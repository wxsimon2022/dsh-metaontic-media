"""博客文章表 `b_posts`。"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT, ENUM, MEDIUMTEXT
from sqlalchemy.orm import relationship

from blog_py.extensions import db
from blog_py.models.post_tags import post_tags


class Post(db.Model):
    __tablename__ = "b_posts"
    __table_args__ = (
        sa.Index("idx_b_posts_status_published", "status", "published_at"),
        sa.Index("ft_b_posts_title_excerpt", "title", "excerpt", mysql_prefix="FULLTEXT"),
    )

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    user_id = db.Column(
        BIGINT(unsigned=True),
        sa.ForeignKey("b_users.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    category_id = db.Column(
        BIGINT(unsigned=True),
        sa.ForeignKey("b_categories.id", ondelete="SET NULL", onupdate="CASCADE"),
    )
    title = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), nullable=False, unique=True)
    excerpt = db.Column(db.String(512))
    body = db.Column(MEDIUMTEXT, nullable=False)
    cover_image_url = db.Column(db.String(512))
    meta_title = db.Column(db.String(255))
    meta_description = db.Column(db.String(512))
    status = db.Column(
        ENUM("draft", "published", "archived", name="b_post_status"),
        nullable=False,
        server_default="draft",
    )
    published_at = db.Column(db.DateTime(3))
    view_count = db.Column(BIGINT(unsigned=True), nullable=False, default=0)
    created_at = db.Column(db.DateTime(3), server_default=sa.text("CURRENT_TIMESTAMP(3)"), nullable=False)
    updated_at = db.Column(
        db.DateTime(3),
        server_default=sa.text("CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)"),
        nullable=False,
    )

    author = relationship("User", back_populates="posts")
    category = relationship("Category", back_populates="posts")
    tags = relationship("Tag", secondary=post_tags, back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete")
