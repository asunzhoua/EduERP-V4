# NEXT-PHASE-ROADMAP.md

> **Version**: 1.0
> **Date**: 2026-07-18
> **Status**: PLANNED
> **Owner**: Lobster (Orchestrator)
> **Description**: EOS AI Team 下一阶段规划（龙虾自愈改造后）

---

## 当前阶段完成状态

```
Phase A: Feishu Resource Creation           ✅ COMPLETE
Phase B: Mission Board → Runtime Control    ✅ COMPLETE
Phase C: Feishu Notification                ⏳ NOT STARTED
Phase D: Bidirectional Sync                  ⏳ NOT STARTED
Phase E: Feishu Bot NLP Entry               ⏳ NOT STARTED

Pump Runner Stability Validation            ✅ COMPLETE
CCAI Governance Framework                   ✅ COMPLETE
System Baseline Documentation                ✅ COMPLETE (当前)
```

---

## Phase 2: Lobster Self-Healing（龙虾自愈）

**优先级**: 🔴 P0 — 解决当前"被动死机"问题

### 目标

让龙虾具备：
- 会话恢复（Session Recovery）
- 心跳检测（Health Check）
- 假死发现（Stale Detection）
- 状态汇报（Status Report）

### 修改范围

| 文件 | 修改类型 | 内容 |
|:-----|:---------|:-----|
| `AGENTS.md` | ✅ 增加规则 | Session Recovery Hook（只检测+提醒） |
| `HEARTBEAT.md` | ✅ 增加规则 | 系统健康检测块（只检测+提醒） |
| `MEMORY.md` | ✅ 增加索引 | 状态追踪字段 |
| Cron 配置 | ✅ 新增 | system-health-check, 15min 间隔 |

### 约束（硬性）

```
✅ 自动检测 = 允许
✅ 自动提醒 = 允许
✅ 自动决策（是否通知、是否等待） = 允许

❌ 自动执行 = 禁止（不启动 Pump Runner）
❌ 自动修复 = 禁止（不改 Runtime 状态）
❌ 自动调度 = 禁止（不 spawn CC）
```

### 架构边界（不可突破）

```
CCAI-017: 角色分离 → 不改
Pump Runner Runtime Boundary → 不改
Runtime Truth Source → 不改
三段式执行模式 → 不改
```

### 完成标准

| # | 标准 | 验证方式 |
|:--|:-----|:---------|
| 1 | 新会话自动恢复上下文 | 重启会话 → 自动输出 System Status Summary |
| 2 | 可主动发现状态 | Session Hook 扫描 .missions/ 和 Feishu Board |
| 3 | 可主动提醒主人 | 发现 CREATED/FAILED/PAUSED 时告知主人 |
| 4 | 不影响 Pump Runner | 不修改 Runtime 状态、不启动 Runner |
| 5 | 不破坏 Runtime 真相源 | .missions/ 和 Feishu Board 只读 |

---

## Phase 3: Feishu Notification（飞书通知）

**优先级**: 🟡 P1

### 目标

Mission 状态变化时自动推送通知到飞书消息。

| 触发事件 | 通知内容 |
|:---------|:---------|
| Mission CREATED | "新任务已创建：{Mission ID}" |
| Mission COMPLETED | "任务完成：{Mission ID} — {Result}" |
| Mission FAILED | "任务失败：{Mission ID} — 需要人工介入" |
| Mission PAUSED | "任务暂停：{Mission ID} — 连续失败" |

### 依赖

- ✅ Pump Runner 状态机（已完成）
- ✅ Feishu Mission Board（已完成）
- ⏳ 飞书 Webhook / 消息推送能力（新开发）

---

## Phase 4: Bidirectional Sync（双向同步）

**优先级**: 🟡 P1

### 目标

飞书修改（状态/描述/优先级）反向影响 Pump Runner 执行。

```
Feishu 修改 Status → mission.json 更新 → Pump Runner 响应
Feishu 修改 Description → Task prompt 更新
Feishu 修改 Priority → 执行优先级调整
```

### 约束

- 飞书只允许修改 CREATED 和 PAUSED 状态
- RUNNING/COMPLETED/FAILED 不可由飞书修改
- 飞书不可直接调用 Claude Code

---

## Phase 5: Cron Monitor & Health Dashboard

**优先级**: 🟡 P1 — 与 Phase 2 配合

### 目标

建立定时监控，每 15 分钟输出系统健康报告。

### 输出

```json
{
  "time": "2026-07-18T12:00:00Z",
  "mission_count": 5,
  "running": 0,
  "paused": 1,
  "failed": 0,
  "last_activity": "2026-07-18T11:58:50Z"
}
```

### 通知规则

| 级别 | 条件 | 行动 |
|:-----|:-----|:------|
| P0 | Pump Runner 崩溃 / Runtime state 损坏 | 立即通知 |
| P1 | Mission FAILED / PAUSED | 通知主人 |
| P2 | CREATED 超过 30 分钟未处理 | 提醒 |

---

## Phase 6: Trigger Layer（自动触发层）

**优先级**: 🟢 P2 — 依赖 Phase 2-5 完成

### 目标

让 Creator（主人）只需要在飞书创建 CREATED Mission，系统自动完成剩余流程。

```
Creator → 飞书创建 CREATED → Trigger Layer 检测
  → 自动 dispatch → Pump Runner → Claude Code → Evidence → 飞书 COMPLETED
```

### 约束

- Trigger Layer 不决定执行什么
- Trigger Layer 不修改任务内容
- Trigger Layer 只做"CREATED → dispatch"这一个动作
- 主人仍可在飞书修改/取消任务

---

## Phase 7: 长期规划

| Phase | 内容 | 优先级 |
|:------|:-----|:-------|
| C | 飞书通知 | 🟡 P1 |
| D | 双向同步 | 🟡 P1 |
| E | 飞书机器人自然语言入口 | 🟢 P2 |
| F | Multi-runner 并行调度 | 🟢 P2 |
| G | Cost Tracking & Token Analytics | 🟢 P2 |
| H | Browser-based Dashboard | 🟢 P3 |

---

## 时间线（建议）

```
现在 → Phase 2: Lobster Self-Healing      [P0 — 解决死机问题]
  ↓ (1-2 次会话)
Phase 3: Feishu Notification               [P1 — 减少人工轮询]
  ↓ (1-2 次会话)
Phase 4: Bidirectional Sync                [P1 — 飞书可控制]
  ↓ (1-2 次会话)
Phase 5: Cron Monitor                      [P1 — 减少人工监控]
  ↓ (稳定运行后)
Phase 6: Trigger Layer                     [P2 — 全自动闭环]
  ↓
Phase 7: 长期优化                          [P2/P3 — 按需推进]
```

---

## 后续授权要求

每 Phase 执行前必须得到主人明确授权，禁止跨 Phase 自动推进。

授权格式：
```
主人说"进入 Phase X" 或
Mission 创建: M-PHASE-X-IMPLEMENT-001 (Status: READY)
```
