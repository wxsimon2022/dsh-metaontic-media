from __future__ import annotations

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from markdown import markdown
from markupsafe import Markup

from blog_py import redis_likes as likes
from blog_py.auth import pack_ip
from blog_py.extensions import db
from blog_py.models import Category, Comment, Post, Tag

bp = Blueprint("blog", __name__)


def _published_posts_query():
    return Post.query.filter(Post.status == "published", Post.published_at.isnot(None))


@bp.app_template_filter("render_md")
def render_md(text: str | None) -> Markup:
    if not text:
        return Markup("")
    html = markdown(
        text,
        extensions=["fenced_code", "tables", "nl2br"],
        output_format="html",
    )
    return Markup(html)


def current_app_posts_per_page() -> int:
    from flask import current_app

    try:
        n = int(current_app.config.get("POSTS_PER_PAGE", 10))
    except (TypeError, ValueError):
        n = 10
    return max(1, min(n, 100))


def _coerce_page() -> int:
    p = request.args.get("page", 1, type=int)
    if p is None:
        return 1
    return max(1, p)


def _like_counts_for_posts(posts: list) -> dict[int, int]:
    if not posts:
        return {}
    return likes.get_like_counts([p.id for p in posts])


def _view_counts_for_posts(posts: list) -> dict[int, int]:
    if not posts:
        return {}
    return likes.get_view_counts([p.id for p in posts])


@bp.route("/")
def index():
    page = _coerce_page()
    per_page = current_app_posts_per_page()
    pagination = likes.paginate_posts_by_likes(_published_posts_query(), page, per_page)
    if page != pagination.page:
        return redirect(url_for("blog.index", page=pagination.page))
    like_counts = _like_counts_for_posts(pagination.items)
    view_counts = _view_counts_for_posts(pagination.items)
    return render_template(
        "blog/index.html",
        pagination=pagination,
        like_counts=like_counts,
        view_counts=view_counts,
    )


@bp.route("/post/<slug>")
def post_detail(slug: str):
    post = Post.query.filter_by(slug=slug).first_or_404()
    if post.status != "published" or post.published_at is None:
        abort(404)
    view_count = likes.increment_post_views(post.id)
    likes.ensure_zset_entries([post.id])
    like_count = likes.get_like_count(post.id)
    comments = (
        Comment.query.filter_by(post_id=post.id, status="approved", parent_id=None)
        .order_by(Comment.created_at.asc())
        .all()
    )
    open_comment_form = request.args.get("comment") == "1"
    return render_template(
        "blog/post.html",
        post=post,
        comments=comments,
        like_count=like_count,
        view_count=view_count,
        open_comment_form=open_comment_form,
    )


@bp.post("/post/<slug>/like")
def post_like(slug: str):
    post = Post.query.filter_by(slug=slug).first_or_404()
    if post.status != "published" or post.published_at is None:
        abort(404)
    n = likes.add_like(post.id)
    if n > 0:
        flash(f"已点赞，当前共 {n} 赞。", "ok")
    else:
        flash("点赞失败：请确认 Redis 已启动且 REDIS_URL 配置正确。", "error")
    next_raw = (request.form.get("next") or "").strip()
    if next_raw.startswith("/") and not next_raw.startswith("//"):
        return redirect(next_raw)
    return redirect(url_for("blog.post_detail", slug=slug))


@bp.route("/post/<slug>/comment", methods=["POST"])
def post_comment(slug: str):
    post = Post.query.filter_by(slug=slug).first_or_404()
    if post.status != "published":
        abort(404)
    name = (request.form.get("author_name") or "").strip()
    body = (request.form.get("body") or "").strip()
    email = (request.form.get("author_email") or "").strip() or None
    url = (request.form.get("author_url") or "").strip() or None
    if not name or not body:
        flash("请填写昵称与评论内容。", "error")
        return redirect(url_for("blog.post_detail", slug=slug, comment=1))
    c = Comment(
        post_id=post.id,
        author_name=name[:128],
        author_email=email[:255] if email else None,
        author_url=url[:512] if url else None,
        body=body[:20000],
        status="pending",
        ip_address=pack_ip(request.remote_addr),
        user_agent=(request.headers.get("User-Agent") or "")[:512],
    )
    db.session.add(c)
    db.session.commit()
    flash("评论已提交，待审核后显示。", "ok")
    return redirect(url_for("blog.post_detail", slug=slug))


@bp.route("/category/<slug>")
def category_posts(slug: str):
    cat = Category.query.filter_by(slug=slug).first_or_404()
    page = _coerce_page()
    per_page = current_app_posts_per_page()
    q = _published_posts_query().filter(Post.category_id == cat.id)
    pagination = likes.paginate_posts_by_likes(q, page, per_page)
    if page != pagination.page:
        return redirect(url_for("blog.category_posts", slug=slug, page=pagination.page))
    like_counts = _like_counts_for_posts(pagination.items)
    view_counts = _view_counts_for_posts(pagination.items)
    return render_template(
        "blog/category.html",
        category=cat,
        pagination=pagination,
        like_counts=like_counts,
        view_counts=view_counts,
    )


@bp.route("/tag/<slug>")
def tag_posts(slug: str):
    tag = Tag.query.filter_by(slug=slug).first_or_404()
    page = _coerce_page()
    per_page = current_app_posts_per_page()
    q = _published_posts_query().join(Post.tags).filter(Tag.id == tag.id)
    pagination = likes.paginate_posts_by_likes(q, page, per_page)
    if page != pagination.page:
        return redirect(url_for("blog.tag_posts", slug=slug, page=pagination.page))
    like_counts = _like_counts_for_posts(pagination.items)
    view_counts = _view_counts_for_posts(pagination.items)
    return render_template(
        "blog/tag.html",
        tag=tag,
        pagination=pagination,
        like_counts=like_counts,
        view_counts=view_counts,
    )
