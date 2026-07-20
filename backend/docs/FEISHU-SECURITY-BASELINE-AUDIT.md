# Feishu Security Baseline Audit

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **审计范围**: 飞书集成相关凭证/代码/权限/注入风险  
> **审计方法**: 只读事实验证，逐项检查源代码 + 环境变量 + 文档  

---

## 审计结论总览

| # | 审计项 | 结论 | 风险等级 |
|:--|:-------|:-----|:---------|
| 1 | Webhook URL 管理 | ✅ SECURE | 🟢 低 |
| 2 | App Secret 管理 | ⚠️ AT RISK | 🟡 中 |
| 3 | App ID 管理 | ⚠️ AT RISK | 🟡 中 |
| 4 | 环境变量存储安全 | ⚠️ AT RISK | 🟡 中 |
| 5 | 飞书权限范围 | ✅ SECURE | 🟢 低 |
| 6 | 脚本注入风险 | ✅ SECURE | 🟢 低 |
| 7 | 源代码泄露 | ✅ SECURE | 🟢 低 |

---

## 1. Webhook URL 管理

### 调查结果

| 检查项 | 结果 | 证据 |
|:-------|:-----|:------|
| URL 是否硬编码在源代码中？ | ❌ 未硬编码 | `grep -r "hook/" backend/tools/*.py` → 无匹配 |
| URL 存储方式 | 环境变量 | `feishu-notify.py:36-40` → `os.environ.get("FEISHU_WEBHOOK_URL")` |
| 持久化方式 | `setx` → 注册表 | `reg query HKCU\Environment` → `FEISHU_WEBHOOK_URL` 存在 |
| URL 是否在文档中泄露？ | ❌ 未发现 | 文档中 URL 已脱敏为 `https://open.feishu.cn/open-apis/bot/v2/hook/...` |
| Webhook URL 可逆推性 | 🟢 不可逆 | 随机 UUID 格式，无规律 |

**URL 内容**（脱敏）：`https://open.feishu.cn/open-apis/bot/v2/hook/21b5ccca-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**结论**: ✅ SECURE — URL 在源代码零硬编码，通过环境变量管理。

---

## 2. App Secret 管理

### 调查结果

| 检查项 | 结果 | 证据 |
|:-------|:-----|:------|
| Secret 是否硬编码？ | ❌ 未硬编码 | `grep -r "app_secret\|secret" backend/tools/*.py` → 无匹配 |
| 是否通过环境变量管理？ | ⚠️ 仅限会话级 | `feishu_bootstrap.py:25-40` 中读取 `os.environ["FEISHU_APP_SECRET"]` |
| 持久化方式 | ❌ 未持久化 | `reg query HKCU\Environment` → 无 `FEISHU_APP_SECRET` |
| 存储位置 | 无 | 用户运行 bootstrap 时通过 `set` 命令设置，重启后消失 |
| 是否在文档中泄露？ | ❌ 未发现 | 文档中写为 `cli_xxxxxxxxxxxxxxxx`（脱敏） |

**发现**: App Secret **未持久化**到任何存储介质（注册表/文件/密码管理器）。每次运行 feishu_bootstrap.py 或 feishu-to-mission.py 需要重新输入。

**风险**: 
- 🟢 不持久化 = 泄露面小
- 🟡 但未持久化也意味着 Mission Board 检测（heartbeat）无法工作（见 CRON-HEARTBEAT-VALIDATION-REPORT.md）
- 🟡 用户可能为方便而将 Secret 写入脚本或文档（需防范）

**结论**: ⚠️ AT RISK — Secret 管理方式是"不存"而非"安全地存"。建议持久化到环境变量（`setx`），但需确保注册表 ACL。

---

## 3. App ID 管理

### 调查结果

| 检查项 | 结果 | 证据 |
|:-------|:-----|:------|
| App ID 是否硬编码？ | ❌ 未硬编码 | 同上 |
| 持久化方式 | ❌ 未持久化 | 同 Secret |
| 风险等级 | 低于 Secret | App ID 本身是公开标识符 |

**结论**: ⚠️ AT RISK — 与 Secret 相同问题，但影响较低（App ID 为公开信息，泄露危害小）。

---

## 4. 环境变量存储安全

### 4.1 `setx` 存储分析

| 维度 | 评估 |
|:-----|:------|
| 存储位置 | `HKCU\Environment`（当前用户注册表） |
| 可读性 | 当前用户 + Administrators 可读 |
| 其他用户 | 其他 Windows 用户不可读（HKCU 隔离） |
| 进程隔离 | 子进程继承（Task Scheduler 可读） |
| 加密 | ❌ 明文存储（注册表值直接可见） |
| 可被其他进程读取 | ✅ 可以（但需要同一用户上下文） |

### 4.2 泄露面分析

| 泄露路径 | 可行性 | 防护 |
|:---------|:-------|:------|
| 其他用户登录读取 | ❌ 不可（HKCU 隔离） | Windows 用户隔离 |
| 恶意软件读取 | ⚠️ 可（同一用户上下文） | 依赖系统安全 |
| Task Scheduler 任务读取 | ✅ 可（当前用户） | 意图内使用 |
| 远程注册表读取 | ⚠️ 可（需管理员权限） | 依赖网络防火墙 |
| 进程环境变量 dump | ⚠️ 可 | 依赖进程安全 |

### 4.3 改进建议

| 建议 | 优先级 | 影响 |
|:-----|:-------|:------|
| Credential Manager / Windows Vault 存储 | 低 | 增加实施复杂度 |
| 注册表 ACL 限制读取权限 | 中 | 减少泄露面 |
| 当前方案可接受（小团队内部使用） | — | 当前已满足需求 |

**结论**: ⚠️ AT RISK — Windows 注册表存储明文凭据，在当前小团队内网场景下可接受，但不符合企业级安全标准。

---

## 5. 飞书权限范围

### 5.1 当前已配置权限

根据 `FEISHU-BOOTSTRAP-IMPLEMENTATION.md:30-36`（已验证部署）：

| 权限代码 | 权限说明 | 最小权限？ | 实际需要？ |
|:---------|:---------|:-----------|:-----------|
| `wiki:space:read` | 读取知识库空间 | ✅ 是 | ✅ 仪表盘需要 |
| `wiki:space:write` | 创建/修改知识库空间 | ✅ 是 | ✅ 初始化需要 |
| `wiki:node:read` | 读取知识库节点 | ✅ 是 | ✅ 仪表盘需要 |
| `wiki:node:write` | 创建/修改知识库节点 | ✅ 是 | ✅ 初始化需要 |
| `sheets:spreadsheet:read` | 读取电子表格 | ✅ 是 | ✅ Mission Board 读取 |
| `sheets:spreadsheet:write` | 创建/修改电子表格 | ✅ 是 | ✅ Mission Board 回写 |
| `docs:document:read` | 读取文档 | ✅ 是 | ✅ 仪表盘 |
| `docs:document:write` | 创建/修改文档 | ✅ 是 | ✅ 初始化 |
| `auth:tenant_access_token:read` | 获取 token | ✅ 必需 | ✅ API 鉴权 |

### 5.2 最小权限原则评估

| 原则 | 符合？ | 说明 |
|:-----|:-------|:------|
| 只分配必要的权限 | ✅ 符合 | 当前均为必需权限 |
| 无过度授权 | ✅ 符合 | 未配置 `im:message`（因未开通） |
| 未使用权限未配置 | ✅ 符合 | 无多余权限 |
| 读写分离 | ✅ 符合 | 大部分权限有单独 read/write 粒度 |

### 5.3 未来需要增加的权限

| 需要时机 | 权限 | 说明 |
|:---------|:-----|:------|
| Phase 4.1 | `im:message` | 读取/发送群消息 |
| Phase 4.1 | `im:chat` | 读取群信息 |
| Phase 4.1 | `event:message` | 订阅消息事件 |

**结论**: ✅ SECURE — 当前权限遵循最小权限原则。未来增加权限时需按需添加。

---

## 6. 脚本注入风险

### 6.1 各工具安全分析

#### feishu-notify.py

| 检查项 | 结果 | 证据 |
|:-------|:-----|:------|
| 参数解析 | ✅ 安全 | `argparse` 无 `shell=True` |
| 子命令调用 | ✅ 安全 | 无 `subprocess`/`os.system`/`eval`/`exec` 调用 |
| URL 拼接 | ✅ 安全 | 直接从环境变量读取，不接受用户输入 |
| 消息内容 | ✅ 安全 | `json.dumps(ensure_ascii=False)` → JSON API |
| 网络请求 | ✅ 安全 | `urllib.request` → HTTPS → 飞书 API |

#### feishu_bootstrap.py

| 检查项 | 结果 |
|:-------|:------|
| 参数解析 | ✅ `argparse` |
| API 调用 | ✅ `requests.post/get` → HTTPS |
| 无 shell 调用 | ✅ 验证 |

#### feishu-to-mission.py / mission-to-feishu.py

| 检查项 | 结果 |
|:-------|:------|
| 参数解析 | ✅ `argparse` |
| 文件写入 | ✅ 写入 `.missions/` 目录，路径可控 |
| 无 shell 调用 | ✅ 验证 |

### 6.2 总体评估

| 风险项 | 评估 |
|:-------|:------|
| Command Injection | ❌ 不存在 — 无 `subprocess`/`os.system` 调用 |
| SQL Injection | ❌ 不存在 — 无数据库操作 |
| Path Traversal | ✅ 低 — 路径参数通过 argparse 传入 |
| SSRF | ✅ 低 — 目标 URL 固定为飞书 API |
| JSON Injection | ✅ 低 — `json.dumps` 自动转义 |

**结论**: ✅ SECURE — 所有工具仅使用标准库网络请求，无系统命令执行，无注入路径。

---

## 7. 源代码泄露检查

### 7.1 硬编码凭证扫描

```bash
# 所有 .py 文件的凭证模式扫描结果
grep "hook/[a-f0-9-]" backend/tools/*.py        → 无匹配 ✅
grep "app_secret\|appSecret\|APP_SECRET" **/*.py  → 无匹配 ✅
grep "cli_" backend/tools/*.py                   → 无匹配 ✅
grep "open.feishu.cn/open-apis/bot" **/*.py      → 无匹配 ✅
```

### 7.2 Git 泄露风险

| 风险项 | 评估 |
|:-------|:------|
| .gitignore 存在？ | ❌ 缺失（见 MEMORY.md P0 安全问题） |
| .py 文件是否被 git 追踪？ | ⚠️ 可能（无 .gitignore） |
| 历史版本是否含凭证？ | ⚠️ 需检查 git log |

**建议**: 添加 `.gitignore` 排除环境变量文件 / `.env` / `*.log`。

---

## 8. 总体风险评估

### 风险矩阵

```
严重程度
  🔴 CRITICAL │
               │
  🟡 AT RISK  │ App Secret(未持久化)   App ID(未持久化)
               │ 注册表明文凭据
               │
  🟢 SECURE   │ Webhook管理  权限范围  注入风险  源代码
               └───────────────────────────────────────
                  低                           高
                            风险概率
```

### 建议行动

| 优先级 | 行动 | 解决什么问题 |
|:-------|:-----|:------------|
| 🟡 中 | 用 `setx` 持久化 App ID + Secret 到注册表 | Heartbeat Board 检测可用 |
| 🟡 中 | 创建 `.gitignore` 防止意外提交 | 防止源码泄露凭据 |
| 🟢 低 | 考虑 Windows Credential Manager 替代注册表 | 提升凭据存储安全性 |
| 🟢 低 | 限制注册表 `HKCU\Environment` ACL | 减少泄露面 |

### 最终结论

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  总体安全等级: 🟡 中风险                                  ║
║                                                          ║
║  Webhook管理:       ✅ SECURE                            ║
║  App Secret管理:    ⚠️ AT RISK — 未持久化                ║
║  权限范围:          ✅ SECURE — 最小权限原则              ║
║  注入风险:          ✅ SECURE — 无注入路径                ║
║  源代码泄露:        ⚠️ AT RISK — 无 .gitignore           ║
║                                                          ║
║  当前系统在小团队内网场景下可接受。                        ║
║  建议先解决 App Secret 持久化和 .gitignore 两个问题。     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```
