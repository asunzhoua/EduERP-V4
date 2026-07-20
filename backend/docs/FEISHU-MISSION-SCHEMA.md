# FEISHU-MISSION-SCHEMA.md — 字段映射规范

> Version: 1.0
> 日期: 2026-07-18
> 状态: DRAFT
> 关联: FEISHU-CONTROL-PLANE-REPORT.md Phase 1

## 1. 概述

定义飞书 Mission Board 与 Pump Runner `mission.json` 之间的双向映射规则。

```
飞书 Mission Board (一行 = 一个 Mission)
         │
         ▼ (Mission Export → feishu-to-mission.py)
         │
mission.json → Pump Runner → Claude Code
         │
         ▼ (状态回写 → mission-to-feishu.py)
         │
飞书 Mission Board (Status/Result/Evidence 更新)
```

## 2. 字段映射表

### 2.1 飞书 → mission.json（导出方向）

| 飞书列 | Mission JSON 字段 | 类型转换 | 说明 |
|:-------|:-----------------|:---------|:-----|
| Mission ID | `id` | 直接映射 string | 唯一标识，如 `FEISHU-CP-001` |
| Mission Name | `name` | 直接映射 string | — |
| Description | `tasks[0].prompt` | Description → Claude Code prompt | 单任务模式：整段 Description 作为执行 prompt |
| Status | — | 不导出 | 状态由 Runtime 管理，飞书只读 |
| Owner | — | 暂不导出 | 元数据，运行时不需要 |
| Executor | — | 暂不导出 | 元数据 |
| Priority | `priority` | 直接映射 string | `"P0"` / `"P1"` / `"P2"` / `"P3"` |
| Created Time | `created_at` | 直接映射 ISO string | 飞书日期 → `YYYY-MM-DDTHH:MM:SSZ` |
| Started Time | — | 由 Pump Runner 填入 | 运行时写入 |
| Finished Time | — | 由 Pump Runner 填入 | 运行时写入 |
| Evidence Link | — | 由 Pump Runner 填入 | 运行时写入 |
| Result | — | 由 Pump Runner 填入 | 运行时写入 |
| Tag | `tags` | 可选映射 | 字符串数组 |

### 2.2 mission.json → 飞书（回写方向）

| Mission JSON 字段 | 飞书列 | 说明 |
|:------------------|:-------|:-----|
| `state.status` | Status | `RUNNING` / `COMPLETED` / `FAILED` / `PAUSED` / `ABORTED` |
| `state.evidence_link` | Evidence Link | 执行输出的证据路径或链接 |
| `state.result` | Result | 执行摘要 |
| `state.started_at` | Started Time | 首次 start 时间 |
| `state.finished_at` | Finished Time | mission COMPLETED/FAILED 时间 |

## 3. mission.json 输出格式

```json
{
  "id": "FEISHU-CP-001",
  "name": "扫描后端模块依赖关系",
  "description": "扫描 backend/src/modules 目录，提取各模块之间的 import 依赖",
  "source": "feishu",
  "feishu_row": 2,
  "feishu_board_token": "UTWZs3CKYhmkpotK3DDczrwDnId",
  "priority": "P1",
  "tags": ["scan", "backend"],
  "created_at": "2026-07-18T10:00:00Z",
  "tasks": [
    {
      "id": "TASK-001",
      "label": "执行任务",
      "prompt": "扫描 backend/src/modules 目录，提取各模块之间的 import 依赖"
    }
  ]
}
```

### 3.1 多任务模式（Future）

当 Description 包含 `---TASK---` 分隔符时，按分隔符拆分为多个任务：

```
Description 内容:
任务1的描述
---TASK---
任务2的描述
---TASK---
任务3的描述
```

展开为：
```json
"tasks": [
  {"id": "TASK-001", "label": "任务1", "prompt": "任务1的描述"},
  {"id": "TASK-002", "label": "任务2", "prompt": "任务2的描述"},
  {"id": "TASK-003", "label": "任务3", "prompt": "任务3的描述"}
]
```

## 4. 状态流转规则

### 4.1 允许的状态值

| 状态 | 说明 | 谁设置 |
|:-----|:-----|:-------|
| `CREATED` | 飞书新建，未调度 | 人工 / Orchestrator |
| `RUNNING` | 已调度给 Pump Runner | Orchestrator（dispatch 时） |
| `PAUSED` | 暂停（连续失败或手动中止） | Pump Runner / Orchestrator |
| `FAILED` | 执行失败 | Orchestrator（审计后） |
| `COMPLETED` | 全部任务完成 | Pump Runner |
| `ABORTED` | 手动中止 | Orchestrator |

### 4.2 状态机

```
CREATED ──▶ RUNNING ──▶ COMPLETED
              │              │
              ├────▶ FAILED  │
              │              │
              ├────▶ PAUSED ─┤
              │              │
              └────▶ ABORTED │
                             │
PAUSED ──▶ RUNNING ──────────┘
ABORTED ──▶ RUNNING (重新调度)
```

### 4.3 禁止的状态流转

| 来源 | 目标 | 禁止原因 |
|:-----|:-----|:---------|
| COMPLETED | 任何状态 | 已完成任务不可回退 |
| FAILED | RUNNING | 失败后需人工分析，不可自动重跑 |
| CREATED | COMPLETED | 跳过执行，违反流程 |

## 5. Export/Import 工具接口

### 5.1 feishu-to-mission.py
```python
# 输入：飞书 Mission Board 一行数据
# 输出：mission.json 文件
# 保存到：.missions/{mission-id}/mission.json
```

### 5.2 mission-to-feishu.py
```python
# 输入：.missions/{mission-id}/ 目录中的 state + data
# 输出：更新飞书 Mission Board 对应的行
```

## 6. 安全规则

1. **飞书只读字段**: Status, Evidence Link, Result, Started Time, Finished Time → 人工不可编辑
2. **飞书可写字段**: Mission ID, Mission Name, Description, Owner, Executor, Priority, Tag
3. **不允许**: 飞书用户直接设定状态（状态仅由 Runtime/Orchestrator 控制）
4. **证据不可删除**: Evidence Link 一旦写入，不可在飞书层面清空

## 7. 挂载点

```
.missions/{mission-id}/
├── mission.json        ← 飞书导出
├── mission.state       ← Pump Runner 状态
├── mission.data.json   ← Pump Runner 原始数据
└── evidence/           ← 执行证据
    └── {task-id}/
        ├── stdout.log
        └── stderr.log
```
