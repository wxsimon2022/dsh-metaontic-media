"""从项目根目录（`demo/.env`）加载环境变量，需在读取 `os.environ` 的配置之前调用。"""

from __future__ import annotations

from pathlib import Path


def load_dotenv_files() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    root = Path(__file__).resolve().parent.parent
    load_dotenv(root / ".env")
