#!/usr/bin/env bash
# ============================================================================
# pre-commit-check.sh — EduERP-V4 提交前安全检查
#
# 用法:
#   sh scripts/pre-commit-check.sh            # 检查暂存区 (默认)
#   sh scripts/pre-commit-check.sh --all      # 检查整个工作树 (已跟踪+未跟踪)
#   sh scripts/pre-commit-check.sh --untracked  # 仅检查未跟踪文件 (提交前补漏)
#   sh scripts/pre-commit-check.sh <path...>  # 检查指定文件/目录
#
# 退出码: 0 = PASS / 1 = FAIL(发现敏感内容) / 2 = 用法错误
#
# 安装 Git 钩子(自动拦截违规提交):
#   sh scripts/install-pre-commit-hook.sh
#
# 校验规则:
#   1. IP 地址模式 (白名单: 127.0.0.1 / 0.0.0.0 / 测试夹具 192.168.1.1 / 192.168.1.100)
#   2. DDNS / 动态域名模式
#   3. 密钥/密码/Token 模式 (占位符与变量引用自动豁免, SEED_* 仅告警)
#   4. 端口转发/反向代理/隧道配置模式
#
# 说明: 本文件及规则/证据文档(见 GUARD_FILES)为模式定义文件,
#       内容在创建时人工审查, 故不参与自检。
# ============================================================================
set -u

# Git for Windows 自带工具路径修正: raw sh.exe 的 PATH 可能不含 /usr/bin (grep/sort/sed)
if [ -x /usr/bin/grep.exe ] || [ -x /usr/bin/grep ]; then
  case ":$PATH:" in
    *":/usr/bin:"*) ;;
    *) export PATH="/usr/bin:$PATH" ;;
  esac
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "${REPO_ROOT}" ]; then
  echo "ERROR: not inside a git repository" >&2
  exit 2
fi
cd "${REPO_ROOT}"

# 受信任的守卫文件(创建时人工审查), 不参与自检
GUARD_FILES='docs/SECURITY-COMMIT-RULES\.md|docs/evidence/M-EDUOS-SECURITY-COMMIT-GUARD-V1\.md|scripts/pre-commit-check\.(sh|bat|ps1)$|scripts/install-pre-commit-hook\.sh|\.gitignore|README\.md'

# 参数解析
MODE="staged"
case "${1:-}" in
  "")
    ;;
  --all)
    MODE="all"
    ;;
  --untracked)
    MODE="untracked"
    ;;
  --staged)
    MODE="staged"
    ;;
  -h|--help)
    sed -n '2,12p' "$0"
    exit 0
    ;;
  *)
    MODE="paths"
    ;;
esac

if [ "${MODE}" = "staged" ]; then
  FILES="$(git diff --cached --name-only --diff-filter=ACM)"
elif [ "${MODE}" = "all" ]; then
  FILES="$( { git ls-files; git ls-files --others --exclude-standard; } | sort -u )"
elif [ "${MODE}" = "untracked" ]; then
  FILES="$(git ls-files --others --exclude-standard)"
else
  FILES="$*"
fi

# 占位符/引用值判定: 返回 0 = 安全(可放行), 1 = 疑似真实值(需拦截)
is_placeholder() {
  local v="$1"
  # 含非 ASCII 字符(如中文占位文本 生产密码/示例)
  echo "$v" | grep -qE '[^\x00-\x7F]' && return 0
  # 占位词 / 环境变量引用
  echo "$v" | grep -qiE 'your_|your-|xxx|example|changeme|change-this|change_this|todo|placeholder|redacted|^<.*>$|^\$' && return 0
  # 高相似度密码形态: 长度>=8 且同时含大小写字母与数字
  if [ ${#v} -ge 8 ]; then
    echo "$v" | grep -q '[A-Z]' && echo "$v" | grep -q '[a-z]' && echo "$v" | grep -q '[0-9]' && return 1
  fi
  # 短标识符(变量名, <=16字符)
  echo "$v" | grep -qE '^[A-Za-z_][A-Za-z0-9_]{0,15}$' && return 0
  # 函数调用引用
  echo "$v" | grep -qE '^[A-Za-z_][A-Za-z0-9_.]*\(.*\)$' && return 0
  # 点号引用 (如 process.env.X / config.DB_PASSWORD)
  echo "$v" | grep -qE '^[A-Za-z_][A-Za-z0-9_.]*\.[A-Za-z_][A-Za-z0-9_.]*$' && return 0
  return 1
}

VIOLATIONS=0
WARNINGS=0

scan_file() {
  local f="$1"
  [ -f "$f" ] || return
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.bmp|*.exe|*.dll|*.db|*.sqlite|*.sqlite3|*.pdf|*.zip|*.gz|*.7z|*.tsbuildinfo|*.woff|*.ttf) return ;;
  esac
  # 跳过超大文件(>5MB, 多为构建产物/数据文件)
  if [ "$(wc -c < "$f" 2>/dev/null || echo 0)" -gt 5242880 ]; then return; fi
  echo "$f" | grep -qE "${GUARD_FILES}" && return
  grep -Iq . "$f" || return   # 跳过二进制

  local ln val
  # 1) IP 地址
  while IFS=: read -r ln val; do
    case "$val" in
      127.0.0.1|0.0.0.0|192.168.1.1|192.168.1.100) continue ;;
    esac
    echo "[FAIL] [IP地址] $f:$ln: $val"
    VIOLATIONS=$((VIOLATIONS+1))
  done < <(grep -noE '([0-9]{1,3}\.){3}[0-9]{1,3}' "$f" || true)

  # 2) DDNS / 动态域名 (匹配域名形态: xxx.ddns.zzz 或 xxx.f3322.net 等)
  while IFS=: read -r ln val; do
    echo "[FAIL] [DDNS域名] $f:$ln: $val"
    VIOLATIONS=$((VIOLATIONS+1))
  done < <(grep -niE '(ddns\.|[a-z0-9_-]+\.(f3322|nat123|3322\.org|oray|no-ip|dyndns|synology\.me|quickconnect|tplinkdns|asuscomm)\.)' "$f" || true)

  # 3a) 密钥/Token (明确指纹)
  while IFS=: read -r ln val; do
    echo "[FAIL] [密钥/Token] $f:$ln: $val"
    VIOLATIONS=$((VIOLATIONS+1))
  done < <(grep -noE 'BEGIN (RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}\.|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_|xox[baprs]-[A-Za-z0-9-]{10,}' "$f" || true)

  # 3b) password/secret/token 赋值 (占位符与变量引用豁免; 带引号字面量一律视为疑似真实值)
  while IFS=: read -r ln val; do
    key="${val%%[=:]*}"
    rest="${val#*[=:]}"
    rest="${rest%,}"
    rest="${rest%;}"
    if is_placeholder "$rest"; then continue; fi
    if echo "$key" | grep -qiE '^SEED_'; then
      echo "[WARN] [种子密码(开发环境)] $f:$ln: $val"
      WARNINGS=$((WARNINGS+1))
      continue
    fi
    echo "[FAIL] [密码/密钥赋值] $f:$ln: $val"
    VIOLATIONS=$((VIOLATIONS+1))
  done < <(grep -noiE "(password|passwd|secret|api[_-]?key|client[_-]?secret|access[_-]?key|token)[[:space:]]*[:=][[:space:]]*[\"']?[^\"'[:space:]]+" "$f" || true)

  # 4) 端口转发 / 反代 / 隧道
  while IFS=: read -r ln val; do
    echo "[FAIL] [端口转发/反代] $f:$ln: $val"
    VIOLATIONS=$((VIOLATIONS+1))
  done < <(grep -niE 'port[_-]?forward|dnat|prerouting|masquerade|proxy_pass|autossh|ssh -[LR] ?[0-9]|virtual server|端口映射|端口转发' "$f" || true)
}

if [ -z "${FILES}" ]; then
  echo "[PASS] 无待检查文件"
  exit 0
fi

echo "== EduERP-V4 Commit Guard (pre-commit-check) =="
echo "== 扫描范围: ${MODE} =="
if [ "${MODE}" = "paths" ]; then
  for f in "$@"; do
    scan_file "$f"
  done
else
  while IFS= read -r f; do
    scan_file "$f"
  done <<< "${FILES}"
fi

echo "----------------------------------------"
if [ "${VIOLATIONS}" -gt 0 ]; then
  echo "[FAIL] 发现 ${VIOLATIONS} 处敏感内容，已阻止提交。请脱敏后重试 (见 docs/SECURITY-COMMIT-RULES.md §4)。"
  if [ "${WARNINGS}" -gt 0 ]; then echo "      另有 ${WARNINGS} 处告警(开发种子密码)，请人工确认。"; fi
  exit 1
fi
if [ "${WARNINGS}" -gt 0 ]; then
  echo "[PASS] 无阻断项 (含 ${WARNINGS} 处告警，请人工确认)。"
  exit 0
fi
echo "[PASS] 未发现敏感内容。"
exit 0
