# Heartbeat Production Audit

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **审计文件**: `backend/tools/heartbeat_check.py` (497行)  
> **审计方法**: 逐行代码审查 + 日志验证

---

## 检测项验证矩阵

| 检测项 | 结果 | 代码行号 | 说明 |
|:-------|:-----|:---------|:------|
| Feishu Board | ⚠️ 已实现但被SKIP | L210-L270 | 功能完整：获取Token→读Board→统计CREATED。因FEISHU_APP_ID/SECRET未持久化，当前SKIP |
| Runtime State | ✅ 完整实现 | L281-L350 | 扫描 `.missions/*/mission.state`，检查FAILED/PAUSED/STALE(>30min) |
| Pump Runner 进程 | ❌ 未实现 | — | 无 `tasklist` / `Get-Process` 检测 pump-runner.py 或 claude.exe |
| 系统 Liveness | ✅ 完整实现 | L354-L400 | 检测日志文件mtime，>4h空闲→INFO通知 |
| 通知发送 | ✅ 完整实现 | L170-L198 | subprocess调用 feishu-notify.py，支持severity/title |
| 通知去重 | ✅ 完整实现 | L100-L155 | notifications.state文件，3600s冷却期，同一内容不重复 |
| 日志记录 | ✅ 完整实现 | L40-L72 | UTC+8时间戳，每日轮换，追加写入 |
| 异常保护 | ✅ 完整实现 | L486-L497 | BaseException捕获，ASCII-safe编码防GBK崩溃 |

---

## 逐项详细审计

### 1. Feishu Board 检测 (L210-L270)

**逻辑链路**:
```
_get_feishu_token() → 检查 APP_ID/SECRET → POST /auth/v3/tenant_access_token/internal/
    → 获取 token → GET /sheets/v2/spreadsheets/{token}/values/{sheet_id}!A2:A
    → 统计 CREATED 行数 → >0 则 WARNING 通知
```

| 子项 | 结果 | 说明 |
|:-----|:-----|:------|
| Token获取 | ✅ 正确 | 与 feishu_bootstrap.py 相同API |
| Board读取 | ✅ 正确 | sheets v2 API |
| 状态判定 | ✅ 正确 | 统计 CREATED 数量 |
| 通知触发 | ✅ 正确 | CREATED > 0 → WARNING |
| 当前可用性 | ⚠️ SKIP | 因凭证未持久化到环境变量 |

**改进建议**: Owner 执行 `setx FEISHU_APP_ID "cli_xxx"` + `setx FEISHU_APP_SECRET "xxx"` 后立即生效。

---

### 2. Runtime State 检测 (L281-L350)

**逻辑链路**:
```
glob(.missions/*/mission.state) → 逐文件解析 JSON → 检查 status 字段
    → FAILED / PAUSED → 立即 WARNING
    → RUNNING + updated_at > 30min → STALE WARNING
```

| 子项 | 结果 | 说明 |
|:-----|:-----|:------|
| 文件扫描 | ✅ 正确 | glob + recursive |
| JSON解析 | ✅ 正确 | 含异常捕获 |
| FAILED检测 | ✅ 正确 | status == "FAILED" |
| PAUSED检测 | ✅ 正确 | status == "PAUSED" |
| STALE检测 | ✅ 正确 | RUNNING + 超过30分钟无更新 |
| 时间戳解析 | ✅ 正确 | 支持ISO格式和Unix时间戳 |

**阈值**: 30 分钟（来自 `STALE_MINUTES = 30`，L45）

---

### 3. Pump Runner 进程检测 ❌

**缺失项**:
- 无 `tasklist /FI "IMAGENAME eq claude.exe"` 检测
- 无 `tasklist /FI "IMAGENAME eq python.exe"` 检测 pump-runner.py
- 无 `Get-Process claude` PowerShell 检测

**影响**:
- 无法检测 Claude Code 进程崩溃（进程消失但 state 仍 RUNNING）
- 无法检测 Pump Runner 进程异常退出
- 当前仅能通过 mission.state.updated_at 间接判定（STALE 检测）

**严重性**: 中。30分钟 STALE 检测可在一定程度上弥补进程检测缺失。

---

### 4. 通知发送 (L170-L198)

| 子项 | 结果 | 说明 |
|:-----|:-----|:------|
| subprocess调用 | ✅ 正确 | `sys.executable feishu-notify.py send --message ... --severity ...` |
| timeout处理 | ✅ 正确 | 30s超时 |
| exit code检查 | ✅ 正确 | returncode == 0 判断成功 |
| 异常捕获 | ✅ 正确 | 所有捕获不崩溃 |

---

### 5. 通知去重 (L100-L155)

| 子项 | 结果 | 说明 |
|:-----|:-----|:------|
| 状态文件 | ✅ JSON格式 | `notifications.state` |
| 冷却期 | ✅ 3600s | 同一内容1小时内不重复 |
| 内容比对 | ✅ 完整detail匹配 | 不是简单check_id匹配 |
| 崩溃保护 | ✅ 有 | 读取异常→返回空dict |

---

### 6. 日志记录 (L40-L72)

| 子项 | 结果 | 说明 |
|:-----|:-----|:------|
| 格式 | ✅ `timestamp \| check \| status \| detail \| notified_flag` | 管道分隔，机器可解析 |
| 轮换 | ✅ 按日 | `YYYY-MM-DD.log` |
| 编码 | ✅ UTF-8 | 避免GBK问题 |
| 目录 | ✅ 自动创建 | `os.makedirs(LOG_DIR, exist_ok=True)` |

---

## 日志验证

### 日志文件: `logs/heartbeat/2026-07-18.log`

```
15:05:24 | FATAL | ERROR | ⚠️ → GBK crash (首次运行)
15:06:13 | Feishu Board | SKIP | 凭证未配置
15:06:13 | Runtime State | OK | 干净环境
15:06:13 | Liveness | OK | 0.0h前
15:06:13 | Summary | ALL_OK | OK=2, SKIP=1
15:06:50 | Feishu Board | SKIP | 凭证未配置
15:06:50 | Runtime State | OK | 干净环境
15:06:50 | Liveness | OK | 0.0h前
15:06:50 | Summary | ALL_OK | OK=2, SKIP=1
```

**历史Bug**: 15:05:24 的 FATAL 由 `⚠️` emoji 导致 GBK 编码崩溃。当前代码 (L490-497) 已修复：
```python
safe_msg = str(e).encode("ascii", errors="replace").decode("ascii")
```

---

## 综合结论

| 维度 | 结果 |
|:-----|:------|
| 检测完整性 | ⚠️ 部分完整（缺CC进程检测） |
| 代码质量 | ✅ 健壮（含异常捕获/dedup/GBK防护） |
| 通知链路 | ✅ 完整（feishu-notify.py） |
| 去重机制 | ✅ 良好 |
| 日志记录 | ✅ 完整 |
| 架构边界 | ✅ 仅只读，不修改Runtime |
| 生产就绪度 | ✅ 可投入运行（Board检测需凭证） |

**总体结论**: ✅ 完整性通过（有条件）

```
条件: FEISHU_APP_ID + FEISHU_APP_SECRET 持久化后，Feishu Board 检测自动激活
缺口: Pump Runner / Claude Code 进程检测未实现（设计已存在，待下阶段实施）
```
