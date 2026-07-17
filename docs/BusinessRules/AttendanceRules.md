# Attendance — Business Rules

> **Domain**: Teaching > Attendance
> **Sprint**: 4.1.5
> **Version**: v1.0.0
> **Last Updated**: 2026-07-14
> **Author**: Chief Architect
> **Authority**: [TeachingConstitution_v1.1.md](../architecture/TeachingConstitution_v1.1.md), [AttendanceDomainModel.md](../DomainModel/AttendanceDomainModel.md)

---

## 1. Core Entity: LessonAttendance

### 1.1 Description

LessonAttendance is the **foundational data source** for the entire financial and operational chain. It records what happened to each student during each lesson.

```
LessonAttendance answers:
  "For student X in lesson Y, what happened?"
  → PRESENT (charged to contract)
  → LATE (charged to contract)
  → ONLINE (charged to contract)
  → OFFLINE (charged to contract)
  → ABSENT (not charged)
  → LEAVE (not charged)
  → MAKEUP (charged on original lesson)
```

### 1.2 Why Attendance Matters

Every downstream system depends on attendance data:

```
Attendance Status
  │
  ├──► Finance: "Was the student present? → Deduct from Contract"
  ├──► Finance: "Which teacher taught? → Calculate salary"
  ├──► Points: "Award points for attendance"
  ├──► Notification: "Alert parent of absence"
  └──► Statistics: "Calculate attendance rate"
```

**If attendance data is wrong, every downstream calculation is wrong.**

### 1.3 Two-Dimensional Design

Attendance uses two independent dimensions:

1. **Workflow State** (PENDING → CHECKED_IN → CONFIRMED → LOCKED): Tracks the lifecycle process.
2. **Status** (PRESENT, ABSENT, LATE, LEAVE, MAKEUP, ONLINE, OFFLINE): Records what happened.

These must never be confused. See [AttendanceStateMachine.md](../StateMachine/AttendanceStateMachine.md).

---

## 2. Attendance Workflow Lifecycle Rules

### 2.1 Auto-Creation Rules

| Rule | Description |
|------|-------------|
| **AC1: Trigger** | Attendance records are auto-created when Lesson transitions SCHEDULED → TEACHING. |
| **AC2: Scope** | One record per ACTIVE Enrollment where classCode = Lesson.classCode. |
| **AC3: Initial State** | workflowState = PENDING, status = null. |
| **AC4: System Origin** | createdBy = 0 (system), operator = 0 (system), source = API. |
| **AC5: Transaction** | All records created in ONE database transaction. If any fail, all rollback. |
| **AC6: Empty Class** | If no ACTIVE Enrollments exist, no records are created. Lesson can still proceed. |

### 2.2 Roll Call Rules (PENDING → CHECKED_IN)

| Rule | Description |
|------|-------------|
| **RC1: Who** | Teacher of the lesson (matching Lesson.teacherId) or Admin. |
| **RC2: When** | During TEACHING state or during FINISHED review window (for corrections). |
| **RC3: Status Required** | `status` must be set to one of 7 values. Cannot remain null. |
| **RC4: Reason Guard** | If status ∈ {LATE, LEAVE, ABSENT}, `reason` is required and must be non-empty. |
| **RC5: checkInTime** | Automatically set to current timestamp when workflowState → CHECKED_IN. |
| **RC6: Operator** | `operator` set to userId of the person recording attendance. |
| **RC7: Batch Roll Call** | Teacher can record attendance for all students in one operation. Individual updates also allowed. |
| **RC8: Partial Roll Call** | Teacher may record attendance for some students first, others later. PENDING records remain until recorded. |

### 2.3 Confirmation Rules (CHECKED_IN → CONFIRMED)

| Rule | Description |
|------|-------------|
| **CF1: Who** | Admin or system (auto-confirm). |
| **CF2: Auto-Confirm** | After review window timeout (default 24h from Lesson FINISHED), all CHECKED_IN records auto-confirm. |
| **CF3: Admin Confirm** | Admin can confirm individual records or all records for a lesson at once. |
| **CF4: event Emission** | When ALL attendance records for a lesson reach CONFIRMED or LOCKED, emit `attendance.confirmed`. |
| **CF5: Partial Confirm** | Admin may confirm some records first. `attendance.confirmed` only emits when ALL are confirmed. |

### 2.4 Lock Rules (CONFIRMED → LOCKED)

| Rule | Description |
|------|-------------|
| **LK1: Trigger** | Automatic when Lesson transitions FINISHED → ARCHIVED. |
| **LK2: Guard** | ALL attendance records for the lesson must be CONFIRMED or LOCKED before Lesson can archive. |
| **LK3: Immutability** | LOCKED records cannot be modified under any circumstance. |
| **LK4: Finance Trigger** | LOCKED attendance is the signal that Finance Domain can process deductions. |

### 2.5 Reverse Transition Rules

| Rule | Description |
|------|-------------|
| **RV1: Authority** | Only Admin can perform reverse transitions. |
| **RV2: Reason Required** | A reason must be provided and logged for every reverse transition. |
| **RV3: Path** | CONFIRMED → CHECKED_IN → PENDING. Cannot skip states. |
| **RV4: Audit** | All reverse transitions logged with: who, when, from, to, why. |

---

## 3. Attendance Status Rules

### 3.1 Status Values

```typescript
enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT  = 'ABSENT',
  LATE    = 'LATE',
  LEAVE   = 'LEAVE',
  MAKEUP  = 'MAKEUP',
  ONLINE  = 'ONLINE',
  OFFLINE = 'OFFLINE',
}
```

### 3.2 Financial Implication Rules

| Status | Deduct from Contract? | Rule Reference |
|--------|----------------------|----------------|
| PRESENT | ✅ Yes | Constitution Rule 16 (via lesson.finished) |
| LATE | ✅ Yes | Constitution Rule 16 (via lesson.finished) |
| ONLINE | ✅ Yes | Constitution Rule 16 (via lesson.finished) |
| OFFLINE | ✅ Yes | Constitution Rule 16 (via lesson.finished) |
| ABSENT | ❌ No | Student did not attend. No charge. |
| LEAVE | ❌ No | Approved absence. No charge. |
| MAKEUP | ❌ No | Charged on original lesson, not the makeup. |

**Deduction Rule (Finance Domain):**
```
FOR EACH LessonAttendance WHERE lessonId = X
  AND status IN ('PRESENT', 'LATE', 'ONLINE', 'OFFLINE'):
    Contract.remainingLessons -= 1
    IF remainingLessons = 0 → Contract → EXHAUSTED
```

**Teaching Domain MUST NOT perform deduction.** This is Finance Domain's responsibility (Constitution Rule 16, Rule 17).

### 3.3 Reason Requirement Rules

| Status | Reason Required? | Validation |
|--------|-----------------|------------|
| PRESENT | No | — |
| LATE | **Yes** | Non-empty, trimmed. Why was the student late? |
| ONLINE | No | — |
| OFFLINE | No | — |
| ABSENT | **Yes** | Non-empty, trimmed. Absence note. |
| LEAVE | **Yes** | Non-empty, trimmed. Leave approval reference. |
| MAKEUP | No | Implied by makeup lesson link (originLessonId). |

### 3.4 Status Immutability by Workflow State

| workflowState | Status Change Allowed? |
|--------------|----------------------|
| PENDING | N/A (status is null) |
| CHECKED_IN | ✅ Yes — teacher can change during roll call |
| CONFIRMED | ❌ No — must revert to CHECKED_IN first (admin override) |
| LOCKED | ❌ No — final, immutable |

---

## 4. Cross-Domain Interaction Rules

| Rule | Description |
|------|-------------|
| **XD1: Teaching Owns Attendance** | No other Domain may create, modify, or delete LessonAttendance records (Rule 17). |
| **XD2: Finance Reads Attendance** | Finance Domain reads attendance status to determine deduction. Read-only access. |
| **XD3: Points Reads Attendance** | Points Domain (future) reads attendance status to determine point awards. Read-only access. |
| **XD4: Dashboard Reads Attendance** | Dashboard Domain reads attendance for statistics. Read-only access. |
| **XD5: No Direct Financial Operations** | Attendance Domain NEVER decrements Contract.remainingLessons. NEVER calculates teacher salary. |
| **XD6: Student Boundary** | Attendance Domain does NOT modify Student status. Student being INACTIVE does not auto-cancel attendance. |

---

## 5. LessonChangeRequest Rules

### 5.1 Request Submission Rules

| Rule | Description |
|------|-------------|
| **RS1: Reason Required** | Every request must have a non-empty `reason`. |
| **RS2: Type-Specific Fields** | RESCHEDULE must populate date/time fields. TEACHER_CHANGE must populate teacher IDs. |
| **RS3: Lesson State** | Request only allowed for SCHEDULED or TEACHING lessons. |
| **RS4: Duplicate Check** | No duplicate PENDING request for the same lesson + type. |

### 5.2 RESCHEDULE Rules

| Rule | Description |
|------|-------------|
| **RS-R1: Max Reschedules** | Maximum 3 reschedule requests per lesson. |
| **RS-R2: Date Range** | New date must be within ±7 days of original date. |
| **RS-R3: Time-Only Changes** | Same-day time-only changes: allowed without ChangeRequest (minor adjustment). |
| **RS-R4: Date Changes** | Any date change MUST go through ChangeRequest with approval. |

### 5.3 TEACHER_CHANGE Rules

| Rule | Description |
|------|-------------|
| **RS-T1: Scope** | One lesson only. Does NOT change Class teacher assignment (TeacherAssignment). |
| **RS-T2: Self-Approve** | Admin action = auto-approve (no separate approval step). |
| **RS-T3: New Teacher** | New teacher must exist and have Teacher role. |

### 5.4 CANCEL Rules

| Rule | Description |
|------|-------------|
| **RS-C1: Reason** | `cancelledReason` required, non-empty. |
| **RS-C2: Attendance** | Existing attendance records are preserved (not deleted). |
| **RS-C3: Students** | No automatic withdrawal of enrolled students. |

### 5.5 REOPEN Rules

| Rule | Description |
|------|-------------|
| **RS-O1: Admin Only** | Only Admin can request reopen. |
| **RS-O2: Safe Reopen** | FINISHED → SCHEDULED: No financial impact. Safe to execute. |
| **RS-O3: Risky Reopen** | ARCHIVED → FINISHED: May require Finance Domain to reverse deductions. Admin must confirm awareness. |
| **RS-O4: Attendance** | Existing attendance records are preserved. Teacher can re-record if needed (LOCKED → CONFIRMED reverse). |

---

## 6. Audit Requirements

### 6.1 Attendance Audit Log

Every attendance state change is logged:

| Field | Description |
|-------|-------------|
| `id` | PK |
| `attendanceId` | FK → LessonAttendance.id |
| `lessonId` | FK → Lesson.id |
| `studentCode` | FK → Student.studentCode |
| `action` | CREATE / STATUS_CHANGE / CONFIRM / LOCK / REVERSE |
| `oldWorkflowState` | Previous workflow state |
| `newWorkflowState` | New workflow state |
| `oldStatus` | Previous attendance status |
| `newStatus` | New attendance status |
| `operator` | userId who performed the action |
| `reason` | Reason (required for REVERSE) |
| `operateTime` | Timestamp |

### 6.2 ChangeRequest Audit Log

| Field | Description |
|-------|-------------|
| `id` | PK |
| `requestId` | FK → LessonChangeRequest.id |
| `lessonId` | FK → Lesson.id |
| `action` | SUBMIT / APPROVE / REJECT / EXECUTE |
| `requestType` | RESCHEDULE / TEACHER_CHANGE / CANCEL / REOPEN |
| `operator` | userId |
| `reason` | Reason |
| `operateTime` | Timestamp |

---

## 7. API Endpoints (Design)

### 7.1 Attendance Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/lessons/:id/attendance | JWT+Role | Batch roll call (set status for all students) |
| PATCH | /api/v1/lessons/:id/attendance/:studentCode | JWT+Role | Update single student attendance |
| GET | /api/v1/lessons/:id/attendance | JWT+Role | List attendance for a lesson |
| POST | /api/v1/lessons/:id/attendance/confirm | JWT+Admin | Confirm all attendance for a lesson |
| GET | /api/v1/students/:studentCode/attendance | JWT+Role | Student attendance history |

### 7.2 LessonChangeRequest Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/lessons/:id/change-requests | JWT+Role | Submit change request |
| PATCH | /api/v1/change-requests/:id/approve | JWT+Admin | Approve request |
| PATCH | /api/v1/change-requests/:id/reject | JWT+Admin | Reject request |
| GET | /api/v1/lessons/:id/change-requests | JWT+Role | List requests for a lesson |

---

## 8. Permission Mapping

| Permission Code | Operations |
|---|---|
| `lesson:update` | Record attendance, update attendance |
| `lesson:read` | View attendance for a lesson |
| `lesson:confirm` | Confirm attendance (admin only) |
| `change-request:create` | Submit change request |
| `change-request:approve` | Approve/reject change request (admin only) |
| `student:read` | View student attendance history |

---

## 9. Domain Invariants

Domain Invariants are **unconditional business rules** that must hold at all times. Violation is a system-level bug.

### Invariant-A001: One Attendance Record Per Student Per Lesson

```
COUNT(LessonAttendance WHERE lessonId = X AND studentCode = Y) ≤ 1
```

**Owner**: Teaching Domain.
**Rationale**: A student can only have one attendance outcome per lesson. Two records would cause double-counting in deduction and statistics.
**Enforcement**: Database UNIQUE constraint on `(lessonId, studentCode)` + service-level check.

### Invariant-A002: Status Must Be Set Before Confirmation

```
IF LessonAttendance.workflowState IN (CHECKED_IN, CONFIRMED, LOCKED)
THEN LessonAttendance.status IS NOT NULL
```

**Owner**: Teaching Domain.
**Rationale**: An attendance record without a status is meaningless. Confirmation of an unset status would propagate null data to Finance and Statistics.
**Enforcement**: CHECKED_IN transition guard requires status to be set. CONFIRMED transition guard requires status to be non-null.

### Invariant-A003: LOCKED Records Are Immutable

```
IF LessonAttendance.workflowState = LOCKED
THEN status, checkInTime, reason, operator CANNOT be modified
```

**Owner**: Teaching Domain.
**Rationale**: LOCKED records are the basis for financial deduction. Modifying a LOCKED record after deduction would create data inconsistency.
**Enforcement**: Service layer rejects any modification attempt on LOCKED records. No UPDATE endpoint for LOCKED records.

### Invariant-A004: Attendance Never Triggers Deduction Directly

```
LessonAttendance.status change
  → NEVER directly calls Contract.remainingLessons -= 1
```

**Owner**: Teaching Domain (negative constraint) + Finance Domain (positive enforcement).
**Rationale**: Constitution Rule 16 — only `lesson.finished` event triggers money moves. If attendance directly triggered deduction, there would be no review window and no confirmation step.
**Enforcement**: Teaching Domain code never imports Finance Domain services. Finance Domain only reacts to `lesson.finished` event.

### Invariant-A005: All Students Must Have Attendance Before Lesson Archives

```
IF Lesson.status = ARCHIVED
THEN COUNT(LessonAttendance WHERE lessonId = Lesson.id AND workflowState = PENDING) = 0
```

**Owner**: Teaching Domain.
**Rationale**: Archiving a lesson with unrecorded attendance means Finance cannot determine who to charge. This creates orphan lessons with no financial trace.
**Enforcement**: LessonService.archive() checks that no PENDING attendance records exist before allowing FINISHED → ARCHIVED transition.

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Attendance code. See also: [AttendanceDomainModel.md](../DomainModel/AttendanceDomainModel.md), [AttendanceStateMachine.md](../StateMachine/AttendanceStateMachine.md), [LessonChangeRequestRules.md](./LessonChangeRequestRules.md), [TeachingRules.md](./TeachingRules.md).*
