# ADR-009: Enrollment Reactivation

> **Status**: ACCEPTED
> **Date**: 2026-07-14
> **Deciders**: CTO (formal decision)
> **Supersedes**: Task-027 Finding 1 (P0), ClassRules.md Section 5.3
> **Related**: ADR-007, ADR-008, TeachingConsistencyAudit.md

---

## Context

Task-027 identified a **P0 Critical conflict** (Finding 1): the Enrollment entity's UNIQUE constraint on `(classCode, studentCode)` prevents creating a second row for the same student-class pair. But the enrollment service attempted re-enrollment by INSERTing a new record, which would fail at the database level.

Three resolution options were proposed:

1. **Partial unique index** — allow one ACTIVE + one WITHDRAWN row
2. **Reactivation** — update existing WITHDRAWN record back to ACTIVE
3. **Application-level check only** — remove DB constraint

The CTO has formally decided: **Option 2 — Reactivation**.

---

## Why NOT INSERT New Enrollment

### Argument 1: Domain Identity

An Enrollment represents a **fact**: "Student X is enrolled in Class Y." This fact does not change when the student withdraws and returns. The identity of the enrollment is the `(classCode, studentCode)` pair.

If a student withdraws from "Saturday 10am class" and later re-enrolls in the same class, the system should record that this is the **same enrollment relationship**, not a brand new one. The enrollment has a history: it was ACTIVE, then WITHDRAWN, then reactivated to ACTIVE.

INSERTing a new record would create the illusion of two separate enrollment events, losing the continuity of the relationship.

### Argument 2: Audit Completeness

With the Reactivation model, the enrollment record carries its full history in a single row:

```
Enrollment (classCode=CL001, studentCode=ST001):
  - enrolledAt: 2026-07-01
  - status: ACTIVE
  - (admin withdraws)
  - status: WITHDRAWN
  - withdrawReason: "暑假回老家"
  - (student returns, admin reactivates)
  - status: ACTIVE
  - contractCode: CT2026070002  (new contract)
```

The complete lifecycle is visible on one record. The `enrolledAt` timestamp preserves the original enrollment date. The `withdrawReason` preserves why the student left. The new `contractCode` on reactivation records the updated funding source.

With INSERT, history is fragmented across multiple rows. The `enrolledAt` on the second record would show a later date, losing the original enrollment timing.

### Argument 3: Data Consistency

The UNIQUE constraint on `(classCode, studentCode)` is an **invariant**: at any point in time, there is exactly ONE enrollment relationship between a student and a class. The status may change (ACTIVE, WITHDRAWN, COMPLETED), but the relationship itself is singular.

INSERT violates this invariant by allowing multiple rows for the same pair. Even with a partial unique index (Option 1), the database would contain multiple rows, creating ambiguity about which is the "current" enrollment.

Reactivation preserves the invariant: one row, one relationship, multiple status transitions over time.

### Argument 4: UNIQUE Constraint Harmony

The existing UNIQUE constraint on `(classCode, studentCode)` is the **correct** constraint. It enforces the business rule at the database level without relying on application logic.

INSERT requires either:
- Removing the constraint (weakens data integrity)
- Using a partial unique index (adds complexity, MySQL limitations)

Reactivation works **with** the existing constraint, not against it. No schema changes needed.

### Argument 5: Historical Records

The CTO has ruled that historical operations should be recorded through `EnrollmentHistory` (or audit logs), not through multiple Enrollment rows. This is consistent with the Constitution's Document First principle (Rule 3): every status change is a new audit entry, not a new entity.

```
enrollment_audit_log:
  - {action: ENROLL, newStatus: ACTIVE, contractCode: CT001}
  - {action: WITHDRAW, oldStatus: ACTIVE, newStatus: WITHDRAWN, reason: "暑假回老家"}
  - {action: REACTIVATE, oldStatus: WITHDRAWN, newStatus: ACTIVE, contractCode: CT002}
```

The audit log provides the full history. The Enrollment entity provides the current state.

---

## Decision

**Adopt the Reactivation model for Enrollment re-enrollment.**

### Formal Rules

1. **One row per student-class pair.** The UNIQUE constraint on `(classCode, studentCode)` is permanent and non-negotiable.

2. **Re-enrollment = Reactivation.** When a WITHDRAWN student re-enrolls in the same class:
   - Do NOT INSERT a new record
   - UPDATE the existing WITHDRAWN record: set `status = ACTIVE`, clear `withdrawReason`, update `contractCode` (if changed)

3. **Re-enrollment requires a new Contract.** The reactivation updates `contractCode` to the new Contract that funds the re-enrollment. The old Contract's financial history is unaffected.

4. **Re-enrollment is a distinct operation from initial enrollment.** The service layer distinguishes:
   - `enroll()` with no existing record → INSERT (initial enrollment)
   - `enroll()` with existing WITHDRAWN record → UPDATE (reactivation)
   - `enroll()` with existing ACTIVE record → REJECT (duplicate)

5. **Reactivation is audited.** Every reactivation creates an audit log entry with:
   - `action: REACTIVATE`
   - `oldStatus: WITHDRAWN`
   - `newStatus: ACTIVE`
   - `oldContractCode` (previous Contract)
   - `newContractCode` (new Contract)
   - `reason` (optional, for admin context)

6. **COMPLETED is terminal.** A COMPLETED enrollment cannot be reactivated. If a student needs to rejoin a completed class, a new class instance must be created (Class → CANCELLED → ACTIVE or new Class).

### State Machine (Updated)

```
                    ┌──────────┐
                    │  ACTIVE  │◄───┐
                    └────┬─────┘    │
                         │          │
              ┌──────────┴───┐      │ Reactivation
              ▼              ▼      │ (WITHDRAWN → ACTIVE)
       ┌──────────┐   ┌──────────┐  │
       │WITHDRAWN │───┘          │  │
       └──────────┘   │COMPLETED │  │
                      └──────────┘  │

ACTIVE → WITHDRAWN:  Admin withdraws student (reason required)
ACTIVE → COMPLETED:  Auto when Class → COMPLETED (terminal)
WITHDRAWN → ACTIVE:  Reactivation (new Contract required)
COMPLETED: Terminal (no transitions)
```

---

## Consequences

### Positive

- **Single source of truth**: One row per student-class pair, full lifecycle visible
- **Database constraint preserved**: No schema changes needed
- **Audit trail via logs**: Consistent with Document First principle
- **Financial clarity**: Each enrollment has exactly one active Contract at any time
- **Simpler queries**: "Find all active enrollments" = `WHERE status = 'ACTIVE'` (no multi-row disambiguation)

### Negative

- **Service complexity**: `enroll()` must handle two code paths (INSERT vs UPDATE) depending on existing record state
- **Contract update on reactivation**: Must carefully update `contractCode` and ensure the old Contract's deduction history is not affected
- **No "re-enrollment count"**: With INSERT, you could count enrollment attempts. With Reactivation, the count lives in audit logs only (acceptable — audit logs are the correct location per Rule 3)

### Migration Plan

| Phase | Action | Risk |
|-------|--------|------|
| 1 | Create ADR-009 (this document) | None — documentation only |
| 2 | Update EnrollmentRules.md — add Domain Invariants, update state machine | None — documentation only |
| 3 | Update TeachingConstitution_v1.0.md — add Single Writer Principle chapter | None — documentation only |
| 4 | Update enrollment.service.ts — replace INSERT-on-reactivation with UPDATE | **Medium** — requires careful testing |
| 5 | Update enrollment.service.spec.ts — update re-enrollment test to verify UPDATE behavior | **Low** — test changes |
| 6 | Run full test suite, verify no regressions | Validation |

**Phase 4 is the only code change and belongs to a future Sprint (not this task).** Task-028 is documentation only.

---

## Compliance

| Constitution Rule | How Reactivation Complies |
|-------------------|--------------------------|
| Rule 3 (Document First) | Every status change recorded in audit log, not as new entity |
| Rule 17 (Data Ownership) | Teaching Domain owns the enrollment UPDATE operation |
| Rule 22 (Unidirectional States) | WITHDRAWN → ACTIVE is a controlled reverse transition (requires admin action + audit) |
| Rule 20 (Every Money → Lesson) | Reactivation does not affect financial records; deduction path unchanged |

---

*This ADR resolves Task-027 Finding 1 (P0) and supersedes the conflicting guidance in ClassRules.md Section 5.3. The Reactivation model is now the authoritative architecture for Enrollment re-enrollment.*
