# FEISHU-CONTROL-PLANE-REPORT.md — Phase 1: Mission Board Schema Audit

> 日期: 2026-07-18
> 状态: DRAFT → AUDITED

## 1. 当前架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      飞书 App (Control Plane)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              EOS AI Workspace (知识库空间)                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │Governance│ │Operations│ │Capability│ │Development   │  │  │
│  │  │          │ │          │ │Registry  │ │              │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Mission Board (多维表格)                       │  │
│  │  [Mission ID | Name | Desc | Status | ... | Evidence]     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼ (Mission Export → mission.json)
┌─────────────────────────────────────────────────────────────────┐
│                    Runtime Layer                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Pump Runner │───▶│ Claude Code  │───▶│   Evidence       │   │
│  │  (调度器)     │    │  (执行器)     │    │   (state + log)  │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼ (状态回写)
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator (龙虾 / GLM5)                    │
│  审计 Evidence → 更新飞书 Mission Board → 通知用户                │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 数据流

```
Feishu (创建)    Orchestrator     Pump Runner     Claude Code     Feishu (反馈)
   │                  │               │               │              │
   │ 1. 填写 Mission   │               │               │              │
   ├──────────────────▶│               │               │              │
   │                  │ 2. 导出        │               │              │
   │                  │ mission.json   │               │              │
   │                  ├───────────────▶│               │              │
   │                  │               │ 3. 调度任务    │              │
   │                  │               ├──────────────▶│              │
   │                  │               │               │ 4. 执行      │
   │                  │               │               │──────────▶   │
   │                  │               │               │ 5. Evidence  │
   │                  │               │◀──────────────┤              │
   │                  │ 6. 审计       │               │              │
   │                  │◀──────────────┤               │              │
   │                  │ 7. 回写状态    │               │              │
   │◀─────────────────┤               │               │              │
   │                  │               │               │              │
```

## 3. Mission Board Schema 审计

### 3.1 当前状态（Production v1 已部署）

| 列 | 名称 | 类型 | 来源 |
|:---|:-----|:-----|:-----|
| A | Mission ID | text | `feishu_bootstrap.py:87` |
| B | Mission Name | text | `feishu_bootstrap.py:88` |
| C | Description | text | `feishu_bootstrap.py:89` |
| D | Status | text (validated) | `feishu_bootstrap.py:90-91` |
| E | Owner | text | `feishu_bootstrap.py:92` |
| F | Executor | text | `feishu_bootstrap.py:93` |
| G | Priority | text (validated) | `feishu_bootstrap.py:94-95` |
| H | Start Time | date | `feishu_bootstrap.py:96` |
| I | End Time | date | `feishu_bootstrap.py:97` |
| J | Evidence Link | text (url) | `feishu_bootstrap.py:98` |
| K | Result | text | `feishu_bootstrap.py:99` |
| L | Tag | text | `feishu_bootstrap.py:100` |

### 3.2 需求规范对照

| 需求字段 | 类型 | 当前状态 | 差异 |
|:---------|:-----|:---------|:-----|
| Mission ID | text | A - ✅ 存在 | — |
| Mission Name | text | B - ✅ 存在 | — |
| Description | 多行文本 | C - ✅ 存在 | 当前为 text，飞书 sheets 中无差异 |
| Status | 单选 | D - ✅ 存在 | 验证值已正确 |
| Priority | 单选 | G - ✅ 存在 | 验证值已正确 |
| Owner | 人员 | E - ⚠️ text | 需求为"人员"类型；飞书 sheets 不支持人员类型，保持 text |
| Executor | text | F - ✅ 存在 | — |
| **Created Time** | 日期 | ❌ 缺失 | 需要新增列（应该在 H 位置） |
| **Started Time** | 日期 | H - ⚠️ 名称不符 | 当前为 "Start Time"，需重命名为 "Started Time" |
| **Finished Time** | 日期 | I - ⚠️ 名称不符 | 当前为 "End Time"，需重命名为 "Finished Time" |
| Evidence Link | 链接 | J - ✅ 存在 | 当前为 text+is_url，可行 |
| Result | text | K - ✅ 存在 | — |
| Tag | — | L - ⚠️ 多余 | 需求未要求，可保留或删除 |

### 3.3 状态机一致性审计

**需求定义的状态：**
```
CREATED → RUNNING → COMPLETED
                  → FAILED
                  → PAUSED
PAUSED → RUNNING
```

**Pump Runner 实际状态机：**
```
(pump-runner.py:start)         → RUNNING
execute_task (success)         task: COMPLETED
execute_task (fail < max)      task: FAILED, mission continues
execute_task (fail ≥ max)      mission: PAUSED
_pause_remaining (abort)       mission: ABORTED
_pause_remaining (other)       mission: PAUSED
run_mission (all done)         mission: COMPLETED
cmd_resume                     PAUSED→RUNNING
```

**差异分析：**

| 问题 | 详情 | 影响 |
|:-----|:-----|:-----|
| ❌ 缺少 CREATED | Pump Runner 没有 CREATED 状态（start 直接设 RUNNING） | ⚠️ 需要在飞书层面管理 CREATED，dispatch 时设为 RUNNING |
| ⚠️ ABORTED ≠ FAILED | Pump Runner 有 ABORTED，需求要求 FAILED。Pump Runner 中任务失败（FAILED）不等同于任务中止（ABORTED） | 建议：保留 ABORTED 为中止操作，任务级 FAILED 不提升为 mission 级。可在飞书层面映射 ABORTED→FAILED 或增加 FAILED 状态 |
| ⚠️ 任务级 vs 任务集级 | Pump Runner 的 FAILED 是任务级别，不是 mission 级别 | 当所有任务完成后，如果任意任务 FAILED，mission 可设置为 COMPLETED_WITH_ERRORS 或在 result 中注明 |

### 3.4 建议修改方案

**列结构调整：**
```
A:  Mission ID       (不变)
B:  Mission Name     (不变)
C:  Description      (不变)
D:  Status           (不变，验证值不变)
E:  Owner            (不变)
F:  Executor         (不变)
G:  Priority         (不变)
--- 插入新列 ---
H:  Created Time     (新增，日期类型)
I:  Started Time     (原 H: Start Time → 重命名)
J:  Finished Time    (原 I: End Time → 重命名)
K:  Evidence Link    (原 J，不变)
L:  Result           (原 K，不变)
M:  Tag              (原 L，保留可选)
```

**状态验证值：**
```
CREATED, RUNNING, PAUSED, FAILED, COMPLETED, ABORTED
```
（在需求基础上增加 ABORTED，确保与实际 Runtime 一致）

## 4. 审计结论

### ✅ 通过项
- 核心字段（ID, Name, Description, Status, Priority, Owner, Executor）全部存在
- Status 验证值已正确匹配 Runtime 状态
- Evidence Link 和 Result 字段存在

### ⚠️ 需修正项
1. **缺 Created Time** — 需要新增列（优先级：高）
2. **Start Time → Started Time** — 重命名（优先级：中）
3. **End Time → Finished Time** — 重命名（优先级：中）
4. **状态机扩展** — 增加 ABORTED，明确 CREATED 在飞书层面管理（优先级：低）
5. **Tag 列** — 保留，非必需（优先级：低）

### ❌ 非问题
- Owner 类型 text vs person → 飞书 sheets 无人员类型，保持 text
- Description 类型 text vs 多行文本 → 飞书 sheets 无区分，保持 text

## 5. 下一步（Phase 2）

Phase 2 将建立 Mission JSON 转换规则，实现飞书记录 → mission.json → Pump Runner 的完整映射。
