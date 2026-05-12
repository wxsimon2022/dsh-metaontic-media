-- 个人博客系统 · MySQL 5.7+ / 8.x 逻辑模型
-- 业务表统一前缀 b_（blog）
-- 字符集 utf8mb4，InnoDB，外键约束
-- 使用: mysql -u root -p < schema.sql
--
-- 5.7 说明：需 InnoDB；DATETIME(3) 与双列 DEFAULT CURRENT_TIMESTAMP 需 MySQL 5.6.5+。
-- InnoDB FULLTEXT 自 5.6 起支持。若 sql_mode 含 NO_ZERO_DATE 等，请按业务自行调整。

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS personal_blog
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE personal_blog;

-- ---------------------------------------------------------------------------
-- 用户（个人博客通常 1 名管理员；表结构保留多用户扩展）
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS b_comments;
DROP TABLE IF EXISTS b_post_tags;
DROP TABLE IF EXISTS b_posts;
DROP TABLE IF EXISTS b_tags;
DROP TABLE IF EXISTS b_categories;
DROP TABLE IF EXISTS b_users;

CREATE TABLE b_users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(64)  NOT NULL COMMENT '登录名',
  email         VARCHAR(255) NOT NULL COMMENT '邮箱',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希（应用层 bcrypt 等）',
  display_name  VARCHAR(128) NOT NULL DEFAULT '' COMMENT '展示昵称',
  avatar_url    VARCHAR(512) NULL,
  bio           TEXT NULL COMMENT '作者简介',
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_b_users_username (username),
  UNIQUE KEY uk_b_users_email (email)
) ENGINE=InnoDB COMMENT='博主/管理员';

-- ---------------------------------------------------------------------------
-- 分类（树形可选：parent_id）
-- ---------------------------------------------------------------------------
CREATE TABLE b_categories (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id   BIGINT UNSIGNED NULL COMMENT '父分类，顶级为 NULL',
  name        VARCHAR(128) NOT NULL,
  slug        VARCHAR(128) NOT NULL COMMENT 'URL 段，唯一',
  description VARCHAR(512) NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_b_categories_slug (slug),
  KEY idx_b_categories_parent (parent_id),
  CONSTRAINT fk_b_categories_parent
    FOREIGN KEY (parent_id) REFERENCES b_categories (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='文章分类';

-- ---------------------------------------------------------------------------
-- 文章
-- ---------------------------------------------------------------------------
CREATE TABLE b_posts (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id            BIGINT UNSIGNED NOT NULL COMMENT '作者',
  category_id        BIGINT UNSIGNED NULL,
  title              VARCHAR(255) NOT NULL,
  slug               VARCHAR(255) NOT NULL COMMENT 'URL 友好唯一键',
  excerpt            VARCHAR(512) NULL COMMENT '摘要',
  body               MEDIUMTEXT NOT NULL COMMENT '正文（HTML/Markdown 由应用约定）',
  cover_image_url    VARCHAR(512) NULL,
  meta_title         VARCHAR(255) NULL COMMENT 'SEO 标题，默认可同 title',
  meta_description   VARCHAR(512) NULL,
  status             ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at       DATETIME(3) NULL COMMENT '首次/当前发布时间',
  view_count         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_b_posts_slug (slug),
  KEY idx_b_posts_user (user_id),
  KEY idx_b_posts_category (category_id),
  KEY idx_b_posts_status_published (status, published_at),
  FULLTEXT KEY ft_b_posts_title_excerpt (title, excerpt),
  CONSTRAINT fk_b_posts_user
    FOREIGN KEY (user_id) REFERENCES b_users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_b_posts_category
    FOREIGN KEY (category_id) REFERENCES b_categories (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='博客文章';

-- ---------------------------------------------------------------------------
-- 标签（多对多）
-- ---------------------------------------------------------------------------
CREATE TABLE b_tags (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(64) NOT NULL,
  slug       VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_b_tags_slug (slug),
  UNIQUE KEY uk_b_tags_name (name)
) ENGINE=InnoDB COMMENT='标签';

CREATE TABLE b_post_tags (
  post_id BIGINT UNSIGNED NOT NULL,
  tag_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  KEY idx_b_post_tags_tag (tag_id),
  CONSTRAINT fk_b_post_tags_post
    FOREIGN KEY (post_id) REFERENCES b_posts (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_b_post_tags_tag
    FOREIGN KEY (tag_id) REFERENCES b_tags (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='文章-标签关联';

-- ---------------------------------------------------------------------------
-- 评论（可选审核；支持楼中楼 parent_id）
-- ---------------------------------------------------------------------------
CREATE TABLE b_comments (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id      BIGINT UNSIGNED NOT NULL,
  parent_id    BIGINT UNSIGNED NULL COMMENT '回复某条评论',
  author_name  VARCHAR(128) NOT NULL,
  author_email VARCHAR(255) NULL,
  author_url   VARCHAR(512) NULL,
  body         TEXT NOT NULL,
  status       ENUM('pending','approved','spam','rejected') NOT NULL DEFAULT 'pending',
  ip_address   VARBINARY(16) NULL COMMENT 'IPv4/IPv6 二进制，便于索引',
  user_agent   VARCHAR(512) NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_b_comments_post (post_id, status, created_at),
  KEY idx_b_comments_parent (parent_id),
  CONSTRAINT fk_b_comments_post
    FOREIGN KEY (post_id) REFERENCES b_posts (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_b_comments_parent
    FOREIGN KEY (parent_id) REFERENCES b_comments (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='读者评论';

SET FOREIGN_KEY_CHECKS = 1;
