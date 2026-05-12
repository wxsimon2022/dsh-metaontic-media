import os
from urllib.parse import urlsplit, urlunsplit


def mask_database_uri(uri: str) -> str:
    """日志/终端展示用，隐藏密码。"""
    if not uri:
        return "(未配置)"
    try:
        p = urlsplit(uri)
        if p.username is not None:
            port = f":{p.port}" if p.port else ""
            netloc = f"{p.username}:***@{p.hostname or ''}{port}"
            return urlunsplit((p.scheme, netloc, p.path, p.query, p.fragment))
    except Exception:
        pass
    return uri


def _database_uri() -> str:
    """优先 DATABASE_URL / SQLALCHEMY_DATABASE_URI，否则用 MYSQL_* 分项拼接。"""
    uri = (os.environ.get("DATABASE_URL") or os.environ.get("SQLALCHEMY_DATABASE_URI") or "").strip()
    if uri:
        return uri
    host = (os.environ.get("MYSQL_HOST") or "").strip()
    if host:
        user = (os.environ.get("MYSQL_USER") or "root").strip()
        password = (os.environ.get("MYSQL_PASSWORD") or "").strip()
        port = (os.environ.get("MYSQL_PORT") or "3306").strip()
        name = (os.environ.get("MYSQL_DATABASE") or "personal_blog").strip()
        auth = f"{user}:{password}@" if password else f"{user}@"
        return f"mysql+pymysql://{auth}{host}:{port}/{name}?charset=utf8mb4"
    # 本地开发兜底；生产环境请在 .env 中设置 DATABASE_URL 或 MYSQL_*。
    return "mysql+pymysql://root@127.0.0.1:3306/personal_blog?charset=utf8mb4"


def _posts_per_page() -> int:
    try:
        n = int(os.environ.get("POSTS_PER_PAGE", "10"))
    except ValueError:
        n = 10
    return max(1, min(n, 100))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-blog-secret-change-me")
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }
    POSTS_PER_PAGE = _posts_per_page()
