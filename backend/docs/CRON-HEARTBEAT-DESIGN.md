# CRON-HEARTBEAT-DESIGN — Self-Healing Health Check Cron Design

> **Part of**: LOBSTER-SELF-HEALING-IMPLEMENT-001 Phase 2
> **Date**: 2026-07-18

---

## 1. Overview

This document defines the cron-based health check system that runs periodic system diagnostics. The cron triggers health checks independently of the HEARTBEAT.md mechanism — providing an additional safety layer for system monitoring even when no conversation is active.

---

## 2. Trigger Configuration

| Parameter | Value |
|:----------|:------|
| **Interval** | Every **15 minutes** |
| **Type** | Fixed interval cron (`*/15 * * * *`) |
| **Target Agent** | Orchestrator (default) |
| **Session** | Dedicated cron health check session |
| **Retry on Failure** | Yes, retry 2x at 30s intervals |

**Rationale for 15 minutes**:
- Heartbeat runs at ~30 minute intervals within active sessions
- Cron at 15 minutes provides coverage when no session is active
- Overlap provides redundancy — if one fails, the other catches it
- 15 minutes is fast enough to detect P0 failures without excessive API calls

---

## 3. Flow Diagram

```
┌──────────────────┐
│  Cron Trigger     │  (*/15 * * * *)
│  15 min interval  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Health Check     │  ─── Read-only checks
│  Initialization   │
└────────┬─────────┘
         │
    ┌────┴────┬──────────┬───────────┐
    ▼         ▼          ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│ Feishu │ │Runtime │ │Evidence│ │  System  │
│ Mission│ │Status  │ │Freshness│ │Availabil-│
│ Queue  │ │Check   │ │Check   │ │ity Check │
└───┬────┘ └───┬────┘ └───┬────┘ └────┬─────┘
    │          │          │           │
    └────┬─────┴──────────┴───────────┘
         │
         ▼
┌──────────────────┐
│  Report          │
│  Generation      │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
(正常)      (异常)
    │          │
    ▼          ▼
┌────────┐ ┌──────────┐
│ Log &  │ │ Notify   │
│ Idle   │ │ User     │
└────────┘ └──────────┘
```

---

## 4. Detailed Check Specifications

### 4.1 Feishu Mission Queue
```
Check:   Call Feishu API → read Mission Board
Output:  "Pending Mission Count: X"
Alert:   X > 0 → remind user of pending missions
Readonly:✅ (GET only)
```

### 4.2 Runtime Status
```
Check:   Scan .missions/*/mission.state for each mission
States:  CREATED, RUNNING, PAUSED, FAILED, COMPLETED
Alert:   PAUSED | FAILED | RUNNING > 30min without update
Readonly:✅ (no state modification)
```

### 4.3 Evidence Freshness
```
Check:   Read mission.state.updated_at
Thresholds:
  - >1h without activity → log as low-activity
  - >4h without activity → alert user
Readonly:✅
```

### 4.4 System Availability
```
Check:   Pump Runner status (if exists)
Check:   Last Pump Runner execution timestamp
Alert:   Abnormal state detected → notify user
Readonly:✅
```

---

## 5. Notification Rules

| Condition | Severity | Action | Channel |
|:----------|:---------|:-------|:--------|
| All checks pass | Info | Log only, no notification | — |
| New CREATED mission | Info | "发现待处理 Mission: X" | Direct message |
| PAUSED mission | Warning | "异常 Mission: PAUSED" | Direct message |
| FAILED mission | Critical | "异常 Mission: FAILED" | Direct message + highlight |
| RUNNING timeout (>30min) | Warning | "RUNNING 超时告警" | Direct message |
| Evidence stale (>4h) | Warning | "系统低活跃告警" | Direct message |
| Pump Runner anomaly | Critical | "系统异常告警" | Direct message |

---

## 6. Prohibited Operations (Hard Constraints)

```
┌──────────────────────────────────────────────┐
│ ❌ Cron shall NOT call Claude Code            │
│ ❌ Cron shall NOT modify Runtime state        │
│ ❌ Cron shall NOT start Pump Runner           │
│ ❌ Cron shall NOT modify Feishu Board         │
│ ❌ Cron shall NOT modify any files            │
│ ❌ Cron shall NOT auto-execute any mission    │
│ ❌ Cron shall NOT trigger automated recovery  │
└──────────────────────────────────────────────┘
```

**Rationale**: The cron health check is purely a **monitoring and notification** layer. Any automated response requires explicit user authorization per CCAI-017 (Orchestrator ≠ Executor) and GR-007 (CC Is The Only Executor).

---

## 7. Integration Points

### 7.1 With HEARTBEAT.md
- HEARTBEAT.md section 6 defines the same checks for in-session execution
- Cron provides coverage when no session is active
- Both use identical check logic and notification templates
- No deduplication needed — they serve different runtime contexts

### 7.2 With Session Recovery (AGENTS.md)
- Session Recovery reads from the same `.missions/` data
- Recovery runs once per session; cron runs periodically
- Recovery includes user interaction; cron is autonomous (read-only)

### 7.3 With MEMORY.md State Index
- Cron can optionally update "最后健康检查时间" in MEMORY.md
- State Index provides persistent reference for Recovery protocol

---

## 8. Implementation Notes

### 8.1 Crons to Create
| Cron ID | Description | Schedule |
|:--------|:------------|:---------|
| `HEALTH-CHECK-15MIN` | System health check cron | `*/15 * * * *` |

### 8.2 Command Template
```bash
qwenpaw cron create \
  --schedule "*/15 * * * *" \
  --task "Execute System Health Check: scan .missions/, read Feishu Board, check Runtime status, check Evidence freshness, check System Availability. Output summary. Do NOT call CC, modify state, or start Pump Runner." \
  --agent-id default
```

### 8.3 Failure Handling
- On API failure: retry 2x, then skip that check
- On mission parse error: log warning, continue with other checks
- On total failure (all checks fail): log critical, notify user

---

## 9. Future Extensions (Phase 3+)

| Feature | Description | Requires |
|:--------|:------------|:---------|
| Automated email notification | Push alerts to user's email | SMTP config |
| Feishu push notification | Send alert to Feishu channel | Webhook config |
| Dashboard integration | Log health check history to dashboard | Dashboard service |
| Automated PAUSED retry | Auto-resume PAUSED missions | User pre-authorization |

---

*End of Cron Design Document*
