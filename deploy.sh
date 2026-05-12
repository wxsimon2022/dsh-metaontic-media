#!/usr/bin/env bash
# 将本仓库同步到远程服务器并在目标目录安装/更新依赖。
#
# 默认目标：biu@124.223.72.223:/home/biu/blog
#
# 用法：
#   ./deploy.sh              # 同步 + 远程 pip install（不删远端多余文件）
#   ./deploy.sh --delete     # rsync 增加 --delete（镜像本地，慎用）
#
# 环境变量（可选）：
#   DEPLOY_SSH_USER=biu
#   DEPLOY_SSH_HOST=124.223.72.223
#   DEPLOY_SSH_PORT=22
#   DEPLOY_REMOTE_DIR=/home/biu/blog
#   DEPLOY_REMOTE_PYTHON=python3
#   DEPLOY_SKIP_PIP=1        # 只 rsync，不执行 pip
#   DEPLOY_REMOTE_RESTART="sudo systemctl restart blog"   # 部署成功后执行（为空则跳过）
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_USER="${DEPLOY_SSH_USER:-root}"
REMOTE_HOST="${DEPLOY_SSH_HOST:-124.223.72.223}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/home/biu/blog}"
SSH_PORT="${DEPLOY_SSH_PORT:-22}"
REMOTE_PYTHON="${DEPLOY_REMOTE_PYTHON:-python3}"
REMOTE_RESTART="${DEPLOY_REMOTE_RESTART:-}"

RSYNC_DELETE=0
for arg in "$@"; do
  case "$arg" in
    --delete) RSYNC_DELETE=1 ;;
    -h|--help)
      grep '^#' "$0" | grep -v '^#!/' | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

RSYNC_OPTS=(-avz -e "ssh -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new" --mkpath)
if [[ "$RSYNC_DELETE" -eq 1 ]]; then
  RSYNC_OPTS+=(--delete)
fi

EXCLUDES=(
  --exclude='.venv/'
  --exclude='.git/'
  --exclude='__pycache__/'
  --exclude='*.py[cod]'
  #--exclude='.env'
  --exclude='.cursor/'
  --exclude='.DS_Store'
  --exclude='*.swp'
  --exclude='*.egg-info/'
  --exclude='.mypy_cache/'
  --exclude='.pytest_cache/'
  --exclude='.ruff_cache/'
)

DEST="${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> rsync 同步到 ${DEST}"
rsync "${RSYNC_OPTS[@]}" "${EXCLUDES[@]}" "${ROOT}/" "${DEST}"

if [[ "${DEPLOY_SKIP_PIP:-}" == "1" ]]; then
  echo "==> 已设置 DEPLOY_SKIP_PIP=1，跳过远程 pip"
else
  echo "==> 远程：venv + pip install -r requirements.txt"
  ssh -p "${SSH_PORT}" -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" \
    REMOTE_DIR="${REMOTE_DIR}" \
    REMOTE_PYTHON="${REMOTE_PYTHON}" \
    bash -s <<'REMOTE_EOF'
set -euo pipefail
cd "${REMOTE_DIR}"
if [[ ! -d .venv ]]; then
  "${REMOTE_PYTHON}" -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
python -m pip install -U pip wheel >/dev/null
pip install -r requirements.txt
echo "==> 远程依赖已更新（Python: $(python -V 2>&1)）"
REMOTE_EOF
fi

if [[ -n "${REMOTE_RESTART}" ]]; then
  echo "==> 远程重启: ${REMOTE_RESTART}"
  ssh -p "${SSH_PORT}" -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" \
    "bash -lc $(printf '%q' "${REMOTE_RESTART}")"
fi

echo "==> 完成。请在服务器上自行维护 ${REMOTE_DIR}/.env（勿从本机同步 .env）。"
