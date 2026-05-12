from __future__ import annotations

import re
import secrets

from sqlalchemy import or_

from blog_py.extensions import db
from blog_py.models import Tag


def slugify_text(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^\w\-]+", "-", s, flags=re.ASCII)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    if s:
        return s[:250]
    return "post-" + secrets.token_hex(4)


def ensure_unique_post_slug(base: str, exclude_post_id: int | None = None) -> str:
    from blog_py.models import Post

    slug = base[:255]
    candidate = slug
    n = 2
    while True:
        q = Post.query.filter_by(slug=candidate)
        if exclude_post_id is not None:
            q = q.filter(Post.id != exclude_post_id)
        if not q.first():
            return candidate
        suffix = f"-{n}"
        candidate = (slug[: 255 - len(suffix)] + suffix)[:255]
        n += 1


def get_or_create_tags(tag_line: str) -> list[Tag]:
    """逗号分隔的标签名；slug 由小写名简化生成。"""
    out: list[Tag] = []
    for raw in tag_line.split(","):
        name = raw.strip()
        if not name:
            continue
        slug = slugify_text(name)
        if slug.startswith("post-") and len(name) > 1:
            slug = slugify_text(re.sub(r"\s+", "-", name.lower()))[:64] or slug
        tag = Tag.query.filter(or_(Tag.slug == slug, Tag.name == name)).first()
        if not tag:
            tag = Tag(name=name[:64], slug=slug[:64])
            db.session.add(tag)
            db.session.flush()
        out.append(tag)
    return out
