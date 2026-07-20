# EOS AI Assistant — 架构设计

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **状态**: 设计稿  
> **作者**: Lobster (Orchestrator)  
> **相关文档**:  
> - Feishu Architecture: `FEISHU-ARCHITECTURE-DESIGN.md`  
> - Notification Design: `FEISHU-NOTIFICATION-DESIGN.md`  
> - Pump Runner: `PUMP-RUNNER-ARCHITECTURE.md`  
> - Lobster Self-Healing: `LOBSTER-SELF-HEALING-DESIGN.md`  
> - Next Phase Roadmap: `NEXT-PHASE-ROADMAP.md`  
> - System of Record: `SystemOfRecord.md`  

---

## 目录

1. [Q1：飞书机器人模式选择](#q1飞书机器人模式选择)
2. [Q2：GPT 职责边界](#q2gpt-职责边界)
3. [Q3：Lobster 接口设计](#q3lobster-接口设计)
4. [整体架构](#整体架构)
   - [Layer 0-3 分层定义](#layer-0-3-分层定义)
   - [架构图](#架构图)
   - [数据流](#数据流)
5. [飞书命令格式设计](#飞书命令格式设计)
6. [设计决策记录](#设计决策记录)

---

## Q1：飞书机器人模式选择

### 选项对比

| 维度 | 群机器人（Webhook） | 企业自建应用机器人 | 两者结合（推荐） |
|:-----|:-------------------|:------------------|:----------------|
| **当前状态** | ✅ 已部署 | ❌ 未开通 im:message | — |
| **能发消息** | ✅ 单向推送 | ✅ 双向收发 | ✅ 分工明确 |
| **能收消息** | ❌ 不能 | ✅ Event Subscription | ✅ 通过应用收 |
| **权限需求** | 无 | `im:message` + `im:chat` + Event 配置 | 群机器人无权限 + 应用开权限 |
| **部署成本** | 零（10秒配置） | 中（权限审批+事件服务器） | 中（群机器人已就绪，逐步开通应用）
| **适合场景** | 系统→人的通知 | 人↔系统的对话交互 | 通知用群机器人，对话用应用机器人 |

### 结论：**企业自建应用机器人**（单一模式）

选择依据：

1. **双向通信是硬需求** — AI Assistant 的核心价值是主人通过飞书 @机器人 下达指令，单向推送无法满足。
2. **群机器人（Webhook）不能收消息** — 只能做通知，不能做对话入口。即使结合使用，也需要事件服务器处理消息接收，与应用机器人无本质区别。
3. **企业自建应用已完成开发者认证** — EOS 应用已存在（app_id: `cli_a7e0dfca5e7a5013`），只需要：
   - 开通 `im:message` 权限（在应用配置中勾选）
   - 配置 Event Subscription（事件订阅 URL）
   - 重新发布应用 → 等待审批
   - 不需要额外创建新应用
4. **群机器人保留作为通知通道** — 现有 Webhook 通知脚本不改，作为系统→人的异步通知通道。应用机器人专门做人↔系统的对话交互。

### 模式决策树

```
需要双向通信？
├── 是 → 企业自建应用机器人
│   ├── 已有应用 → 开权限 + Event Subscription
│   └── 无应用 → 创建新应用
└── 否 → 群机器人 Webhook（已部署）
    └── 仅通知 → 不需要改
```

---

## Q2：GPT 职责边界

GPT（通过 Lobster / Orchestrator 角色）在 EOS AI Assistant 中的职责有明确边界。

### ✅ 允许（GA — Governance Allowed）

| 职责 | 说明 | 示例 |
|:-----|:------|:-----|
| **接收并解释飞书命令** | 解析 @EOS AI Assistant 后的自然语言指令 | `"查看状态"` → 执行状态查询 |
| **查询系统状态** | 读取 `.missions/`、`state`、Evidence | "列出所有运行中的任务" |
| **创建 Mission** | 在飞书 Mission Board 创建 CREATED 记录 | "创建任务：优化数据库" |
| **恢复 PAUSED Mission** | 将 PAUSED 状态置为 CREATED（需要确认） | "恢复任务 M-XXX" |
| **审计 Evidence** | 读取 Claude Code 执行结果并判断 | "检查 M-XXX 的结果" |
| **输出状态摘要** | 格式化数据为主人可读的回答 | "当前系统健康，3个任务完成" |
| **通知主人** | 通过 Webhook 或对话主动推送 | "M-XXX 已超时" |
| **拒绝非法命令** | 安全校验，阻止越权操作 | "不能直接从飞书调用 Claude Code" |

### ❌ 禁止（GP — Governance Prohibited）

| 职责 | 原因 | 违反后果 |
|:-----|:------|:---------|
| **直接调用 Claude Code** | 绕过 Pump Runner 调度层 | 破坏三层架构 |
| **修改 Runtime 状态** | Runtime Truth Source 不可篡改 | 状态不一致 |
| **启动 Pump Runner** | Orchestrator ≠ Executor | 违反 CCAI-017 |
| **修改运行中的任务** | RUNNING/COMPLETED/FAILED 不可改 | 破坏执行闭环 |
| **执行任意代码** | 超出 AI Assistant 职能 | 安全风险 |
| **越过三层架构直接执行** | 必须经过 Lobster→Pump→CC | 治理失效 |

### 边界矩阵

```
User in Feishu
    │
    ▼
┌─────────────────────────────────────────────┐
│      Layer 0-1: GPT (Lobster)                │
│                                              │
│  ✅ 解释命令    ✅ 查询状态    ✅ 创建 Mission  │
│  ✅ 审计结果    ✅ 输出回答    ✅ 安全检查     │
│                                              │
│  ❌ 写代码      ❌ 调 CC       ❌ 改 Runtime  │
│  ❌ 启动 Pump   ❌ 执行命令    ❌ 绕过三层     │
└──────────────┬──────────────────────────────┘
               │
               ▼  (governed actions only)
     ┌──────────────────────┐
     │  Pump Runner / CC    │
     │  (隔离执行层)         │
     └──────────────────────┘
```

---

## Q3：Lobster 接口设计

Lobster 作为 GPT 的执行主体，对外暴露以下接口（设计为逻辑 API，非 REST API）。

### 3.1 查询接口（Read-only）

| 接口 | 命令关键词 | 输入 | 输出 | 调用成本 |
|:-----|:----------|:-----|:-----|:--------|
| `status` | 状态 / status | (无) | 系统摘要（Mission 数、状态分布、最后活跃时间） | O(1) scan |
| `list_missions` | 任务列表 / missions | 状态过滤（可选） | Mission 列表（ID、Name、Status、Owner） | O(n) scan |
| `show_mission` | 查看任务 / mission | Mission ID | 单任务详情（描述、任务列表、状态、Evidence） | O(1) lookup |
| `show_evidence` | 证据 / evidence | Mission ID + Task ID（可选） | 执行日志、exit code、stdout | O(1) read |
| `health` | 健康 / heartbeat | (无) | 各组件健康状态 | 多源读取 |

### 3.2 控制接口（Governed）

| 接口 | 命令关键词 | 输入 | 权限验证 | 输出 |
|:-----|:----------|:-----|:---------|:-----|
| `create_mission` | 创建任务 / create | Name + Desc + Tasks | 无（允许任意创建） | Mission ID + CREATED | 
| `resume_mission` | 恢复任务 / resume | Mission ID | 仅 PAUSED 可恢复 | 状态置为 CREATED |
| `abort_mission` | 中止任务 / abort | Mission ID | 仅 RUNNING 可中止 | 状态置为 ABORTED |
| `cancel_mission` | 取消任务 / cancel | Mission ID | 仅 CREATED 可取消 | 状态置为 CANCELLED |

### 3.3 控制接口权限验证规则

```
create_mission:    无前置条件 ✅
resume_mission:    status==PAUSED ✅ | else ❌
abort_mission:     status==RUNNING ✅ | else ❌
cancel_mission:    status==CREATED ✅ | else ❌
```

所有控制接口修改的是 **飞书 Mission Board**（控制平面），而非 Runtime `.missions/`。Pump Runner 通过读取飞书来响应状态变更。

### 3.4 接口调用流程（通用）

```
User: @EOS AI Assistant 状态
  → Event Subscription 收到消息
  → GPT 解析命令 keyword = "状态" / "status"
  → GPT 调用 Lobster Interface: status()
  → Lobster 读取 .missions/ 各 state 文件
  → Lobster 格式化输出
  → GPT 构造回复消息
  → Event Subscription 发送回飞书
```

### 3.5 拒绝响应模式

当命令无法识别或不被允许时，统一以以下格式拒绝：

```
@主人，命令无法执行：
  ─ 你说了：「xxxx」
  ─ 原因：[具体原因]
  ─ 允许的命令：状态 | 任务列表 | 查看任务 <ID> | 创建任务 <描述> | 恢复任务 <ID>
```

---

## 整体架构

### Layer 0-3 分层定义

#### Layer 0：Feishu 交互层（新增）

| 属性 | 定义 |
|:-----|:------|
| **名称** | EOS AI Assistant 飞书前端 |
| **载体** | 企业自建应用（EOS）→ 开通 `im:message` + Event Subscription |
| **职责** | 接收用户 @消息 → 转发到 Layer 1 / 将 Layer 1 回复发回飞书 |
| **不做什么** | 不解释命令内容、不决策、不访问 Runtime |
| **状态** | ❌ 尚未开通 |

**组件**：
- **Event Subscription Handler** — 接收飞书推送的事件（`im.message.receive_v1`）
- **Response Sender** — 调用飞书 API 发送回复消息
- **Webhook Notifier**（已有）— 系统→群单向通知通道

#### Layer 1：Orchestrator（Lobster / GPT）

| 属性 | 定义 |
|:-----|:------|
| **名称** | Lobster（龙虾） |
| **载体** | GLM5 / GPT-4 (Orchestrator Agent) |
| **职责** | 命令解析、权限验证、状态查询、审计决策、输出格式化 |
| **不做什么** | 不执行代码、不修改 Runtime、不直接调 CC |
| **状态** | ✅ 已就绪 |

#### Layer 2：Scheduler（Pump Runner）

| 属性 | 定义 |
|:-----|:------|
| **名称** | Pump Runner |
| **载体** | `pump-runner.py`（非 AI 脚本） |
| **职责** | 任务队列、CLI 调用、重试、状态持久化、Evidence 收集 |
| **不做什么** | 不解释命令、不决策、不创建 Mission |
| **状态** | ✅ 已验证（28/28 稳定） |

#### Layer 3：Executor（Claude Code）

| 属性 | 定义 |
|:-----|:------|
| **名称** | Claude Code |
| **载体** | Claude Code CLI |
| **职责** | 编码、测试、文档生成、Evidence 写入 |
| **不做什么** | 不调度、不决策、不管理多层 |
| **状态** | ✅ 已就绪 |

### 架构图

```
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 0: Feishu Interaction Layer（新增）                              │
│                                                                        │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │  EOS App Bot          │    │  Webhook Group Robot（已有）         │  │
│  │  (im:message + Event) │    │  (notifications only)               │  │
│  │                       │    │                                      │  │
│  │  @主人消息 → Layer 1  │    │  Layer 1 → 群消息推送                │  │
│  │  Layer 1 → 回复消息   │    │  (单向)                              │  │
│  └──────────┬────────────┘    └──────────────────────────────────────┘  │
└─────────────┼──────────────────────────────────────────────────────────┘
              │ (parsed command)
              ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Orchestrator（Lobster / GPT）                                │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 命令解析      │  │ 权限验证      │  │ 状态查询      │  │ 输出格式化  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                        │
│  读取：.missions/   飞书 Mission Board   Evidence                         │
│  写：飞书 Mission Board（CREATE / RESUME / ABORT / CANCEL）              │
└─────────────────────┬──────────────────────────────────────────────────┘
                      │ (mission.json / 调度指令)
                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 2: Pump Runner（调度器）                                        │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 任务队列       │  │ CLI 调用      │  │ 重试/暂停     │  │ Evidence   │ │
│  │              │  │              │  │              │  │ 收集       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                        │
│  写：.missions/state  .missions/evidence/                                │
└─────────────────────┬──────────────────────────────────────────────────┘
                      │ (claude --print)
                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 3: Claude Code CLI（执行器）                                    │
│                                                                        │
│  编码  测试  文档  报告  证据                                            │
│                                                                        │
│  写：evidence/  stdout/stderr/meta                                       │
└────────────────────────────────────────────────────────────────────────┘
```

### 数据流（完整链路）

```
1. 主人：@EOS AI Assistant 状态
2. 飞书 Event Subscription → Layer 0 接收
3. Layer 0 → Layer 1 (Lobster)：解析命令 = status()
4. Layer 1 读取 .missions/ 各 state 文件
5. Layer 1 格式化输出 → Layer 0
6. Layer 0 → 飞书 API 发送回复
7. 主人看到回复

--- 控制流程（需要执行）---

1. 主人：@EOS AI Assistant 创建任务 "优化数据库索引"
2. 飞书 Event Subscription → Layer 0 接收
3. Layer 0 → Layer 1：解析命令 = create_mission("优化数据库索引")
4. Layer 1 权限验证：create_mission → ✅ 允许
5. Layer 1 创建飞书 Mission Board 记录（Status: CREATED）
6. Layer 1 回复：已创建任务 M-2026-07-18-XXX
7. （后续）Pump Runner 检测到新 CREATED → 自动调度执行
8. Pump Runner → Claude Code 执行
9. Claude Code → Evidence
10. Pump Runner 更新 state 为 COMPLETED
11. Layer 1（下次心跳/查询时）审计结果 → 更新飞书 Board
12. Webhook → 群通知：任务完成

--- 通知流程（异步）---

1. Pump Runner 完成 Mission → state: COMPLETED
2. Layer 1（Heartbeat 检测到）→ 审计 Evidence
3. Layer 1 → Webhook → 飞书群通知
4. 或 Layer 1 → 飞书 API → 应用机器人私信主人
```

---

## 飞书命令格式设计

### 命令前缀

所有命令以 `@EOS AI Assistant` 开头（在飞书群内 @机器人）。

### 命令分类

#### 查询类（即时响应）

| 命令示例 | 解析动作 | 响应示例 |
|:---------|:---------|:---------|
| `@EOS AI Assistant 状态` | status() | "系统健康 ✅ | 3个任务运行中 | 最后活跃: 12:30" |
| `@EOS AI Assistant 任务列表` | list_missions() | "共5个任务：M-001 ✅ M-002 🔄 M-003 ⏸️ ..." |
| `@EOS AI Assistant 任务列表 运行中` | list_missions(status=RUNNING) | "运行中任务：M-002（优化查询）..." |
| `@EOS AI Assistant 查看任务 M-001` | show_mission("M-001") | "M-001：优化数据库 | 状态 CREATED | 任务：3/3 | ..." |
| `@EOS AI Assistant 证据 M-001` | show_evidence("M-001") | "M-001 执行日志：task1 ✅ task2 ✅ task3 ❌（超时）" |
| `@EOS AI Assistant 健康检查` | health() | "Lobster ✅ Pump ✅ CC ✅ Webhook ✅" |
| `@EOS AI Assistant 谁在干活` | status(executor) | "Pump Runner 空闲 | 上次执行: 12:00 | 等待新任务" |

#### 控制类（需要确认）

| 命令示例 | 解析动作 | 前置条件 | 确认要求 |
|:---------|:---------|:---------|:---------|
| `@EOS AI Assistant 创建任务 优化数据库索引` | create_mission(...) | 无 | ❌ 不需要 |
| `@EOS AI Assistant 恢复任务 M-003` | resume_mission("M-003") | status==PAUSED | ✅ 需要确认 |
| `@EOS AI Assistant 中止任务 M-002` | abort_mission("M-002") | status==RUNNING | ✅ 需要确认 |
| `@EOS AI Assistant 取消任务 M-001` | cancel_mission("M-001") | status==CREATED | ❌ 不需要 |

#### 确认流程示例

```
主人：@EOS AI Assistant 恢复任务 M-003
机器人：⚠️ 确认操作：恢复已暂停的任务「M-003：数据库迁移」？
  回复「确认」继续，或「取消」中止。
主人：确认
机器人：✅ 任务 M-003 已恢复（Status: CREATED），Pump Runner 将接手执行。
```

#### 通知类（由系统发起）

| 通知内容 | 触发时机 | 通道 |
|:---------|:---------|:-----|
| "M-005 已完成 ✅" | Mission COMPLETED | Webhook 群通知 |
| "M-002 已暂停 ⏸️" | Mission PAUSED | Webhook 群通知 |
| "系统心跳：正常" | 每15分钟 | Webhook 群通知（可选） |
| "任务 M-005 需要审计" | Mission COMPLETED | 应用机器人私信 |
| "Pump Runner 异常" | 检测到崩溃 | Webhook + 应用机器人 |

#### 无效命令响应

```
主人：@EOS AI Assistant 给我写个Python脚本
机器人：@主人，我不能直接执行代码。
  EOS AI Assistant 的职责是管理任务和执行调度。
  如需执行代码，请使用「创建任务 <描述>」创建 Mission。
```

---

## 设计决策记录

| 决策 | 选项 | 选择 | 理由 |
|:-----|:-----|:-----|:------|
| Bot 模式 | 群机器人 / 应用机器人 / 两者 | **应用机器人** | 双向通信是硬需求 |
| 事件处理位置 | 飞书云函数 / 自建服务器 / Lobster 内 | **Lobster 内** | 避免额外基础设施，Lobster 本身即是 AI 处理层 |
| 命令解析方式 | NLP 自由 / 关键词 / 结构化 | **自由 NLP + 关键词回退** | 用户输入不可预测，NLP 更自然 |
| 权限模型 | 白名单 / 黑名单 | **白名单（仅允许列表）** | 安全优先，未明确允许即禁止 |
| 确认机制 | 总是确认 / 从不确认 / 分类确认 | **分类确认** | 破坏性操作（resume/abort）需要确认 |
| 群通知 vs 私信 | 群通知 / 应用私信 / 两者 | **两者结合** | 群通知公开透明，私信适合敏感内容 |
| Event Subscription 协议 | Webhook / WebSocket | **Webhook** | 飞书标准协议，Lobster 可解析 HTTP |

---

*本文档为设计稿，不涉及代码实现。*
