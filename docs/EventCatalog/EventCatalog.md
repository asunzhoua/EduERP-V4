# EduOS Event Catalog

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1 (Domain Blueprint)
> **Purpose**: Every developer's reference for what events exist, who publishes them, and who should be listening. Prevents event misuse and cross-domain guessing (Rule 21).
> **Parent**: [ContextInteractionMatrix.md](../domain/ContextInteractionMatrix.md)
> **Related**: [EventSchema.md](./EventSchema.md), [Aggregates.md](../domain/Aggregates.md), [BoundedContexts.md](../domain/BoundedContexts.md)

---

## Event Naming Convention

```
Format: <domain>.<action>[.<context>]

Examples:
  lesson.completed
  lesson.finished
  attendance.confirmed
  contract.deducted       (planned)
```

All events are emitted via `@nestjs/event-emitter` (EventBus). Event names use lowercase dot notation.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| **CURRENT** | Implemented and emitting in production |
| **DESIGNED** | Fully specified (schema, ownership, consumers) but not yet emitting |
| **PLANNED** | Registered in catalog; detailed design in a future sprint |
| **FUTURE** | Conceptual only; no schema or implementation planned yet |

---

## Event Summary

| # | Event Name | Status | Owner Domain | Aggregate | Consumers |
|---|-----------|--------|-------------|-----------|-----------|
| 1 | `lesson.completed` | CURRENT | Teaching | Lesson (T4) | Dashboard, Notification (future) |
| 2 | `lesson.finished` | CURRENT | Teaching | Lesson (T4) | Finance, Points, Notification, Dashboard |
| 3 | `attendance.confirmed` | DESIGNED | Teaching | Lesson (T4) | Dashboard |
| 4 | `lesson.feedback.created` | DESIGNED | Teaching | Lesson (T4) | Dashboard, Notification (future) |
| 5 | `leave.submitted` | DESIGNED | Teaching | Lesson (T4) | Notification (future) |
| 6 | `leave.approved` | DESIGNED | Teaching | Lesson (T4) | Notification (future) |
| 7 | `contract.exhausted` | DESIGNED | Finance | Contract (T3) | Teaching, Dashboard |
| 8 | `contract.expired` | DESIGNED | Finance | Contract (T3) | Teaching, Dashboard |
| 9 | `contract.refunded` | DESIGNED | Finance | Contract (T3) | Teaching, Dashboard |
| 10 | `student.deactivated` | DESIGNED | Student | Student (S1) | Teaching |
| 11 | `points.granted` | DESIGNED | Finance | (Finance entity) | Dashboard, Notification (future) |
| 12 | `contract.deducted` | PLANNED | Finance | Contract (T3) | Dashboard, Notification |
| 13 | `salary.calculated` | PLANNED | Finance | (Finance entity) | Notification, Dashboard |
| 14 | `student.status.changed` | PLANNED | Student | Student (S1) | Teaching, Finance, Dashboard |
| 15 | `attendance.anomaly` | PLANNED | Teaching | Lesson (T4) | Notification |
| 16 | `contract.expiring` | PLANNED | Finance | Contract (T3) | Notification |
| 17 | `attendance.summary` | FUTURE | Teaching | Lesson (T4) | Dashboard |
| 18 | `points.awarded` | FUTURE | Points | (Points entity) | Dashboard, Notification |
| 19 | `points.redeemed` | FUTURE | Points | (Points entity) | Dashboard |
| 20 | `student.created` | FUTURE | Student | Student (S1) | Teaching, Dashboard |
| 21 | `user.login` | FUTURE | Identity | User (I1) | Dashboard, Notification |
| 22 | `user.logout` | FUTURE | Identity | User (I1) | Dashboard |
| 23 | `rule.updated` | FUTURE | System | (System) | All domains |
| 24 | `config.changed` | FUTURE | System | (System) | All domains |

**Aggregate Reference Key:** T1=Course, T2=Class, T3=Contract, T4=Lesson, T5=Enrollment, S1=Student, I1=User, I2=Role

---

## CURRENT Events

### `lesson.completed`

| | |
|---|---|
| **Publisher** | Teaching Domain |
| **Status** | CURRENT |
| **Source** | `TeachingConstitution_v1.1.md` Section 11.1 |
| **Trigger** | Teacher completes lesson (Lesson status: TEACHING -> FINISHED) |
| **Meaning** | Teaching is done, attendance recorded. **No money moves yet.** |
| **Payload** | `lessonId`, `classCode`, `courseCode`, `teacherId`, `scheduledDate`, `actualStartTime`, `actualEndTime`, `durationMinutes`, `attendance[]` |
| **Idempotency Key** | `lessonId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Dashboard | Update real-time teaching stats ("3 lessons today") | DESIGNED |
| Notification | Send "class completed" pre-notice to parents | FUTURE |

---

### `lesson.finished`

| | |
|---|---|
| **Publisher** | Teaching Domain |
| **Status** | CURRENT |
| **Source** | `TeachingConstitution_v1.1.md` Section 11.1, `events/lesson/lesson-finished.event.ts` |
| **Trigger** | Lesson confirmed (Lesson status: FINISHED -> ARCHIVED) |
| **Meaning** | Lesson is financially settled. **Money can move.** This is the only event that triggers financial operations. |
| **Payload** | `lessonId`, `classCode`, `courseCode`, `teacherId`, `scheduledDate`, `actualStartTime`, `actualEndTime`, `durationMinutes`, `attendance[]`, `confirmedBy`, `confirmedAt` |
| **Idempotency Key** | `lessonId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Finance | Deduct Contract remainingLessons, calculate teacher salary | PLANNED (Sprint 6) |
| Points | Award attendance points to students | FUTURE |
| Notification | Send confirmed lesson notification to parents | FUTURE |
| Dashboard | Update financial and operational stats | FUTURE |

---

## DESIGNED Events

### `attendance.confirmed`

| | |
|---|---|
| **Publisher** | Teaching Domain (Attendance subdomain) |
| **Status** | DESIGNED |
| **Source** | `ADR-010-Attendance-Event-Ownership.md` |
| **Trigger** | ALL LessonAttendance records for a Lesson reach CONFIRMED or LOCKED state |
| **Meaning** | Attendance data is finalized. Ready for financial processing. Prerequisite for `lesson.finished`. |
| **Payload** | `lessonId` |
| **Idempotency Key** | `lessonId` |
| **Constraint** | MUST precede `lesson.finished`. Finance MUST NOT react to this event. |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Dashboard | Update real-time attendance stats | DESIGNED |

---

### `lesson.feedback.created`

| | |
|---|---|
| **Publisher** | Teaching Domain |
| **Status** | DESIGNED |
| **Source** | `events/lesson/lesson-feedback-created.event.ts` |
| **Trigger** | Student or parent submits feedback for a completed lesson |
| **Payload** | `eventId`, `lessonId`, `studentId`, `teacherId`, `time` |
| **Idempotency Key** | `eventId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Dashboard | Display lesson feedback summary | FUTURE |
| Notification | Notify teacher of new feedback | FUTURE |

---

### `leave.submitted`

| | |
|---|---|
| **Publisher** | Teaching Domain |
| **Status** | DESIGNED |
| **Source** | `events/leave/leave-submitted.event.ts` |
| **Trigger** | Parent submits a leave request for a student |
| **Payload** | `eventId`, `leaveId`, `studentId`, `lessonId`, `time` |
| **Idempotency Key** | `eventId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Notification | Notify admin of pending leave request | FUTURE |

---

### `leave.approved`

| | |
|---|---|
| **Publisher** | Teaching Domain |
| **Status** | DESIGNED |
| **Source** | `events/leave/leave-approved.event.ts` |
| **Trigger** | Admin approves a leave request |
| **Payload** | `eventId`, `leaveId`, `studentId`, `lessonId`, `approvedBy`, `time` |
| **Idempotency Key** | `eventId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Notification | Notify parent of approval | FUTURE |
| Dashboard | Update attendance records | FUTURE |

---

### `contract.exhausted`

| | |
|---|---|
| **Publisher** | Finance Domain |
| **Status** | DESIGNED |
| **Source** | `TeachingConstitution_v1.1.md` Section 11.1 |
| **Trigger** | `Contract.remainingLessons` reaches 0 |
| **Meaning** | All lessons in the contract have been used. |
| **Idempotency Key** | `contractId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Teaching | Sync contract status | DESIGNED |
| Dashboard | Update remaining lesson display | DESIGNED |

---

### `contract.expired`

| | |
|---|---|
| **Publisher** | Finance Domain |
| **Status** | DESIGNED |
| **Source** | `TeachingConstitution_v1.1.md` Section 11.1 |
| **Trigger** | `Contract.validTo` date has passed |
| **Meaning** | Contract validity period has ended. |
| **Idempotency Key** | `contractId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Teaching | Sync contract status | DESIGNED |
| Dashboard | Update contract metrics | DESIGNED |

---

### `contract.refunded`

| | |
|---|---|
| **Publisher** | Finance Domain |
| **Status** | DESIGNED |
| **Source** | `TeachingConstitution_v1.1.md` Section 11.1 |
| **Trigger** | Contract refund has been processed |
| **Meaning** | Contract has been refunded (partial or full). |
| **Idempotency Key** | `contractId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Teaching | Sync contract status | DESIGNED |
| Dashboard | Update financial metrics | DESIGNED |

---

### `student.deactivated`

| | |
|---|---|
| **Publisher** | Student Domain |
| **Status** | DESIGNED |
| **Source** | `TeachingConstitution_v1.1.md` Section 11.1 |
| **Trigger** | Student status: ACTIVE -> INACTIVE |
| **Meaning** | Student record has been deactivated. |
| **Idempotency Key** | `studentId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Teaching | Review and cancel future enrollments | DESIGNED |

---

### `points.granted`

| | |
|---|---|
| **Publisher** | Finance Domain |
| **Status** | DESIGNED |
| **Source** | `events/finance/points-granted.event.ts` |
| **Trigger** | Points awarded to student (e.g., after attendance confirmation) |
| **Payload** | `eventId`, `studentId`, `lessonId`, `points`, `time` |
| **Idempotency Key** | `eventId` |

**Subscribers:**

| Domain | Action | Status |
|--------|--------|--------|
| Dashboard | Update student points balance | FUTURE |
| Notification | Notify student of points earned | FUTURE |

---

## PLANNED Events

### `contract.deducted` *(Sprint 6)*

| | |
|---|---|
| **Publisher** | Finance Domain |
| **Status** | PLANNED |
| **Source** | `EventCatalog.md` v0.1.0 |
| **Trigger** | LessonFinished processed, Contract balance updated |
| **Payload** | `contractCode`, `lessonId`, `studentCode`, `previousBalance`, `newBalance`, `timestamp` |

**Subscribers:**
- Dashboard: Update remaining lesson display
- Notification: Alert parent when balance is low (<=3 lessons)

---

### `salary.calculated` *(Sprint 6)*

| | |
|---|---|
| **Publisher** | Finance Domain |
| **Status** | PLANNED |
| **Source** | `EventCatalog.md` v0.1.0 |
| **Trigger** | Teacher salary batch calculation |
| **Payload** | `teacherId`, `periodStart`, `periodEnd`, `totalLessons`, `totalAmount`, `lessonDetails[]` |

**Subscribers:**
- Notification: Send salary statement to teacher
- Dashboard: Update salary expense metrics

---

### `student.status.changed` *(Future)*

| | |
|---|---|
| **Publisher** | Student Domain |
| **Status** | PLANNED |
| **Source** | `EventCatalog.md` v0.1.0, `DomainCatalog.md` |
| **Trigger** | Student status transition (e.g., ACTIVE -> INACTIVE) |
| **Payload** | `studentCode`, `previousStatus`, `newStatus`, `reason`, `operatedBy` |

**Subscribers:**
- Teaching: Cancel future lessons for this student
- Finance: Pause contract deductions
- Dashboard: Update enrollment metrics

---

### `attendance.anomaly` *(Future)*

| | |
|---|---|
| **Publisher** | Teaching Domain (Attendance subdomain) |
| **Status** | PLANNED |
| **Source** | `EventCatalog.md` v0.1.0, `DomainCatalog.md` |
| **Trigger** | Unusual attendance pattern detected (e.g., 3 consecutive absences) |
| **Payload** | `studentCode`, `classCode`, `consecutiveAbsences`, `alertLevel` |

**Subscribers:**
- Notification: Alert admin and parent

---

### `contract.expiring` *(Future)*

| | |
|---|---|
| **Publisher** | Finance Domain |
| **Status** | PLANNED |
| **Source** | `EventCatalog.md` v0.1.0 |
| **Trigger** | Contract approaching expiration (configurable threshold) |
| **Payload** | `contractCode`, `studentCode`, `remainingLessons`, `validTo`, `daysUntilExpiry` |

**Subscribers:**
- Notification: Send renewal reminder to parent

---

## FUTURE Events

> The following events are conceptual only. Payloads are proposed and may change.

### `attendance.summary` *(Future)*

| | |
|---|---|
| **Publisher** | Teaching Domain (Attendance subdomain) |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md` |
| **Trigger** | Periodic attendance summary generation |

---

### `points.awarded` *(Future)*

| | |
|---|---|
| **Publisher** | Points Domain |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md`, `TeachingDomainModel.md` |
| **Trigger** | Attendance-based point award after lesson.finished |

---

### `points.redeemed` *(Future)*

| | |
|---|---|
| **Publisher** | Points Domain |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md` |
| **Trigger** | Points redeemed for rewards |

---

### `student.created` *(Future)*

| | |
|---|---|
| **Publisher** | Student Domain |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md` |
| **Trigger** | New student record created |

---

### `user.login` *(Future)*

| | |
|---|---|
| **Publisher** | Identity Domain |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md` |
| **Trigger** | User login |

---

### `user.logout` *(Future)*

| | |
|---|---|
| **Publisher** | Identity Domain |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md` |
| **Trigger** | User logout |

---

### `rule.updated` *(Future)*

| | |
|---|---|
| **Publisher** | System Domain |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md` |
| **Trigger** | Business rule configuration changed |

---

### `config.changed` *(Future)*

| | |
|---|---|
| **Publisher** | System Domain |
| **Status** | FUTURE |
| **Source** | `DomainCatalog.md` |
| **Trigger** | System-wide configuration changed |

---

## Event Flow Diagram

```
                              Teaching Domain
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │  Feedback    │    │  Lesson Status   │    │  Attendance      │
  │  Submitted   │    │  Changes         │    │  Confirmed       │
  └──────┬───────┘    └────────┬─────────┘    └────────┬─────────┘
         │                     │                       │
         ▼                     ▼                       ▼
  lesson.feedback.      lesson.completed          attendance.
  created               (TEACHING→FINISHED)       confirmed
         │                     │                       │
         │               ┌─────┘                       │
         │               │  (review window)            │
         │               │                             │
         │               ▼                             │
         │          lesson.finished ◄──────────────────┘
         │          (FINISHED→ARCHIVED)      (guard: all confirmed)
         │               │
         │               ▼
         │        ┌──────────────┐
         │        │    Finance   │
         │        └──────┬───────┘
         │               │
         │     ┌─────────┼─────────┐
         │     ▼         ▼         ▼
         │ contract.  contract.  contract.
         │ deducted   expired    refunded
         │     │
         │     ▼
         │ contract.
         │ exhausted
         │
         ▼
    Dashboard
   (real-time stats)
```

---

## Event Ownership Rules (Rule 21)

1. **Every event has exactly one publisher domain.** No two domains emit the same event name.
2. **Every event follows `<domain>.<action>` naming.** Domain prefix always matches the publisher.
3. **Subscribers NEVER guess business state.** They listen for events, not poll or infer.
4. **New events must be registered here** before being implemented.
5. **Event payloads are immutable** for the lifetime of the major version. Add new fields only with version bump.

---

## Event-to-Aggregate Mapping

This section maps each event to the aggregate that emits it and the invariants it enforces.

### Teaching Context Events

| Event | Aggregate | State Transition | Invariant Enforced |
|-------|-----------|-----------------|-------------------|
| `lesson.completed` | Lesson (T4) | TEACHING → FINISHED | LESSON-001: All attendance recorded |
| `lesson.finished` | Lesson (T4) | FINISHED → ARCHIVED | LESSON-002: All attendance CONFIRMED/LOCKED. LESSON-003: Money can move |
| `attendance.confirmed` | Lesson (T4) | CHECKED_IN → CONFIRMED (all) | LESSON-002: Prerequisite for ARCHIVED |
| `lesson.feedback.created` | Lesson (T4) | (no state change) | Feedback recorded after lesson |
| `leave.submitted` | Lesson (T4) | (no state change) | Leave request recorded |
| `leave.approved` | Lesson (T4) | (no state change) | Leave approved, attendance adjusted |

**Key Rule:** Events from the Lesson Aggregate follow the two-phase pattern:
1. `lesson.completed` (TEACHING → FINISHED): No money moves. Safe state.
2. Review window (admin can correct attendance)
3. `lesson.finished` (FINISHED → ARCHIVED): Money moves. Final state.

### Finance Context Events

| Event | Aggregate | State Transition | Invariant Enforced |
|-------|-----------|-----------------|-------------------|
| `contract.exhausted` | Contract (T3) | ACTIVE → EXHAUSTED | CONTRACT-001: remainingLessons = 0 |
| `contract.expired` | Contract (T3) | ACTIVE → EXPIRED | Contract validity period ended |
| `contract.refunded` | Contract (T3) | ACTIVE → REFUNDED | Refund processed |
| `contract.deducted` | Contract (T3) | ACTIVE (no change) | CONTRACT-002: Only Finance modifies remainingLessons |
| `salary.calculated` | (Finance entity) | N/A | Salary batch computed |

**Key Rule:** Finance events react to `lesson.finished` from Teaching. Finance is the ONLY context that modifies `Contract.remainingLessons` (CONTRACT-002).

### Student Context Events

| Event | Aggregate | State Transition | Invariant Enforced |
|-------|-----------|-----------------|-------------------|
| `student.deactivated` | Student (S1) | ACTIVE → INACTIVE | STUDENT-003: Non-terminal transition |
| `student.status.changed` | Student (S1) | Any → Any | All status transitions emit this event |
| `student.created` | Student (S1) | (new entity) | STUDENT-001: StudentCode immutable |

### Identity Context Events

| Event | Aggregate | State Transition | Invariant Enforced |
|-------|-----------|-----------------|-------------------|
| `user.login` | User (I1) | (no state change) | Authentication recorded |
| `user.logout` | User (I1) | (no state change) | Session ended |

### Points Context Events

| Event | Aggregate | State Transition | Invariant Enforced |
|-------|-----------|-----------------|-------------------|
| `points.awarded` | (Points entity) | (balance increase) | Points balance non-negative |
| `points.redeemed` | (Points entity) | (balance decrease) | Sufficient balance required |
| `points.granted` | (Finance entity) | N/A | Points awarded to student |

---

## Event Flow by Aggregate

### Lesson Aggregate (T4) — Event Flow

```
Lesson Lifecycle:
  DRAFT → SCHEDULED → TEACHING → FINISHED → ARCHIVED
                                      │
                                      ├── lesson.completed (TEACHING → FINISHED)
                                      │   No money moves
                                      │
                                      ├── attendance.confirmed (all CONFIRMED/LOCKED)
                                      │   Prerequisite for ARCHIVED
                                      │
                                      └── lesson.finished (FINISHED → ARCHIVED)
                                          Money moves
                                          Finance reacts
```

### Contract Aggregate (T3) — Event Flow

```
Contract Lifecycle:
  ACTIVE → EXHAUSTED / EXPIRED / FROZEN / REFUNDED
      │
      ├── lesson.finished (from Teaching) triggers deduction
      │   └── contract.deducted (after each deduction)
      │
      ├── remainingLessons = 0 → contract.exhausted
      │
      ├── validTo passed → contract.expired
      │
      └── refund processed → contract.refunded
```

### Student Aggregate (S1) — Event Flow

```
Student Lifecycle:
  ACTIVE → PAUSED / GRADUATED / INACTIVE
      │
      ├── ACTIVE → INACTIVE → student.deactivated
      │
      └── Any transition → student.status.changed
```

---

## Cross-Context Event Dependencies

| Producer Context | Event | Consumer Context | Consumer Action | Dependency Type |
|-----------------|-------|-----------------|-----------------|-----------------|
| Teaching | `lesson.finished` | Finance | Deduct Contract | Critical (blocks financial settlement) |
| Teaching | `lesson.completed` | Dashboard | Update stats | Non-critical (async update) |
| Teaching | `attendance.confirmed` | Dashboard | Update stats | Non-critical (async update) |
| Finance | `contract.exhausted` | Teaching | Sync status | Non-critical (display only) |
| Finance | `contract.expired` | Teaching | Sync status | Non-critical (display only) |
| Finance | `contract.refunded` | Teaching | Sync status | Non-critical (display only) |
| Student | `student.deactivated` | Teaching | Review enrollments | Advisory (manual action) |
| Student | `student.status.changed` | Finance | Pause deductions | Advisory (manual action) |

**Critical Path:** Teaching → Finance (lesson.finished) is the only critical dependency. All other cross-context events are advisory or informational.

---

*This is a living document. Add new events here before implementing them. Never emit an event not listed in this catalog.*
