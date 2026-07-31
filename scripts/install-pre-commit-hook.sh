#!/usr/bin/env bash
# ============================================================================
# install-pre-commit-hook.sh — 安装提交前安全检查 Git 钩子
#
# 用法: sh scripts/install-pre-commit-hook.sh
#
# 效果: 在 .git/hooks/pre-commit 写入钩子, 每次 git commit 自动运行
#       scripts/pre-commit-check.sh, 命中敏感内容时拒绝提交。
# 卸载: 删除 .git/hooks/pre-commit 即可。
# ============================================================================
set -e

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "${ROOT}" ]; then
  echo "ERROR: not inside a git repository" >&2
  exit 2
fi

HOOK_DIR="${ROOT}/.git/hooks"
HOOK="${HOOK_DIR}/pre-commit"

if [ -f "${HOOK}" ]; then
  echo "WARN: ${HOOK} already exists, backing up to pre-commit.bak"
  cp "${HOOK}" "${HOOK}.bak"
fi

cat > "${HOOK}" <<'EOF'
#!/bin/sh
# EduERP-V4 Commit Guard — 由 scripts/install-pre-commit-hook.sh 安装
root="$(git rev-parse --show-toplevel)"
if command -v bash >/dev/null 2>&1; then
  bash "$root/scripts/pre-commit-check.sh"
else
  sh "$root/scripts/pre-commit-check.sh"
fi
EOF
chmod +x "${HOOK}"

echo "OK: pre-commit hook installed -> ${HOOK}"
echo "    (本仓库为 Windows 开发环境, 若未安装 Git Bash, 请改用 scripts\\pre-commit-check.bat 手动检查)"
