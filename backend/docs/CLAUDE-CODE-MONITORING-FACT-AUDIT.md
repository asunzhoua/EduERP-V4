# Claude Code Monitoring Fact Audit

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **审计方法**: 事实验证，仅基于已有数据  
> **原则**: 禁止假设，禁止推测

---

## 数据源清查

| 数据源 | 是否存在 | 路径 |
|:-------|:---------|:------|
| `.missions/` 目录 | ❌ 不存在 | `C:\Users\sunz\.qwenpaw\workspaces\default\.missions\` |
| mission.state 样本 | ❌ 无可读样本 | 仅在 Pump Runner 运行时存在 |
| Pump Runner evidence | ❌ 无当前证据 | 上一轮测试证据未保留 |
| heartbeat_check.py | ✅ 存在 | `backend/tools/heartbeat_check.py` |
| CLAUDE-CODE-MONITORING-DESIGN.md | ✅ 存在 | `backend/docs/CLAUDE-CODE-MONITORING-DESIGN.md` |
| feishu-notify.py | ✅ 存在 | `backend/tools/feishu-notify.py` |
| EOS-NEXT-PHASE-ROADMAP.md | ✅ 存在 | `backend/docs/EOS-NEXT-PHASE-ROADMAP.md` |
| Pump Runner Stability Report | ✅ 存在 | `backend/docs/PUMP-RUNNER-STABILITY-REPORT.md` |

---

## 审计项

### Q1: 当前是否能判断 Claude Code 是否启动？

**结论**: ❌ 不可判断

**理由**:
1. `heartbeat_check.py` 中**无任何** `tasklist` / `Get-Process` / `wmic` 进程检测
2. CLAUDE-CODE-MONITORING-DESIGN.md L36 设计了进程检测（`tasklist /FI "IMAGENAME eq claude.exe"`），但**未部署**
3. `.missions/` 目录不存在时，无法通过 state 文件判断 CC 是否启动

**证据**:
- `heartbeat_check.py` 全文搜索 `tasklist` / `claude` / `Get-Process` → **0 匹配**
- `heartbeat_check.py` L281-L350 (check_runtime_state): 仅扫描 mission.state，无进程检测
- `CLAUDE-CODE-MONITORING-DESIGN.md` L36: `claude.exe 进程 | tasklist | 进程不存在 → CRASHED` — **仅设计未实现**

---

### Q2: 当前是否能判断 Claude Code 是否退出？

**结论**: ⚠️ 部分可实现（间接）

**理由**:
1. Pump Runner 运行的 task 会在 mission.state 中写入状态变化（RUNNING→COMPLETED/FAILED）
2. heartbeat_check.py L281-L350 可读取 mission.state 中的 status 字段
3. 但当前 `.missions/` 目录空，无实际状态文件可读

**直接判断方法**: 不可实现 → 无进程检测
**间接判断方法**: 可实现 → 通过 mission.state.status 变化

| 判断方式 | 能否实现 | 当前状态 |
|:---------|:---------|:---------|
| tasklist 直接查进程 | ❌ 不能 | 未实现 |
| mission.state status=COMPLETED | ✅ 可以 | 已实现（L290-L350） |
| mission.state status=FAILED | ✅ 可以 | 已实现（L290-L350） |

**证据**:
- `heartbeat_check.py` L290-295: `if status == "FAILED"` 检测
- `heartbeat_check.py` L300-320: `if status == "RUNNING"` → 超时检测
- PUMP-RUNNER-STABILITY-REPORT.md: 已验证 Pump Runner 会在任务完成时更新 state

---

### Q3: 当前是否能判断 Claude Code 是否失败？

**结论**: ⚠️ 部分可实现（仅限于 Pump Runner 管理的任务）

**理由**:
1. Pump Runner 在每个任务完成后生成 `evidence/exit_code` 文件
2. mission.state 在任务失败时写入 status=FAILED
3. heartbeat_check.py L292 检测 FAILED 状态
4. 但 CC 本身崩溃（非 Pump Runner 管理的场景）无法检测

| 判断方式 | 能否实现 | 当前状态 |
|:---------|:---------|:---------|
| mission.state=FAILED | ✅ 可以 | `heartbeat_check.py` L292-293 |
| evidence/exit_code≠0 | ⚠️ 可实现 | 未在心跳中实现（只在设计文档中） |
| CC 进程消失 | ❌ 不能 | 未实现 |
| CC stderr 含错误 | ❌ 不能 | 未实现 |

**证据**:
- `heartbeat_check.py` L281-L350: 有 FAILED 检测，但证据行号 L292
- `CLAUDE-CODE-MONITORING-DESIGN.md` L35: 设计了 exit_code 检测，**未部署**
- `heartbeat_check.py` 全文: 无 evidence/exit_code 读取逻辑

---

### Q4: 当前是否能判断 Claude Code 是否卡死？

**结论**: ✅ 部分可判断（通过 STALE 检测）

**理由**:
1. heartbeat_check.py L300-320 实现了 RUNNING 状态的 updated_at 超时检测
2. 阈值: 30 分钟（`STALE_MINUTES = 30`，L45）
3. 支持 ISO 格式和 Unix 时间戳两种时间格式

**限制**:
- 仅能检测 Pump Runner 写入的 mission.state
- 如果 Pump Runner 本身崩溃（不更新 state），卡死检测也会失效
- CC 进程卡死但 Pump Runner 正常 → 30分钟内可检出

**证据**:
- `heartbeat_check.py` L300-315: `age_minutes = (now - updated_ts) / 60` + `if age_minutes > STALE_MINUTES`
- `STALE_MINUTES = 30` (L45)
- notifies WARNING (`send_notification("WARNING", ...)`) at L320

---

## 综合审计结论

| 监控能力 | 可判断性 | 实现状态 | 缺失原因 |
|:---------|:---------|:---------|:---------|
| CC 是否启动 | ❌ 不可判断 | 未实现 | 无进程检测 |
| CC 是否退出 | ⚠️ 间接可判 | 部分实现 | 需 mission.state 存在 |
| CC 是否失败 | ⚠️ 部分可判 | 部分实现 | 有 FAILED 检测，无 evidence 分析 |
| CC 是否卡死 | ✅ 部分可判 | 已实现 | 30分钟 STALE 检测 |

### 差距分析

```
当前覆盖:
  mission.state status 检测 ─── ✅ FAILED/PAUSED/STALE
  Liveness 检测 ───────────────── ✅ 4h空闲通知
  通知去重 ────────────────────── ✅ notifications.state

未覆盖:
  tasklist 进程检测 ───────────── ❌ 设计存在，未部署
  evidence/exit_code 分析 ─────── ❌ 设计存在，未部署
  CC stdout 实时心跳 ──────────── ❌ 仅设计
  Pump Runner 进程检测 ────────── ❌ 未设计
```

**总体结论**: ⚠️ 当前只能通过 mission.state 间接监控 Claude Code。直接进程检测和 evidence 分析均未实现。30分钟 STALE 检测是唯一可用的 CC 异常判定手段。
