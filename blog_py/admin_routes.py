from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, flash, redirect, render_template, request, url_for

from blog_py.auth import authenticate, current_user, hash_password, login_required, login_user, logout_user
from blog_py.extensions import db
from blog_py.models import Category, Comment, Post
from blog_py import redis_likes as likes
from blog_py.utils import ensure_unique_post_slug, get_or_create_tags, slugify_text

bp = Blueprint("blog_admin", __name__, url_prefix="/admin")


def _naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _safe_next(target: str | None) -> str:
    if not target:
        return url_for("blog.index")
    t = target.strip()
    # 仅允许站内相对路径，禁止 // 开头的开放重定向
    if t.startswith("/") and not t.startswith("//") and "\n" not in t and "\r" not in t:
        return t
    return url_for("blog.index")


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        user = authenticate(username, password)
        if user:
            login_user(user)
            nxt = request.args.get("next") or (request.form.get("next") or "").strip() or None
            return redirect(_safe_next(nxt))
        flash("用户名或密码错误。", "error")
    return render_template("blog/admin_login.html")


@bp.route("/logout", methods=["POST"])
def logout():
    logout_user()
    return redirect(url_for("blog.index"))


@bp.route("/")
@login_required
def dashboard():
    return redirect(url_for("blog_admin.posts"))


@bp.route("/posts")
@login_required
def posts():
    status = request.args.get("status", "all")
    q = Post.query.order_by(Post.updated_at.desc())
    if status == "published":
        q = q.filter(Post.status == "published")
    elif status == "draft":
        q = q.filter(Post.status == "draft")
    elif status == "archived":
        q = q.filter(Post.status == "archived")
    posts_list = q.limit(200).all()
    ids = [p.id for p in posts_list]
    like_counts = likes.get_like_counts(ids)
    view_counts = likes.get_view_counts(ids)
    return render_template(
        "blog/admin_posts.html",
        posts=posts_list,
        filter_status=status,
        like_counts=like_counts,
        view_counts=view_counts,
    )


@bp.route("/posts/new", methods=["GET", "POST"])
@login_required
def post_new():
    u = current_user()
    categories = Category.query.order_by(Category.sort_order, Category.id).all()
    if request.method == "POST":
        title = (request.form.get("title") or "").strip()
        slug_raw = (request.form.get("slug") or "").strip()
        excerpt = (request.form.get("excerpt") or "").strip() or None
        body = (request.form.get("body") or "").strip()
        status = (request.form.get("status") or "draft").strip()
        if status not in ("draft", "published", "archived"):
            status = "draft"
        cid = request.form.get("category_id", type=int)
        category_id = cid if cid else None
        tag_line = request.form.get("tags") or ""
        if not title or not body:
            flash("标题与正文必填。", "error")
            return render_template("blog/admin_post_form.html", categories=categories, post=None)
        base_slug = slugify_text(slug_raw) if slug_raw else slugify_text(title)
        slug = ensure_unique_post_slug(base_slug)
        p = Post(
            user_id=u.id,
            category_id=category_id,
            title=title[:255],
            slug=slug,
            excerpt=excerpt[:512] if excerpt else None,
            body=body,
            status=status,
            published_at=_naive_utc_now() if status == "published" else None,
        )
        db.session.add(p)
        db.session.flush()
        p.tags = get_or_create_tags(tag_line)
        db.session.commit()
        if status == "published":
            likes.ensure_zset_entries([p.id])
        flash("文章已创建。", "ok")
        return redirect(url_for("blog_admin.posts"))
    return render_template("blog/admin_post_form.html", categories=categories, post=None)


@bp.route("/posts/<int:post_id>/edit", methods=["GET", "POST"])
@login_required
def post_edit(post_id: int):
    p = db.session.get(Post, post_id)
    if not p:
        flash("文章不存在。", "error")
        return redirect(url_for("blog_admin.posts"))
    categories = Category.query.order_by(Category.sort_order, Category.id).all()
    if request.method == "POST":
        title = (request.form.get("title") or "").strip()
        slug_raw = (request.form.get("slug") or "").strip()
        excerpt = (request.form.get("excerpt") or "").strip() or None
        body = (request.form.get("body") or "").strip()
        status = (request.form.get("status") or "draft").strip()
        if status not in ("draft", "published", "archived"):
            status = "draft"
        cid = request.form.get("category_id", type=int)
        category_id = cid if cid else None
        tag_line = request.form.get("tags") or ""
        if not title or not body:
            flash("标题与正文必填。", "error")
            return render_template("blog/admin_post_form.html", categories=categories, post=p)
        base_slug = slugify_text(slug_raw) if slug_raw else slugify_text(title)
        if base_slug != p.slug:
            slug = ensure_unique_post_slug(base_slug, exclude_post_id=p.id)
            p.slug = slug
        p.title = title[:255]
        p.excerpt = excerpt[:512] if excerpt else None
        p.body = body
        p.category_id = category_id
        old_status = p.status
        p.status = status
        if status == "published" and (p.published_at is None or old_status != "published"):
            p.published_at = _naive_utc_now()
        p.tags = get_or_create_tags(tag_line)
        db.session.commit()
        if old_status == "published" and p.status != "published":
            likes.remove_post(p.id)
        elif p.status == "published":
            likes.ensure_zset_entries([p.id])
        flash("已保存。", "ok")
        return redirect(url_for("blog_admin.posts"))
    return render_template("blog/admin_post_form.html", categories=categories, post=p)


@bp.route("/posts/<int:post_id>/delete", methods=["POST"])
@login_required
def post_delete(post_id: int):
    p = db.session.get(Post, post_id)
    if p:
        likes.purge_post_redis(p.id)
        db.session.delete(p)
        db.session.commit()
        flash("已删除。", "ok")
    return redirect(url_for("blog_admin.posts"))


@bp.route("/comments")
@login_required
def comments():
    status = request.args.get("status", "pending")
    q = Comment.query.order_by(Comment.created_at.desc())
    if status != "all":
        q = q.filter(Comment.status == status)
    rows = q.limit(200).all()
    return render_template("blog/admin_comments.html", comments=rows, filter_status=status)


@bp.route("/comments/<int:cid>/approve", methods=["POST"])
@login_required
def comment_approve(cid: int):
    c = db.session.get(Comment, cid)
    if c:
        c.status = "approved"
        db.session.commit()
    return redirect(url_for("blog_admin.comments"))


@bp.route("/comments/<int:cid>/spam", methods=["POST"])
@login_required
def comment_spam(cid: int):
    c = db.session.get(Comment, cid)
    if c:
        c.status = "spam"
        db.session.commit()
    return redirect(url_for("blog_admin.comments"))


@bp.route("/comments/<int:cid>/reject", methods=["POST"])
@login_required
def comment_reject(cid: int):
    c = db.session.get(Comment, cid)
    if c:
        c.status = "rejected"
        db.session.commit()
    return redirect(url_for("blog_admin.comments"))


@bp.route("/password", methods=["GET", "POST"])
@login_required
def change_password():
    if request.method == "POST":
        old = request.form.get("old_password") or ""
        new = request.form.get("new_password") or ""
        u = current_user()
        if not u or not authenticate(u.username, old):
            flash("当前密码不正确。", "error")
        elif len(new) < 6:
            flash("新密码至少 6 位。", "error")
        else:
            u.password_hash = hash_password(new)
            db.session.commit()
            flash("密码已更新。", "ok")
            return redirect(url_for("blog_admin.posts"))
    return render_template("blog/admin_password.html")
