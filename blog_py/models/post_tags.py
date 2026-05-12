"""文章与标签的多对多关联表 `b_post_tags`。"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT

from blog_py.extensions import db

post_tags = sa.Table(
    "b_post_tags",
    db.metadata,
    sa.Column(
        "post_id",
        BIGINT(unsigned=True),
        sa.ForeignKey("b_posts.id", ondelete="CASCADE", onupdate="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "tag_id",
        BIGINT(unsigned=True),
        sa.ForeignKey("b_tags.id", ondelete="CASCADE", onupdate="CASCADE"),
        primary_key=True,
    ),
    mysql_charset="utf8mb4",
)
