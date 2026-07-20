# EOS AI Assistant — 安全边界设计

> **版本**: 1.0  
> **日期**: 2026-07-18  
> **状态**: 设计稿  
> **作者**: Lobster (Orchestrator)  
> **相关文档**:  
> - Architecture: `EOS-AI-ASSISTANT-ARCHITECTURE.md`  
> - CCAI Governance: `docs/CCAI/Capability-Pattern/`  
> - System of Record: `SystemOfRecord.md`  

---

## 目录

1. [完整链路](#1-完整链路)
2. [各层权限边界](#2-各层权限边界)
3. [禁止路径](#3-禁止路径)
4. [命令验证与审批流程](#4-命令验证与审批流程)
5. [威胁模型分析](#5-威胁模型分析)
6. [安全黄金法则](#6-安全黄金法则)

---

## 1. 完整链路

### 1.1 查询链路（只读）

```
主人             Layer 0               Layer 1              Runtime
 │                 │                      │                    │
 │ @EOS 状态       │                      │                    │
 │────────────────▶│  Event Subscription  │                    │
 │                 │─────────────────────▶│                    │
 │                 │                      │ 读取 .missions/    │
 │                 │                      │───────────────────▶│
 │                 │                      │◀───────────────────│
 │                 │                      │ 格式化输出          │
 │                 │◀─────────────────────│                    │
 │◀────────────────│  回复消息到飞书       │                    │
 │ 看到状态摘要    │                      │                    │
```

### 1.2 控制链路（写入）

```
主人             Layer 0               Layer 1              Layer 2/3
 │                 │                      │                    │
 │ @EOS 创建任务   │                      │                    │
 │────────────────▶│                      │                    │
 │                 │─────────────────────▶│                    │
 │                 │                      │ 权限验证            │
 │                 │                      │ 写飞书 Board       │
 │                 │◀─────────────────────│ (CREATED)          │
 │◀────────────────│ 已创建任务 M-XXX     │                    │
 │                 │                      │                    │
 │              （后续 Pump Runner 检测到新任务 → 执行）         │
```

### 1.3 通知链路（异步推送）

```
Layer 1              Webhook             飞书群
  │                     │                  │
  │ 检测到 COMPLETED    │                  │
  │────────────────────▶│ POST JSON        │
  │                     │─────────────────▶│
  │                     │                  │ 主人看到通知
```

---

## 2. 各层权限边界

### Layer 0：Feishu 交互层

| 权限项 | 允许 | 禁止 |
|:-------|:-----|:------|
| 接收消息 | ✅ 接收 @机器人 消息 | ❌ 接收非 @消息（除非配置了群全部消息） |
| 发送消息 | ✅ 回复消息给发送者 | ❌ 主动向非关联用户发私信 |
| 消息类型 | ✅ text / post / card | ❌ 发送文件、图片（非必要） |
| 事件处理 | ✅ `im.message.receive_v1` | ❌ 其他事件类型（除非明确授权） |
| 解密 | ❌ 不涉及 | — |

**Layer 0 安全规则**：
- 只接收 `@机器人` 提及的消息（filter by mention）
- 非 @消息直接丢弃，不转给 Layer 1
- 每消息最大长度 5000 字符，超长截断
- 发送频率限制：每分钟 10 条（避免刷屏）

### Layer 1：Lobster / Orchestrator

| 权限项 | 允许 | 禁止 |
|:-------|:-----|:------|
| 读取 `.missions/` | ✅ 所有 state 文件 | ❌ 修改 state 文件 |
| 读取飞书 Board | ✅ 所有记录 | ❌ 修改非相关列 |
| 修改飞书 Board | ✅ Status（仅限合法转换） | ❌ 修改 Evidence/Result |
| 调用 Pump Runner | ❌ 不允许直接调用 | ❌ 禁止 |
| 调用 Claude Code | ❌ 不允许 | ❌ 禁止 |
| 执行系统命令 | ❌ 不允许 | ❌ 禁止 |
| 修改系统配置 | ❌ 不允许 | ❌ 禁止 |

**Layer 1 白名单操作**：

| 操作 | 修改对象 | 条件 |
|:-----|:---------|:-----|
| `create_mission` | 飞书 Board 新增行 | 无 |
| `resume_mission` | 飞书 Board Status → CREATED | 原状态 == PAUSED |
| `abort_mission` | 飞书 Board Status → ABORTED | 原状态 == RUNNING |
| `cancel_mission` | 飞书 Board Status → CANCELLED | 原状态 == CREATED |
| `update_description` | 飞书 Board 描述列 | 仅 CREATED 状态 |

所有白名单外的操作 → 拒绝。

### Layer 2：Pump Runner

| 权限项 | 允许 | 禁止 |
|:-------|:-----|:------|
| 读取飞书 Board | ✅ CREATED 状态的 Mission | ❌ 修改飞书 Board |
| 修改 Runtime | ✅ `.missions/state` + evidence | ❌ 修改飞书 Board |
| 调用 Claude Code | ✅ 通过 CLI | ❌ 绕过后直接修改文件 |
| 错误处理 | ✅ 重试 / 暂停 / 中止 | ❌ 自动创建新 Mission |

**Layer 2 安全规则**：
- 只读取飞书 Board 中 `Status == CREATED` 的 Mission
- 执行完成后通过 Lobster 回写飞书 Board（Layer 1 审计后）
- 异常时只暂停自身，不向上游传播错误

### Layer 3：Claude Code

| 权限项 | 允许 | 禁止 |
|:-------|:-----|:------|
| 写入代码 | ✅ 根据任务描述 | ❌ 修改非任务相关文件 |
| 生成 Evidence | ✅ stdout/stderr/meta | ❌ 修改 state |
| 读取文件 | ✅ 任务范围内 | ❌ 读取任务外敏感文件 |
| 访问网络 | ✅ 根据任务需要 | ❌ 外传系统数据 |

---

## 3. 禁止路径

### ❌ 禁止路径 #1：飞书 → Claude Code（越过三层）

```
飞书 @机器人 消息 ──→ 直接 ──→ Claude Code CLI
                                            ↑
                                    ❌ 绕过 Lobster + Pump Runner
```

**后果**：治理失效、不可审计、不可追踪。  
**防范**：Layer 1 拒绝任何"执行代码"类命令，Claude Code 只接受 Pump Runner 调度。

### ❌ 禁止路径 #2：GPT → 修改 Runtime State

```
GPT ──→ 直接写入 .missions/XXX/state
                    ↑
            ❌ 绕过 Pump Runner 状态机
```

**后果**：状态不一致、System of Record 污染。  
**防范**：Lobster 规则中明确禁止修改 `.missions/` 下的任何文件。

### ❌ 禁止路径 #3：飞书 → 直接修改飞书 Board 上的 RUNNING/COMPLETED

```
主人 ──→ 手动修改飞书 Board Status 从 RUNNING → COMPLETED
                          ↑
                  ❌ 绕过 Runtime 真相源
```

**后果**：状态造假、执行信息丢失。  
**防范**：飞书 Board 设置验证规则，RUNNING/COMPLETED/FAILED 不可由人修改。

### ❌ 禁止路径 #4：GPT → 自动启动 Pump Runner

```
GPT ──→ python pump-runner.py start
                    ↑
            ❌ 自动执行（需主人明确授权）
```

**后果**：在未获授权的情况下消费配额、执行非预期任务。  
**防范**：CCAI-017 明确禁止 Orchestrator 启动 Pump Runner。

### ❌ 禁止路径 #5：GPT → 越权读取敏感文件

```
GPT ──→ 读取 .env / 密钥文件 / 凭证
                    ↑
            ❌ 越权
```

**后果**：凭证泄露、系统被攻破。  
**防范**：Lobster 的读取能力限定在 `.missions/`、飞书 Board、Evidence 目录。

### 禁止路径全景图

```
                    ┌──────────┐
                    │  飞书用户  │
                    └────┬─────┘
                         │
                 ✅ ─────┼──────❌  #1: 越过三层直接调 CC
                         │
                    ┌────▼─────┐
                    │  Layer 0  │
                    │  Feishu   │
                    └────┬─────┘
                         │
                 ✅ ─────┼──────❌  #4: 自动启 Pump
                         │
                    ┌────▼─────┐
                    │  Layer 1  │
                    │  Lobster  │
                    └────┬─────┘
                         │
                    ┌────┼────┐
                    │    │    │
                    │    │    │
              ❌ #2 │   ✅    │ ❌ #5: 读密钥
              (改   │   │    │
              state)│   │    │
                    │ ┌─▼──┐ │
                    │ │L2  │ │
                    │ │Pump│ │
                    │ └─┬──┘ │
                    │ ┌─▼──┐ │
                    │ │L3  │ │
                    │ │ CC │ │
                    │ └────┘ │
                    └────────┘
```

---

## 4. 命令验证与审批流程

### 4.1 命令验证流程（每命令必经）

```
收到命令
  │
  ├─ 步骤1：格式校验 ── 是否以 @EOS AI Assistant 开头？ │ 否 → 丢弃
  │                                                        │
  ├─ 步骤2：命令识别 ── NLP 解析 → 匹配已知命令模式       │ 否 → 返回"无法识别"
  │                                                        │
  ├─ 步骤3：权限校验 ── 是否在白名单操作列表中？          │ 否 → 返回"不允执行"
  │                                                        │
  ├─ 步骤4：前置条件 ── 操作所需状态条件满足？             │ 否 → 返回"条件不满足"
  │                                                        │
  ├─ 步骤5：需要确认？  ── resume/abort 等破坏性操作       │ 是 → 等待主人确认
  │                                                        │
  └─ 步骤6：执行 ── 调用 Lobster 接口 → 格式化回复
```

### 4.2 审批流程（需要确认的操作）

```
主人: @EOS AI Assistant 恢复任务 M-003

  → Layer 1 验证：resume_mission 白名单 ✅
  → Layer 1 前置条件：M-003.status == PAUSED?
      ├── 是 → 继续
      └── 否 → 回复"任务 M-003 当前状态为 RUNNING，不允许恢复"

  → Layer 1 确认要求：resume 操作需要确认 ✅
  → Layer 1 发送确认请求：
     "⚠️ 确认操作：恢复已暂停的任务「M-003：数据库迁移」？
      回复「确认」继续，或「取消」中止。"

  → 主人回复 "确认"
  → Layer 1 执行 resume_mission("M-003")
  → Layer 1 回复 "✅ 任务 M-003 已恢复（Status: CREATED）"
```

### 4.3 审批超时

| 阶段 | 超时时间 | 行为 |
|:-----|:---------|:-----|
| 等待确认 | 5分钟 | 自动取消操作，回复"确认超时，操作已取消" |
| 等待主人后续命令 | 无限制 | 不自动超时 |

---

## 5. 威胁模型分析

### 5.1 威胁清单

| 编号 | 威胁 | 来源 | 影响 | 概率 | 缓解措施 |
|:-----|:------|:------|:-----|:-----|:---------|
| T1 | 伪造飞书消息冒充主人 | 外部 | 未授权操作 | 低 | 飞书 Event 签名验证 |
| T2 | 命令注入（说"创建任务 x; 执行恶意代码"） | 用户 | 越权执行 | 低 | Layer 1 白名单过滤，返回解释而非执行 |
| T3 | 越权修改 Runtime | GPT 误操作 | 状态不一致 | 中 | Layer 1 规则禁止，权限边界定义 |
| T4 | 无限创建任务（DoS） | 用户/自动化 | 消耗配额 | 低 | 每分钟最多创建1个Mission |
| T5 | 循环执行失败任务 | Pump Runner | 无限重试 | 低 | 重试阈值 3次→PAUSED |
| T6 | 飞书 Webhook URL 泄露 | 凭证管理 | 群消息伪造 | 中 | URL 包含随机 UUID，环境变量管理 |
| T7 | GPT 幻觉输出错误状态 | AI 模型 | 误导用户 | 中 | 状态来源于实际文件读取，GPT 仅格式化 |
| T8 | Event Subscription 服务器被攻击 | 网络 | 消息拦截 | 低 | HTTPS + 签名验证，无持久存储 |

### 5.2 签名验证（飞书 Event Subscription）

飞书事件推送包含签名验证头：

```
X-Lark-Request-Timestamp: <timestamp>
X-Lark-Request-Nonce: <nonce>
X-Lark-Signature: <signature>
```

Layer 0 必须验证每个事件的签名，验证失败的请求直接丢弃。

### 5.3 速率限制

| 限流维度 | 限制 | 超限后果 |
|:---------|:-----|:---------|
| 飞书消息接收 | 10条/分钟 | 超过丢弃，不积压 |
| 飞书消息发送 | 5条/分钟 | 超过排队等待 |
| Mission 创建 | 1个/分钟 | 超过拒绝 |
| Mission 恢复/中止 | 3次/分钟 | 超过拒绝 |
| 状态查询 | 20次/分钟 | 超过拒绝 |

---

## 6. 安全黄金法则

### GR-001：三层不可逾越

```
User → Feishu → Lobster → Pump Runner → Claude Code
                              ↓
                    ❌ 任何绕过都是禁止的
```

### GR-002：Orchestrator ≠ Executor

```
Lobster 只做 Governance（调度、审计、决策）
Claude Code 只做 Execution（编码、测试、文档）
Pump Runner 只做 Scheduling（排队、调度、重试）
```

### GR-003：Runtime Truth Source 不可篡改

```
.missions/ 下的 state 文件是权威来源
飞书 Board 是展示副本
任何冲突以 .missions/ 为准
```

### GR-004：白名单优先

```
未在「Lobster 接口设计」白名单中的操作 = 禁止
不识别命令 = 返回"无法识别"而非猜测执行
```

### GR-005：消息即命令，命令即可审计

```
每条 @EOS AI Assistant 消息
  → 进入不可变日志
  → 记录：时间 / 发送者 / 命令 / 响应 / 执行结果
  → 可供主人审计追溯
```

---

## 附录：禁止操作速查表

| 操作 | 是否允许 | 不允许时返回 |
|:-----|:---------|:------------|
| 查询状态 | ✅ | — |
| 创建任务 | ✅ | — |
| 恢复暂停任务 | ✅（需确认） | "任务状态不是 PAUSED" |
| 中止运行任务 | ✅（需确认） | "任务状态不是 RUNNING" |
| 取消已创建任务 | ✅ | "任务状态不是 CREATED" |
| 修改任务描述 | ✅（仅 CREATED） | "任务已开始执行，不能修改" |
| 删除任务 | ❌ | "任务不能被删除，只能取消" |
| 修改完成的任务 | ❌ | "已完成的任务不能修改" |
| 调用 Claude Code | ❌ | "EOS AI Assistant 不能直接执行代码" |
| 执行 Shell 命令 | ❌ | "EOS AI Assistant 不能执行系统命令" |
| 读取系统文件 | ❌ | "不能读取指定路径之外的文件" |
| 修改系统配置 | ❌ | "不能修改系统配置" |
| 发送私信 | ❌ | "EOS AI Assistant 只在群内回复" |
| 修改其他用户权限 | ❌ | "没有权限执行此操作" |

---

*本文档为安全设计稿，不涉及代码实现。*
