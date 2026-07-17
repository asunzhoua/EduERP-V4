# Lesson State Machine

> **Entity**: Lesson (课次)
> **Version**: v1.0.0
> **Rule Reference**: Constitution Rule 19 (Lesson = Timeline), Rule 20 (Every Money → Lesson), Rule 22 (Unidirectional States)
> **Last Updated**: 2026-07-14

---

## States

```typescript
enum LessonStatus {
  DRAFT      = 'DRAFT',      // Being prepared (manual only)
  SCHEDULED  = 'SCHEDULED',  // On the calendar
  TEACHING   = 'TEACHING',   // In progress
  FINISHED   = 'FINISHED',   // Teaching done, attendance recorded. Emits LessonCompleted.
  ARCHIVED   = 'ARCHIVED',   // Financially settled. Emits LessonFinished. Terminal.
  CANCELLED  = 'CANCELLED',  // Cancelled. Never deleted.
}
```

## State Diagram

```
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ schedule
                         ▼
                  ┌──────────┐         ┌──────────────┐
                  │SCHEDULED │◄────────│ CANCELLED    │ (reopen)
                  └────┬─────┘         └──────────────┘
                       │ start
                       ▼
                  ┌──────────┐
                  │ TEACHING │
                  └────┬─────┘
                       │ complete + attendance
                       ▼
                  ┌──────────┐         ┌──────────────┐
                  │ FINISHED │◄────────│ ARCHIVED     │ (reopen)
                  └────┬─────┘         └──────────────┘
                       │ confirm
                       ▼
                  ┌──────────┐
                  │ ARCHIVED │  ← Terminal
                  └──────────┘
```

## Primary Flow (Happy Path)

```
SCHEDULED → TEACHING → FINISHED → ARCHIVED
```

## All Transitions

| # | From | To | Who | Guard | Side Effects | Event |
|---|------|----|-----|-------|-------------|-------|
| T1 | DRAFT | SCHEDULED | Admin/System | Date/time set | — | — |
| T2 | SCHEDULED | TEACHING | Teacher | None | Records `actualStartTime` | — |
| T3 | TEACHING | FINISHED | Teacher | ALL enrolled students have non-NOT_STARTED attendance status | Records `actualEndTime`. Saves attendance records. | **lesson.completed** |
| T4 | FINISHED | ARCHIVED | Admin or Auto-timeout | Timeout (default 24h) or admin confirms | Records `confirmedBy`, `confirmedAt` | **lesson.finished** |
| T5 | SCHEDULED | CANCELLED | Admin/Teacher | `cancelledReason` required | — | — |
| T6 | TEACHING | CANCELLED | Admin | Emergency. `cancelledReason` required. | — | — |
| T7 | FINISHED | SCHEDULED | Admin | Reason required | Unlocks attendance for editing | — |
| T8 | ARCHIVED | FINISHED | Admin | Reason required | May trigger financial rollback | — |
| T9 | CANCELLED | SCHEDULED | Admin | Reason required | — | — |

## Event Emission Rules

### lesson.completed (T3: TEACHING → FINISHED)

```
Emitted when:  Lesson transitions to FINISHED
Meaning:       Teaching is done. Attendance recorded. Awaiting confirmation.
Money moves:   NO
Consumers:     Dashboard (real-time stats), Notification (future pre-notice)
```

Payload:
```typescript
{
  lessonId: number;
  classCode: string;
  courseCode: string;
  teacherId: number;
  scheduledDate: Date;
  actualStartTime: Date;
  actualEndTime: Date;
  durationMinutes: number;
  attendance: Array<{
    studentCode: string;
    status: 'NOT_STARTED' | 'PRESENT' | 'LATE' | 'LEAVE_APPROVED' | 'ABSENT';
  }>;
  timestamp: Date;
}
```

### lesson.finished (T4: FINISHED → ARCHIVED)

```
Emitted when:  Lesson transitions to ARCHIVED
Meaning:       Lesson is financially settled. Money can move.
Money moves:   YES — this is the ONLY event that triggers financial operations.
Consumers:     Finance (deduction, salary), Points (awards), Notification (confirm), Dashboard
```

Payload:
```typescript
{
  lessonId: number;
  classCode: string;
  courseCode: string;
  teacherId: number;
  scheduledDate: Date;
  actualStartTime: Date;
  actualEndTime: Date;
  durationMinutes: number;
  attendance: Array<{
    studentCode: string;
    status: 'PRESENT' | 'LATE' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'ABSENT' | 'MAKEUP';
  }>;
  confirmedBy: number;    // userId or 0 for auto-approve
  confirmedAt: Date;
  timestamp: Date;
}
```

## Critical Business Rules

### Rule: No Money Before Confirmation

```
FINISHED is a SAFE STATE — teaching is done but no money has moved.
FINISHED → SCHEDULED (reopen) is safe — no financial rollback needed.
ARCHIVED → FINISHED (reopen) MAY require financial rollback.
```

### Rule: All Attendance Required Before FINISHED

```
Before T3 (TEACHING → FINISHED):
  - EVERY enrolled student MUST have a non-NOT_STARTED attendance status
  - Server validates this. If any student is NOT_STARTED, the transition is rejected.
```

### Rule: CANCELLED Is Not Terminal

```
CANCELLED → SCHEDULED (T9) is allowed.
Cancelled lessons can be reopened with a reason.
This supports scenarios like: "Class was cancelled due to weather, rescheduled to next week."
```

### Rule: No Indefinite Stays

```
DRAFT lessons: auto-cancel after 7 days (future).
FINISHED lessons: auto-archive after configurable timeout (default 24h).
SCHEDULED lessons: if past scheduledDate and still SCHEDULED, flag for admin review.
```

## Reverse Transitions (Admin Override)

All reverse transitions require:
1. Admin-level authority
2. A logged reason
3. Audit trail entry in `lesson_audit_log`

| Reverse Transition | Financial Impact | Required Action |
|-------------------|-----------------|-----------------|
| FINISHED → SCHEDULED | None (safe) | Reason logged. Attendance unlocked. |
| ARCHIVED → FINISHED | May need rollback | Finance domain notified. Contract adjustment may be needed. |
| CANCELLED → SCHEDULED | None | Reason logged. Lesson reappears on teacher calendar. |

## Attendance and State Relationship

| Lesson Status | Attendance Editable? | Notes |
|---------------|---------------------|-------|
| DRAFT | N/A | No attendance records yet |
| SCHEDULED | N/A | No attendance records yet |
| TEACHING | Yes | Teacher is actively taking attendance |
| FINISHED | **No** (locked) | Must reopen to FINISHED → SCHEDULED to edit |
| ARCHIVED | **No** (locked) | Must reopen to FINISHED → SCHEDULED, then edit |
| CANCELLED | N/A | No attendance for cancelled lessons |

## Makeup Lesson Lifecycle

A makeup lesson is a standard Lesson entity with two extra flags:

```
isMakeup = true
originLessonId = <original missed lesson's id>
```

Makeup lessons follow the EXACT same state machine. They emit both lesson.completed and lesson.finished. The only difference is:
- The original lesson's attendance is NOT modified
- The makeup lesson's attendance triggers the deduction against the student's Contract
