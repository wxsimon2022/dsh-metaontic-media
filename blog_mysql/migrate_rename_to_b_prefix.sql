-- 将旧版无前缀表名改为 b_ 前缀（在仍使用 users / posts / … 的库上执行一次）
-- 执行前请备份数据库。MySQL 5.7+ InnoDB 在 RENAME 时会维护外键引用。
SET FOREIGN_KEY_CHECKS = 0;

RENAME TABLE
  comments TO b_comments,
  post_tags TO b_post_tags,
  posts TO b_posts,
  tags TO b_tags,
  categories TO b_categories,
  users TO b_users;

SET FOREIGN_KEY_CHECKS = 1;
