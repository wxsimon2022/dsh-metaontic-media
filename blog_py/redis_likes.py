"""文章点赞：Redis ZSET；阅读数：Redis HASH。列表按赞数排序，同赞按发布时间倒序。"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Sequence

import redis
from redis.exceptions import RedisError

LIKES_ZSET_KEY = os.environ.get("REDIS_BLOG_LIKES_KEY", "b:post:likes")
VIEWS_HASH_KEY = os.environ.get("REDIS_BLOG_VIEWS_KEY", "b:post:views")


def _redis_client() -> redis.Redis | None:
    url = (os.environ.get("REDIS_URL") or "").strip()
    if url:
        return redis.from_url(url, decode_responses=True)
    host = os.environ.get("REDIS_HOST", "127.0.0.1").strip()
    port = int(os.environ.get("REDIS_PORT", "6379"))
    db = int(os.environ.get("REDIS_DB", "0"))
    password = (os.environ.get("REDIS_PASSWORD") or "").strip() or None
    return redis.Redis(host=host, port=port, db=db, password=password, decode_responses=True)


def ensure_zset_entries(post_ids: Sequence[int]) -> None:
    """保证文章 id 在 ZSET 中存在，初始 0 赞（不覆盖已有分数）。"""
    r = _redis_client()
    if not r or not post_ids:
        return
    try:
        mapping = {str(pid): 0.0 for pid in post_ids}
        r.zadd(LIKES_ZSET_KEY, mapping, nx=True)
    except RedisError:
        pass


def get_like_counts(post_ids: Sequence[int]) -> dict[int, int]:
    """批量读取点赞数；Redis 不可用时全为 0。"""
    if not post_ids:
        return {}
    r = _redis_client()
    if not r:
        return {int(pid): 0 for pid in post_ids}
    try:
        pipe = r.pipeline()
        for pid in post_ids:
            pipe.zscore(LIKES_ZSET_KEY, str(pid))
        vals = pipe.execute()
        return {int(pid): int(float(v)) if v is not None else 0 for pid, v in zip(post_ids, vals)}
    except RedisError:
        return {int(pid): 0 for pid in post_ids}


def get_like_count(post_id: int) -> int:
    return get_like_counts([post_id]).get(post_id, 0)


def add_like(post_id: int) -> int:
    """+1 赞，返回当前总赞数。"""
    r = _redis_client()
    if not r:
        return 0
    try:
        ensure_zset_entries([post_id])
        return int(float(r.zincrby(LIKES_ZSET_KEY, 1, str(post_id))))
    except RedisError:
        return 0


def remove_post(post_id: int) -> None:
    """文章删除或取消发布时从排行 ZSET 移除。"""
    r = _redis_client()
    if not r:
        return
    try:
        r.zrem(LIKES_ZSET_KEY, str(post_id))
    except RedisError:
        pass


def increment_post_views(post_id: int) -> int:
    """详情页每次请求 +1，返回当前阅读总数。Redis 不可用时返回 0。"""
    r = _redis_client()
    if not r:
        return 0
    try:
        return int(r.hincrby(VIEWS_HASH_KEY, str(post_id), 1))
    except RedisError:
        return 0


def get_view_counts(post_ids: Sequence[int]) -> dict[int, int]:
    if not post_ids:
        return {}
    r = _redis_client()
    if not r:
        return {int(pid): 0 for pid in post_ids}
    try:
        pipe = r.pipeline()
        for pid in post_ids:
            pipe.hget(VIEWS_HASH_KEY, str(pid))
        vals = pipe.execute()
        out: dict[int, int] = {}
        for pid, v in zip(post_ids, vals):
            out[int(pid)] = int(v) if v is not None else 0
        return out
    except RedisError:
        return {int(pid): 0 for pid in post_ids}


def purge_post_redis(post_id: int) -> None:
    """删除文章时移除点赞 ZSET 与阅读 HASH 字段。"""
    remove_post(post_id)
    r = _redis_client()
    if not r:
        return
    try:
        r.hdel(VIEWS_HASH_KEY, str(post_id))
    except RedisError:
        pass


@dataclass
class LikesSortedPagination:
    """与 Flask-SQLAlchemy Pagination 列表页常用属性兼容。"""

    items: list
    page: int
    per_page: int
    total: int

    def __post_init__(self) -> None:
        if self.total > 0:
            self.pages = max(1, math.ceil(self.total / self.per_page))
        else:
            self.pages = 1

    @property
    def has_prev(self) -> bool:
        return self.page > 1

    @property
    def has_next(self) -> bool:
        return self.page < self.pages

    @property
    def prev_num(self) -> int | None:
        return self.page - 1 if self.has_prev else None

    @property
    def next_num(self) -> int | None:
        return self.page + 1 if self.has_next else None


def paginate_posts_by_likes(base_query, page: int, per_page: int) -> LikesSortedPagination:
    """
    base_query：已限定为「已发布」等条件的 Post 查询（可含 join）。
    先取 id 列表，再按 Redis 赞数 + 发布时间排序后分页。
    """
    from blog_py.models import Post

    id_rows = base_query.with_entities(Post.id).distinct().all()
    ids = [row[0] for row in id_rows]
    total = len(ids)
    if total == 0:
        return LikesSortedPagination([], 1, per_page, 0)

    max_page = max(1, math.ceil(total / per_page))
    page = min(max(1, page), max_page)

    meta_rows = Post.query.filter(Post.id.in_(ids)).with_entities(Post.id, Post.published_at).all()
    published_at = {r.id: r.published_at for r in meta_rows}

    ensure_zset_entries(ids)
    scores = get_like_counts(ids)

    def sort_key(pid: int) -> tuple:
        ts = published_at[pid].timestamp() if published_at.get(pid) else 0.0
        return (-scores.get(pid, 0), -ts)

    sorted_ids = sorted(ids, key=sort_key)
    start = (page - 1) * per_page
    slice_ids = sorted_ids[start : start + per_page]

    posts = Post.query.filter(Post.id.in_(slice_ids)).all()
    order = {pid: i for i, pid in enumerate(slice_ids)}
    posts.sort(key=lambda p: order.get(p.id, 999999))
    return LikesSortedPagination(posts, page, per_page, total)
