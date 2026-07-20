# FEISHU-NOTIFICATION-DESIGN.md

> **Mission**: FEISHU-NOTIFICATION-LAYER-001
> **Version**: 1.0
> **Date**: 2026-07-18
> **Status**: DESIGN ONLY — 不开发
> **Owner**: Lobster (Orchestrator)

---

## 1. 设计目标

让系统从：

```
主人主动打开飞书查看状态
```

升级为：

```
系统发现重要状态变化 → 主动通知主人 → 主人决定下一步
```

### 当前能力

| 能力 | 是否具备 |
|:-----|:---------|
| 飞书创建 Mission | ✅ Phase B |
| 飞书查看状态 | ✅ Phase B |
| Runtime 执行闭环 | ✅ Phase B |
| 龙虾自检恢复 | ✅ Phase 2 |
| 状态主动通知 | ❌ 本期设计 |

---

## 2. Task 001: Mission 状态通知

### 2.1 触发条件

```
CREATED ──→ RUNNING ──→ COMPLETED
                │
                ├──→ FAILED
                │
                └──→ PAUSED
```

| 触发 | 说明 | 通知级别 |
|:-----|:------|:---------|
| CREATED → RUNNING | Mission 开始执行 | P2 — 知会 |
| RUNNING → COMPLETED | 全部任务成功 | P1 — 汇报 |
| RUNNING → FAILED | 任务失败不可恢复 | P0 — 立即 |
| RUNNING → PAUSED | 连续失败暂停 | P0 — 立即 |

### 2.2 通知内容格式

```json
{
  "type": "mission_status_change",
  "mission_id": "M-2026-07-18-XXX",
  "mission_name": "任务名称",
  "old_status": "RUNNING",
  "new_status": "COMPLETED",
  "executor": "Pump Runner + Claude Code",
  "duration": "5m 23s",
  "task_count": 8,
  "completed_count": 8,
  "failed_count": 0,
  "evidence_path": ".missions/M-2026-07-18-XXX/evidence/",
  "next_action": "无 — 已完成",
  "timestamp": "2026-07-18T12:00:00Z"
}
```

**各状态下的 Next Action：**

| 状态 | Next Action |
|:-----|:------------|
| COMPLETED | 无 — 任务已完成 |
| FAILED | 请决定：重试 / 中止 / 忽略 |
| PAUSED | 请决定：恢复执行 / 中止 |
| RUNNING | (通知主人任务已开始) |

### 2.3 去重规则

- 同一 Mission 同一状态变化只通知一次
- 状态不变不通知
- Heartbeat 检测到已通知过的状态不重复通知

---

## 3. Task 002: 异常通知

### 3.1 检测项

| 检测对象 | 条件 | Severity | 说明 |
|:---------|:-----|:---------|:------|
| **Pump Runner** | 连续失败 ≥ 2 次 | P0 | 对应 PAUSED 状态 |
| **Pump Runner** | CRASH（进程消失） | P0 | stderr 检测 / 状态卡住 |
| **Runtime** | RUNNING 超时 > 30min | P1 | state.updated_at 停滞 |
| **Runtime** | Evidence 超过 4h 未更新 | P1 | 低活跃 |
| **Runtime** | state 文件损坏 | P1 | JSON 解析失败 |
| **Feishu** | API 调用失败 ≥ 3 次 | P1 | token 过期 / 网络问题 |
| **Feishu** | Token 获取异常 | P0 | 控制面不可用 |
| **Feishu** | Mission Board 无响应 | P1 | 连接问题 |

### 3.2 异常通知内容

```json
{
  "type": "anomaly_alert",
  "level": "P0",
  "source": "Pump Runner",
  "issue": "Mission PAUSED — 连续失败",
  "mission_id": "M-2026-07-18-XXX",
  "detail": {
    "task_id": "TASK-005",
    "failed_attempts": 2,
    "consecutive_failures": 2,
    "last_error": "(从 stderr.log 提取)",
    "evidence_path": ".missions/M-2026-07-18-XXX/evidence/TASK-005/"
  },
  "suggested_action": "请决定：resume 继续 / abort 中止",
  "timestamp": "2026-07-18T12:00:00Z"
}
```

### 3.3 通知频率

| 级别 | 频率 | 行为 |
|:-----|:------|:------|
| P0 | 立即 | 发现即通知，无去重窗口 |
| P1 | 每分钟最多一条 | 合并同类异常 |
| P2 | 每次 Heartbeat | 合并汇总报告 |

---

## 4. Task 003: 通知渠道设计

### 4.1 方案对比

| 维度 | 方案 A: 飞书 Webhook | 方案 B: 飞书应用消息 | 方案 C: 事件订阅 |
|:-----|:---------------------|:--------------------|:-------------------|
| **原理** | Pump Runner 通过 Webhook URL 发 POST 到群机器人 | 通过飞书 API send message 发消息给用户 | 飞书事件订阅监听多维表格变更 |
| **可靠性** | ⭐⭐⭐ — 单向，不保序 | ⭐⭐⭐⭐ — API 有重试机制 | ⭐⭐⭐ — 依赖事件推送 |
| **权限** | 群机器人 token，最低 | App 凭证 + user_access_token | 事件订阅需要额外配置 |
| **维护成本** | ⭐⭐⭐⭐⭐ — 5 分钟配置 | ⭐⭐⭐ — 需要获取用户 open_id | ⭐⭐ — 需要事件服务器 |
| **实时性** | 即时 | 即时 | 可能有延迟 (1-5s) |
| **能否发送到个人** | ❌ 只能发群 | ✅ 可发个人/群 | — |
| **能否带操作按钮** | ✅ 消息卡片 | ✅ 消息卡片 | — |
| **当前已具备** | ❌ 未配置 | ✅ API 凭证已有 | ❌ 需额外开发 |

### 4.2 推荐方案

**Phase 3 实施建议：方案 A + 方案 B 混合**

| 场景 | 渠道 | 原因 |
|:-----|:------|:------|
| P0 异常（FAILED/PAUSED） | 方案 B: 应用消息 | 更可靠，可发到个人，可带操作按钮 |
| P1 状态变更（COMPLETED） | 方案 A: Webhook 群机器人 | 低成本，群内可见，多人可查 |
| P2 日常（RUNNING） | 方案 A: Webhook | 低优先级，群通知即可 |

### 4.3 选择理由

**选方案 A 作为优先通道**：
1. 已存在飞书 App + API 凭证 ✅
2. Webhook 配置简单，5 分钟完成
3. 群通知允许多人查看
4. 消息卡片支持丰富格式

**方案 B 补充 P0 场景**：
1. 需要获取主人的 `open_id`（一次配置）
2. 可靠性更高
3. 可带操作按钮（resume/abort）

### 4.4 不做方案 C

**理由**：事件订阅需要额外搭建事件接收服务器，当前架构没有这个基础设施。且多维表格事件目前飞书 API 支持有限。留到 Phase E（机器人入口）时重新评估。

---

## 5. Task 004: 权限审计

### 5.1 通知系统权限边界

```
✅ 可以：
  ├─ 发送消息到飞书群/个人
  ├─ 读取 Mission Board 状态
  ├─ 读取 .missions/ 目录
  └─ 生成通知内容

❌ 不能：
  ├─ 创建 Mission
  ├─ 修改 Mission Board
  ├─ 修改 Runtime 状态
  ├─ 调用 Claude Code
  ├─ 修改 .missions/ 目录
  └─ 启动 Pump Runner
```

### 5.2 CCAI-017 兼容性

| 规则 | 通知系统 |
|:-----|:---------|
| 龙虾 ≠ Executor | ✅ 通知不执行代码 |
| 飞书 ≠ Runtime | ✅ 通知系统只读不写 |
| Pump Runner 唯一调度层 | ✅ 通知不触发调度 |
| CC 唯一执行者 | ✅ 通知不调用 CC |
| Runtime 真相源 | ✅ 不修改 Runtime 状态 |

### 5.3 权限最小化

```
通知系统需要的 API 权限：

方案 A — Webhook 群机器人:
  权限级别: 最低
  只需要: webhook URL (群内复制)
  无需: 任何飞书 App API 权限

方案 B — 应用消息:
  额外需要:
  - im:message 权限 (发送消息)
  无需:
  - drive:drive (可读)
  - sheets:spreadsheet (只读 Mission Board 已有)
  - wiki:wiki (不需要)
```

---

## 6. 与现有架构的关系

### 6.1 数据流

```
Pump Runner / Heartbeat
    │
    ├─ 检测到状态变化
    ├─ 生成通知Payload
    ├─ 判断通知级别 (P0/P1/P2)
    │
    ▼
通知路由
    │
    ├─ P0 → 飞书应用消息 (方案 B) → 主人个人
    ├─ P1 → 飞书 Webhook (方案 A) → 群通知
    └─ P2 → 飞书 Webhook (方案 A) → 群通知 (合并)
    │
    ▼
主人收到通知
    │
    └─ 决定下一步操作
```

### 6.2 不改变的组件

| 组件 | 不改变 |
|:-----|:-------|
| Pump Runner | 不增加 --feishu-output 参数（留到 Phase 4） |
| Claude Code | 不与飞书通信 |
| mission.state | 格式不变 |
| .missions/ | 目录结构不变 |
| Feishu Mission Board | 不变 |

### 6.3 谁触发通知

```
通知触发者 = 龙虾 (Orchestrator)
```

具体场景：

| 场景 | 谁检测 | 谁发送通知 |
|:-----|:-------|:----------|
| Mission COMPLETED | Pump Runner 完成后 → state 文件更新 | Heartbeat 轮询发现 → 龙虾发送 |
| Mission FAILED | Pump Runner 失败 → state FAILED | Heartbeat 轮询发现 → 龙虾发送 |
| Mission PAUSED | Pump Runner 暂停 → state PAUSED | Heartbeat 轮询发现 → 龙虾发送 |
| Stale RUNNING | Heartbeat 检测超时 | Heartbeat 直接发送 |
| Feishu API 失败 | Session Hook / Heartbeat | 直接发送 |

**设计原因**：Pump Runner 当前是无耦合的纯 Python 脚本，不引入飞书 SDK 依赖。通知由拥有飞书 API 凭证的层（龙虾 / Heartbeat / Cron）发出，保持层间解耦。

---

## 7. 实施步骤（仅设计，待授权）

```
Step 1: 配置飞书群 Webhook
  - 在飞书群 → 设置 → 群机器人 → 添加 Webhook 机器人
  - 记录 Webhook URL

Step 2: 通知脚本开发
  - 创建 backend/tools/feishu-notify.py
  - 输入：payload JSON
  - 输出：POST 到 Webhook / 飞书 API

Step 3: Heartbeat 集成
  - HEARTBEAT.md 系统健康检测 → 异常时调用通知脚本

Step 4: P0 通道配置（可选）
  - 获取主人 open_id → 飞书应用消息通道
```

---

## 8. 设计约束总结

| 约束 | 说明 |
|:-----|:------|
| 通知不改状态 | 只发消息，不改 Mission Board |
| 通知不调度 | 不发命令，只发信息 |
| 通知不执行 | 不调用 CC / Pump Runner |
| 去重 | 同一状态变化不重复通知 |
| 限频 | P0 即时，P1 合并，P2 汇总 |
| 可弃 | 通知失败不影响系统运行 |
