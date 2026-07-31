# EduERP-V4 提交安全规则 (Commit Security Rules)

> 版本：V1
> 状态：生效中（M-EDUOS-SECURITY-COMMIT-GUARD-V1）
> 适用范围：本仓库所有分支、所有提交（含合并请求、补丁、导出）
> 背景：仓库历史曾泄露内网/公网 IP、DDNS 域名与端口转发配置，已完成历史清理（见 `docs/evidence/M-EDUOS-SECURITY-HISTORY-CLEANUP-V1.md`）。本文件定义后续开发的提交安全约束。

---

## 1. 禁止提交项清单

以下内容 **禁止以任何形式** 出现在提交内容中（含文件名、文件内容、提交信息、注释、图片元数据、日志附件）。

| # | 类别 | 包含内容 | 典型特征 |
|---|------|---------|---------|
| 1 | 本地服务器真实 IP | 192.168.x.x / 10.x.x.x / 172.16–31.x.x 等内网地址 | IPv4 地址段；测试夹具白名单除外（见 §3） |
| 2 | 公网 IP 地址 | 家庭宽带 WAN IP、云服务器公网 IP | 非私有网段的 IPv4 地址 |
| 3 | DDNS 域名 | 任何 DDNS 服务分配的动态域名 | `*.ddns.*`、`*.f3322.net`、`*.nat123.net`、`*.3322.org`、`*.oray.com`、`*.no-ip.*`、`*.dyndns.*`、`*.synology.me`、`*.quickconnect.to`、`*.tplinkdns.com`、`*.asuscomm.com` 等 |
| 4 | 端口转发 / 反向代理配置细节 | 路由器端口映射规则、iptables DNAT、nginx proxy_pass 反代、SSH 隧道、frp/ngrok 内网穿透配置 | `portforward`、`DNAT`、`PREROUTING`、`MASQUERADE`、`proxy_pass`、`ssh -R` / `ssh -L`、`autossh`、`virtual server`、`端口映射` |
| 5 | 路由器 / 群晖管理地址 | 路由器后台地址、DSM 管理端口、NAS 管理页面 URL | 管理 IP + 管理端口组合（如内网 IP:5000/5001 等） |
| 6 | SSL 证书私钥 | PEM / DER / PKCS 私钥文件 | `BEGIN RSA PRIVATE KEY`、`BEGIN EC PRIVATE KEY`、`BEGIN OPENSSH PRIVATE KEY`、`*.pem` / `*.key` / `*.p12` / `*.pfx` |
| 7 | Token / 密码 / 密钥 | JWT、访问令牌、API Key、AppSecret、数据库密码、SSH 私钥口令 | `eyJ…`（JWT 头）、`AKIA…`（AWS）、`sk-…`、`ghp_…`（GitHub）、`password=` / `secret=` / `api_key=` / `client_secret=` 后接真实值 |
| 8 | 真实生产环境变量 | 生产数据库连接串、生产 JWT_SECRET、生产小程序 AppID/Secret、生产 Sentry DSN 等 | `.env`、`tokens.env`、`*_token.json`、`ecosystem.config.js` 内嵌密钥 |

> **判定原则**：无法判断是否敏感时，一律按敏感处理；宁可标记后人工确认，不可放行后泄露。

---

## 2. 配置分离原则

1. **代码与配置分离**：仓库只保存代码与配置**模板**，不保存任何真实环境值。
2. **模板入库，真实值留在本地**：
   - 后端：`backend/.env.example`（占位符模板）入库；真实 `.env` 只在本地/服务器上维护，永不提交。
   - 小程序：`miniapp/config.example.js`（占位符模板）入库；真实 `miniapp/config.js` 已在 `.gitignore` 中，仅本地维护。
3. **网络拓扑不进仓库**：内网 IP、公网 IP、DDNS 域名、端口转发映射属于部署环境信息，记录在私有运维笔记（如 QwenPaw 工作区 MEMORY），不得写入 `docs/`、`deploy/`、`README.md` 等任何会入库的文件。
4. **证据文档必须脱敏**：`docs/evidence/` 下的报告若涉及上述内容，一律以 `REDACTED` / `<占位符>` 形式描述，禁止粘贴真实 IP、域名、Token。
5. **环境注入**：所有环境依赖值通过 `process.env` / 本地配置文件注入，代码中禁止硬编码。

---

## 3. 提交前自查清单

提交前依次执行以下检查，全部通过方可提交：

- [ ] 运行 `scripts/pre-commit-check.bat`（Windows）或 `scripts/pre-commit-check.sh`（Git Bash / CI），确认 **PASS**（无 IP / DDNS 域名 / 密钥 / 端口转发命中）。
- [ ] `git status` 确认待提交文件清单，无 `tokens.env`、`*_token.json`、`.env*`、`config.js`、`*_cookies*.txt`、`*.pem` / `*.key` 等敏感文件。
- [ ] `git diff --cached` 人工逐行过目，重点检查：URL、host、ip、password、secret、token、key 字段。
- [ ] 若涉及测试数据中的 IP，仅允许以下白名单值：
  - `192.168.1.1`（测试夹具）
  - `192.168.1.100`（测试夹具 / 文档示例）
  - `127.0.0.1`、`0.0.0.0`（本机回环 / 监听地址）
  - `localhost`、`your-production-domain.com`、`example.com`（占位符）
- [ ] 新产生的调试/验证产物（API 响应、登录 Token、日志）确认已加入 `.gitignore` 或删除，不随提交进入仓库。
- [ ] 提交信息本身不含 IP、域名、Token。

> 安装 Git 钩子后，`git commit` 会自动执行上述检查，违规时提交被拦截（见 §4.1）。

---

## 4. 违规处理流程

### 4.1 本地拦截（推荐）

1. 已安装 pre-commit 钩子（见 `scripts/pre-commit-check.sh` 头部说明）：`git commit` 时自动扫描暂存区，命中即拒绝提交并列出违规文件/行。
2. 违规处置：`git restore --staged <file>` 撤销暂存 → 修改/脱敏 → 重新 `git add` → 重跑检查至 PASS。

### 4.2 已提交、未推送

1. 立即停止推送。
2. 使用 `git reset --soft HEAD~1` 撤销提交，或 `git commit --amend` 修改，重新走 §3 自查后再提交。

### 4.3 已推送到远端

1. **立即**停止一切后续推送，通知仓库管理员与用户评估泄露影响范围。
2. 参照 `M-EDUOS-SECURITY-HISTORY-CLEANUP-V1` 流程处置：
   - 在临时 clone 中 `git filter-branch --tree-filter`（或安装 `git-filter-repo`）重写包含敏感值的提交；
   - 用 `REDACTED` 替换敏感值后强制推送 master；
   - 原仓库工作树通过 `update-ref` 指针级同步，避免误伤未提交改动；
   - 联系 GitHub Support 清除旧 commit SHA 缓存（Purge）。
3. 若泄露值仍有效（如密码/Token 未轮换），**必须**立即轮换凭据，并在 `docs/evidence/` 记录处置证据。

### 4.4 责任与升级

- 任何提交者在发现疑似泄露时，有义务立即上报，不隐瞒、不自行"小修"后继续推送。
- 若自动化检查被绕过（如 `git commit --no-verify`），将按 4.3 流程从重处理。

---

## 附：相关文件

| 文件 | 作用 |
|------|------|
| `.gitignore` | 屏蔽敏感文件类型（见"Security: sensitive files"区块） |
| `backend/.env.example` | 后端环境变量模板（占位符） |
| `miniapp/config.example.js` | 小程序配置模板（占位符） |
| `scripts/pre-commit-check.sh` / `.bat` / `.ps1` | 提交前安全检查脚本 |
| `docs/evidence/M-EDUOS-SECURITY-HISTORY-CLEANUP-V1.md` | 历史清理证据 |
| `docs/evidence/M-EDUOS-SECURITY-COMMIT-GUARD-V1.md` | 本约束实施证据 |
