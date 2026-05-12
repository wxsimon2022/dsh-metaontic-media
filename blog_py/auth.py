from __future__ import annotations

import functools
import ipaddress

from flask import g, redirect, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from blog_py.extensions import db
from blog_py.models import User


def _login_redirect_target() -> str:
    """登录后跳回当前浏览位置（含 ?page= 等查询串），长度做截断。"""
    q = request.query_string.decode("utf-8") if request.query_string else ""
    path = request.path or "/"
    out = f"{path}?{q}" if q else path
    return out[:2048]


def login_required(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("blog_admin.login", next=_login_redirect_target()))
        return view(*args, **kwargs)

    return wrapped


def current_user() -> User | None:
    uid = session.get("user_id")
    if not uid:
        return None
    if getattr(g, "_blog_user", None) is None or g._blog_user.id != uid:
        g._blog_user = db.session.get(User, uid)
    return g._blog_user


def verify_password(stored_hash: str, plain_password: str) -> bool:
    """
    校验密码：支持 Werkzeug 生成的哈希（pbkdf2/scrypt 等），以及标准 bcrypt 串。
    数据库里若是非法占位串，不会抛错，仅返回 False。
    """
    h = (stored_hash or "").strip()
    if not h or not plain_password:
        return False
    try:
        if check_password_hash(h, plain_password):
            return True
    except (ValueError, TypeError):
        pass
    if h.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            import bcrypt

            return bcrypt.checkpw(plain_password.encode("utf-8"), h.encode("utf-8"))
        except Exception:
            return False
    return False


def authenticate(username: str, password: str) -> User | None:
    u = User.query.filter_by(username=username).first()
    if u and verify_password(u.password_hash, password):
        return u
    return None


def login_user(user: User) -> None:
    session["user_id"] = user.id
    session.permanent = True


def logout_user() -> None:
    session.pop("user_id", None)
    g.pop("_blog_user", None)


def hash_password(raw: str) -> str:
    return generate_password_hash(raw)


def pack_ip(addr: str | None) -> bytes | None:
    if not addr:
        return None
    try:
        return ipaddress.ip_address(addr).packed
    except ValueError:
        return None
