# Attendance Domain Model

> **Version**: v1.0.0
> **Status**: Sprint 4.1.5 — Architecture Phase
> **Last Updated**: 2026-07-14
> **Authority**: [TeachingConstitution_v1.1.md](../architecture/TeachingConstitution_v1.1.md), [Sprint 4.1.5 Mission Brief](../Review/)
> **Scope**: Attendance Domain (LessonAttendance + LessonChangeRequest)

---

## 1. Domain Overview

### 1.1 What Is the Attendance Domain?

The Attendance Domain answers one fundamental question:

> **For a given student in a given lesson, what happened?**

It is NOT a simple "present or absent" check. Attendance is the **foundational data source** for:

| Downstream System | Depends On Attendance For |
|-------------------|---------------------------|
| Finance Domain | Contract deduction (which students to charge) |
| Finance Domain | Teacher salary calculation (which lessons were taught) |
| Points Domain | Attendance-based point awards |
| Statistics | Attendance rate, student engagement metrics |
| Notification | Parent absence alerts, lesson confirmation |
| Report | Student attendance history, class attendance reports |

**If Attendance is designed incorrectly, every downstream system inherits the error.**

### 1.2 Domain Boundary

```
┌──────────────────────────────────────────────────────────────┐
│                   ATTENDANCE DOMAIN                            │
│                                                                │
│  LessonAttendance                                              │
│    ├── Workflow State: PENDING → CHECKED_IN → CONFIRMED → LOCKED │
│    └── Status: PRESENT | ABSENT | LATE | LEAVE | MAKEUP | ONLINE | OFFLINE │
│                                                                │
│  LessonChangeRequest                                           │
│    ├── Request: RESCHEDULE | TEACHER_CHANGE | CANCEL | REOPEN  │
│    └── Lifecycle: PENDING → APPROVED → EXECUTED | REJECTED     │
│                                                                │
│  Events OUT: attendance.confirmed                              │
│  Events IN:  (none)                                            │
│                                                                │
│  Tables Owned: lesson_attendance, lesson_change_request        │
│                lesson_audit_log (shared with Lesson entity)    │
└──────────────────────────────────────────────────────────────┘

OUT OF SCOPE:
  Finance   → Contract deduction, teacher salary
  Points    → Attendance-based point awards
  Dashboard → Statistics and analytics
  Notification → Parent/teacher notifications
```

### 1.3 Constitution Alignment

| Rule | How Attendance Domain Complies |
|------|-------------------------------|
| Rule 16 (Financial Trigger) | Attendance NEVER triggers deduction directly. Only `lesson.finished` triggers Finance. |
| Rule 17 (Data Ownership) | Attendance owns `lesson_attendance` and `lesson_change_request` tables. |
| Rule 18 (Server-Side Calc) | Attendance rate, confirmation status — all computed server-side. |
| Rule 19 (Lesson = Timeline) | Attendance is per-Lesson. Each Lesson has attendance records for all enrolled students. |
| Rule 20 (Every Money → Lesson) | Attendance records reference `lessonId`. Finance traces deduction to lesson. |
| Rule 22 (Unidirectional States) | Both workflow state machine and request lifecycle are unidirectional. |

---

## 2. Two-Dimensional State Design

Attendance uses **two independent dimensions** that must never be confused:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Dimension 1: WORKFLOW STATE (lifecycle process)             │
│    Tracks WHERE the attendance record is in its process.     │
│    Values: PENDING → CHECKED_IN → CONFIRMED → LOCKED        │
│                                                              │
│  Dimension 2: STATUS (what happened)                         │
│    Records WHAT actually happened to the student.            │
│    Values: PRESENT | ABSENT | LATE | LEAVE | MAKEUP |       │
│            ONLINE | OFFLINE                                  │
│                                                              │
│  RULE: These two dimensions are orthogonal.                  │
│  Workflow State governs the process. Status governs the data.│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why two dimensions?**

Consider a student's attendance record for Lesson #5:

| Phase | workflowState | status | Meaning |
|-------|--------------|--------|---------|
| Lesson starts | PENDING | `null` | "We know this student should be here, but no one has recorded attendance yet." |
| Teacher records | CHECKED_IN | LATE | "Teacher recorded that this student arrived 10 minutes late." |
| Admin confirms | CONFIRMED | LATE | "Admin reviewed and confirmed the late arrival." |
| Lesson archived | LOCKED | LATE | "Final. Cannot be changed. Finance will deduct." |

The workflow state tells us **how far along the process** the record is. The status tells us **what happened** to the student. These are fundamentally different questions.

---

## 3. LessonAttendance Entity

### 3.1 Definition

One record per student per lesson. Created automatically when a Lesson transitions to TEACHING. Captures the complete story of a student's participation in a specific teaching session.

### 3.2 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | BigInt PK | ✅ | Auto-increment internal ID |
| `lessonId` | BigInt FK | ✅ | → Lesson.id. The lesson this attendance belongs to. |
| `studentCode` | String FK | ✅ | → Student.studentCode. The student being tracked. |
| `classCode` | String FK | ✅ | → Class.classCode. Denormalized from Lesson for query efficiency. |
| `teacherId` | Int FK | ✅ | → User.id. The PRIMARY teacher of the class at lesson time. Copied from Lesson. |
| `workflowState` | Enum | ✅ | PENDING \| CHECKED_IN \| CONFIRMED \| LOCKED. See Section 4. |
| `status` | Enum | ❌ | PRESENT \| ABSENT \| LATE \| LEAVE \| MAKEUP \| ONLINE \| OFFLINE. Nullable when workflowState = PENDING. See Section 5. |
| `checkInTime` | DateTime | ❌ | Timestamp when the student checked in or was recorded. Set when workflowState → CHECKED_IN. |
| `reason` | Text | ❌ | Reason for LATE, LEAVE, or ABSENT. Required when status = LATE, LEAVE, or ABSENT. |
| `operator` | Int | ✅ | userId of whoever recorded or last modified this attendance. System = 0. |
| `source` | Enum | ✅ | MANUAL \| SELF_CHECK_IN \| API \| IMPORT. How attendance was recorded. |
| `note` | Text | ❌ | Optional remark from teacher or admin. |
| `createdBy` | Int | ✅ | userId who created the record. |
| `createdAt` | DateTime | ✅ | Auto-set creation timestamp. |
| `updatedAt` | DateTime | ✅ | Auto-set last modification timestamp. |

### 3.3 Identity

```
Primary Key: id (bigint auto-increment)
Business Key: (lessonId, studentCode) — one record per student per lesson
Unique Constraint: UNIQUE KEY uk_attendance_lesson_student (lesson_id, student_code)
```

### 3.4 Unique Constraint Rationale

A student can only have one attendance record per lesson. This is a hard business invariant. If a student was late and then the teacher wants to change it to "present" (e.g., the student caught up), the existing record is UPDATED, not a new one created.

### 3.5 Auto-Creation Rule

Attendance records are **auto-created** when a Lesson transitions from SCHEDULED → TEACHING:

```
TRIGGER: Lesson.status = TEACHING
ACTION:
  1. Find all ACTIVE Enrollments WHERE classCode = Lesson.classCode
  2. FOR EACH enrollment:
     CREATE LessonAttendance:
       - lessonId = Lesson.id
       - studentCode = Enrollment.studentCode
       - classCode = Lesson.classCode
       - teacherId = Lesson.teacherId
       - workflowState = PENDING
       - status = null
       - operator = 0 (system)
       - source = API
       - createdBy = 0 (system)
  3. All records created in ONE database transaction
```

**Guard:** If no ACTIVE Enrollments exist for the class, no attendance records are created. The Lesson can still proceed (edge case: all students withdrawn).

---

## 4. Attendance Workflow State Machine

The workflow state tracks the **lifecycle process** of an attendance record.

```
         ┌─────────┐
         │ PENDING  │  ← Auto-created when Lesson → TEACHING
         └────┬─────┘
              │ teacher records attendance
              ▼
       ┌────────────┐
       │ CHECKED_IN │  ← Teacher set status + checkInTime
       └─────┬──────┘
             │ admin confirms OR auto-confirm timeout
             ▼
       ┌────────────┐
       │ CONFIRMED  │  ← Attendance data reviewed and approved
       └─────┬──────┘
             │ lesson archived
             ▼
       ┌──────────┐
       │  LOCKED  │  ← Final. Immutable. Finance can process.
       └──────────┘
```

### 4.1 Transition Rules

| From | To | Trigger | Guard | Side Effect |
|------|----|---------|-------|-------------|
| PENDING | CHECKED_IN | Teacher records attendance | `status` must be set (one of 7 values). `checkInTime` set. | Record now has attendance data. |
| CHECKED_IN | CONFIRMED | Admin confirms OR auto-confirm (timeout after review window) | All CHECKED_IN records for this lesson reviewed. | Emits `attendance.confirmed` when ALL records for this lesson reach CONFIRMED. |
| CONFIRMED | LOCKED | Lesson: FINISHED → ARCHIVED | Lesson archived. | Record is final. No further modifications allowed. |

### 4.2 Reverse Transitions

| From | To | Guard | Authority |
|------|----|-------|-----------|
| CONFIRMED | CHECKED_IN | Admin override + reason logged | Admin only. Re-opens attendance for correction. |
| CHECKED_IN | PENDING | Admin override + reason logged | Admin only. Resets attendance to unrecorded. |

**Rule:** Reverse transitions require admin authority and a logged reason (Constitution Rule 22).

---

## 5. Attendance Status Definitions

The status records **what actually happened** to the student during the lesson.

### 5.1 Status Values

| Status | Name (CN) | Meaning | Financial Impact |
|--------|-----------|---------|-----------------|
| `PRESENT` | 出勤 | Student attended the lesson | **Deduct** from Contract |
| `LATE` | 迟到 | Student arrived late but attended | **Deduct** from Contract |
| `ONLINE` | 线上出勤 | Student attended online/remote | **Deduct** from Contract |
| `OFFLINE` | 线下出勤 | Student attended in person | **Deduct** from Contract |
| `ABSENT` | 缺勤 | Student did not attend, no approval | **No deduction** |
| `LEAVE` | 请假 | Student on approved leave | **No deduction** |
| `MAKEUP` | 补课 | Student attending a makeup lesson | **No deduction** (charged on original lesson) |

### 5.2 Financial Implication Rules

```
Deduction Rule:
  IF status ∈ {PRESENT, LATE, ONLINE, OFFLINE}
  THEN Finance Domain deducts from Contract.remainingLessons

No-Deduction Rule:
  IF status ∈ {ABSENT, LEAVE, MAKEUP}
  THEN Finance Domain does NOT deduct
```

**Critical:** Attendance Domain NEVER performs deduction. It only records the status. Finance Domain reads the status and decides whether to deduct. This boundary is absolute (Constitution Rule 16).

### 5.3 Status Assignment Rules

| Status | Who Sets | When | Reason Required? |
|--------|----------|------|-----------------|
| PRESENT | Teacher | During CHECKED_IN | No |
| LATE | Teacher | During CHECKED_IN | Yes — why late |
| ONLINE | Teacher / System | During CHECKED_IN | No |
| OFFLINE | Teacher / System | During CHECKED_IN | No |
| ABSENT | Teacher / System | During CHECKED_IN | Yes — absence note |
| LEAVE | Admin | During CHECKED_IN | Yes — leave approval reference |
| MAKEUP | System | Auto-creation | No (implied by makeup lesson link) |

### 5.4 Status Immutability Rules

| Workflow State | Status Mutable? | Detail |
|----------------|----------------|--------|
| PENDING | N/A | Status is null |
| CHECKED_IN | ✅ Yes | Teacher can change status during roll call |
| CONFIRMED | ❌ No | Status is locked after confirmation. Admin override → reverts to CHECKED_IN first. |
| LOCKED | ❌ No | Status is final. No changes allowed under any circumstance. |

---

## 6. LessonChangeRequest Entity

### 6.1 Definition

Instead of directly editing Lesson fields, all changes go through a LessonChangeRequest. This ensures every change has a reason, an approval, an execution record, and an audit trail.

**Key principle:** A LessonChangeRequest is NOT a lesson edit. It is an APPLICATION — a formal request that flows through a governance process.

### 6.2 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | BigInt PK | ✅ | Auto-increment internal ID |
| `lessonId` | BigInt FK | ✅ | → Lesson.id. The lesson to be changed. |
| `requestType` | Enum | ✅ | RESCHEDULE \| TEACHER_CHANGE \| CANCEL \| REOPEN |
| `requestedBy` | Int | ✅ | userId of the requester (Teacher or Admin) |
| `reason` | Text | ✅ | WHY the change is needed. Non-empty. |
| `status` | Enum | ✅ | PENDING \| APPROVED \| REJECTED \| EXECUTED |
| `approvedBy` | Int | ❌ | userId of the admin who approved. Null until approved. |
| `approvedAt` | DateTime | ❌ | Approval timestamp. |
| `rejectionReason` | Text | ❌ | Why the request was rejected. Required when REJECTED. |
| `executedAt` | DateTime | ❌ | When the change was applied to the Lesson. Null until EXECUTED. |
| `executedBy` | Int | ❌ | userId or system (0) that executed the change. |
| `previousDate` | Date | ❌ | Lesson date before change (RESCHEDULE only). |
| `newDate` | Date | ❌ | Proposed new date (RESCHEDULE only). |
| `previousStartTime` | String | ❌ | Lesson start time before change (RESCHEDULE only). |
| `newStartTime` | String | ❌ | Proposed new start time (RESCHEDULE only). |
| `previousEndTime` | String | ❌ | Lesson end time before change (RESCHEDULE only). |
| `newEndTime` | String | ❌ | Proposed new end time (RESCHEDULE only). |
| `previousTeacherId` | Int | ❌ | Teacher before change (TEACHER_CHANGE only). |
| `newTeacherId` | Int | ❌ | Proposed new teacher (TEACHER_CHANGE only). |
| `createdAt` | DateTime | ✅ | Request submission timestamp. |

### 6.3 Identity

```
Primary Key: id (bigint auto-increment)
No composite business key — each request is a unique record.
```

---

## 7. LessonChangeRequest State Machine

### 7.1 Lifecycle

```
         ┌──────────┐
         │ PENDING  │  ← Request submitted
         └────┬─────┘
              │
       ┌──────┴──────┐
       │              │
       ▼              ▼
┌──────────┐   ┌──────────┐
│ APPROVED │   │ REJECTED │  ← Terminal (cannot retry)
└────┬─────┘   └──────────┘
     │
     │ system executes change
     ▼
┌──────────┐
│ EXECUTED │  ← Terminal (change applied to Lesson)
└──────────┘
```

### 7.2 Transition Rules

| From | To | Trigger | Guard | Side Effect |
|------|----|---------|-------|-------------|
| PENDING | APPROVED | Admin approves | Request is valid. Admin has authority. | Record approvedBy + approvedAt. |
| PENDING | REJECTED | Admin rejects | `rejectionReason` required, non-empty. | Record rejectionReason. |
| APPROVED | EXECUTED | System applies change | Lesson is in a mutable state. Change is valid. | Apply change to Lesson entity. Record executedAt + executedBy. |
| APPROVED | REJECTED | Admin reverses approval | `rejectionReason` required. Before execution. | Record rejectionReason. |

### 7.3 Reverse Transitions

**None.** Both EXECUTED and REJECTED are terminal states. Once a request is executed or rejected, it cannot be undone. A new request must be created for any further changes.

---

## 8. Request Type Constraints

### 8.1 RESCHEDULE (调课)

| Constraint | Value |
|------------|-------|
| Max requests per lesson | 3 |
| Date range | Within ±7 days of original date |
| Allowed Lesson states | SCHEDULED, TEACHING |
| Who requests | Teacher, Admin |
| Who approves | Admin |
| Fields used | previousDate, newDate, previousStartTime, newStartTime, previousEndTime, newEndTime |

### 8.2 TEACHER_CHANGE (换师)

| Constraint | Value |
|------------|-------|
| Scope | One lesson only. Does NOT change Class teacher assignment. |
| Allowed Lesson states | SCHEDULED, TEACHING |
| Who requests | Admin |
| Who approves | Auto (admin action = self-approve) |
| Fields used | previousTeacherId, newTeacherId |

### 8.3 CANCEL (停课)

| Constraint | Value |
|------------|-------|
| `cancelledReason` | Required, non-empty |
| Allowed Lesson states | SCHEDULED, TEACHING |
| Who requests | Teacher, Admin |
| Who approves | Admin |
| Fields used | None (reason is on the request, cancelledReason on Lesson) |

### 8.4 REOPEN (复课)

| Constraint | Value |
|------------|-------|
| From states | FINISHED → SCHEDULED (safe, no money moved) or ARCHIVED → FINISHED (may need financial rollback) |
| Who requests | Admin only |
| Who approves | Auto (admin action = self-approve) |
| Financial impact | ARCHIVED → FINISHED may require Finance Domain rollback |

---

## 9. Entity Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                    ATTENDANCE DOMAIN RELATIONSHIPS                 │
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                       │
│  │   Lesson     │ 1──── N │  LessonAttendance                    │
│  │              │         │               │                       │
│  │ id (PK)      │         │ id (PK)       │                       │
│  │ classCode    │         │ lessonId (FK) │──► Lesson.id          │
│  │ teacherId    │         │ studentCode   │──► Student.studentCode│
│  │ status       │         │ classCode     │──► Class.classCode    │
│  └──────┬───────┘         │ teacherId     │──► User.id            │
│         │                 │ workflowState  │                       │
│         │                 │ status         │                       │
│         │                 └────────────────┘                       │
│         │                                                         │
│         │ 1──── N                                                 │
│         │                                                         │
│  ┌──────────────────┐                                             │
│  │ LessonChangeRequest│                                            │
│  │                   │                                             │
│  │ id (PK)           │                                             │
│  │ lessonId (FK)     │──► Lesson.id                               │
│  │ requestType       │                                             │
│  │ requestedBy       │──► User.id                                 │
│  │ status            │                                             │
│  │ approvedBy        │──► User.id                                 │
│  └───────────────────┘                                             │
└──────────────────────────────────────────────────────────────────┘
```

### 9.1 Cross-Domain References

| Field | References | Domain | Access |
|-------|-----------|--------|--------|
| LessonAttendance.studentCode | Student.studentCode | Student | Read-only (boundary check) |
| LessonAttendance.classCode | Class.classCode | Teaching | Read-only (denormalized) |
| LessonAttendance.teacherId | User.id | Identity | Read-only (denormalized from Lesson) |
| LessonChangeRequest.requestedBy | User.id | Identity | Read-only |
| LessonChangeRequest.approvedBy | User.id | Identity | Read-only |

**Rule:** Attendance Domain NEVER writes to Student, Class, or User tables. All cross-domain references are read-only (Constitution Rule 17).

---

## 10. Event Integration

### 10.1 attendance.confirmed (NEW)

| Property | Value |
|----------|-------|
| **Emitter** | Teaching Domain (Attendance subdomain) |
| **Trigger** | ALL LessonAttendance records for a Lesson reach CONFIRMED or LOCKED state |
| **Meaning** | Attendance data is finalized. Ready for financial processing. |
| **Money moves?** | No |
| **Consumers** | Dashboard (real-time stats), guard for lesson.finished emission |
| **Idempotency key** | `lessonId` |

### 10.2 Integration with Two-Phase Events

```
Timeline:
  1. Lesson: SCHEDULED → TEACHING
     └── Auto-create LessonAttendance records (PENDING)
  
  2. Teacher records attendance
     └── Attendance: PENDING → CHECKED_IN (status set)
  
  3. Teacher completes lesson
     └── Lesson: TEACHING → FINISHED
     └── Emits: lesson.completed (NO money)
  
  4. Admin reviews attendance during review window
     └── Attendance: CHECKED_IN → CONFIRMED
  
  5. ALL attendance confirmed
     └── Emits: attendance.confirmed
  
  6. Admin confirms / auto-timeout
     └── Guard: ALL attendance must be CONFIRMED or LOCKED
     └── Lesson: FINISHED → ARCHIVED
     └── Emits: lesson.finished (MONEY MOVES)
  
  7. Finance Domain receives lesson.finished
     └── For each attendance WHERE status ∈ {PRESENT, LATE, ONLINE, OFFLINE}
     └── Contract.remainingLessons -= 1
```

### 10.3 Event Safety: attendance.confirmed MUST Precede lesson.finished

```
CONSTRAINT:
  lesson.finished MUST NOT be emitted unless attendance.confirmed
  has been emitted for the same lessonId.

ENFORCEMENT:
  LessonService.archive() checks:
    IF any LessonAttendance WHERE lessonId = X AND workflowState NOT IN (CONFIRMED, LOCKED)
    THEN REJECT archive with error "All attendance must be confirmed before archiving"
```

---

## 11. Database Table Summary

| Table | Key | Estimated Rows (1 year) | Notes |
|-------|-----|------------------------|-------|
| `lesson_attendance` | (lessonId, studentCode) | 25,000 – 125,000 | 1 record per student per lesson |
| `lesson_change_request` | id (PK) | 200 – 1,000 | 1 record per change request |

---

## 12. Downstream Impact Matrix

| What Attendance Records | Who Consumes | How |
|------------------------|-------------|-----|
| status (PRESENT/LATE/ONLINE/OFFLINE) | Finance | Deduction path: `lesson → attendance → enrollment → contract → deduct` |
| status (all values) | Points | Point award rules based on attendance type |
| status (ABSENT) | Notification | Parent absence alert |
| status (LEAVE) | Notification | Leave confirmation to parent |
| workflowState | Dashboard | Real-time attendance tracking |
| checkInTime | Statistics | Punctuality metrics |
| teacherId | Finance | Teacher salary calculation per lesson |
| source | Audit | How attendance was recorded (manual vs self-check-in) |

---

*This document is the authoritative domain model for the Attendance Domain. It was produced during Sprint 4.1.5 (Attendance Domain + LessonChangeRequest Skeleton). Any changes require a Change Request per Constitution Rule 7 and Rule 25.*

*Companion documents: [AttendanceRules.md](../BusinessRules/AttendanceRules.md), [AttendanceStateMachine.md](../StateMachine/AttendanceStateMachine.md), [LessonChangeRequestRules.md](../BusinessRules/LessonChangeRequestRules.md), [ADR-010-Attendance-Event-Ownership.md](../DecisionLog/ADR-010-Attendance-Event-Ownership.md).*
