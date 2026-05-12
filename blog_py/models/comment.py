"""评论表 `b_comments`。"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT, ENUM, VARBINARY
from sqlalchemy.orm import relationship

from blog_py.extensions import db


class Comment(db.Model):
    __tablename__ = "b_comments"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    post_id = db.Column(
        BIGINT(unsigned=True),
        sa.ForeignKey("b_posts.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    parent_id = db.Column(
        BIGINT(unsigned=True),
        sa.ForeignKey("b_comments.id", ondelete="CASCADE", onupdate="CASCADE"),
    )
    author_name = db.Column(db.String(128), nullable=False)
    author_email = db.Column(db.String(255))
    author_url = db.Column(db.String(512))
    body = db.Column(db.Text, nullable=False)
    status = db.Column(
        ENUM("pending", "approved", "spam", "rejected", name="b_comment_status"),
        nullable=False,
        server_default="pending",
    )
    ip_address = db.Column(VARBINARY(16))
    user_agent = db.Column(db.String(512))
    created_at = db.Column(db.DateTime(3), server_default=sa.text("CURRENT_TIMESTAMP(3)"), nullable=False)

    post = relationship("Post", back_populates="comments")
    parent = relationship("Comment", remote_side=[id], back_populates="replies")
    replies = relationship("Comment", back_populates="parent")
