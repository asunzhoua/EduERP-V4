# Decision Log: DEC-005 — Teaching Domain Deep Modeling

> **Task**: Task-EduOS-005
> **Date**: 2026-07-14
> **Status**: ACCEPTED
> **Gate**: #005 (Domain Review)

---

## Context

Sprint 4.0 completed the Teaching Domain skeleton (61 files, 5 sub-modules, ~40 API endpoints, all HTTP 501). Before writing any business logic, the Architect mandated a deep domain modeling phase (Task-EduOS-005) to freeze the Teaching Domain model at a level of precision that eliminates ambiguity.

This decision log captures the key architectural decisions made during the modeling phase.

---

## DEC-005-01: Course Is Pure Knowledge Product

**Decision:** Course has NO pricing, NO scheduling, NO teacher assignment.

**Rationale:**
- In real training institutions, a "course" (课程) is a catalog entry — "少儿英语一级, 40 lessons, 60 min each"
- Pricing varies by Contract (bulk discounts, promotions, different time periods)
- Scheduling varies by Class (Saturday 10am, Tuesday 2pm)
- Teacher varies by Class assignment

**Alternatives considered:**
- Price on Course: rejected. Different parents pay different prices for the same course (early bird, sibling discount, promotion). Price belongs to the Contract.
- Schedule on Course: rejected. Same course offered at multiple times. Schedule belongs to Class.

**Impact:** Clean separation of concerns. Course is stable. Class and Contract are dynamic.

---

## DEC-005-02: Contract Is the Financial Unit

**Decision:** Contract, not Enrollment, is the entity that tracks remaining lessons and connects to financial operations.

**Rationale:**
- A parent buys "20 math lessons" — that is a Contract
- The student enrolls in "Saturday 10am class" — that is an Enrollment
- If the student changes classes mid-term, the Contract stays, only the Enrollment changes
- Without Contract, the system cannot answer: "How many lessons does this student have left?"

**Old model (v1.0):** Student → Enrollment → Class (lessons deducted from Enrollment)
**New model (v1.1):** Student → Contract → Enrollment → Class (lessons deducted from Contract)

**Impact:** Financial operations (deduction, refund, expiry) operate on Contract. Teaching operations (schedule, attendance) operate on Class/Lesson. Clean boundary.

---

## DEC-005-03: Schedule Embedded in Class

**Decision:** The recurring schedule (dayOfWeek, startTime, endTime) is stored directly on the Class entity, not in a separate Schedule table.

**Rationale:**
- For v1.0, each Class has exactly one schedule pattern
- A separate Schedule table adds complexity without benefit at this stage
- The dayOfWeek/startTime/endTime fields on Class are sufficient for lesson generation
- When multi-schedule-per-class or exception-day support is needed (v2.0), a Schedule table can be introduced

**Alternatives considered:**
- Separate Schedule table: more flexible but adds JOIN complexity and DTO overhead for v1.0
- Calendar-based scheduling: too complex for the initial version

**Impact:** Simpler implementation. Schedule is frozen on Class activation. Future-proof via planned migration path.

---

## DEC-005-04: Two-Phase Events for Financial Safety

**Decision:** Teaching completion (lesson.completed) and financial settlement (lesson.finished) are separate events with a review window between them.

**Rationale:**
- In reality, a teacher clicking "complete lesson" should NOT immediately deduct money
- Parents may call to correct attendance after the lesson
- Admin may need to adjust "Late" to "Leave Approved"
- The review window (default 24h) provides a safety buffer
- Auto-approval on timeout prevents workflow bottlenecks

**Event semantics:**
- lesson.completed = "Teaching is done, data is provisional"
- lesson.finished = "Data is confirmed, money can move"

**Impact:** No accidental financial operations. Full correction capability before money moves. Finance domain only reacts to lesson.finished, never lesson.completed.

---

## DEC-005-05: Lesson Is the Atomic Business Unit

**Decision:** Lesson, not Class, is the smallest unit of business operations. All financial records, attendance, salary, points, and notifications trace to a specific lessonId.

**Rationale:**
- Constitution Rule 19: Lesson is the only business timeline
- Constitution Rule 20: Every money must have a lesson
- A Class can span months with 20+ lessons — operations must be per-lesson
- Salary is per-lesson, deduction is per-lesson, points are per-lesson

**Impact:** Every financial record in the system includes a lessonId. Full traceability. Audit trail is lesson-centric.

---

## DEC-005-06: ChangeRequest Over Direct Edit

**Decision:** All lesson modifications (reschedule, teacher change, cancel, reopen) go through a LessonChangeRequest entity. Direct field edits are forbidden.

**Rationale:**
- Constitution Rule 3 (Document First): all modifications are new business documents
- Ensures every change has a reason, an approver, and an audit trail
- Enables rollback and conflict detection
- Prevents "silent" changes that are hard to trace

**Alternatives considered:**
- Direct edit with audit log: simpler but loses the before/after snapshot and approval workflow
- Approval workflow for all changes: good, but overkill for minor changes (time-only same-day adjustments exempted)

**Impact:** Slightly more complex lesson modification flow, but significantly better audit trail and safety.

---

## DEC-005-07: Batch Lesson Generation

**Decision:** All lessons for a Class are generated in one batch when Class → ACTIVE, not one-by-one via a daily cron job.

**Rationale:**
- Simpler implementation (single transaction vs. daily cron)
- All lessons are visible to teachers and admins from day one
- No risk of cron failures causing missing lessons
- Trade-off: if schedule changes mid-term, future lessons must be regenerated

**Impact:** Lesson generation is a single operation. Schedule changes require manual regeneration of future lessons.

---

## DEC-005-08: Enrollment Carries Contract Reference

**Decision:** The Enrollment entity includes a `contractCode` field, creating an explicit link between enrollment and financial source.

**Rationale:**
- Without this link, the system cannot determine which Contract to deduct from
- One Contract can fund multiple Enrollments (concurrent classes)
- When a lesson finishes, the deduction path is: Lesson → Enrollment → Contract
- This is the bridge between Teaching operations and Financial tracking

**Impact:** Clear, deterministic deduction path. No ambiguity about which Contract is charged.

---

## Document Decisions

| Document | Key Decision |
|----------|-------------|
| TeachingDomainModel.md | Central source of truth for all Teaching Domain entities and relationships |
| CourseStateMachine.md | 3 states (DRAFT/PUBLISHED/ARCHIVED). ARCHIVED is not terminal. |
| ClassStateMachine.md | 4 states. Activation requires teacher + schedule. Batch lesson generation on activation. |
| LessonStateMachine.md | 6 states. Two-phase events. FINISHED is safe state (no money). ARCHIVED is terminal. |
| TeachingRules.md v1.2 | Updated to reference DomainModel as authoritative source |

---

*This decision log is part of the Task-EduOS-005 deliverables. All decisions are final pending Gate #005 approval. Changes require a Change Request (CR) per Constitution Rule 7 and Rule 25.*
