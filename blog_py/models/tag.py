"""标签表 `b_tags`。"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from blog_py.extensions import db
from blog_py.models.post_tags import post_tags


class Tag(db.Model):
    __tablename__ = "b_tags"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    name = db.Column(db.String(64), nullable=False, unique=True)
    slug = db.Column(db.String(64), nullable=False, unique=True)
    created_at = db.Column(db.DateTime(3), server_default=sa.text("CURRENT_TIMESTAMP(3)"), nullable=False)

    posts = relationship("Post", secondary=post_tags, back_populates="tags")
