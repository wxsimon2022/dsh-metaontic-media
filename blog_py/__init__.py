import os

import click
from flask import Flask

from blog_py.env_load import load_dotenv_files

load_dotenv_files()

from blog_py.config import Config
from blog_py.extensions import db


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder=None)
    app.config.from_object(Config)
    db.init_app(app)

    from blog_py import models  # noqa: F401, E402

    from blog_py.admin_routes import bp as admin_bp
    from blog_py.public_routes import bp as public_bp

    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp)

    @app.context_processor
    def inject_globals() -> dict:
        from sqlalchemy.exc import OperationalError

        from blog_py.auth import current_user
        from blog_py.models import Category, Tag

        try:
            categories = Category.query.order_by(Category.sort_order, Category.id).limit(100).all()
            tags = Tag.query.order_by(Tag.name).limit(60).all()
        except OperationalError:
            categories, tags = [], []

        return {
            "categories": categories,
            "tags": tags,
            "current_user": current_user,
        }

    @app.cli.command("init-db")
    def init_db_command() -> None:
        """根据 models 创建表；若 b_users 为空则创建管理员。"""
        from sqlalchemy.exc import OperationalError

        from blog_py.auth import hash_password
        from blog_py.config import mask_database_uri
        from blog_py.models import User

        try:
            db.create_all()
            if User.query.count() == 0:
                pw = os.environ.get("BLOG_ADMIN_PASSWORD", "admin123")
                email = os.environ.get("BLOG_ADMIN_EMAIL", "admin@example.com")
                db.session.add(
                    User(
                        username="admin",
                        email=email,
                        password_hash=hash_password(pw),
                        display_name="博主",
                    )
                )
                db.session.commit()
                click.echo("已创建管理员 admin；默认密码见 BLOG_ADMIN_PASSWORD（未设置则为 admin123）。")
            else:
                click.echo("b_users 表已有数据，跳过管理员创建。")
        except OperationalError as e:
            click.secho("init-db 失败：无法连接或访问 MySQL。", fg="red", err=True)
            click.echo(f"  原因: {e}", err=True)
            click.echo(f"  当前连接: {mask_database_uri(app.config.get('SQLALCHEMY_DATABASE_URI', '') or '')}", err=True)
            click.echo(
                "  请检查: 1) MySQL 已启动且监听正确端口  "
                "2) .env 中 DATABASE_URL（或 MYSQL_*）主机/账号/密码/库名  "
                "3) 本机网络/云安全组/防火墙是否放行  "
                "4) 数据库 personal_blog 已创建（可先执行 blog_mysql/schema.sql）",
                err=True,
            )
            raise SystemExit(1) from e

    return app


app = create_app()
