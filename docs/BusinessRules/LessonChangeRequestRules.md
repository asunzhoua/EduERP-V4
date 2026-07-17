# LessonChangeRequest — Business Rules

> **Domain**: Teaching > LessonChangeRequest
> **Sprint**: 4.1.5
> **Version**: v1.0.0
> **Last Updated**: 2026-07-14
> **Author**: Chief Architect
> **Authority**: [TeachingConstitution_v1.1.md](../architecture/TeachingConstitution_v1.1.md), [AttendanceDomainModel.md](../DomainModel/AttendanceDomainModel.md)

---

## 1. Core Entity: LessonChangeRequest

### 1.1 Description

A LessonChangeRequest is NOT a lesson edit. It is a **formal application** — a governance mechanism that ensures every change to a Lesson has a reason, an approval, an execution record, and an audit trail.

```
LessonChangeRequest lifecycle:

  Teacher/Admin → "I need to change this lesson"
                    │
                    ▼
              ┌──────────┐
              │ Request  │  ← Formal application with reason
              └────┬─────┘
                   │
              ┌────┴────┐
              │         │
              ▼         ▼
         ┌────────┐ ┌────────┐
         │Approve │ │Reject  │  ← Admin governance
         └───┬────┘ └────────┘
             │
             ▼
        ┌──────────┐
        │ Execute  │  ← System applies change
        └──────────┘
```

**Key principle:** Directly editing Lesson fields (without a ChangeRequest) is **forbidden** for any field change that affects students, teachers, or financial records.

### 1.2 What Requires a ChangeRequest

| Change Type | Requires ChangeRequest? | Reason |
|-------------|------------------------|--------|
| Date change (different day) | **Yes** | Affects student/teacher schedule |
| Time change (same day, minor) | No | Administrative adjustment |
| Teacher substitution | **Yes** | Affects who teaches |
| Lesson cancellation | **Yes** | Major operational change |
| Lesson reopen | **Yes** | May have financial implications |
| Note update | No | Informational only |
| Room change | No (v1.0) | Administrative adjustment |

---

## 2. Request Types

```typescript
enum ChangeRequestType {
  RESCHEDULE    = 'RESCHEDULE',     // Change date/time
  TEACHER_CHANGE = 'TEACHER_CHANGE', // Change teacher
  CANCEL        = 'CANCEL',         // Cancel lesson
  REOPEN        = 'REOPEN',         // Reopen cancelled/finished lesson
}
```

### 2.1 RESCHEDULE (调课)

**Purpose:** Change the date and/or time of a lesson.

**Before/After Fields:**
- `previousDate` → `newDate`
- `previousStartTime` → `newStartTime`
- `previousEndTime` → `newEndTime`

**Constraints:**

| Constraint | Value |
|------------|-------|
| Max requests per lesson | 3 |
| Date range | New date within ±7 days of original |
| Allowed Lesson states | SCHEDULED, TEACHING |
| Who requests | Teacher, Admin |
| Who approves | Admin |
| Approval type | Manual (admin reviews and approves) |

**Guard: RESCHEDULE Count**
```
COUNT(LessonChangeRequest WHERE lessonId = X AND requestType = 'RESCHEDULE' AND status IN ('APPROVED', 'EXECUTED')) < 3
```

**Guard: Date Range**
```
ABS(DATEDIFF(newDate, previousDate)) ≤ 7
```

### 2.2 TEACHER_CHANGE (换师)

**Purpose:** Substitute the teacher for a single lesson.

**Before/After Fields:**
- `previousTeacherId` → `newTeacherId`

**Constraints:**

| Constraint | Value |
|------------|-------|
| Scope | One lesson only. Does NOT modify TeacherAssignment. |
| Allowed Lesson states | SCHEDULED, TEACHING |
| Who requests | Admin |
| Who approves | Auto (admin = self-approve) |
| New teacher | Must exist, must have Teacher role |

**Note:** TEACHER_CHANGE is a per-lesson substitution. It does NOT change the Class-level teacher assignment (TeacherAssignment entity). The original teacher remains PRIMARY for the Class.

### 2.3 CANCEL (停课)

**Purpose:** Cancel a scheduled or teaching lesson.

**Constraints:**

| Constraint | Value |
|------------|-------|
| `cancelledReason` | Required, non-empty |
| Allowed Lesson states | SCHEDULED, TEACHING |
| Who requests | Teacher, Admin |
| Who approves | Admin |
| Attendance impact | Existing attendance records preserved (not deleted) |
| Enrollment impact | Students remain enrolled. No automatic withdrawal. |

**Execution:**
```
Lesson.status → CANCELLED
Lesson.cancelledReason = request.reason
Lesson.changeRequestId = request.id
```

### 2.4 REOPEN (复课)

**Purpose:** Reopen a lesson that was cancelled, finished, or archived.

**Before/After Fields:**
- None (the change is the status transition itself)

**Constraints:**

| Constraint | Value |
|------------|-------|
| From CANCELLED | → SCHEDULED. Safe — no financial impact. |
| From FINISHED | → SCHEDULED. Safe — no money moved yet. |
| From ARCHIVED | → FINISHED. **Risky** — may need Finance to reverse deductions. |
| Who requests | Admin only |
| Who approves | Auto (admin = self-approve) |
| Financial warning | ARCHIVED → FINISHED requires admin confirmation of financial rollback awareness |

**Execution:**
```
IF Lesson.status = CANCELLED:
  Lesson.status → SCHEDULED
ELIF Lesson.status = FINISHED:
  Lesson.status → SCHEDULED
ELIF Lesson.status = ARCHIVED:
  Lesson.status → FINISHED
  WARNING: "Financial rollback may be required. Finance Domain notified."
```

---

## 3. Request Lifecycle

### 3.1 Status Values

```typescript
enum ChangeRequestStatus {
  PENDING  = 'PENDING',   // Request submitted, awaiting approval
  APPROVED = 'APPROVED',  // Admin approved, awaiting execution
  REJECTED = 'REJECTED',  // Admin rejected (terminal)
  EXECUTED = 'EXECUTED',  // Change applied to Lesson (terminal)
}
```

### 3.2 Lifecycle Rules

| Rule | Description |
|------|-------------|
| **LC1: Submission** | Request created with status = PENDING. All required fields must be populated. |
| **LC2: Approval** | Only Admin can approve. Sets approvedBy + approvedAt. |
| **LC3: Rejection** | Only Admin can reject. `rejectionReason` required. Sets rejectionReason. |
| **LC4: Execution** | System executes approved requests. Sets executedAt + executedBy. |
| **LC5: Self-Approve** | TEACHER_CHANGE and REOPEN: Admin requester = auto-approve (skip PENDING → APPROVED step). |
| **LC6: No Modify** | PENDING requests can be cancelled by the requester. APPROVED requests cannot be modified. |
| **LC7: Terminal** | REJECTED and EXECUTED are terminal. No further transitions. |

### 3.3 Execution Guard

Before executing an approved request, the system checks:

```
GUARD: Lesson.status must be mutable
  RESCHEDULE:    Lesson.status ∈ {SCHEDULED, TEACHING}
  TEACHER_CHANGE: Lesson.status ∈ {SCHEDULED, TEACHING}
  CANCEL:        Lesson.status ∈ {SCHEDULED, TEACHING}
  REOPEN:        Lesson.status ∈ {CANCELLED, FINISHED, ARCHIVED}

IF guard fails:
  Request status → REJECTED (auto-reject)
  rejectionReason = "Lesson is no longer in a mutable state"
```

---

## 4. Approval Rules

### 4.1 Who Can Approve

| Request Type | Approver | Approval Method |
|-------------|----------|----------------|
| RESCHEDULE | Admin | Manual review and approve |
| TEACHER_CHANGE | Admin (self) | Auto-approve on submission |
| CANCEL | Admin | Manual review and approve |
| REOPEN | Admin (self) | Auto-approve on submission |

### 4.2 Approval Constraints

| Constraint | Description |
|-----------|-------------|
| **Single Approval** | Each request can only be approved once. |
| **No Partial Approval** | The entire request is approved or rejected as a whole. |
| **Approval Window** | If a PENDING request is not acted upon within 7 days, it auto-expires (REJECTED with reason "Expired"). |

---

## 5. Cross-Domain Interaction Rules

| Rule | Description |
|------|-------------|
| **XC1: Teaching Owns Requests** | No other Domain may create, approve, or execute LessonChangeRequests (Rule 17). |
| **XC2: Finance Notification** | When REOPEN from ARCHIVED executes, Finance Domain should be notified (may need deduction reversal). |
| **XC3: Student Boundary** | LessonChangeRequest does NOT modify Student data. Student is not notified by Teaching Domain (Notification Domain handles that). |
| **XC4: Teacher Boundary** | TEACHER_CHANGE modifies Lesson.teacherId only. Does NOT modify TeacherAssignment or Identity Domain records. |

---

## 6. Audit Requirements

### 6.1 ChangeRequest Audit Events

| Event | Always Audited? | Includes |
|-------|----------------|----------|
| Request submitted | ✅ | Requester, type, reason, lesson snapshot |
| Request approved | ✅ | Approver, timestamp |
| Request rejected | ✅ | Rejector, reason, timestamp |
| Request executed | ✅ | Executor, before/after state, timestamp |

### 6.2 Lesson Audit Trail

When a ChangeRequest executes, the Lesson entity logs:

| Field | Description |
|-------|-------------|
| `changeRequestId` | FK → LessonChangeRequest.id |
| Previous values | Snapshot of changed fields before execution |
| New values | Snapshot of changed fields after execution |
| Executed by | userId or 0 (system) |
| Executed at | Timestamp |

---

## 7. Domain Invariants

### Invariant-CR001: Every Lesson Change Goes Through ChangeRequest

```
IF Lesson.{scheduledDate, startTime, endTime, teacherId, status} is modified
AND the change affects students or financial records
THEN a LessonChangeRequest MUST exist with status = EXECUTED
AND Lesson.changeRequestId MUST reference that request
```

**Owner**: Teaching Domain.
**Rationale**: Without a ChangeRequest, there is no audit trail for who authorized the change and why. This violates the principle of governance.
**Enforcement**: Service layer rejects direct field modifications on Lesson for guarded fields. Only the ChangeRequest execution path can modify these fields.

### Invariant-CR002: One Active Request Per Lesson Per Type

```
COUNT(LessonChangeRequest WHERE lessonId = X AND requestType = Y AND status = 'PENDING') ≤ 1
```

**Owner**: Teaching Domain.
**Rationale**: Two pending reschedule requests for the same lesson would create ambiguity about which one to approve.
**Enforcement**: Service-level check before creating new request.

### Invariant-CR003: Executed Request References Lesson

```
IF LessonChangeRequest.status = 'EXECUTED'
THEN LessonChangeRequest.lessonId MUST reference a valid Lesson
AND Lesson.changeRequestId = LessonChangeRequest.id
```

**Owner**: Teaching Domain.
**Rationale**: An executed request without a back-reference to the Lesson breaks the audit trail.
**Enforcement**: Execution step sets `Lesson.changeRequestId` in the same transaction.

---

## 8. State Machine Summary

```
                    ┌──────────┐
                    │ PENDING  │
                    └────┬─────┘
                         │
                  ┌──────┴──────┐
                  │             │
                  ▼             ▼
           ┌──────────┐  ┌──────────┐
           │ APPROVED │  │ REJECTED │ ← Terminal
           └────┬─────┘  └──────────┘
                │
                │ Execute
                ▼
           ┌──────────┐
           │ EXECUTED │ ← Terminal
           └──────────┘
```

**Quick reference:**

| Transition | Reversible? | Guard |
|------------|-------------|-------|
| → PENDING | N/A (creation) | Reason required, type-specific fields |
| PENDING → APPROVED | Via reject (admin) | Admin authority |
| PENDING → REJECTED | No (terminal) | RejectionReason required |
| APPROVED → EXECUTED | No (terminal) | Lesson in mutable state |
| APPROVED → REJECTED | No (terminal) | RejectionReason required, before execution |
| REJECTED → anything | **Not allowed** | Terminal state |
| EXECUTED → anything | **Not allowed** | Terminal state |

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any LessonChangeRequest code. See also: [AttendanceDomainModel.md](../DomainModel/AttendanceDomainModel.md), [AttendanceStateMachine.md](../StateMachine/AttendanceStateMachine.md), [AttendanceRules.md](./AttendanceRules.md), [LessonRules.md](./LessonRules.md).*
