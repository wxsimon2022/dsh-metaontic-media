-- 示例数据（开发联调用）
-- 需先执行 schema.sql
-- admin 默认密码为 admin123（Werkzeug scrypt，与 blog_py 校验逻辑一致）

USE personal_blog;

INSERT INTO b_users (id, username, email, password_hash, display_name, bio)
VALUES
  (1, 'admin', 'admin@example.com', 'scrypt:32768:8:1$GxplbJVt02Kcz9Wa$933bedb38c4c557ed5e724f6ba19d0a2340afb17d263102ea6124922aab31781b3ba8ecd410f83945f9c6d338ce9dc9e69bd456b47e50d8f819811b1d29a5dce', '博主', '个人博客作者');

INSERT INTO b_categories (id, parent_id, name, slug, description, sort_order)
VALUES
  (1, NULL, '技术', 'tech', '开发与架构', 10),
  (2, NULL, '生活', 'life', '随笔', 20),
  (3, 1, '数据库', 'database', 'MySQL 等', 11);

INSERT INTO b_tags (id, name, slug) VALUES
  (1, 'MySQL', 'mysql'),
  (2, '设计', 'design'),
  (3, '随笔', 'notes');

INSERT INTO b_posts (
  id, user_id, category_id, title, slug, excerpt, body,
  status, published_at, view_count
) VALUES
  (
    1, 1, 1,
    '用 MySQL 设计个人博客库表',
    'mysql-blog-schema-design',
    '从用户、文章、分类、标签到评论的表结构说明。',
    '# 正文示例\n\n这里是 Markdown 或 HTML，由应用层渲染。',
    'published', NOW(3), 128
  ),
  (
    2, 1, 3,
    'InnoDB 外键与索引实践',
    'innodb-fk-index-tips',
    '个人小站上的外键选择与查询索引。',
    '正文占位……',
    'published', DATE_SUB(NOW(3), INTERVAL 3 DAY), 42
  ),
  (
    3, 1, 2,
    '未发布的草稿',
    'draft-sample',
    NULL,
    '草稿内容',
    'draft', NULL, 0
  );

INSERT INTO b_post_tags (post_id, tag_id) VALUES
  (1, 1), (1, 2),
  (2, 1), (2, 2);

INSERT INTO b_comments (post_id, parent_id, author_name, author_email, body, status)
VALUES
  (1, NULL, '读者A', 'a@example.com', '写得很清楚，感谢分享！', 'approved'),
  (1, NULL, '读者B', NULL, '请问评论会做反垃圾吗？', 'pending');
