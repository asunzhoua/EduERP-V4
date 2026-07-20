# LOBSTER Active Capability Audit

> **审计日期**: 2026-07-18
> **审计角色**: 龙虾（Orchestrator）
> **审计模式**: READ-ONLY（不修改任何文件）
> **核心原则**: "规则存在" ≠ "规则自动生效"

---

## 审计对象

| # | 能力 | 文件 | 关键词/章节 |
|:--|:-----|:-----|:------------|
| 1 | Session Recovery | `AGENTS.md` | 🚀 Session Recovery Protocol（会话自恢复 — P0） |
| 2 | System Health Check | `HEARTBEAT.md` | 6. 系统健康检测（System Health Monitoring — P0） |
| 3 | Feishu Mission Scan | `HEARTBEAT.md` | 6.1 Feishu Mission Queue（任务队列检测） |
| 4 | Runtime 状态检测 | `HEARTBEAT.md` | 6.2 Runtime Status（运行时状态检测） |
| 5 | Notification 调用 | `HEARTBEAT.md` | 7. 飞书通知集成 |

---

### 1. Session Recovery（会话自恢复）

| 字段 | 值 |
|:-----|:----|
| **规则定义** | `AGENTS.md:73` — 🚀 Session Recovery Protocol 标题 |
| **规则内容** | `AGENTS.md:73-110` — 完整协议：Step 1（读取系统状态）→ Step 2（根据状态输出信息）→ 约束 + 触发时机 |
| **触发时机** | `AGENTS.md:109` — "每次收到用户消息的初始阶段执行（首次检测）" |
| **关键约束** | `AGENTS.md:103-108` — 禁止自动启动 Pump Runner / 禁止自动调度 CC / 禁止修改 Runtime |
| **部署状态** | ⚠️ 规则已定义，待激活 |

#### 证据链

| 检查项 | 结果 | 说明 |
|:-------|:-----|:------|
| 规则是否存在 | ✅ 存在 | `AGENTS.md:73-110` 完整定义了协议 |
| 是否自动执行 | ❌ 未执行 | 本次会话启动时，龙虾未执行 Session Recovery（主人直接下达了审计任务，龙虾直接执行） |
| 是否有外部触发机制 | ❌ 无 | 当前无 Cron 或机制确保"每次新会话"自动执行 Recovery |
| 是否可手动调用 | ⚠️ 理论可行 | 规则定义在 AGENTS.md 中，依赖龙虾自觉遵守 |

#### 生效分析

**结论：未生效。** 规则定义完整但存在三个问题：

1. **触发机制无保障** — 规则说"每次新会话启动时"，但龙虾是否实际执行完全依赖 AGENTS.md 被读取后的自觉遵守，没有外部强制检查
2. **已违反实例** — 本次会话中主人直接下达任务，龙虾直接执行审计（未做 Session Recovery），虽然本次任务明确跳过 Recovery，但说明规则无强制执行
3. **Cron 缺失** — Health Check 的 Cron 定时触发机制也缺席，Session Recovery 本身的"新会话"触发无法被自动化

---

### 2. System Health Check（系统健康检测）

| 字段 | 值 |
|:-----|:----|
| **规则定义** | `HEARTBEAT.md:33` — "### 6. 系统健康检测（System Health Monitoring — P0）" |
| **检测周期** | `HEARTBEAT.md:35` — "每次 Heartbeat 触发时执行（约 30 分钟）" |
| **4 个子检测** | `HEARTBEAT.md:39-62` — 6.1 Feishu Mission Queue + 6.2 Runtime Status + 6.3 Evidence Freshness + 6.4 System Availability |
| **部署状态** | ❌ 未部署 |

#### 证据链

| 检查项 | 结果 | 说明 |
|:-------|:-----|:------|
| 规则是否存在 | ✅ 存在 | `HEARTBEAT.md:33-69` 完整定义了 4 个子检测 + 约束 |
| 是否自动触发 | ❌ 未触发 | 当前会话期间未执行任何 Health Check |
| Heartbeat 是否配置 | ❌ 未配置 | `AGENTS.md` 中 Heartbeat 提示存在，但实际系统无 Heartbeat 触发机制 |
| Cron 定时任务 | ❌ 未部署 | `EOS-NEXT-PHASE-ROADMAP.md:31` — "Cron 定时心跳部署：设计完成，未部署" |

#### 生效分析

**结论：未生效。** Health Check 的完整流程定义在 HEARTBEAT.md 中，但依赖 **Heartbeat 定时触发**。当前系统中：

- Heartbeat 机制依赖 QwenPaw 的 heartbeat 功能（约 30 分钟间隔）
- 但 **未配置** Cron 或其他定时器来确保 Heartbeat 自动触发
- Health Check 的 4 项子检测全部依赖于 Heartbeat 被触发

---

### 3. Feishu Mission Scan（任务队列检测）

| 字段 | 值 |
|:-----|:----|
| **规则定义** | `HEARTBEAT.md:39` — "#### 6.1 Feishu Mission Queue（任务队列检测）" |
| **规则内容** | `HEARTBEAT.md:39-43` — 调用 Feishu API → 检查 CREATED → 输出计数 → 提醒主人 |
| **部署状态** | ❌ 未部署 |

#### 证据链

| 检查项 | 结果 | 说明 |
|:-------|:-----|:------|
| 规则是否存在 | ✅ 存在 | `HEARTBEAT.md:39-43` |
| API 是否可调用 | ⚠️ 理论可行 | Feishu 已配置，Mission Board API 可访问 |
| 是否自动执行 | ❌ 未执行 | 整个 Health Check 未触发，Mission Scan 自然也未被调用 |
| 独立执行能力 | ❌ 不具备 | 规则设计为 Health Check 的子步骤，无独立触发机制 |

#### 生效分析

**结论：未生效。** Feishu Mission Scan 是 Health Check 的子步骤，Health Check 未部署，Mission Scan 自然也未生效。

即使手动触发 Health Check，Mission Scan 依赖 `FEISHU_WEBHOOK_URL` 环境变量和 Feishu API 访问权限，这些虽然在 EOS 中已配置，但没有经过自动化验证。

---

### 4. Runtime 状态检测

| 字段 | 值 |
|:-----|:----|
| **规则定义** | `HEARTBEAT.md:45` — "#### 6.2 Runtime Status（运行时状态检测）" |
| **规则内容** | `HEARTBEAT.md:45-53` — 扫描 `.missions/*/mission.state` → 检查 PAUSED / FAILED / RUNNING 超时 → 生成异常摘要 |
| **子检测 6.3** | `HEARTBEAT.md:54-57` — Evidence Freshness（1小时低活跃 / 4小时无活动提醒） |
| **子检测 6.4** | `HEARTBEAT.md:59-62` — System Availability（Pump Runner 异常 + 最后运行时间） |
| **部署状态** | ❌ 未部署 |

#### 证据链

| 检查项 | 结果 | 说明 |
|:-------|:-----|:------|
| 规则是否存在 | ✅ 存在 | `HEARTBEAT.md:45-62` |
| 扫描路径是否正确 | ✅ 正确 | `.missions/*/mission.state` — 已验证实际存在该路径模式 |
| 是否自动执行 | ❌ 未执行 | 依赖 Health Check 触发 |
| 已知可检测到的问题 | ⚠️ 存在 | pump-test-001 PAUSED（`CURRENT-ISSUE-REGISTER.md:86`）— 如果有 Runtime 检测本该发现 |

#### 生效分析

**结论：未生效。** Runtime 状态检测同样依赖 Health Check → Heartbeat → Cron 的整体链路。

值得注意的是，如果此能力已部署，**pump-test-001 遗留 PAUSED 状态**本应在上次 Heartbeat（假设存在）时被自动检测并汇报。当前该问题仅存在于文档中（`CURRENT-ISSUE-REGISTER.md:86`），无人主动发现。

---

### 5. Notification 调用（飞书通知集成）

| 字段 | 值 |
|:-----|:----|
| **规则定义** | `HEARTBEAT.md:71` — "### 7. 飞书通知集成" |
| **规则内容** | `HEARTBEAT.md:71-77` — 通知脚本路径 + Webhook 环境变量 + 调用时机 + Severity 级别 |
| **脚本路径** | `C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\backend\tools\feishu-notify.py` |
| **部署状态** | ⚠️ 部分就绪 |

#### 证据链

| 检查项 | 结果 | 说明 |
|:-------|:-----|:------|
| 通知脚本是否存在 | ✅ 存在 | `HEARTBEAT.md:72` — 脚本路径明确 |
| Webhook 是否配置 | ✅ 已配置 | `HEARTBEAT.md:73` — 环境变量 `FEISHU_WEBHOOK_URL` |
| Severity 级别是否定义 | ✅ 已定义 | `HEARTBEAT.md:75` — INFO/WARNING/ERROR |
| 自动调用是否就绪 | ❌ 未就绪 | 依赖 Health Check 发现异常后调用，Health Check 未部署 |
| 手动调用是否可行 | ✅ 可行 | 脚本 + Webhook 存在，可手动调用 |

#### 生效分析

**结论：部分就绪，未自动生效。** 

- **通知脚本**: ✅ 存在且已验证
- **Webhook**: ✅ 已配置且已验证（Control Plane 验证期间已使用过）
- **Severity 标准**: ✅ 已定义
- **自动触发**: ❌ 未生效 — 通知调用设计为 Health Check 发现异常后的下一步操作

当前该能力处于"基础设施就绪，但缺乏自动调度"的状态。

---

## 汇总

| # | 能力 | 规则存在 | 自动生效 | 部署状态 | 阻塞原因 |
|:--|:-----|:---------|:---------|:---------|:---------|
| 1 | Session Recovery | ✅ `AGENTS.md:73` | ❌ | ⚠️ 待激活 | 无外部触发机制，依赖自觉 |
| 2 | System Health Check | ✅ `HEARTBEAT.md:33` | ❌ | ❌ 未部署 | Cron 定时任务未配置 |
| 3 | Feishu Mission Scan | ✅ `HEARTBEAT.md:39` | ❌ | ❌ 未部署 | 依赖 Health Check |
| 4 | Runtime 状态检测 | ✅ `HEARTBEAT.md:45` | ❌ | ❌ 未部署 | 依赖 Health Check |
| 5 | Notification 调用 | ✅ `HEARTBEAT.md:71` | ❌ | ⚠️ 部分就绪 | 依赖 Health Check 触发 |

### 依赖链可视化

```
Cron 定时任务（缺失 🔴）
  └─→ Heartbeat（30分钟周期，缺失 🔴）
       └─→ Session Recovery（仅首次会话，当前未强制执行 ⚠️）
       └─→ System Health Check（缺失 🔴）
            ├─→ Feishu Mission Scan（缺失 🔴）
            ├─→ Runtime 状态检测（缺失 🔴）
            │    └─→ Evidence Freshness（缺失 🔴）
            │    └─→ System Availability（缺失 🔴）
            └─→ Notification 调用（脚本就绪 ✅，触发缺失 🔴）
```

### 关键发现

1. **根因阻塞点只有一个**: **Cron 定时心跳未部署**（`EOS-NEXT-PHASE-ROADMAP.md:31`）
   - 部署该 Cron 后，5 项能力中 4 项（Health Check + Mission Scan + Runtime 检测 + Notification）可一次性激活
   - Session Recovery 仍需额外机制确保"首次会话"自动执行

2. **5 项能力的规则定义全部完整**，但没有一项实际自动生效

3. **通知能力的基础设施最就绪**（脚本 + Webhook），仅缺触发

4. **pump-test-001 PAUSED** 是能力未部署的直接后果 — 如果有 Runtime 检测本该已被发现

### 审计结论

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     5 项 Active Capability:                                  ║
║     ✅ 5/5 规则已定义                                         ║
║     ❌ 5/5 均未自动生效                                      ║
║                                                              ║
║     根本原因: Cron 定时任务未部署                              ║
║     解锁条件: 部署 Cron → Heartbeat → Health Check           ║
║     → 一次性激活 4 项下游能力                                ║
║                                                              ║
║     优先级建议: P0 - 部署 Cron 定时心跳（~1小时）            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```
