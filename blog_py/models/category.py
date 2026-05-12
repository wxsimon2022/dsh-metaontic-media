"""文章分类表 `b_categories`（支持 parent_id 树形）。"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from blog_py.extensions import db


class Category(db.Model):
    __tablename__ = "b_categories"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    parent_id = db.Column(
        BIGINT(unsigned=True),
        sa.ForeignKey("b_categories.id", ondelete="SET NULL", onupdate="CASCADE"),
    )
    name = db.Column(db.String(128), nullable=False)
    slug = db.Column(db.String(128), nullable=False, unique=True)
    description = db.Column(db.String(512))
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(3), server_default=sa.text("CURRENT_TIMESTAMP(3)"), nullable=False)

    parent = relationship("Category", remote_side=[id], back_populates="children")
    children = relationship("Category", back_populates="parent")
    posts = relationship("Post", back_populates="category")
