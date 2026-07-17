# ADR-012: Context Separation Strategy

> **Status**: PROPOSED
> **Date**: 2026-07-15
> **Sprint**: 5 WP1
> **Supersedes**: (none — new decision)
> **Relates to**: ADR-011 (Domain Boundary), Constitution Rule 17 (Data Ownership), Rule 16 (Financial Trigger)

---

## Context

EduOS has 7 planned contexts. Some contexts have overlapping concerns:
1. **Teaching owns Contract** for lifecycle (create, freeze, unfreeze) but **Finance owns Contract** for financial operations (deduction, refund)
2. **Teaching owns Attendance** but **Finance reads Attendance** for deduction decisions
3. **Dashboard reads from all contexts** but owns no data

Without a formal separation strategy, developers may:
- Place financial logic in the Teaching context
- Place attendance logic in the Finance context
- Create circular dependencies between contexts

---

## Decision

**Adopt a three-layer separation strategy:**

### Layer 1: Data Ownership (Who Writes)

Each field has exactly one owning context. The owning context is the ONLY context that may write to that field.

| Field | Owner Context | Other Contexts |
|-------|--------------|----------------|
| `Course.name` | Teaching | — |
| `Class.status` | Teaching | — |
| `Contract.status` (ACTIVE/FROZEN) | Teaching | Finance (EXHAUSTED/EXPIRED/REFUNDED) |
| `Contract.remainingLessons` | **Finance only** | Teaching reads only |
| `Enrollment.status` | Teaching | — |
| `Lesson.status` | Teaching | — |
| `LessonAttendance.workflowState` | Teaching | — |
| `LessonAttendance.status` | Teaching | Finance reads for deduction |

**Critical Exception:** `Contract.remainingLessons` is written by Finance ONLY. Teaching may create and freeze/unfreeze Contracts but NEVER deduct lessons.

### Layer 2: Event Ownership (Who Emits)

Each event has exactly one publisher. The publisher is the ONLY context that may emit that event.

| Event | Publisher Context | Consumers |
|-------|------------------|-----------|
| `lesson.completed` | Teaching | Dashboard, Notification |
| `lesson.finished` | Teaching | Finance, Points, Notification, Dashboard |
| `attendance.confirmed` | Teaching | Dashboard, Points |
| `contract.exhausted` | Finance | Teaching, Dashboard |
| `contract.expired` | Finance | Teaching, Dashboard |
| `contract.refunded` | Finance | Teaching, Dashboard |
| `salary.calculated` | Finance | Notification, Dashboard |
| `student.deactivated` | Student | Teaching |
| `points.awarded` | Points | Dashboard, Notification |

### Layer 3: Query Ownership (Who Reads)

Reading another context's data is permitted through events. Direct database queries across contexts are prohibited.

**Allowed reads:**
- Finance reads Enrollment during `lesson.finished` processing (to find Contract)
- Dashboard reads all contexts for aggregation (via events)
- Teaching reads Student by studentCode (identity reference, not full entity)

**Prohibited reads:**
- Finance querying Teaching tables directly
- Dashboard querying any context's tables directly
- Notification querying Student tables directly

---

## Separation Enforcement

### Compile-Time Enforcement
- NestJS module imports are explicit. Teaching module cannot import Finance module.
- TypeScript import restrictions via ESLint rules.

### Runtime Enforcement
- EventBus validates event publisher identity
- Guard middleware checks module boundaries
- Audit interceptor logs all cross-context data access

### Code Review Enforcement
- Every PR that adds a new cross-context reference must be reviewed
- New events must be registered in EventCatalog before implementation
- New cross-context reads must be documented in ContextInteractionMatrix

---

## Consequences

### Positive
- Clear, three-layer separation model
- Prevents financial logic from leaking into Teaching context
- Prevents attendance logic from leaking into Finance context
- Aligns with Constitution Rules 16, 17, 21

### Negative
- Requires explicit documentation of every cross-context read
- Some reads (Finance reading Enrollment) feel like violations but are necessary

---

*This ADR defines the context separation strategy. All developers must comply. The three-layer model (Data Ownership, Event Ownership, Query Ownership) is the authoritative separation framework.*
