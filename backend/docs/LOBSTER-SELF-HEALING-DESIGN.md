# LOBSTER-SELF-HEALING-IMPLEMENT-001 — Phase 2 Design Document

> **Mission**: M-2026-07-18-PHASE2-001
> **Status**: COMPLETED
> **Date**: 2026-07-18

---

## 1. Mission Overview

### 1.1 Objective
Implement Phase 2 of the LOBSTER Self-Healing protocol — the **Session Recovery & System Health Monitoring** layer. This adds P0-level recovery rules to the cognitive operating system and heartbeat health checks for proactive fault detection.

### 1.2 Scope
| Component | Description |
|:----------|:------------|
| Session Recovery | New session startup → state recovery flow in AGENTS.md |
| Heartbeat Health | Periodic system health checks in HEARTBEAT.md |
| State Index | Persistent session state tracking in MEMORY.md |
| Audit | Verification that modifications respect all governance boundaries |
| Design Documents | Architecture summary, audit table, cron design |

---

## 2. Modified Files

### 2.1 AGENTS.md — Session Recovery Protocol

**Location**: Inserted before the `## 安全` section (between the "最终目标" section and "安全" section).

**Added**: `### 🚀 Session Recovery Protocol（会话自恢复 — P0）`

**Content**:
- **Step 1: 读取系统状态** — Scan `.missions/` directory for `mission.state` files; read Feishu Mission Board; summarize states
- **Step 2: 根据状态输出对应信息** — Output templates for CREATED/RUNNING/PAUSED/FAILED/无异常 states
- **约束（硬性）** — Permission boundaries (what is allowed vs prohibited)
- **触发时机** — Only on first user message per session, not repeated

**Key design decision**: The protocol is **read-only** — it reads mission states and Feishu board, outputs summaries, but NEVER modifies runtime state, starts Pump Runner, or schedules Claude Code. This preserves the CCAI-017 role separation.

### 2.2 HEARTBEAT.md — System Health Monitoring（P0）

**Location**: Appended after Section 5 (小红书运营监控).

**Added**: `### 6. 系统健康检测（System Health Monitoring — P0）`

**Four sub-checks**:
| Sub-section | Check | Alert trigger |
|:------------|:------|:--------------|
| 6.1 | Feishu Mission Queue | New CREATED mission detected |
| 6.2 | Runtime Status | PAUSED/FAILED/RUNNING timeout (>30 min) |
| 6.3 | Evidence Freshness | >1h idle (low), >4h idle (alert) |
| 6.4 | System Availability | Pump Runner anomaly |

**Design principle**: All checks are **read-only**. The heartbeat logs, reads, and reports — but never modifies state, starts processes, or calls Claude Code.

### 2.3 MEMORY.md — Session 追踪（System Self-Healing — P0）

**Location**: Inserted in the `## 永久记忆（Permanent）` section, after the "执行模式" line, before the CCAI Governance section.

**Tracked fields**:
- 最后活跃时间
- 上次完成 Mission
- 当前 Active Mission
- 待处理 Mission 数
- 最后健康检查时间
- 未处理问题

**Purpose**: Provides a persistent, at-a-glance status section that survives session restarts, enabling the Session Recovery Protocol to detect state changes between sessions.

---

## 3. Architecture Boundaries

### 3.1 Role Compliance (CCAI-017)

```
龙虾 (Orchestrator)     →   调度、审计、状态读取    ✅ Allowed
Claude Code (Executor)  →   文件修改、代码执行       ✅ Not called by recovery
Pump Runner             →   自动执行引擎             ❌ Not started by recovery
Feishu Board            →   任务队列                 ✅ Read-only access
```

### 3.2 Runtime Boundary Diagram

```
┌─────────────────────────────────────────┐
│           Session Recovery               │
│  (AGENTS.md P0 Rule)                     │
│  Reads: .missions/, Feishu Board         │
│  Outputs: Status summary to user         │
│  ❌ Does NOT: modify state, start         │
│     Pump Runner, call CC                 │
└──────────────┬──────────────────────────┘
               │ (info flow only)
               ▼
┌─────────────────────────────────────────┐
│         Heartbeat Health Check           │
│  (HEARTBEAT.md Section 6)               │
│  ~30 min periodic checks                 │
│  Reads: .missions/, Pump Runner status   │
│  ❌ Does NOT: call CC, modify files       │
└──────────────┬──────────────────────────┘
               │ (info flow only)
               ▼
┌─────────────────────────────────────────┐
│           MEMORY State Index             │
│  (MEMORY.md)                             │
│  Persistent state tracking               │
│  Updated only by explicit mission flow   │
└─────────────────────────────────────────┘
```

### 3.3 Constraint Rules (Hard)

| Rule | Description | Violation Risk |
|:-----|:------------|:---------------|
| GR-007 | CC Is The Only Executor | ❌ Cannot be violated |
| CCAI-017 | Orchestrator ≠ Executor | ✅ Preserved |
| FP-015 | Audit Only Mode | ✅ All operations are read-only |
| GR-013 | Mission Continuity | ✅ Recovery doesn't interrupt |
| No Auto-Execute | No automatic task dispatch | ✅ Enforced |

---

## 4. Trigger Conditions

### Session Recovery (AGENTS.md)
- **Trigger**: First user message in a new session
- **Scope**: Single execution per session
- **Execution**: Orchestrator reads state, outputs summary, waits for user

### Heartbeat Health (HEARTBEAT.md)
- **Trigger**: Every ~30 min heartbeat
- **Scope**: Continuous periodic check during session
- **Execution**: Orchestrator reads state, generates alerts if needed

---

## 5. Future Considerations (Phase 3+)

- **Automated recovery actions** for specific failure modes (requires explicit user approval)
- **Feishu push notifications** for detected anomalies
- **Mission retry logic** for PAUSED missions
- **Evidence archive cleanup** for stale missions

---

*End of Design Document*
