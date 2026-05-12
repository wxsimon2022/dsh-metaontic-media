import os

from blog_py.env_load import load_dotenv_files

load_dotenv_files()

from blog_py import app


def _listen_host() -> str:
    h = (
        (os.environ.get("BLOG_HOST") or "").strip()
        or (os.environ.get("FLASK_RUN_HOST") or "").strip()
        or "127.0.0.1"
    )
    return h or "127.0.0.1"


def _listen_port() -> int:
    for key in ("BLOG_PORT", "PORT", "FLASK_RUN_PORT"):
        raw = (os.environ.get(key) or "").strip()
        if not raw:
            continue
        try:
            p = int(raw)
            if 1 <= p <= 65535:
                return p
        except ValueError:
            continue
    return 5001


def _debug_enabled() -> bool:
    bd = (os.environ.get("BLOG_DEBUG") or "").strip().lower()
    if bd in ("0", "false", "no", "off"):
        return False
    if bd in ("1", "true", "yes", "on"):
        return True
    return os.environ.get("FLASK_DEBUG", "1") not in ("0", "", "false", "False", "no")


if __name__ == "__main__":
    host = _listen_host()
    port = _listen_port()
    debug = _debug_enabled()
    app.run(host=host, port=port, debug=debug)
