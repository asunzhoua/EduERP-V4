# EduOS State Machine Catalog

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1 (Domain Blueprint)
> **Purpose**: Authoritative reference for all entity state transitions. Every state change in the system must follow the rules defined here. No skipping states (Rule 22).
> **Parent**: [Aggregates.md](../domain/Aggregates.md)
> **Related**: [EventCatalog.md](../EventCatalog/EventCatalog.md), [BoundedContexts.md](../domain/BoundedContexts.md)

---

## How State Machines Work in EduOS

Each state machine defines:
- **States** — the possible status values for an entity
- **Transitions** — allowed paths between states
- **Guards** — conditions that must be met for a transition to be allowed
- **Side Effects** — what happens automatically when a transition occurs

All state transitions are **unidirectional** (Rule 22):
- Forward transitions follow the defined path
- Reverse transitions (reopens, corrections) require admin-level override with logged reason
- Jumping states (e.g., Draft -> Finished) is strictly prohibited

---

## 1. Student Status

> **Aggregate**: Student (S1)
> **Context**: Student
> **Database Tables**: `student`, `student_parent`
> **Invariants**: STUDENT-001 (StudentCode immutable), STUDENT-002 (Soft delete only), STUDENT-003 (GRADUATED terminal)

```
                     ┌─────────────┐
                     │   Active    │
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌─────────┐  ┌──────────┐  ┌───────────┐
        │ Paused  │  │Graduated │  │ Inactive  │
        └────┬────┘  └──────────┘  └─────┬─────┘
             │                            │
             └──────────┬─────────────────┘
                        ▼
                  ┌─────────────┐
                  │   Active    │
                  └─────────────┘
```

| From | To | Guard | Side Effect | Event Emitted |
|------|----|-------|-------------|---------------|
| ACTIVE | PAUSED | None | Enrolled classes remain, future lessons cancelled | `student.status.changed` (PLANNED) |
| ACTIVE | GRADUATED | All classes completed | Terminal state — no future transitions | `student.status.changed` (PLANNED) |
| ACTIVE | INACTIVE | None | Future lessons cancelled, contracts frozen | `student.deactivated` (DESIGNED) |
| PAUSED | ACTIVE | Admin action | Resume classes | `student.status.changed` (PLANNED) |
| INACTIVE | ACTIVE | Admin action | Resume classes | `student.status.changed` (PLANNED) |
| GRADUATED | — | Terminal | No transitions allowed | — |

**Detailed Doc**: *None (standalone)*

---

## 2. Course Status

> **Aggregate**: Course (T1)
> **Context**: Teaching
> **Database Tables**: `course`
> **Invariants**: COURSE-001 (Only DRAFT soft-deleted), COURSE-002 (ARCHIVED not terminal)

```
                ┌─────────────┐
                │   DRAFT     │
                └──────┬──────┘
                       │ publish (all required fields filled)
                       ▼
                ┌─────────────┐
                │  PUBLISHED  │
                └──────┬──────┘
               ┌───────┴───────┐
               │               │
               ▼               ▼
        ┌──────────┐    ┌──────────┐
        │ ARCHIVED │    │ PUBLISHED│  (re-activate allowed)
        └──────────┘    └──────────┘
```

| From | To | Guard | Side Effect | Event Emitted |
|------|----|-------|-------------|---------------|
| DRAFT | PUBLISHED | All required fields filled | Classes can now be created | — |
| PUBLISHED | ARCHIVED | None (even with active classes) | No new classes allowed | — |
| ARCHIVED | PUBLISHED | None | Classes creatable again | — |
| DRAFT | (soft delete) | No existing classes | Recycled | — |

**Detailed Doc**: [CourseStateMachine.md](./CourseStateMachine.md)

---

## 3. Class Status

> **Aggregate**: Class (T2)
> **Context**: Teaching
> **Database Tables**: `class`, `teacher_assignment`
> **Invariants**: CLASS-001 (ACTIVE requires PRIMARY teacher), CLASS-002 (Activation requires teacher + schedule), CLASS-003 (COMPLETED is automatic)

```
                ┌─────────────┐
                │   DRAFT     │
                └──────┬──────┘
                       │ activate (teacher assigned, schedule set)
                       ▼
                ┌─────────────┐
                │   ACTIVE    │ ◄──── (re-activate from CANCELLED)
                └──────┬──────┘
               ┌───────┴───────┐
               │               │
               ▼               ▼
        ┌──────────┐    ┌──────────┐
        │COMPLETED │    │CANCELLED │
        └──────────┘    └──────────┘
```

| From | To | Guard | Side Effect | Event Emitted |
|------|----|-------|-------------|---------------|
| DRAFT | ACTIVE | Teacher assigned, schedule defined | Lessons auto-generated | — |
| ACTIVE | COMPLETED | All lessons ARCHIVED | Final class report | — |
| ACTIVE | CANCELLED | Admin approval, reason | All future lessons -> CANCELLED | — |
| CANCELLED | ACTIVE | Admin override | Future lessons regenerated | — |
| DRAFT | CANCELLED | No students enrolled | No side effects | — |
| COMPLETED | — | Terminal | No transitions allowed | — |

**Detailed Doc**: [ClassStateMachine.md](./ClassStateMachine.md)

---

## 4. Contract Status

> **Aggregate**: Contract (T3)
> **Context**: Teaching (creation, freeze/unfreeze) / Finance (deduction, refund)
> **Database Tables**: `contract`
> **Invariants**: CONTRACT-001 (remainingLessons non-negative), CONTRACT-002 (Only Finance modifies remainingLessons), CONTRACT-003 (FROZEN ↔ ACTIVE bidirectional)

```
                    ┌──────────────┐
                    │   ACTIVE     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │EXHAUSTED │ │ EXPIRED  │ │  FROZEN  │
        └──────────┘ └──────────┘ └────┬─────┘
                                        │ unfreeze
                                        ▼
                                  ┌──────────┐
                                  │  ACTIVE  │
                                  └──────────┘

ACTIVE ─────► REFUNDED (at any point)
FROZEN ─────► REFUNDED
```

| From | To | Trigger | Side Effect | Event Emitted |
|------|----|---------|-------------|---------------|
| ACTIVE | EXHAUSTED | `remainingLessons = 0` | Auto-transition on last deduction | `contract.exhausted` (DESIGNED) |
| ACTIVE | EXPIRED | `validTo` date passed | Auto-cron (future) | `contract.expired` (DESIGNED) |
| ACTIVE | FROZEN | Admin action | No deductions allowed | — |
| ACTIVE | REFUNDED | Finance action | Requires refund record | `contract.refunded` (DESIGNED) |
| FROZEN | ACTIVE | Admin action | Resume deductions | — |
| FROZEN | REFUNDED | Finance action | Requires refund record | `contract.refunded` (DESIGNED) |
| EXHAUSTED | REFUNDED | Finance action | Requires refund record | `contract.refunded` (DESIGNED) |
| EXPIRED | REFUNDED | Finance action | Requires refund record | `contract.refunded` (DESIGNED) |
| EXHAUSTED | — | Terminal | No transitions (except REFUNDED) | — |
| EXPIRED | — | Terminal | No transitions (except REFUNDED) | — |
| REFUNDED | — | Terminal | No transitions allowed | — |

**Detailed Doc**: *None (standalone)*

---

## 5. Lesson Status (Core Business Timeline)

> **Aggregate**: Lesson (T4)
> **Context**: Teaching
> **Database Tables**: `lesson`, `lesson_attendance`, `lesson_change_request`
> **Invariants**: LESSON-001 (One attendance per student per lesson), LESSON-002 (ARCHIVED requires all attendance confirmed), LESSON-003 (FINISHED→ARCHIVED emits lesson.finished), LESSON-004 (CANCELLED never deleted), LESSON-005 (Every money must have a lesson)

```
                        ┌──────────┐
                        │  DRAFT   │
                        └────┬─────┘
                             │ schedule
                             ▼
                      ┌──────────┐
                      │SCHEDULED │ ◄──── (reopen from CANCELLED)
                      └────┬─────┘
                           │ start
                           ▼
                      ┌──────────┐
                      │ TEACHING │
                      └────┬─────┘
                           │ complete + attendance
                           ▼
                      ┌──────────┐
                      │ FINISHED │ ◄──── (reopen from ARCHIVED)
                      └────┬─────┘
                           │ confirm (admin or auto-timeout)
                           ▼
                      ┌──────────┐
                      │ ARCHIVED │  ← Terminal
                      └──────────┘

DRAFT ────cancel────► CANCELLED
SCHEDULED ──cancel──► CANCELLED
TEACHING ───cancel──► CANCELLED
```

| From | To | Who | Guard | Side Effect | Event Emitted |
|------|----|-----|-------|-------------|---------------|
| DRAFT | SCHEDULED | Admin/System | Date/time set | — | — |
| DRAFT | CANCELLED | Admin | No students enrolled | — | — |
| SCHEDULED | TEACHING | Teacher | None | Records `actualStartTime` | — |
| TEACHING | FINISHED | Teacher | All students have attendance | Emits **lesson.completed** | `lesson.completed` (CURRENT) |
| FINISHED | ARCHIVED | Admin/Auto | Timeout or confirm | Emits **lesson.finished** | `lesson.finished` (CURRENT) |
| FINISHED | SCHEDULED | Admin | Reason required | Safe — no money moved yet | — |
| SCHEDULED | CANCELLED | Admin | `cancelledReason` required | — | — |
| TEACHING | CANCELLED | Admin | Emergency, reason required | — | — |
| ARCHIVED | FINISHED | Admin | Reason required | May need financial rollback | — |
| CANCELLED | SCHEDULED | Admin | Reason required | Reopen cancelled lesson | — |

### Lesson Status — Event Mapping

| Lesson Status | Event Emitted | Money Moves? |
|---------------|---------------|-------------|
| DRAFT | — | No |
| SCHEDULED | — | No |
| TEACHING | — | No |
| FINISHED | **lesson.completed** | No (safe state) |
| ARCHIVED | **lesson.finished** | Yes |
| CANCELLED | — | No |

**Detailed Doc**: [LessonStateMachine.md](./LessonStateMachine.md)

---

## 6. Attendance Workflow State Machine

> **Aggregate**: Lesson (T4) — contained entity LessonAttendance
> **Context**: Teaching (Attendance subdomain)
> **Database Tables**: `lesson_attendance`
> **Invariants**: LESSON-001 (One attendance per student per lesson), LESSON-002 (ARCHIVED requires all attendance CONFIRMED/LOCKED)

```
┌──────────┐     CHECKED_IN     ┌─────────────┐     CONFIRMED     ┌────────────┐
│  PENDING │ ──────────────────► │ CHECKED_IN  │ ─────────────────►│ CONFIRMED  │
└──────────┘                     └──────┬──────┘                   └─────┬──────┘
                                        │                               │
                                        │  reverse                      │  forward
                                        │  (admin)                      │
                                        ▼                               ▼
                               ┌──────────┐                    ┌────────────┐
                               │  PENDING │                    │   LOCKED   │
                               └──────────┘                    └────────────┘
                                                              (terminal)

                                        CHECKED_IN ◄── reverse (admin)
                                        (CONFIRMED → CHECKED_IN)
```

**Forward Path:** PENDING -> CHECKED_IN -> CONFIRMED -> LOCKED

| From | To | Trigger | Guard | Side Effect | Event Emitted |
|------|----|---------|-------|-------------|---------------|
| PENDING | CHECKED_IN | Roll call recorded | Status must be set (not null) | Records `checkInTime` | — |
| CHECKED_IN | CONFIRMED | Admin confirms | All CHECKED_IN records reviewed | Records confirmation | — |
| CONFIRMED | LOCKED | Lesson archived | Lesson status -> ARCHIVED | Immutable from this point | — |
| CHECKED_IN | PENDING | Admin override | Reason required | Reopens for correction | — |
| CONFIRMED | CHECKED_IN | Admin override | Reason required | Reopens for correction | — |

**Terminal States:** LOCKED (no transitions out)

**Event Emitted:** `attendance.confirmed` (when ALL records for a lesson reach CONFIRMED or LOCKED)

**Event Emission Point:** Attendance confirms the prerequisite for `lesson.finished`. This event MUST precede `lesson.finished` in the event sequence.

**Detailed Doc**: [AttendanceStateMachine.md](./AttendanceStateMachine.md)

---

## 7. LessonChangeRequest Lifecycle

> **Aggregate**: Lesson (T4) — contained entity LessonChangeRequest
> **Context**: Teaching
> **Database Tables**: `lesson_change_request`
> **Invariants**: CR002 (One active request per lesson per type), CR003 (Max 3 reschedule per lesson), CR004 (Max 7-day date shift)

```
                    ┌──────────┐
                    │ PENDING  │
                    └────┬─────┘
                ┌────────┴────────┐
                ▼                 ▼
        ┌───────────┐     ┌───────────┐
        │ APPROVED  │     │ REJECTED  │ ← Terminal
        └─────┬─────┘     └───────────┘
         ┌────┴────┐
         ▼         ▼
  ┌───────────┐ ┌───────────┐
  │ EXECUTED  │ │ REJECTED  │ ← Terminal
  └───────────┘ └───────────┘
  (Terminal)
```

**Forward Path:** PENDING -> APPROVED -> EXECUTED

| From | To | Trigger | Guard | Side Effect | Event Emitted |
|------|----|---------|-------|-------------|---------------|
| PENDING | APPROVED | Admin approves | Valid request type, constraints met | Records `approvedBy`, `approvedAt` | — |
| PENDING | REJECTED | Admin rejects | Reason required | Records `rejectionReason` | — |
| APPROVED | EXECUTED | System executes | Business logic for request type | Records `executedAt`, `executedBy` | — |
| APPROVED | REJECTED | Admin reversal | Reason required | Reverses approval before execution | — |

**Terminal States:** REJECTED, EXECUTED (no transitions out)

**Request Types:**
- RESCHEDULE: Change lesson date/time (max 3 per lesson, max 7 days shift)
- TEACHER_CHANGE: Reassign teacher
- CANCEL: Cancel a lesson
- REOPEN: Reopen a cancelled/archived lesson

**Constraints:**
- One active (PENDING) request per lesson per type (CR002)
- Max 3 reschedule requests per lesson
- Max 7-day date shift for reschedule

**Detailed Doc**: *None (rules in BusinessRules/LessonChangeRequestRules.md)*

---

## 8. Enrollment Status

> **Aggregate**: Enrollment (T5)
> **Context**: Teaching
> **Database Tables**: `enrollment`
> **Invariants**: ENROLL-001 (UNIQUE classCode+studentCode), ENROLL-002 (ACTIVE requires ACTIVE contract), ENROLL-003 (Reactivation requires new contract), ENROLL-004 (COMPLETED is terminal), ENROLL-005 (Never deleted)

```
                ┌──────────┐
                │  ACTIVE  │ ◄──── (reactivate from WITHDRAWN)
                └────┬─────┘
           ┌─────────┴─────────┐
           ▼                   ▼
    ┌───────────┐       ┌───────────┐
    │ WITHDRAWN │       │ COMPLETED │
    └─────┬─────┘       └───────────┘
          │             (terminal)
          │ reactivate
          ▼
    ┌───────────┐
    │  ACTIVE   │
    └───────────┘
```

| From | To | Trigger | Guard | Side Effect | Event Emitted |
|------|----|---------|-------|-------------|---------------|
| ACTIVE | WITHDRAWN | Admin action | `withdrawReason` required | Student removed from roster. Finance may process refund. | — |
| ACTIVE | COMPLETED | System (auto) | Class status -> COMPLETED | All ACTIVE enrollments auto-transition. | — |
| WITHDRAWN | ACTIVE | Admin (Reactivation) | New ACTIVE Contract required | Existing record UPDATEd (not new row). `withdrawReason` cleared. | — |

**Terminal States:** COMPLETED (no transitions out)

**Detailed Doc**: *None (rules in EnrollmentRules.md)*

---

## 9. TeacherAssignment Status

> **Aggregate**: Class (T2) — contained entity TeacherAssignment
> **Context**: Teaching
> **Database Tables**: `teacher_assignment`
> **Invariants**: CLASS-001 (ACTIVE requires exactly one PRIMARY TeacherAssignment)

```
    ┌──────────┐
    │  ACTIVE  │
    └────┬─────┘
         │ expire / reassign
         ▼
    ┌───────────┐
    │ INACTIVE  │
    └───────────┘
    (terminal)
```

| From | To | Trigger | Guard | Side Effect | Event Emitted |
|------|----|---------|-------|-------------|---------------|
| ACTIVE | INACTIVE | Assignment expires or teacher reassigned | End date reached or admin action | Teacher no longer assigned to class | — |

**Terminal States:** INACTIVE (no transitions out)

**Detailed Doc**: *None*

---

## State Transition Validation Rules (Rule 22)

1. **No skipping states.** Every transition must go to the immediate next state in the path.
2. **Reverse transitions require admin-level authority** and a logged reason.
3. **Terminal states** (GRADUATED, COMPLETED, ARCHIVED, EXHAUSTED, LOCKED, REJECTED, EXECUTED, INACTIVE) cannot transition forward.
4. **Cancelled is NOT a terminal state** — lessons can be reopened from CANCELLED -> SCHEDULED.
5. **Every transition is audited** — who, when, from, to, why.

---

## Quick Reference: All Entity Statuses

| # | Entity | State Machine | States | Terminal |
|---|--------|--------------|--------|----------|
| 1 | **Student** | Student Status | ACTIVE, PAUSED, GRADUATED, INACTIVE | GRADUATED |
| 2 | **Course** | Course Status | DRAFT, PUBLISHED, ARCHIVED | ARCHIVED |
| 3 | **Class** | Class Status | DRAFT, ACTIVE, COMPLETED, CANCELLED | COMPLETED |
| 4 | **Contract** | Contract Status | ACTIVE, EXHAUSTED, EXPIRED, FROZEN, REFUNDED | EXHAUSTED, EXPIRED, REFUNDED |
| 5 | **Lesson** | Lesson Status | DRAFT, SCHEDULED, TEACHING, FINISHED, ARCHIVED, CANCELLED | ARCHIVED |
| 6 | **Attendance** | Attendance Workflow | PENDING, CHECKED_IN, CONFIRMED, LOCKED | LOCKED |
| 7 | **ChangeRequest** | Request Lifecycle | PENDING, APPROVED, REJECTED, EXECUTED | REJECTED, EXECUTED |
| 8 | **Enrollment** | Enrollment Status | ACTIVE, WITHDRAWN, COMPLETED | COMPLETED |
| 9 | **TeacherAssignment** | Assignment Status | ACTIVE, INACTIVE | INACTIVE |

---

## State Machine to Aggregate Mapping

| # | State Machine | Aggregate | Context | Database Tables | Events Emitted |
|---|--------------|-----------|---------|-----------------|----------------|
| 1 | Student Status | Student (S1) | Student | student, student_parent | `student.deactivated`, `student.status.changed` |
| 2 | Course Status | Course (T1) | Teaching | course | (none) |
| 3 | Class Status | Class (T2) | Teaching | class, teacher_assignment | (none) |
| 4 | Contract Status | Contract (T3) | Teaching/Finance | contract | `contract.exhausted`, `contract.expired`, `contract.refunded` |
| 5 | Lesson Status | Lesson (T4) | Teaching | lesson, lesson_attendance, lesson_change_request | `lesson.completed`, `lesson.finished` |
| 6 | Attendance Workflow | Lesson (T4) | Teaching | lesson_attendance | `attendance.confirmed` |
| 7 | ChangeRequest Lifecycle | Lesson (T4) | Teaching | lesson_change_request | (none) |
| 8 | Enrollment Status | Enrollment (T5) | Teaching | enrollment | (none) |
| 9 | TeacherAssignment Status | Class (T2) | Teaching | teacher_assignment | (none) |

---

## Event Emission Sequence (Lesson Lifecycle)

The Lesson lifecycle produces events in this exact order:

```
1. TEACHING → FINISHED
   Event: lesson.completed
   Money: NO
   Meaning: Teaching is done, attendance recorded

2. Attendance CONFIRMED (all records)
   Event: attendance.confirmed
   Money: NO
   Meaning: Attendance data finalized

3. FINISHED → ARCHIVED
   Event: lesson.finished
   Money: YES
   Meaning: Lesson is financially settled

4. Finance reacts to lesson.finished
   Events: contract.deducted (per student), contract.exhausted (if 0 remaining)
   Money: YES
   Meaning: Contract balance updated
```

**Critical Rule:** `lesson.finished` MUST NOT be emitted before `lesson.completed` and `attendance.confirmed`. This ordering is enforced by the Lesson Service.

---

## State Machine to Event Schema Cross-Reference

| State Machine | State Transition | Event | EventSchema.md Section |
|--------------|-----------------|-------|------------------------|
| Student Status | ACTIVE → INACTIVE | `student.deactivated` | DESIGNED Events |
| Student Status | Any → Any | `student.status.changed` | PLANNED Events |
| Contract Status | ACTIVE → EXHAUSTED | `contract.exhausted` | DESIGNED Events |
| Contract Status | ACTIVE → EXPIRED | `contract.expired` | DESIGNED Events |
| Contract Status | ACTIVE → REFUNDED | `contract.refunded` | DESIGNED Events |
| Lesson Status | TEACHING → FINISHED | `lesson.completed` | CURRENT Events |
| Lesson Status | FINISHED → ARCHIVED | `lesson.finished` | CURRENT Events |
| Attendance Workflow | CHECKED_IN → CONFIRMED (all) | `attendance.confirmed` | DESIGNED Events |

---

*This is a living document. Update it whenever an entity's state machine changes. All state machine changes must be approved through the Change Request process.*
