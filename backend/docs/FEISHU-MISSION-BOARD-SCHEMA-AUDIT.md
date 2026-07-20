# FEISHU-MISSION-BOARD-SCHEMA-AUDIT.md

> Version: 1.0
> Date: 2026-07-18
> Status: ✅ COMPLETED

## 1. Schema 最终确认

### 列定义 (A-M, 13列)

| 列 | 名称 | 类型 | 说明 |
|:---|:-----|:-----|:-----|
| A | Mission ID | text | 唯一标识 |
| B | Mission Name | text | 任务名称 |
| C | Description | text | 任务描述（导出为 task prompt） |
| D | Status | text | 枚举值见下方 |
| E | Owner | text | 负责人 |
| F | Executor | text | 执行器（Pump Runner / CC） |
| G | Priority | text | P0/P1/P2/P3 |
| H | **Created Time** | date | **新增列** |
| I | **Started Time** | date | **原名 Start Time** |
| J | **Finished Time** | date | **原名 End Time** |
| K | Evidence Link | text | 执行结果链接 |
| L | Result | text | 执行摘要 |
| M | Tag | text | 分类标签 |

### Status 允许值

```
CREATED → RUNNING → COMPLETED
                  → FAILED
                  → PAUSED
                  → ABORTED (新增)
```

| 状态 | 说明 |
|:-----|:------|
| CREATED | 飞书新建，未调度 |
| RUNNING | 已调度给 Pump Runner |
| PAUSED | 暂停（连续失败或手动中止） |
| FAILED | 执行失败 |
| COMPLETED | 全部任务完成 |
| ABORTED | 手动终止（与 FAILED 区分） |

## 2. 变更记录

| # | 操作 | 旧值 | 新值 | 时间 |
|:--|:-----|:-----|:-----|:-----|
| 1 | 新增列 | — | H: Created Time | 2026-07-18 |
| 2 | 重命名 | H: Start Time | I: Started Time | 2026-07-18 |
| 3 | 重命名 | I: End Time | J: Finished Time | 2026-07-18 |
| 4 | 右移 | J: Evidence Link | K: Evidence Link | 2026-07-18 |
| 5 | 右移 | K: Result | L: Result | 2026-07-18 |
| 6 | 右移 | L: Tag | M: Tag | 2026-07-18 |
| 7 | 新增状态 | — | ABORTED | 2026-07-18 |

## 3. 生产环境验证

- Board Token: `UTWZs3CKYhmkpotK3DDczrwDnId`
- Sheet ID: `40e76d`
- 所有 13 列已写入 ✅
- 原有数据无损 ✅

## 4. 关联文档

- `FEISHU-CONTROL-PLANE-REPORT.md` (Phase 1 架构 + 数据流)
- `FEISHU-MISSION-SCHEMA.md` (Phase 2 字段映射)
- `FEISHU-CONTROL-PLANE-IMPLEMENTATION-REPORT.md` (Phase 3 实现)
