# ORCHESTRATOR-RECOVERY-AUDIT.md

> **Mission**: ORCHESTRATOR-SELF-RECOVERY-IMPLEMENT-PLAN-001 — Phase 1
> **Date**: 2026-07-18
> **Auditor**: Lobster (Orchestrator)
> **Status**: ✅ COMPLETE

---

## 1. 当前系统状态

### 1.1 Feishu Control Plane
| 组件 | 状态 |
|:-----|:-----|
| Mission Board | ✅ 正常 — 1行数据 (COMPLETED) |
| 连接状态 | ✅ 正常 — tenant_access_token 可用 |
| CREATED Missions | 0 |
| RUNNING Missions | 0 |
| FAILED/PAUSED Missions | 0 |

### 1.2 Pump Runner Runtime
| 组件 | 状态 |
|:-----|:-----|
| pump-runner.py | ✅ 存在 — 已验证可执行 |
| .missions/ 目录 | ✅ 存在 — 8个任务目录 |
| Active (RUNNING/PAUSED) | 0 — 全部已结束 |
| `pump-test-001` | ⏸️ PAUSED (遗留，需清理) |

### 1.3 Claude Code CLI
| 组件 | 状态 |
|:-----|:-----|
| 安装 | ✅ v2.1.211 |
| 路径 | `C:\Users\sunz\AppData\Roaming\npm\claude.cmd` |
| 可执行 | ✅ 已验证 |

### 1.4 当前 Session 机制
| 组件 | 状态 |
|:-----|:-----|
| Heartbeat | ✅ 配置中 — 约30min |
| Cron | ❌ 无 — 未配置任何定时任务 |
| Session Recovery | ❌ 无 — 无恢复机制 |
| 主动检测 | ❌ 无 — 被动等待输入 |

---

## 2. 文件审计

### 2.1 AGENTS.md 审计

| 审计项 | 当前状态 | 评估 |
|:-------|:---------|:-----|
| CCAI-017 角色分离 | ✅ 有定义 | 完整 |
| 8-step 工作流 | ✅ 有定义 | 完整 |
| Heartbeat 引用 | ✅ 引用 HEARTBEAT.md | 正常 |
| **Session 恢复** | ❌ **缺失** | 无任何新会话恢复逻辑 |
| **系统状态检查** | ❌ **缺失** | 无启动时自检 |
| **Feishu 扫描** | ❌ **缺失** | 无任务队列检测 |
| **Cron 引用** | ✅ 提及 | 但无具体规则 |
| **主动提醒** | ❌ **缺失** | 仅被动响应输入 |

**关键发现**: AGENTS.md 定义了"我是谁"和"怎么执行"，但完全没有定义"醒来后该做什么"。

### 2.2 HEARTBEAT.md 审计

| 审计项 | 当前状态 | 评估 |
|:-------|:---------|:-----|
| 课时记录 | ✅ 有定义 | 正常 |
| 记忆同步 | ✅ 有定义 | 正常 |
| 小红书监控 | ✅ 有定义 | 正常 |
| **系统健康检测** | ❌ **缺失** | 无 Pump Runner 状态检查 |
| **Feishu Board 扫描** | ❌ **缺失** | 无任务队列监控 |
| **Stale Mission 检测** | ❌ **缺失** | 无超时/卡住检测 |
| **Evidence 新鲜度** | ❌ **缺失** | 无最近活动时间检查 |
| **Pump Runner 进程** | ❌ **缺失** | 无进程存活检查 |
| **主动通知** | ❌ **缺失** | 仅记录文件，不推消息 |

**关键发现**: HEARTBEAT.md 关注的是"业务自动任务"，完全没覆盖"系统自身健康"。

### 2.3 MEMORY.md 审计

| 审计项 | 当前状态 | 评估 |
|:-------|:---------|:-----|
| 项目索引 | ✅ 完整 | 所有项目有记录 |
| 治理规则 | ✅ 完整 | CCAI 规则索引 |
| **最后活跃时间** | ❌ **缺失** | 无时间戳记录 |
| **Session 状态** | ❌ **缺失** | 无会话生命周期追踪 |
| **Mission 队列** | ❌ **缺失** | 无待执行任务记录 |

---

## 3. 问题清单

| ISS-ID | Severity | 问题 | 影响 | 涉及文件 |
|:-------|:---------|:-----|:-----|:---------|
| REC-001 | 🔴 P0 | 新会话无状态恢复 | 每次醒来不知之前干了什么 | AGENTS.md |
| REC-002 | 🔴 P0 | 无系统自检 | 错过 RUNNING/FAILED Mission | AGENTS.md / HEARTBEAT.md |
| REC-003 | 🟡 P1 | 无 Feishu Board 扫描 | 有 CREATED 任务不知道 | HEARTBEAT.md |
| REC-004 | 🟡 P1 | 无 Stale Mission 检测 | 卡住的任务无人发现 | HEARTBEAT.md |
| REC-005 | 🟡 P1 | 无 Cron 监控 | 无人值守时段无保底 | — |
| REC-006 | 🟢 P2 | 无 Evidence 新鲜度检查 | 不知道上次成功执行时间 | HEARTBEAT.md |
| REC-007 | 🟢 P2 | 无主动通知机制 | 发现问题无法通知主人 | AGENTS.md |

---

## 4. 架构风险评估

### 4.1 修改范围与影响

```
修改文件:
  AGENTS.md       [+Session Hook 规则]     → 只加规则描述，不涉及执行代码
  HEARTBEAT.md    [+健康检测规则]          → 只加检测规则，不涉及 Runtime 修改
  MEMORY.md       [+状态追踪字段]          → 只加索引字段

不修改:
  pump-runner.py           → Runtime 不动
  feishu-to-mission.py     → 工具不动
  mission-to-feishu.py     → 工具不动
  .missions/*              → Runtime 状态不动
  Feishu Board             → Control Plane 不动
```

### 4.2 架构边界确认

```
龙虾自恢复的边界:
  检测   → ✅ 允许 (读文件、读 API)
  提醒   → ✅ 允许 (channel_message / 对话回复)
  决策   → ✅ 允许 (判断是否通知、是否等输入)
  
  执行   → ❌ 禁止 (不启动 Pump Runner)
  修改   → ❌ 禁止 (不改代码、不改 Runtime 状态)
  调度   → ❌ 禁止 (不自动 spawn CC)
```

### 4.3 与现有规则的一致性

| 规则 | 冲突检查 |
|:-----|:---------|
| CCAI-017 角色分离 | ✅ 自恢复只负责检测+提醒，不执行代码 |
| GR-007 CC 唯一执行者 | ✅ 自恢复不直接调用 CC |
| GR-013/014 Pipeline 连续性 | ✅ 自恢复检测到问题提醒主人，不替 Pump Runner 决策 |
| CCAI-020 Runtime Truth Rule | ✅ 自恢复不修改 Runtime 状态 |
| 三段式执行规则 | ✅ 自恢复属于 Plan/Review 阶段 |

### 4.4 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|:-----|:-----|:-----|:-----|
| 自恢复规则太松，变成隐式执行器 | 中 | 高 | Phase 设计只加检测规则，不加执行逻辑 |
| Heartbeat 误报 | 低 | 低 | 只产生警告，不自动操作 |
| Session Hook 消耗 Token | 低 | 低 | 读取本地文件为主，一次 API 调用 |
| 与现有规则冲突 | 低 | 高 | Phase 1 审计已确认无冲突 |

---

## 5. Phase 2 修改建议

### 5.1 AGENTS.md 新增内容

```markdown
### 🚀 Session Recovery（会话自恢复 — P0）

**每次新会话启动时，必须执行**：

1. **读取系统状态**
   - 扫描 `.missions/` 下所有 `mission.state`
   - 统计 CREATED / RUNNING / PAUSED / FAILED / COMPLETED
   
2. **读取 Feishu Mission Board**
   - 检查是否有 CREATED 状态的 Mission
   
3. **输出 System Status Summary**
   - 汇报当前 Mission 状态概览
   - 如有异常状态，主动告知主人
   
4. **等待指令**
   - 发现 CREATED Mission → "发现 X 个待执行 Mission，等待调度"
   - 发现 FAILED → 产出异常摘要，等待决策
   - 无异常 → "系统正常，上次完成: [Mission ID]"

**禁止**：
- ❌ 自动启动 Pump Runner
- ❌ 自动调度 CC
- ❌ 自动修改任何 Runtime 状态
```

### 5.2 HEARTBEAT.md 新增内容

```markdown
### 6. 系统健康检测（新增）

每次 Heartbeat 触发时增加：

- **Pump Runner 状态检查**
  - 读取 `.missions/*/mission.state`
  - 检测是否卡 RUNNING（超过 30 分钟未更新）
  - 检测是否 PAUSED / FAILED

- **Feishu Board 扫描**
  - 检查 CREATED Mission 数量
  - 发现新的待执行任务

- **Evidence 新鲜度**
  - 检查最近已完成的 mission.state.updated_at
  - 如果超过 1 小时无新活动：记录状态

**发现异常时的行为**：
- 卡 RUNNING → MISSION_STALE_WARNING（提醒主人）
- PAUSED/FAILED → 异常摘要（提醒主人）
- CREATED 新任务 → "发现 N 个 CREATED Mission"
- 正常 → 不打扰（仅记录）

**禁止**：
- ❌ 修改 Runtime 状态
- ❌ 启动 Pump Runner
- ❌ 调用 Claude Code
```

### 5.3 Cron 配置建议

```bash
qwenpaw cron create --agent-id default \
  --name "system-health-check" \
  --interval 15m \
  --task "执行系统健康检测并汇报异常"
```

### 5.4 MEMORY.md 新增追踪字段

```markdown
## Session 追踪（系统自恢复用）
- **最后活跃时间**: YYYY-MM-DD HH:MM (来自最后完成的 Mission)
- **当前 Session ID**: 从对话上下文获取
- **待处理 Mission**: 0
```

---

## 6. 完成检查

| # | 标准 | 当前 |
|:--|:-----|:-----|
| 1 | ✅ 龙虾可恢复上下文 | ❌ 未实现 |
| 2 | ✅ 可以主动发现状态 | ❌ 未实现 |
| 3 | ✅ 可以主动提醒主人 | ❌ 未实现 |
| 4 | ✅ 不影响 Pump Runner | ✅ 架构确认无影响 |
| 5 | ✅ 不破坏 Runtime 真相源 | ✅ 架构确认无影响 |

---

## 7. 当前结论

Phase 1 审计完成。系统状态：

- **龙虾当前是纯被动组件**：等人说话 → 干活 → 等下一句话
- **没有 Session Recovery**：每次醒来都是"全新开始"
- **没有系统健康检测**：Heartbeat 不关注系统自身状态
- **没有 Cron 保底**：无人值守时段无监控

Phase 2 修改范围：
- AGENTS.md: +Session Recovery 规则块（只检测+提醒）
- HEARTBEAT.md: +系统健康检测块（只检测+提醒）
- MEMORY.md: +状态追踪索引字段

Phase 2 就绪，等待批准后由 CC 执行修改。
