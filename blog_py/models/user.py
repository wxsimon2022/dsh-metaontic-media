"""博主 / 管理员表 `b_users`。"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import relationship

from blog_py.extensions import db


class User(db.Model):
    __tablename__ = "b_users"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    username = db.Column(db.String(64), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(128), nullable=False, default="")
    avatar_url = db.Column(db.String(512))
    bio = db.Column(db.Text)
    created_at = db.Column(db.DateTime(3), server_default=sa.text("CURRENT_TIMESTAMP(3)"), nullable=False)
    updated_at = db.Column(
        db.DateTime(3),
        server_default=sa.text("CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)"),
        nullable=False,
    )

    posts = relationship("Post", back_populates="author")
