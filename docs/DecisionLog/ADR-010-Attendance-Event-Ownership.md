# ADR-010: Attendance Event Ownership

> **Status**: PROPOSED
> **Date**: 2026-07-14
> **Sprint**: 4.1.5
> **Authority**: [TeachingConstitution_v1.1.md](../architecture/TeachingConstitution_v1.1.md), [Constitution-v4.0.md](../00-Constitution/Constitution-v4.0.md)
> **Supersedes**: TeachingConstitution Section 11.1 (adds `attendance.confirmed` event)
> **Relates to**: ADR-009 (Enrollment Reactivation), Constitution Rule 16 (Financial Trigger), Constitution Rule 21 (Event Publishing)

---

## 1. Context

### 1.1 Current Event Model

The Teaching Domain currently emits two events:

| Event | Trigger | Money Moves? |
|-------|---------|-------------|
| `lesson.completed` | Lesson: TEACHING → FINISHED | No |
| `lesson.finished` | Lesson: FINISHED → ARCHIVED | Yes |

### 1.2 Problem

With the introduction of the Attendance Domain's two-dimensional state design (workflow state + status), a new requirement emerges:

1. **Attendance confirmation must precede financial processing.** Finance Domain should not process deductions until attendance data is confirmed by an admin.

2. **The current model has no event for attendance confirmation.** The only events are lesson-level. There is no mechanism for Dashboard or other consumers to know when attendance is finalized.

3. **The guard for `lesson.finished` needs a concrete signal.** Currently, the guard says "all attendance must be confirmed" but there is no event that signals this condition has been met.

### 1.3 CTO Directive

> "AttendanceConfirmed 触发 LessonFinished 再触发 Finance remainingLessons--。唯一。不能 Attendance 自己扣课。"

Translation: AttendanceConfirmed triggers LessonFinished, which triggers Finance to deduct. Only this path. Attendance must never deduct directly.

---

## 2. Decision

### 2.1 Introduce `attendance.confirmed` Event

Add a new event `attendance.confirmed` to the Teaching Domain event catalog:

| Property | Value |
|----------|-------|
| **Event Name** | `attendance.confirmed` |
| **Emitter** | Teaching Domain (Attendance subdomain) |
| **Trigger** | ALL LessonAttendance records for a Lesson reach CONFIRMED or LOCKED state |
| **Meaning** | Attendance data is finalized. Ready for financial processing. |
| **Money Moves?** | No |
| **Idempotency Key** | `lessonId` |

### 2.2 Updated Event Chain

```
Teaching Domain — Attendance Subdomain
  │
  │  ALL LessonAttendance.workflowState → CONFIRMED
  │
  ├──► emits: attendance.confirmed
        │
        ▼
  Dashboard Domain
    │
    ├──► Update real-time attendance stats

Teaching Domain — Lesson Subdomain
  │
  │  Guard: ALL attendance CONFIRMED or LOCKED (checked via attendance.confirmed)
  │  Lesson: FINISHED → ARCHIVED
  │
  ├──► emits: lesson.finished
        │
        ▼
  Finance Domain
    │
    ├──► FOR EACH attendance WHERE status ∈ {PRESENT, LATE, ONLINE, OFFLINE}:
    │     Contract.remainingLessons -= 1
    │
    └──► Audit: contract_audit_log
```

### 2.3 Updated Event Ownership Table

| Event | Emitter | Consumers | Trigger |
|-------|---------|-----------|---------|
| `attendance.confirmed` | **Teaching** | Dashboard | All attendance for lesson confirmed |
| `lesson.completed` | **Teaching** | Dashboard, Notification (future) | Lesson: TEACHING → FINISHED |
| `lesson.finished` | **Teaching** | Finance, Points (future), Notification, Dashboard | Lesson: FINISHED → ARCHIVED |
| `contract.exhausted` | **Finance** | Teaching, Dashboard | remainingLessons reaches 0 |
| `contract.expired` | **Finance** | Teaching, Dashboard | validTo date passed |
| `contract.refunded` | **Finance** | Teaching, Dashboard | Refund processed |
| `student.deactivated` | **Student** | Teaching | Student: ACTIVE → INACTIVE |

### 2.4 Updated Event Safety Constraints

| Constraint | Rule | Enforcement |
|------------|------|-------------|
| `attendance.confirmed` MUST precede `lesson.finished` | Constitution Rule 16 | LessonService.archive() checks all attendance is CONFIRMED/LOCKED before allowing FINISHED → ARCHIVED. |
| `lesson.completed` MUST precede `lesson.finished` | Constitution Rule 16 | Sequential by design: FINISHED emits lesson.completed, ARCHIVED emits lesson.finished. |
| No direct financial operations | Constitution Rule 16 | Finance ONLY reacts to `lesson.finished`. Never reacts to `attendance.confirmed` or `lesson.completed`. |
| All listeners idempotent | Architecture requirement | Event payload includes `lessonId`. Consumers use `lessonId` as idempotency key. |

---

## 3. Arguments

### 3.1 Why a Separate Event?

**Alternative A: No `attendance.confirmed` event. Guard only.**

Guard `lesson.finished` emission by checking attendance status in the service layer. No new event.

| Pros | Cons |
|------|------|
| Simpler — fewer events | Dashboard cannot track attendance confirmation in real-time |
| | No signal for Points Domain to award attendance points |
| | Guard is implicit (code check), not explicit (event) |

**Alternative B: Include confirmation data in `lesson.completed` payload.**

Extend `lesson.completed` event payload to include attendance confirmation status.

| Pros | Cons |
|------|------|
| No new event | `lesson.completed` is emitted before attendance is confirmed (TEACHING → FINISHED) |
| | Temporal mismatch: event says "completed" but data isn't confirmed yet |
| | Violates the principle that events represent factual state changes |

**Alternative C (CHOSEN): New `attendance.confirmed` event.**

| Pros | Cons |
|------|------|
| Clean separation of concerns | One more event to manage |
| Dashboard gets real-time attendance confirmation signal | |
| Points Domain can use it for attendance-based awards | |
| Explicit, auditable signal that attendance is finalized | |
| Natural prerequisite check for `lesson.finished` | |

### 3.2 Why Not Let Attendance Trigger Deduction?

The CTO explicitly stated: "不能 Attendance 自己扣课" (Attendance must not deduct directly).

Reasons:
1. **Review Window**: Attendance data needs admin review before financial processing. Direct deduction would skip this safety step.
2. **Constitution Rule 16**: Only `lesson.finished` triggers money moves. Attendance confirmation is an intermediate step.
3. **Single Trigger Path**: Having one money trigger path (lesson.finished → Finance) is simpler to audit and debug than multiple trigger points.
4. **Reversibility**: If attendance is wrong, it can be corrected during the review window. If deduction already happened, reversal is complex.

---

## 4. Consequences

### 4.1 Positive

1. **Clean event chain**: `attendance.confirmed` → `lesson.finished` → Finance deduction. Each step is explicit and auditable.
2. **Dashboard benefit**: Real-time tracking of attendance confirmation without polling.
3. **Points Domain ready**: When Points Domain is implemented, it can use `attendance.confirmed` for attendance-based point awards.
4. **Guard enforcement**: The `lesson.finished` emission has a concrete prerequisite signal.

### 4.2 Negative

1. **Additional event to implement**: One more event emitter in the Attendance service.
2. **Slightly more complex flow**: Three events instead of two. But the complexity is justified by the governance requirements.

### 4.3 Migration

No migration needed. This is a new event added to the Teaching Domain's event catalog. Existing events (`lesson.completed`, `lesson.finished`) are unchanged.

---

## 5. Implementation Notes

### 5.1 Event Emission Logic

```typescript
// In AttendanceService.confirmAll()
async confirmAll(lessonId: number): Promise<void> {
  // 1. Update all CHECKED_IN records to CONFIRMED
  await this.attendanceRepository.confirmAllByLessonId(lessonId);
  
  // 2. Check if ALL records are now CONFIRMED or LOCKED
  const pendingCount = await this.attendanceRepository.countPendingByLessonId(lessonId);
  
  // 3. If all confirmed, emit event
  if (pendingCount === 0) {
    this.eventEmitter.emit('attendance.confirmed', { lessonId });
  }
}
```

### 5.2 Guard in Lesson Archive

```typescript
// In LessonService.archive()
async archive(lessonId: number): Promise<void> {
  // 1. Guard: all attendance must be confirmed
  const pendingCount = await this.attendanceService.countPendingByLessonId(lessonId);
  if (pendingCount > 0) {
    throw new BadRequestException(
      'All attendance must be confirmed before archiving lesson'
    );
  }
  
  // 2. Archive lesson
  await this.lessonRepository.archive(lessonId);
  
  // 3. Emit lesson.finished
  this.eventEmitter.emit('lesson.finished', { lessonId });
}
```

---

## 6. Decision Log

| Item | Decision | Reason |
|------|----------|--------|
| New event name | `attendance.confirmed` | Clear, descriptive, follows naming convention |
| Emitter | Teaching Domain (Attendance subdomain) | Attendance data is Teaching-owned |
| Trigger condition | ALL records CONFIRMED or LOCKED | Partial confirmation is not enough |
| Relationship to lesson.finished | Prerequisite (guard) | lesson.finished MUST NOT emit before attendance.confirmed |
| Financial implication | None | attendance.confirmed does NOT trigger deduction |

---

*This ADR is part of Sprint 4.1.5 (Attendance Domain + LessonChangeRequest Skeleton). It updates the Teaching Domain's event catalog. Changes to this ADR require a Change Request per Constitution Rule 7 and Rule 25.*
