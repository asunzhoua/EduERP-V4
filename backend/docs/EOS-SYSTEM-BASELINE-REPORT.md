# EOS SYSTEM BASELINE REPORT

> **Version**: 1.0
> **Date**: 2026-07-18
> **Status**: FROZEN
> **Owner**: Lobster (Orchestrator)
> **Description**: EOS AI Team 当前阶段最终状态基线，冻结于龙虾自愈改造前。

---

## 1. Overall Architecture

### 1.1 三层架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Orchestrator（龙虾 / GLM5）                           │
│                                                                 │
│  职责:                                                          │
│  ├─ Mission Planning        — 任务拆解、优先级排序               │
│  ├─ Dispatch               — spawn_subagent → Worker Agent     │
│  ├─ Governance             — CCAI 规则制定与审计               │
│  └─ Audit                  — Evidence 审计、Gate 决策           │
│                                                                 │
│  限制:                                                          │
│  ├─ ❌ 不直接执行代码                                           │
│  ├─ ❌ 不绕过 Pump Runner                                       │
│  └─ ❌ 不直接调用 Claude Code                                   │
│                                                                 │
│  当前模式: 纯被动 — 等待用户输入后响应                           │
│  工作流: 收到任务 → 拆解 → spawn_subagent → 审核 Evidence       │
└─────────────────────────────────────────────────────────────────┘
                            │
               mission.json / task dispatch
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Pump Runner（非 AI 脚本）                              │
│                                                                 │
│  实现: pump-runner.py (Python 3.10+, 单文件, 无外部依赖)        │
│                                                                 │
│  职责:                                                          │
│  ├─ Task Queue Management     — 串行执行任务队列                │
│  ├─ CLI Invocation            — 调用 Claude Code --print       │
│  ├─ Retry Logic               — max_retries=2 / task           │
│  ├─ Failure Pause             — max_consecutive_failures=2     │
│  ├─ Resume Support            — 中断恢复，跳过已完成            │
│  ├─ State Persistence         — .missions/{id}/mission.state   │
│  └─ Evidence Collection       — stdout/stderr/meta 文件         │
│                                                                 │
│  状态机:                                                        │
│  CREATED → RUNNING → (任务循环) → COMPLETED                     │
│                    → PAUSED (连续失败≥2)                        │
│                    → FAILED (不可恢复)                           │
│                    → ABORTED (手动中止)                          │
│  PAUSED → RUNNING (resume)                                      │
│                                                                 │
│  已验证: 28/28 tasks COMPLETED, 54min 稳定运行                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                  claude --print [prompt]
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Claude Code CLI（v2.1.211）                           │
│                                                                 │
│  职责:                                                          │
│  ├─ Coding                  — 创建/修改代码文件                │
│  ├─ Testing                 — 执行测试套件                     │
│  ├─ Refactoring             — 代码重构、优化                   │
│  └─ Documentation           — 生成文档、报告                   │
│                                                                 │
│  调用方式: claude --print (stdin prompt → stdout output)        │
│  代理路径: QwenPaw CLI → CCSwitch (127.0.0.1:15722) → OpenCode  │
│  模型映射: deepseek-v4-flash / mimo-v2.5                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 完整数据流

```
主人指令 / Feishu CREATED
    │
    ▼
Orchestrator (龙虾)            ← Plan / Governance / Audit
    │
    ├─ 创建/分配 Mission
    ├─ spawn_subagent → Worker  (不直接执行)
    └─ 审计 Evidence → Gate 决策
    │
    ▼
mission.json
    │
    ▼
Pump Runner                    ← 纯脚本调度
    │
    ├─ start / resume
    ├─ 状态持久化 (.missions/{id}/)
    └─ 重试/暂停逻辑
    │
    ▼
Claude Code CLI --print        ← 唯一代码执行者
    │
    ├─ Coding / Testing / Docs
    └─ stdout/stderr → Evidence
    │
    ▼
Evidence
    ├─ mission.state
    ├─ stdout.log / stderr.log
    └─ 生成的文件
```

### 1.3 技术栈

| 组件 | 版本/路径 | 说明 |
|:-----|:----------|:-----|
| Python | 3.10+ | Pump Runner 运行环境 |
| Claude Code CLI | v2.1.211 | `C:\Users\sunz\AppData\Roaming\npm\claude.cmd` |
| CCSwitch | v3.17.0 | 代理桥，端口 15722，已启用 |
| OpenCode API | deepseek-v4-flash / mimo-v2.5 | 模型能力提供 |
| Feishu API | v2/v3 | 控制面 API |
| Pump Runner | `pump-runner.py` | `C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\` |
| Governance Repo | `git@github.com:asunzhoua/qwenpaw-eos-governance.git` | 4层治理文件 |

---

## 2. Feishu Control Plane Status

### 2.1 当前状态

| 项目 | 状态 |
|:-----|:------|
| Feishu App | ✅ 已创建 — App ID: `cli_aad065c7f678dcee` |
| API 权限 | ✅ 已配置 — `wiki:wiki`, `wiki:wiki:readonly`, `drive:drive`, `sheets:spreadsheet` |
| 权限审批 | ✅ 已发布 v1.0.0 并审通过 |
| EOS AI Workspace | ✅ 已创建 — space_id: `BbKawkY9kiQqWIk9JuHcgDaynrh` |
| Mission Board | ✅ 已部署 — token: `UTWZs3CKYhmkpotK3DDczrwDnId`, sheet_id: `40e76d` |
| Schema | ✅ 13列完成（A-M）：Mission ID, Name, Description, Status, Owner, Executor, Priority, Created Time, Started Time, Finished Time, Evidence Link, Result, Tag |
| 状态集 | CREATED, RUNNING, PAUSED, FAILED, COMPLETED, ABORTED |

### 2.2 已验证的能力

| 能力 | 状态 | 工具 |
|:-----|:-----|:-----|
| Workspace 创建 | ✅ | `feishu_bootstrap.py`（空间由浏览器手动创建） |
| Mission Board 创建 | ✅ | `feishu_bootstrap.py` |
| Schema 更新 | ✅ | `update-existing-board.py` |
| Export（飞书 → mission.json） | ✅ | `feishu-to-mission.py` |
| Import（mission.json → 飞书回写） | ✅ | `mission-to-feishu.py` |
| 状态回写（智能 diff） | ✅ | 只写变化的单元格 |

### 2.3 完整闭环验证

```
Feishu CREATED                           ← Row 2 写入 M-2026-07-18-TEST-001
    │
    ▼
feishu-to-mission.py                     ← .missions/TEST-001/mission.json
    │
    ▼
pump-runner.py start                     ← 状态: CREATED → RUNNING
    │
    ▼
Claude Code CLI                          ← 真实执行：创建文件 + 读取 package.json
    │
    ▼
Evidence                                 ← stdout.log / mission.state
    │
    ▼
mission-to-feishu.py                     ← 回写: Status/Time/Evidence/Result
    │
    ▼
Feishu COMPLETED ✅                       ← 闭环完成
```

### 2.4 代码工具清单

| 工具 | 路径 | 用途 |
|:-----|:-----|:-----|
| `feishu_bootstrap.py` | `backend/tools/feishu_bootstrap.py` | 初始化飞书资源 |
| `update-existing-board.py` | `backend/tools/update-existing-board.py` | 更新已部署表的 Schema |
| `feishu-to-mission.py` | `backend/tools/feishu-to-mission.py` | 飞书行 → mission.json |
| `mission-to-feishu.py` | `backend/tools/mission-to-feishu.py` | state → 飞书回写 |

### 2.5 文档清单

| 文档 | 路径 | 内容 |
|:-----|:-----|:------|
| 架构设计 | `backend/docs/FEISHU-ARCHITECTURE-DESIGN.md` | 整体架构、权限、证据流 |
| 实施报告 | `backend/docs/FEISHU-BOOTSTRAP-IMPLEMENTATION.md` | Bootstrap 实施过程 |
| Schema 审计 | `backend/docs/FEISHU-CONTROL-PLANE-REPORT.md` | Phase 1 架构审计 |
| 字段映射 | `backend/docs/FEISHU-MISSION-SCHEMA.md` | 飞书 ↔ mission.json 映射 |
| Schema 确认 | `backend/docs/FEISHU-MISSION-BOARD-SCHEMA-AUDIT.md` | Schema 变更审计 |
| 实现报告 | `backend/docs/FEISHU-CONTROL-PLANE-IMPLEMENTATION-REPORT.md` | Phase 3 实现报告 |
| 闭环验证 | `backend/docs/FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md` | 完整闭环验证报告 |
| System of Record | `backend/docs/SystemOfRecord.md` | 数据权威来源定义 |

### 2.6 未完成

| Phase | 描述 | 状态 |
|:------|:-----|:-----|
| Phase C | 飞书通知（状态变化推送） | ⏳ 未开始 |
| Phase D | 双向同步 | ⏳ 未开始 |
| Phase E | 飞书机器人自然语言入口 | ⏳ 最后 |

---

## 3. Pump Runner Status

### 3.1 架构总结

```
┌─────────────────────────────────────────────┐
│  Pump Runner (pump-runner.py)               │
│                                              │
│  CLI: start / resume / status / abort        │
│                                              │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Task    │─▶│ Claude   │─▶│ Evidence   │  │
│  │ Queue   │  │ Code CLI │  │ Collection │  │
│  └─────────┘  └──────────┘  └────────────┘  │
│       │            │               │         │
│       ▼            ▼               ▼         │
│  ┌─────────────────────────────────────┐    │
│  │  State Persistence                  │    │
│  │  .missions/{id}/mission.state       │    │
│  │  .mission.state.bak (atomic write)  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 3.2 验证结果

| Mission | Status | Tasks | Duration | 说明 |
|:--------|:-------|:------|:---------|:-----|
| PUMP-STABILITY-001 | ✅ COMPLETED | 8/8 | ~5 min | 多类型任务混合（读取、修改、测试） |
| PUMP-STABILITY-8H | ✅ COMPLETED | 20/20 | ~49 min | 全量执行（文件读取6 + 测试5 + 代码分析9） |
| M-2026-07-18-TEST-001 | ✅ COMPLETED | 1/1 | ~1 min | 飞书控制面闭环验证 |
| **总计** | **28/28 PASS** | **28** | **~54 min** | — |

### 3.3 稳定性测试

| 测试 | 场景 | 结果 |
|:-----|:-----|:------|
| Test A: 中断恢复 | Shell timeout 杀死 pump runner | ✅ PASS — resume 跳过已完成，继续未完成 |
| Test B: CLI 失败恢复 | 手动杀 claude.exe (PID 5860, 2972) | ✅ PASS — 自动 retry, 新进程执行 |
| Test C: 连续失败暂停 | 2 次连续失败 | ✅ PASS — max_consecutive_failures=2 → PAUSED |

### 3.4 配置参数

| 参数 | 默认值 | 说明 |
|:-----|:-------|:-----|
| `max_retries` | 2 | 每个任务最多重试2次（共3次尝试） |
| `max_consecutive_failures` | 2 | 连续失败2次 → PAUSED |
| `retry_delay_seconds` | 30 | 重试等待时间 |
| `cli_timeout_seconds` | 600 | Claude Code CLI 超时 |

### 3.5 已知限制

| 限制 | 说明 | 影响 |
|:-----|:-----|:-----|
| 单任务串行 | 一次只执行一个 task | 长任务集耗时长 |
| SIGTERM 捕获不完全 | Shell timeout 杀死时 state 卡 RUNNING | 需手动 fix（可改进） |
| 无 token 统计 | 不追踪 API token 消耗 | 无法做成本分析 |

### 3.6 文件结构

```
pump-runner.py                    ← 单文件实现 (~12.5KB)
backend/docs/
├── PUMP-RUNNER-ARCHITECTURE.md   ← 架构定义 (481行)
└── PUMP-RUNNER-STABILITY-REPORT.md  ← 稳定性报告
.missions/                        ← Run-time 数据
├── PUMP-STABILITY-001/
├── PUMP-STABILITY-8H/
├── M-2026-07-18-TEST-001/
├── pump-test-001/                ← ⏸️ 遗留 PAUSED
├── pump-test-002/                ← ✅ COMPLETED
├── pump-test-003/                ← ✅ COMPLETED
├── stability-001/                ← 旧命名，无 state
└── stability-8h/                 ← 旧命名，无 state
```

---

## 4. CCAI Governance Status

### 4.1 规则层次结构

```
Level 0: 唯一事实层          SYSTEM_FACTS.md
Level 1: 治理规则            RULE_LIBRARY.md (P0/P1/P2)
Level 2: 执行协议            EXECUTION_PROTOCOL.md
Level 3: 执行模式            EXECUTION_MODE.md
```

### 4.2 核心规则

| Rule ID | Name | Type | 内容 |
|:--------|:-----|:-----|:------|
| CCAI-017 | Agent Role Separation v1.1 | P0 | 龙虾 = 调度者 ≠ 执行者 |
| CCAI-018 | Trusted Executor Permission Policy | P0 | CC 权限边界 |
| CCAI-019 | Capability Factory Governance v1.1 | P0 | Pattern 强制 + Evidence 三权分立 |
| CCAI-020 | Runtime Truth Rule | P0 | Execution Plan + Actual Runtime 强制输出 |
| GR-001 | Reality First | P0 Root | 真实系统 > 模型经验 |
| GR-007 | CC Is The Only Executor | P0 Root | 龙虾不得替代执行 |
| GR-013/014 | Mission Continuity | P0 Root | Pipeline 确认后自动推进 |

### 4.3 角色定义（硬性）

| 角色 | 模型 | 职责 | 可执行代码 |
|:-----|:-----|:------|:----------|
| **龙虾（Orchestrator）** | GLM5 | 规划、审计、治理 | ❌ 永不可 |
| **Pump Runner** | — | 调度、状态管理、证据收集 | ✅ 非 AI 脚本 |
| **Claude Code（Executor）** | CC | 编码、测试、文档 | ✅ 唯一权限 |
| **Worker Agent** | — | 任务执行（通过 spawn_subagent） | 由 CC 执行 |
| **OpenCode API** | — | 模型能力提供 | ❌ 不是 Agent |

### 4.4 Governance 仓库

| 项目 | 状态 |
|:-----|:------|
| 远程仓库 | `git@github.com:asunzhoua/qwenpaw-eos-governance.git` |
| 最新 SHA | `8df9c96`（共3次提交） |
| 文件 | SYSTEM_FACTS.md, RULE_LIBRARY.md, EXECUTION_PROTOCOL.md, EXECUTION_MODE.md |
| 已验证 | ✅ Mission Completion Protocol 9步全 PASS |

### 4.5 CCAI 本地文档

| 文档 | 路径 |
|:-----|:------|
| Runtime Naming Governance v1.1 | `docs/CCAI/Runtime-Naming-Governance-v1.1.md` |
| Runtime Registry | `docs/CCAI/Runtime-Registry.md` |
| Governance Version Index | `docs/CCAI/Governance-Version-Index.md` |
| CCAI-020 Runtime Truth Rule | `docs/CCAI/CCAI-020-Runtime-Truth-Rule-v1.0.md` |
| Claude Code Qualification | `docs/CCAI/CCAI-CC-001-Claude-Code-Qualification.md` |
| CCAI-017 Violation Record | `docs/CCAI/Deviations/DEV-2026-07-17-001.md` |
| CCAI-017 Correction | `docs/CCAI/Deviations/DEV-2026-07-17-001-CORRECTION.md` |

---

## 5. 环境清单

### 5.1 系统文件

| 文件 | 路径 | 状态 |
|:-----|:-----|:------|
| AGENTS.md | 工作区根 | ✅ 已审计 — 缺 Session Recovery |
| HEARTBEAT.md | 工作区根 | ✅ 已审计 — 缺系统健康检测 |
| MEMORY.md | 工作区根 | ✅ 已审计 — 缺状态追踪 |
| PROFILE.md | 工作区根 | ✅ 基础配置完成 |
| SOUL.md | 工作区根 | ✅ 核心准则定义 |

### 5.2 项目目录

```
C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\
├── pump-runner.py                    ← Pump Runner 执行文件
├── backend/
│   ├── tools/
│   │   ├── feishu_bootstrap.py       ← 飞书初始化工具
│   │   ├── feishu-to-mission.py      ← 飞书 → mission.json
│   │   ├── mission-to-feishu.py      ← state → 飞书回写
│   │   └── update-existing-board.py  ← Schema 更新工具
│   ├── docs/
│   │   ├── PUMP-RUNNER-ARCHITECTURE.md
│   │   ├── PUMP-RUNNER-STABILITY-REPORT.md
│   │   ├── FEISHU-ARCHITECTURE-DESIGN.md
│   │   ├── FEISHU-BOOTSTRAP-IMPLEMENTATION.md
│   │   ├── FEISHU-CONTROL-PLANE-REPORT.md
│   │   ├── FEISHU-MISSION-SCHEMA.md
│   │   ├── FEISHU-MISSION-BOARD-SCHEMA-AUDIT.md
│   │   ├── FEISHU-CONTROL-PLANE-IMPLEMENTATION-REPORT.md
│   │   ├── FEISHU-CONTROL-PLANE-VALIDATION-REPORT.md
│   │   ├── FEISHU-EXPORT-TEST-REPORT.md
│   │   ├── SystemOfRecord.md
│   │   └── ORCHESTRATOR-RECOVERY-AUDIT.md   ← 新建（自恢复审计）
│   ├── src/                          ← NestJS 后端源码
│   └── test/                         ← 测试文件
├── .missions/                        ← Runtime 数据（8个任务）
└── docs/                             ← CCAI / CCAI 文档
```

### 5.3 .missions/ 完整状态

| Mission ID | Status | Tasks | 说明 |
|:-----------|:-------|:------|:-----|
| PUMP-STABILITY-001 | ✅ COMPLETED | 8/8 | 稳定性测试1 |
| PUMP-STABILITY-8H | ✅ COMPLETED | 20/20 | 稳定性测试2 |
| M-2026-07-18-TEST-001 | ✅ COMPLETED | 1/1 | 飞书闭环验证 |
| pump-test-001 | ⏸️ PAUSED | — | 遗留（可清理） |
| pump-test-002 | ✅ COMPLETED | — | 早期测试 |
| pump-test-003 | ✅ COMPLETED | — | 早期测试 |
| stability-001 | — | — | 空目录（旧命名） |
| stability-8h | — | — | 空目录（旧命名） |

---

## 6. 安全与风险

### 6.1 EduERP-V4 未解决问题

| # | 问题 | 位置 | Severity |
|:---|:-----|:-----|:---------|
| 1 | `.gitignore` 不存在 | 根目录 | 🔴 P0 |
| 2 | 硬编码 DB 密码 (`root`) | `.env:6` | 🔴 P0 |
| 3 | 硬编码 JWT 密钥 | `.env:9-10` | 🔴 P0 |
| 4 | 硬编码管理员密码 (`admin123`) | `database/seeds/seed.service.ts:80` | 🔴 P0 |
| 5 | 12 个 TS 编译错误 | `isolatedModules` 配置问题 | 🟡 P1 |

### 6.2 系统已知问题

| ISS-ID | Severity | 问题 |
|:-------|:---------|:-----|
| REC-001 | 🔴 P0 | 新会话无状态恢复 |
| REC-002 | 🔴 P0 | 无系统主动健康检查 |
| REC-003 | 🟡 P1 | 无 Feishu Board 自动扫描 |
| REC-004 | 🟡 P1 | 无 Stale Mission 检测 |
| REC-005 | 🟡 P1 | 无 Cron 监控 |
| REC-006 | 🟢 P2 | 无 Evidence 新鲜度检查 |
| REC-007 | 🟢 P2 | 无主动通知机制 |

---

## 7. 冻结声明

本基线文档记录了 EOS AI Team 在 2026-07-18 的完整系统状态。

在此之后 AGENTS.md / HEARTBEAT.md 的任何修改，都应在此基线基础上对比，记录变更点。
