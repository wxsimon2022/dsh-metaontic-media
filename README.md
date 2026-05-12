# demo

个人博客（Flask + MySQL + SQLAlchemy），文章列表按 **Redis** 中记录的点赞数排序（同赞数按发布时间从新到旧）；**阅读数**亦存于 Redis，每次打开已发布文章详情页计一次。配置通过项目根目录的 **`.env`** 加载（模板见 **`env.example`**）。

## 环境要求

- Python 3.11+（建议使用仓库内 `.venv`）
- MySQL **5.7+**（博客；推荐 5.7 / 8.0，与 `blog_mysql/schema.sql` 一致）
- Redis（文章点赞与首页/分类/标签列表排序）

## 快速开始

在项目根目录执行：

```bash
cd /path/to/demo
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp env.example .env
```

编辑 **`.env`**：

- **博客**：设置 `DATABASE_URL`（或 `SQLALCHEMY_DATABASE_URI`），或使用 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE` 等分项。
- **点赞 / 阅读**：设置 `REDIS_URL`（或 `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` / `REDIS_PASSWORD`）。可选 `REDIS_BLOG_LIKES_KEY`（点赞 ZSET）、`REDIS_BLOG_VIEWS_KEY`（阅读数 HASH，默认 `b:post:views`）。

首次初始化博客数据库表与管理员账号：

```bash
flask --app blog_py init-db
```

若命令退出码非 0，终端会打印**脱敏后的数据库连接串**与简要排查项。常见原因：

- **连不上主机**：`.env` 里 `DATABASE_URL` 指向的 IP/域名不可达（本机未联网、云库安全组未放行本机 IP、VPN 等）。
- **MySQL 未监听或端口错**：确认服务已启动，端口与 URL 一致。
- **账号/密码/库名错误**：或尚未创建库 `personal_blog`（可先执行 `blog_mysql/schema.sql` 建库建表，再执行 `init-db` 仅补管理员；或删表后仅用 ORM `create_all`）。

默认管理员：`admin`，密码由环境变量 `BLOG_ADMIN_PASSWORD` 指定（未设置时为 `admin123`）。生产环境请务必修改。

## 启动方式

| 应用 | 命令 | 默认地址 |
|------|------|----------|
| 个人博客 | `python -m blog_py` | http://127.0.0.1:5001/ |

端口与监听地址在 **`.env`** 中配置：`BLOG_PORT`（优先，其次 `PORT`、`FLASK_RUN_PORT`，默认 `5001`）、`BLOG_HOST`（可选，其次 `FLASK_RUN_HOST`）。调试开关：`BLOG_DEBUG` 或 `FLASK_DEBUG`。

后台入口：**http://127.0.0.1:5001/admin/login**（博客端口以你本地 `.env` 为准）。

## 目录说明

| 路径 | 说明 |
|------|------|
| `blog_py/` | 博客 Flask 应用（前台、后台、模板、Redis 点赞） |
| `blog_mysql/schema.sql` | MySQL 表结构（业务表统一前缀 `b_`，可与 ORM 对照） |
| `blog_mysql/migrate_rename_to_b_prefix.sql` | 旧库表名改为 `b_*` 的一次性迁移（执行前请备份） |
| `blog_mysql/seed.sql` | 示例数据（可选） |
| `env.example` | 环境变量模板，复制为 `.env` |

## 配置说明摘要

- 应用启动时会通过 `blog_py/env_load.py` 加载项目根目录下的 **`.env`**。
- 数据库 URI 优先级：`DATABASE_URL` → `SQLALCHEMY_DATABASE_URI` → `MYSQL_*` 拼接；若均未配置，博客会使用本地开发默认连接（仅适合本机联调，**生产必须在 `.env` 中显式配置**）。
- Redis：`REDIS_URL` 优先；否则使用 `REDIS_HOST` 等分项。文章点赞使用 ZSET（键名见 `REDIS_BLOG_LIKES_KEY`）；阅读数使用 HASH 字段（键名见 `REDIS_BLOG_VIEWS_KEY`，默认 `b:post:views`）。

更完整的变量列表见 **`env.example`**。

## 安全提示

- 不要将 **`.env`** 提交到版本库（仓库 `.gitignore` 已忽略）。
- 生产环境请设置强随机 `SECRET_KEY`，并修改默认管理员密码。
