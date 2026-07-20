# Feishu Architecture Design

> **Version**: 1.0  
> **Date**: 2026-07-18  
> **Status**: Draft  
> **Author**: EOS AI Team  
> **RelatedDocuments**:
> - PumpRunnerArchitecture: `backend/docs/PUMP-RUNNER-ARCHITECTURE.md`
> - StabilityReport: `backend/docs/PUMP-RUNNER-STABILITY-REPORT.md`
> - EOSGovernance: qwenpaw-eos-governance repo
> - CCAIGovernance: `docs/CCAI/Capability-Pattern/`

## 1. Workspace Architecture

### 1.1 Top-Level Directory Structure

飞书空间顶层目录：

| 目录 | 用途 | 权限 | 生命周期 |
|:-----|:-----|:-----|:---------|
| Governance/ | 治理规则存放 | Owner + Orchestrator 可写，其他只读 | 永久，更新时版本归档 |
| Missions/ | 每个 Mission 一个子目录 | Orchestrator 创建管理，Executor 提交报告 | Mission 完成后30天归档 |
| Architecture/ | 系统架构文档、CCAI 治理文档 | Owner + Orchestrator 可写 | 永久 |
| Evidence/ | 汇总报告 + 审计结论 | Orchestrator/Executor 上传，Viewer 只读 | 90天滚动清理 |
| Operations/ | 运维日志、日常运营 | Owner 全部 | 按内容类型定 |
| EduOS/ | Education OS 相关文档 | 按需分配 | 持续更新 |
| Archive/ | 归档记录 | 全部只读 | 永久保留 |

每个目录下必须有 README.md 说明用途和索引。

### 1.2 Directory Detail

#### Governance/

```
Governance/
├── README.md                    # 目录说明与索引
├── RULE_LIBRARY.md              # P0-P2 治理规则
├── SystemOfRecord.md            # 系统记录 - 各类型数据的权威来源
├── EXECUTION_PROTOCOL.md        # 执行协议
├── EXECUTION_MODE.md            # 执行模式
├── SYSTEM_FACTS.md              # 系统事实层
└── archive/                     # 旧版归档
    ├── v1.0_RULE_LIBRARY.md
    └── v1.0_EXECUTION_PROTOCOL.md
```

说明：存放 EOS 治理体系的全部规则文档。版本更新时旧版移至 archive/ 目录。

#### Missions/

```
Missions/
├── README.md                    # 目录说明与索引
├── MissionBoard.md              # 多维表格链接说明
├── M-2026-07-17-001/            # 示例：Mission 子目录
│   ├── mission-summary.md       # Mission 执行摘要
│   ├── status-log.json          # 状态变更日志
│   └── execution-report.md      # Executor 提交的执行报告
├── M-2026-07-17-002/
└── M-2026-07-18-001/
```

说明：每个 Mission 独立子目录，包含摘要、状态日志和执行报告。Mission 完成后30天移至 Archive/。

#### Architecture/

```
Architecture/
├── README.md                    # 目录说明与索引
├── Runtime-Architecture.md      # 三层架构设计
├── CCAI-Governance.md           # CCAI 治理体系
├── Pattern-Library.md           # 模式库
├── Teaching-Blueprint.md        # Teaching Capability Blueprint
└── Assessment-Blueprint.md      # Assessment Capability Blueprint
```

说明：系统架构文档，Orchestrator 维护更新。

#### Evidence/

```
Evidence/
├── README.md                    # 目录说明与索引
├── Runtime-Reports/             # 运行汇总报告
│   ├── 2026-07-17-stability-001.md
│   └── 2026-07-17-night-mission.md
├── Audit-Reports/               # 审计报告
│   ├── ORCH-002-Final-Report.md
│   └── Phase0-Audit-Report.md
├── Test-Reports/                # 测试报告
│   └── 2026-07-17-test-summary.md
└── Failure-Reports/             # 失败分析报告
    └── DEV-2026-07-17-001.md
```

说明：不存储原始日志（原始 Evidence 在本地 .missions/ 目录），只保存汇总报告和审计结论，90天滚动清理。

#### Operations/

```
Operations/
├── README.md
├── Runtime-Logs/                # 运行日志
├── Daily-Notes/                 # 每日运营
└── Metrics/                     # 运行指标
```

#### EduOS/

```
EduOS/
├── README.md
├── Course-Designs/              # 课程设计
├── Student-Records/             # 学生管理
└── Assessment/                  # 评估体系
```

#### Archive/

```
Archive/
├── README.md
└── Missions-Archive/            # 已归档 Mission
    └── M-2026-07-01-001/
```

---

## 2. Mission Management Design

### 2.1 Mission Board（飞书多维表格）

飞书多维表格作为 Mission Board，字段定义：

| 字段 | 类型 | 说明 |
|:-----|:-----|:-----|
| Mission ID | 文本，格式：M-YYYY-MM-DD-NNN | 唯一标识，自动生成 |
| Mission Name | 文本 | 简短描述 |
| Description | 文本，多行 | 详细描述 |
| Status | 单选 | CREATED / RUNNING / PAUSED / FAILED / COMPLETED |
| Owner | 人员 | 当前只能是 Lobster |
| Executor | 文本 | Pump Runner / Claude Code / Manual |
| Priority | 单选 | P0 / P1 / P2 / P3 |
| Start Time | 日期 | 开始时间 |
| End Time | 日期 | 结束时间 |
| Evidence Link | 超链接 | 指向 Evidence 目录或文档 |
| Result | 文本 | 执行摘要 |
| Tag | 多选 | stability / governance / edu / devops / feature / bugfix |

### 2.2 Views

| 视图名称 | 过滤条件 | 排序 |
|:---------|:---------|:-----|
| Active Missions | Status ≠ COMPLETED, FAILED | 按 Priority 降序 |
| My Missions | Owner = 当前用户 | 按 Start Time 降序 |
| Recent Archive | Status = COMPLETED, 最近30天 | 按 End Time 降序 |

### 2.3 Status State Machine

状态流转定义：

```
CREATED ──start──→ RUNNING ──complete──→ COMPLETED
  ↑                   │
  │      ┌────────────┤
  │      │            ↓
  │      │         PAUSED
  │      │            │
  │      └──resume────┘
  │
  └──fail──→ FAILED
```

状态映射说明：

| 状态 | 触发条件 |
|:-----|:---------|
| CREATED | mission.json 创建后 |
| RUNNING | pump runner start 后 |
| PAUSED | pump runner 暂停或人工暂停 |
| FAILED | mission 失败（含超过重试次数） |
| COMPLETED | 所有 task 完成 |

禁止创建 Runtime 没有的状态。

---

## 3. Evidence Architecture

### 3.1 Evidence Relationship

证据层级关系：

```
物理证据（本地 .missions/）
    ├── stdout.log          # 标准输出
    ├── stderr.log          # 错误输出
    └── meta.json           # 元数据（exit code, duration, retry count）
        │
        ▼
汇总报告（飞书 Evidence/）
    ├── Runtime Report      # 运行汇总（任务数、通过数、失败数、时长）
    ├── Audit Report        # 审计结论、问题列表、风险评级
    ├── Test Report          # 测试结果（套件数、用例数、通过率、覆盖率变化）
    └── Failure Report      # 失败分析（原因、重试记录、Root Cause）
```

### 3.2 报告格式规范

#### Runtime Report 结构

```json
{
  "mission_id": "M-2026-07-18-001",
  "total_tasks": 8,
  "completed": 7,
  "failed": 1,
  "retries": 2,
  "duration_seconds": 1245,
  "status": "COMPLETED_WITH_FAILURES",
  "summary": "8 tasks executed, 7 passed, 1 failed after 2 retries",
  "generated_at": "2026-07-18T10:30:00Z"
}
```

#### Audit Report 结构

```json
{
  "audit_id": "AUDIT-2026-07-18-001",
  "mission_id": "M-2026-07-18-001",
  "auditor": "Lobster",
  "conclusion": "PASS / FAIL / PASS_WITH_EXCEPTION",
  "issues": [
    {
      "id": "ISS-001",
      "severity": "P0 / P1 / P2",
      "description": "...",
      "status": "OPEN / FIXED / WONT_FIX"
    }
  ],
  "risk_level": "HIGH / MEDIUM / LOW",
  "recommendation": "...",
  "generated_at": "2026-07-18T11:00:00Z"
}
```

### 3.3 Data Flow

```
┌─────────────────────┐         ┌──────────────────────┐
│  Pump Runner         │         │  Feishu Evidence/    │
│  .missions/{id}/     │ ──────→ │  Runtime-Reports/    │
│  evidence/{task}/    │ 推送到   │  Audit-Reports/     │
│    stdout.log        │ 飞书     │  Test-Reports/      │
│    stderr.log        │ 汇总     │  Failure-Reports/    │
│    meta.json         │         │                      │
└─────────────────────┘         └──────────────────────┘
         │                              │
         │ 原始证据（唯一真实来源）       │ 管理视图（可追溯）
         │                              │
         ▼                              ▼
   本地只读，不删除              90天滚动清理
```

---

## 4. Permission Architecture

### 4.1 Role Definition

基于最小权限原则：

| 角色 | 对应实体 | 权限范围 |
|:-----|:---------|:---------|
| Human Owner | 用户（主人） | 飞书空间管理员。全部目录全部权限，最终决策，角色分配。不能直接操作 Runtime |
| Orchestrator | 龙虾（GLM5） | 飞书空间内容管理员。Governance/ 读写，Missions/ 创建编辑，Architecture/ 读写，Evidence/ 创建审计报告。不能删除任何内容 |
| Executor | Claude Code / Pump Runner | Evidence/ 上传执行结果，Missions/ 提交执行记录。只写不读 |
| Viewer | 外部审计/只读用户 | 所有目录只读。不能编辑 |

### 4.2 Permission Matrix

| 目录 | Owner | Orchestrator | Executor | Viewer |
|:-----|:------|:-------------|:---------|:-------|
| Governance/ | 读写 | 读写 | 无 | 只读 |
| Missions/ | 全部 | 创建编辑 | 提交报告 | 只读 |
| Architecture/ | 读写 | 读写 | 无 | 只读 |
| Evidence/ | 读写 | 上传+审计 | 上传 | 只读 |
| Operations/ | 全部 | 只读 | 无 | 只读 |
| EduOS/ | 全部 | 按需 | 按需 | 只读 |
| Archive/ | 只读 | 只读 | 只读 | 只读 |

### 4.3 关键约束

- Owner 不能直接操作 Runtime（遵循三层架构设计）
- Orchestrator 不能删除任何内容（保留审计追溯）
- Executor 只写不读（执行器不需要读飞书）
- Viewer 只读不写（外部审计权限）

---

## 5. Integration Roadmap

### 5.1 Phase A：设计完成（当前阶段）

**状态**：设计完成，不集成。

**工作内容**：
- ✅ 飞书架构设计文档完成
- □ 飞书空间人工搭建（按本设计创建目录结构）
- □ Mission Board 多维表格手工创建

**禁止**：不开发任何集成代码。

### 5.2 Phase B：单向推送（近期）

**目标**：Pump Runner 完成后自动推送 Mission Summary 到飞书。

**接口设计**：

```
pump-runner.py --feishu-output

参数：--feishu-output <path>
功能：Mission 完成后生成 JSON 格式的 Mission Summary
      输出到指定路径，脚本推送到飞书 Evidence/Runtime-Reports/
```

**输出示例**：

```json
{
  "mission_id": "M-2026-07-18-001",
  "name": "Mission Name",
  "status": "COMPLETED",
  "total_tasks": 8,
  "completed_tasks": 8,
  "failed_tasks": 0,
  "total_duration": 1200,
  "summary": "All tasks completed successfully",
  "evidence_path": "Evidence/Runtime-Reports/2026-07-18-mission-report.md"
}
```

**前置条件**：
- Feishu API 凭证配置
- 飞书文件夹对应的 token
- Pump Runner 增加 --feishu-output 参数

### 5.3 Phase C：Webhook 通知（中期）

**目标**：飞书接收 Mission 状态变更通知。

**交互流程**：

```
Pump Runner ──HTTP POST──→ Feishu Webhook
  (Mission完成/失败时)         (消息通知)
```

**Webhook Payload**：

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": "Mission 状态变更",
      "subtitle": "M-2026-07-18-001"
    },
    "elements": [
      { "text": "状态：COMPLETED" },
      { "text": "任务数：8/8 完成" },
      { "text": "耗时：20分钟" }
    ]
  }
}
```

**触发条件**：
- Mission 全部完成
- Mission 执行失败
- Mission 暂停

### 5.4 Phase D：双向同步（远期）

**目标**：飞书 Mission Board 状态变更可反向影响 Pump Runner。

**交互流程**：

```
Feishu Webhook ←── Mission Board 状态变更
      │
      ▼
Pump Runner ── 暂停/恢复/中止当前 Mission
```

**约束**：
- Pump Runner 必须保留作为独立执行层
- 飞书不能直接调度 Claude Code
- 飞书状态变更 → Webhook → Pump Runner 仅支持：暂停（PAUSE）、恢复（RESUME）、中止（ABORT）
- 不允许飞书创建新 Mission

**禁止的操作**：
- ❌ 飞书直接调用 Claude Code CLI
- ❌ 飞书绕过 Pump Runner 调度
- ❌ 飞书修改本地 .missions/ 目录

---

## Appendix A：Conventions

### A.1 Naming Convention

| 项目 | 规则 | 示例 |
|:-----|:-----|:-----|
| Mission ID | M-YYYY-MM-DD-NNN | M-2026-07-18-001 |
| Audit ID | AUDIT-YYYY-MM-DD-NNN | AUDIT-2026-07-18-001 |
| Directory | PascalCase | Missions/, Evidence/ |
| Markdown | 中文内容，UTF-8 | - |

### A.2 Document Template

每个飞书文档应包含 Front Matter：

```markdown
> **Version**: 1.0
> **Date**: YYYY-MM-DD
> **Status**: Draft / Review / Published / Archived
> **Owner**: Lobster
```

### A.3 File Naming Rule

- 英文文件名，PascalCase
- 目录名末尾带斜杠
- 每个目录有 README.md

---

## Appendix B：Related Documents

| 文档 | 路径 |
|:-----|:-----|
| Pump Runner Architecture | `backend/docs/PUMP-RUNNER-ARCHITECTURE.md` |
| Mission Execution Report | `backend/docs/PUMP-RUNNER-STABILITY-REPORT.md` |
| EOS Governance | Governance repo (qwenpaw-eos-governance) |
| CCAI Governance | `docs/CCAI/Capability-Pattern/` |
