# Attendance State Machine

> **Version**: v1.0.0
> **Status**: Sprint 4.1.5 — Architecture Phase
> **Last Updated**: 2026-07-14
> **Authority**: [AttendanceDomainModel.md](../DomainModel/AttendanceDomainModel.md), [TeachingConstitution_v1.1.md](../architecture/TeachingConstitution_v1.1.md)
> **Scope**: LessonAttendance workflow state machine + LessonChangeRequest lifecycle

---

## 1. Overview

Attendance Domain contains **two state machines** that must never be confused:

| State Machine | Entity | Purpose | States |
|--------------|--------|---------|--------|
| **Workflow State Machine** | LessonAttendance | Tracks the lifecycle process of recording attendance | PENDING → CHECKED_IN → CONFIRMED → LOCKED |
| **Request Lifecycle** | LessonChangeRequest | Tracks the governance process of lesson changes | PENDING → APPROVED → EXECUTED / REJECTED |

**Critical distinction:** The LessonAttendance `status` field (PRESENT, ABSENT, LATE, etc.) is **NOT** a state machine. It is a **data value** set by the teacher during the CHECKED_IN transition. The workflow state machine governs the process; the status records the outcome.

---

## 2. LessonAttendance Workflow State Machine

### 2.1 ASCII Diagram

```
                          Lesson SCHEDULED → TEACHING
                                    │
                    ┌───────────────┐│
                    │ Auto-create   ││
                    │ attendance    ││
                    │ records for   ││
                    │ all enrolled  ││
                    │ students      ││
                    └───────┬───────┘│
                            ▼        │
                    ┌─────────────┐  │
                    │   PENDING   │  │
                    │ (status=null)│  │
                    └──────┬──────┘  │
                           │         │
                           │ Teacher records attendance
                           │ (sets status + checkInTime)
                           ▼         │
                    ┌─────────────┐  │
                    │ CHECKED_IN  │  │
                    │ (status set)│  │
                    └──────┬──────┘  │
                           │         │
                    ┌──────┴──────┐  │
                    │             │  │
                    │ Admin       │  │ Admin override
                    │ confirms    │  │ (reverse: → CHECKED_IN)
                    │ OR          │  │
                    │ auto-confirm│  │
                    │ (timeout)   │  │
                    │             │  │
                    └──────┬──────┘  │
                           │         │
                           ▼         │
                    ┌─────────────┐  │
                    │ CONFIRMED   │  │
                    │ (finalized) │  │
                    └──────┬──────┘  │
                           │         │
                           │ Lesson: FINISHED → ARCHIVED
                           │ (guard: ALL attendance CONFIRMED/LOCKED)
                           ▼         │
                    ┌─────────────┐  │
                    │   LOCKED    │  │
                    │ (immutable) │  │
                    └─────────────┘  │
                                     │
                    ═══ Emits: lesson.finished ═══
                    ═══ Finance Domain: deduct ═══
```

### 2.2 Forward Transition Rules

| # | From | To | Trigger | Guard | Side Effect |
|---|------|----|---------|-------|-------------|
| F1 | — | PENDING | Lesson: SCHEDULED → TEACHING | At least 1 ACTIVE Enrollment exists for the class | Auto-create attendance records. operator=0 (system), source=API. |
| F2 | PENDING | CHECKED_IN | Teacher records attendance | `status` must be set to one of 7 values. If status ∈ {LATE, LEAVE, ABSENT}, `reason` is required. | Set `checkInTime`. Set `operator` to recording userId. |
| F3 | CHECKED_IN | CONFIRMED | Admin confirms OR auto-confirm (review window timeout) | Record has valid status + checkInTime. | When ALL attendance records for this lesson reach CONFIRMED: emit `attendance.confirmed`. |
| F4 | CONFIRMED | LOCKED | Lesson: FINISHED → ARCHIVED | Lesson archived. ALL attendance records for this lesson must be CONFIRMED or LOCKED. | Record is final. Immutable. Finance Domain can process deduction. |

### 2.3 Reverse Transition Rules

| # | From | To | Trigger | Guard | Side Effect |
|---|------|----|---------|-------|-------------|
| R1 | CONFIRMED | CHECKED_IN | Admin override | `reason` required for reversal. Logged in audit. | Attendance re-opens for correction. Status can be changed. |
| R2 | CHECKED_IN | PENDING | Admin override | `reason` required for reversal. Logged in audit. | Attendance reset to unrecorded. Status cleared to null. |

**Rule:** Reverse transitions require admin authority and a logged reason (Constitution Rule 22). Reverse transitions MUST NOT bypass the forward path — e.g., CONFIRMED → PENDING is NOT allowed (must go through CHECKED_IN first).

### 2.4 Forbidden Transitions

| From | To | Why Forbidden |
|------|----|---------------|
| PENDING → CONFIRMED | Cannot skip CHECKED_IN. Teacher must record attendance first. |
| PENDING → LOCKED | Cannot skip CHECKED_IN and CONFIRMED. |
| CHECKED_IN → LOCKED | Cannot skip CONFIRMED. Admin must review first. |
| CONFIRMED → PENDING | Cannot skip CHECKED_IN. Must go through CHECKED_IN first. |
| LOCKED → anything | LOCKED is terminal. No transitions out. |

---

## 3. Status Values (Data Dimension)

### 3.1 Status Enum

```typescript
enum AttendanceStatus {
  PRESENT = 'PRESENT',    // Student attended
  ABSENT  = 'ABSENT',     // Student did not attend
  LATE    = 'LATE',       // Student arrived late
  LEAVE   = 'LEAVE',      // Student on approved leave
  MAKEUP  = 'MAKEUP',     // Student attending makeup lesson
  ONLINE  = 'ONLINE',     // Student attended online
  OFFLINE = 'OFFLINE',    // Student attended in person
}
```

### 3.2 Status and Workflow State Interaction

| workflowState | status value | Meaning |
|--------------|-------------|---------|
| PENDING | `null` | Attendance not yet recorded |
| CHECKED_IN | Any of 7 | Teacher has recorded attendance |
| CONFIRMED | Same as CHECKED_IN | Attendance confirmed, status unchanged |
| LOCKED | Same as CONFIRMED | Attendance final, status immutable |

### 3.3 Status Transitions (Within CHECKED_IN)

While in CHECKED_IN state, the teacher or admin can change the status:

```
┌─────────────────────────────────────────────────┐
│  Status Changes Allowed in CHECKED_IN State      │
│                                                  │
│  Any status ←→ Any status                        │
│                                                  │
│  Examples:                                       │
│    PRESENT → LATE     (correction: was late)     │
│    ABSENT → PRESENT   (correction: actually came) │
│    LATE → PRESENT     (correction: not actually late)│
│    PRESENT → LEAVE    (correction: was on leave)  │
│                                                  │
│  RULE: All changes are logged in audit.          │
│  RULE: Once CONFIRMED, status cannot change.     │
└─────────────────────────────────────────────────┘
```

---

## 4. LessonChangeRequest Lifecycle

### 4.1 ASCII Diagram

```
         ┌──────────┐
         │ PENDING  │  ← Request submitted by Teacher or Admin
         └────┬─────┘
              │
       ┌──────┴──────┐
       │              │
       ▼              ▼
┌──────────┐   ┌──────────┐
│ APPROVED │   │ REJECTED │  ← Terminal
└────┬─────┘   └──────────┘
     │
     │ System applies change to Lesson
     │ (only if Lesson is in mutable state)
     ▼
┌──────────┐
│ EXECUTED │  ← Terminal
└──────────┘
```

### 4.2 Transition Rules

| # | From | To | Trigger | Guard | Side Effect |
|---|------|----|---------|-------|-------------|
| L1 | — | PENDING | Teacher/Admin submits request | `reason` required, non-empty. Request type fields populated correctly. | Record created. |
| L2 | PENDING | APPROVED | Admin approves | Request is valid. Admin has authority. | Set `approvedBy`, `approvedAt`. |
| L3 | PENDING | REJECTED | Admin rejects | `rejectionReason` required, non-empty. | Set `rejectionReason`. |
| L4 | APPROVED | EXECUTED | System executes change | Lesson is in mutable state (SCHEDULED or TEACHING). Change is valid. | Apply change to Lesson entity. Set `executedAt`, `executedBy`. Emit type-specific side effects. |
| L5 | APPROVED | REJECTED | Admin reverses approval | `rejectionReason` required. Before execution. | Set `rejectionReason`. |

### 4.3 Terminal States

| State | Why Terminal |
|-------|-------------|
| REJECTED | Request denied. Cannot be retried. New request must be created. |
| EXECUTED | Change applied to Lesson. Cannot be undone via this request. |

### 4.4 Execution Side Effects by Request Type

| Request Type | Execution Action | Lesson Change |
|-------------|-----------------|---------------|
| RESCHEDULE | Update Lesson dates | `scheduledDate`, `startTime`, `endTime`, `changeRequestId` |
| TEACHER_CHANGE | Update Lesson teacher | `teacherId` |
| CANCEL | Cancel Lesson | `status` → CANCELLED, set `cancelledReason`, `changeRequestId` |
| REOPEN (from FINISHED) | Reopen Lesson | `status` → SCHEDULED. Safe — no money moved. |
| REOPEN (from ARCHIVED) | Reopen Lesson | `status` → FINISHED. May need financial rollback. |

---

## 5. Integration with Lesson State Machine

### 5.1 Attendance Records Created on Lesson TEACHING

```
Lesson: SCHEDULED → TEACHING
  │
  └──► Auto-create LessonAttendance records
        (workflowState = PENDING, status = null)
        For each ACTIVE Enrollment in the class
```

### 5.2 Attendance Confirmation Required Before Archival

```
Lesson: FINISHED → ARCHIVED
  │
  └──► Guard: ALL LessonAttendance WHERE lessonId = X
        AND workflowState NOT IN (CONFIRMED, LOCKED)
        MUST return 0 rows
  │
  └──► If guard fails: REJECT with error
        "All attendance must be confirmed before archiving lesson"
```

### 5.3 Event Emission Chain

```
Lesson: TEACHING → FINISHED
  └──► Emits: lesson.completed (NO money)

Attendance: ALL CHECKED_IN → ALL CONFIRMED
  └──► Emits: attendance.confirmed (guard for lesson.finished)

Lesson: FINISHED → ARCHIVED (with attendance guard passed)
  └──► Emits: lesson.finished (MONEY MOVES)
```

### 5.4 Lesson Reopen Impact on Attendance

```
Lesson: FINISHED → SCHEDULED (admin reopen, safe)
  └──► Attendance records: LOCKED → CONFIRMED (reverse transition, admin override)
  └──► Teacher can re-record attendance

Lesson: ARCHIVED → FINISHED (admin reopen, financial impact)
  └──► Attendance records: LOCKED → CONFIRMED (reverse transition, admin override)
  └──► May need Finance Domain to reverse deductions
  └──► Teacher can re-record attendance
```

---

## 6. Complete State Reference

### 6.1 LessonAttendance Quick Reference

| State | Can Edit Status? | Can Change Workflow? | Finance Can Process? |
|-------|-----------------|---------------------|---------------------|
| PENDING | N/A (null) | → CHECKED_IN (teacher) | No |
| CHECKED_IN | ✅ Yes | → CONFIRMED (admin) or → PENDING (admin override) | No |
| CONFIRMED | ❌ No | → LOCKED (lesson archived) or → CHECKED_IN (admin override) | Not yet |
| LOCKED | ❌ No | ❌ Terminal | ✅ Yes |

### 6.2 LessonChangeRequest Quick Reference

| State | Can Modify? | Can Cancel? | Next States |
|-------|-----------|------------|-------------|
| PENDING | ✅ Yes (requester) | ✅ Yes (requester cancels → REJECTED) | APPROVED, REJECTED |
| APPROVED | ❌ No | ❌ No | EXECUTED, REJECTED (admin) |
| REJECTED | ❌ Terminal | N/A | — |
| EXECUTED | ❌ Terminal | N/A | — |

---

## 7. State Machine Validation Rules (Rule 22)

1. **No skipping states.** Every forward transition must go to the immediate next state.
2. **Reverse transitions require admin authority** and a logged reason.
3. **Terminal states** (LOCKED, REJECTED, EXECUTED) cannot transition.
4. **Every transition is audited** — who, when, from, to, why (for reverse transitions).
5. **Guard conditions are enforced server-side.** No client-side-only validation.

---

*This state machine is part of the Attendance Domain architecture for Sprint 4.1.5. It must be read before implementing any Attendance or LessonChangeRequest code. See also: [AttendanceDomainModel.md](../DomainModel/AttendanceDomainModel.md), [AttendanceRules.md](../BusinessRules/AttendanceRules.md), [LessonChangeRequestRules.md](../BusinessRules/LessonChangeRequestRules.md).*
