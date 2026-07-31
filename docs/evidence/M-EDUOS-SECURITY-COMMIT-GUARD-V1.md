# M-EDUOS-SECURITY-COMMIT-GUARD-V1 — 提交安全守卫

> 状态：✅ COMPLETE
> 日期：2026-07-31
> 仓库：`git@github.com:asunzhoua/EduERP-V4.git`（公开）
> 前置：M-EDUOS-SECURITY-HISTORY-CLEANUP-V1（历史敏感信息清除）

## 1. 风险说明

本仓库为 **GitHub 公开仓库**，历史曾发生敏感信息泄露并被公开抓取：

| 风险类别 | 说明 | 影响 |
| --- | --- | --- |
| 内网拓扑泄露 | 本地服务器真实 IP（192.168.x.x）曾进入历史 commit | 攻击者可定位内网主机 |
| 公网暴露面 | 公网 WAN IP、DDNS 域名（`ddns.257758.xyz`）曾进入文档 | 暴露家庭网络公网入口 |
| 网络配置泄露 | 端口转发（8443→3000）、反代、路由器/群晖管理地址进入文档 | 便于针对性攻击 |
| 凭据泄露 | JWT Token、密码、密钥若入库即公开 | 直接凭据失窃 |
| 配置污染 | 真实生产环境变量进入模板文件 | 开发/生产配置串扰 |

已通过 `M-EDUOS-SECURITY-HISTORY-CLEANUP-V1` 重写历史并清除远端敏感内容。
本 Mission 建立**持续防护机制**，防止回归性泄露。

## 2. 已禁止提交项列表

详见 [docs/SECURITY-COMMIT-RULES.md](../SECURITY-COMMIT-RULES.md)，核心清单：

1. 本地服务器真实 IP（`192.168.x.x` 等内网地址，测试夹具 `192.168.1.1`/`192.168.1.100` 除外）
2. 公网 IP 地址
3. DDNS / 动态域名（`*.ddns.*`、`*.f3322.net`、`*.3322.org`、oray、no-ip、synology.me、quickconnect、tplinkdns、asuscomm 等）
4. 端口转发 / 反向代理 / SSH 隧道配置细节
5. 路由器 / 群晖管理地址
6. SSL 证书私钥（`BEGIN PRIVATE KEY` 等）
7. Token / JWT / 密码 / 密钥（含 AWS、GitHub、Slack 等密钥形态）
8. 真实生产环境变量值

## 3. 保护措施

### 3.1 配置分离（模板 + gitignore）

| 文件 | 作用 |
| --- | --- |
| `backend/.env.example` | 后端环境变量模板（全占位符，已跟踪） |
| `miniapp/config.example.js` | 小程序配置模板（`localhost` / 占位符域名） |
| `.gitignore` | 屏蔽 `config.js`、`.env*`、Token 文件、旧敏感证据文档等 |

本地使用方式：
- 后端：复制 `backend/.env.example` → 本地 `.env`（不入库）
- 小程序：复制 `miniapp/config.example.js` → 本地 `miniapp/config.js`（不入库）

### 3.2 提交前检查脚本

| 脚本 | 说明 |
| --- | --- |
| `scripts/pre-commit-check.sh` | Git Bash / CI 版，4 类规则检查 |
| `scripts/pre-commit-check.ps1` | PowerShell 版（含 UTF-8 BOM，兼容 PS 5.1） |
| `scripts/pre-commit-check.bat` | Windows 批处理包装器（调 .ps1） |
| `scripts/install-pre-commit-hook.sh` | 一键安装 Git pre-commit 钩子 |

**检查规则**：
1. IP 地址模式（白名单：`127.0.0.1` / `0.0.0.0` / 测试夹具 IP）
2. DDNS / 动态域名模式
3. 密钥 / 密码 / Token 模式（占位符与变量引用自动豁免，`SEED_*` 仅告警）
4. 端口转发 / 反向代理 / 隧道配置模式

**退出码**：`0` = PASS；`1` = FAIL（发现敏感内容，阻止提交）；`2` = 用法错误。

**用法**：
```bash
scripts\pre-commit-check.bat           # Windows（默认检查暂存区）
sh scripts/pre-commit-check.sh         # Git Bash（默认检查暂存区）
sh scripts/pre-commit-check.sh --all   # 检查整个工作树
sh scripts/pre-commit-check.sh --untracked  # 仅检查未跟踪文件
sh scripts/install-pre-commit-hook.sh  # 安装 Git 钩子（自动拦截）
```

### 3.3 规则文档

`docs/SECURITY-COMMIT-RULES.md` 包含：禁止提交项清单、配置分离原则、提交前自查清单、违规处理流程。

### 3.4 README 安全提示

`README.md` 新增「⚠️ 安全提示」章节，指向规则文档与检查脚本用法。

## 4. 校验结果

### 4.1 检测能力验证（负向用例）

构造含敏感内容的临时文件并暂存，运行脚本：

| 用例 | 预期 | 结果 |
| --- | --- | --- |
| 内网 IP `192.168.31.10` | 拦截 | ✅ 命中 |
| 公网 IP | 拦截 | ✅ 命中 |
| DDNS 域名 `ddns.xxx.xyz` | 拦截 | ✅ 命中 |
| JWT Token（`eyJ...`） | 拦截 | ✅ 命中 |
| 密码 `passwd: xxxx` | 拦截 | ✅ 命中 |
| 端口转发 `8443→3000` | 拦截 | ✅ 命中 |

共 10 处敏感内容全部检出，退出码 1（拦截成功）。

### 4.2 守卫文件自检（正向用例）

守卫文件（规则文档、脚本、模板、README、.gitignore）本身运行检查 → **PASS（退出码 0）**。

### 4.3 全库扫描

- 已跟踪文件：DDNS / 公网 IP 命中 **0** ✅
- 未跟踪文件扫描发现：`backend/tokens.env`（真实 JWT）、`backend/admin_token.json` 等 → 已通过 `.gitignore` 屏蔽 ✅
- 遗留敏感证据文档（含 DDNS 与端口转发细节的旧报告）→ 已加入 `.gitignore`，不入库 ✅

### 4.4 环境变量模板

`backend/.env.example` 已核验为全占位符模板（`your_*` / `change-this-*` 等），不含真实值 ✅。
（注：治理策略拦截了 shell/read 直接读取 env 文件，本结论基于本 Mission 前期已完成的内容核验记录。）

## 5. 后续执行约束

1. **所有提交必须通过** `pre-commit-check` 检查（退出码 0 方可提交）
2. 建议执行 `scripts/install-pre-commit-hook.sh` 安装 Git 钩子，实现自动拦截
3. 新增模板文件时保持占位符风格；严禁在模板中填写真实 IP / 域名 / 凭据
4. 本地测试产生的 Token 文件（`*.env`、`*token*.json` 等）不入库；若确需提交凭证类样例，先脱敏为占位符
5. 证据/报告类文档引用真实环境信息前，先替换为占位符（如 `REDACTED`、`your-domain.example`）
6. 发现历史遗留敏感内容：按 `docs/SECURITY-COMMIT-RULES.md` §4 违规处理流程处置（gitignore → 重写历史 → 通知 GitHub Support purge）
7. 本守卫机制为基线约束，后续安全加固 Mission 可在此基础上扩展（如 CI 层扫描、secret scanning 集成）

## 6. 交付物清单

| 交付物 | 路径 | 状态 |
| --- | --- | --- |
| 规则文档 | `docs/SECURITY-COMMIT-RULES.md` | ✅ |
| 小程序配置模板 | `miniapp/config.example.js` | ✅ |
| 后端环境变量模板 | `backend/.env.example` | ✅ |
| README 安全提示 | `README.md` | ✅ |
| 检查脚本（Git Bash） | `scripts/pre-commit-check.sh` | ✅ |
| 检查脚本（PowerShell） | `scripts/pre-commit-check.ps1` | ✅ |
| 检查脚本（Windows 批处理） | `scripts/pre-commit-check.bat` | ✅ |
| 钩子安装脚本 | `scripts/install-pre-commit-hook.sh` | ✅ |
| 本证据文档 | `docs/evidence/M-EDUOS-SECURITY-COMMIT-GUARD-V1.md` | ✅ |
