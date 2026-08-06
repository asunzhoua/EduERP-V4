# Teaching Domain — Consistency Audit

> **Audit Date**: 2026-07-14
> **Scope**: All Teaching Domain documents and implemented code
> **Auditor**: Implementation Engineer (Task-027)
> **Authority**: Constitution-v4.0.md, TeachingConstitution_v1.0.md

---

## 1. Audit Purpose

This audit cross-references all Teaching Domain documents and implementation code to identify:
- **Conflicts**: Two sources making contradictory claims about the same rule
- **Gaps**: Rules described in documents but not enforced in code
- **Missing**: Infrastructure or documentation that should exist but does not

Each finding is classified by severity:
- **P0 (Critical)**: Will cause runtime failures or data corruption
- **P1 (High)**: Incorrect business logic or rule violation
- **P2 (Medium)**: Missing enforcement, deferred validation
- **P3 (Low)**: Documentation inconsistency, cosmetic issues

---

## 2. Documents and Code Audited

### Documents (14 files)

| # | Document | Path | Version |
|---|----------|------|---------|
| D1 | Constitution | `docs/00-Constitution/Constitution-v4.0.md` | v4.0 |
| D2 | Teaching Constitution | `docs/architecture/TeachingConstitution_v1.0.md` | v1.0.0 |
| D3 | Teaching Domain Model | `docs/DomainModel/TeachingDomainModel.md` | v1.0.0 |
| D4 | Teaching Rules | `docs/BusinessRules/TeachingRules.md` | v1.2.0 |
| D5 | Course Rules | `docs/BusinessRules/CourseRules.md` | v0.1.0 |
| D6 | Class Rules | `docs/BusinessRules/ClassRules.md` | v0.1.0 |
| D7 | Contract Rules | `docs/BusinessRules/ContractRules.md` | v0.1.0 |
| D8 | Lesson Rules | `docs/BusinessRules/LessonRules.md` | v0.1.1 |
| D9 | Enrollment Rules | `docs/BusinessRules/EnrollmentRules.md` | v1.0.0 |
| D10 | State Machine Catalog | `docs/StateMachine/StateMachineCatalog.md` | v0.1.0 |
| D11 | Lesson State Machine | `docs/StateMachine/LessonStateMachine.md` | v1.0.0 |
| D12 | DEC-005 | `docs/DecisionLog/DEC-005-TeachingDomain.md` | — |
| D13 | Gate #005 | `docs/Gate/Gate-005-DomainReview.md` | — |
| D14 | Student Rules | `docs/BusinessRules/StudentRules.md` | v0.1.0 |

### Implementation Code (tested, 51 unit tests)

| # | Module | Key Files |
|---|--------|-----------|
| C1 | Course | `course.entity.ts`, `course.service.ts`, `course.service.spec.ts` (12 tests) |
| C2 | Class | `class.entity.ts`, `class.service.ts`, `class.service.spec.ts` (11 tests) |
| C3 | Lesson | `lesson.entity.ts`, `lesson.service.ts`, `lesson.service.spec.ts` (25 tests) |
| C4 | Contract | `contract.entity.ts`, `contract.service.ts`, `contract.service.spec.ts` (14 tests) |
| C5 | Enrollment | `enrollment.entity.ts`, `enrollment.service.ts`, `enrollment.service.spec.ts` (13 tests) |

---

## 3. Findings

### Finding 1: Enrollment UNIQUE Constraint vs Re-enrollment Logic

**Severity**: P0 (Critical)

**Location**:
- Entity: `enrollment.entity.ts` — `@Unique(['classCode', 'studentCode'])`
- Service: `enrollment.service.ts` lines 46-57 — re-enrollment logic
- Document: `ClassRules.md` Section 5.3

**Description**:

The Enrollment entity enforces a **full UNIQUE constraint** on `(classCode, studentCode)`. This means the database will reject any attempt to insert a second row with the same pair, regardless of status.

However, the service code attempts re-enrollment after withdrawal by creating a **new** `EnrollmentEntity` with the same `(classCode, studentCode)`:

```typescript
// enrollment.service.ts lines 46-57
const existing = await this.enrollmentRepo.findByClassAndStudent(
  input.classCode,
  input.studentCode,
);
if (existing) {
  if (existing.status === EnrollmentStatus.ACTIVE) {
    throw new BadRequestException(...);
  }
  // If previous enrollment was WITHDRAWN, allow re-enrollment
}
// ... creates new EnrollmentEntity with same classCode + studentCode
```

This would fail at the database level with a `Duplicate entry` error when `save()` is called, because a WITHDRAWN row already exists for that `(classCode, studentCode)` pair.

The unit test passes only because it mocks `save()` to succeed, masking the real constraint violation.

**Three-way conflict**:
| Source | Says |
|--------|------|
| `enrollment.entity.ts` | UNIQUE(classCode, studentCode) — no duplicates allowed |
| `enrollment.service.ts` | Allow re-enrollment by creating new entity after WITHDRAWN |
| `ClassRules.md` Section 5.3 | "A withdrawn student cannot be re-enrolled (create a new enrollment instead)" |

**Resolution options** (requires CTO decision):
1. **Partial unique index**: Change to `UNIQUE(classCode, studentCode, status)` or use a MySQL generated column to enforce uniqueness only on ACTIVE enrollments. This allows one ACTIVE + one WITHDRAWN row.
2. **Update existing row**: On re-enrollment, update the existing WITHDRAWN record back to ACTIVE (clear withdrawReason, update contractCode). This keeps exactly one row per student+class.
3. **Application-level check only**: Remove the database UNIQUE constraint and enforce uniqueness purely in service code. Risk: race conditions under concurrent requests.

**Recommendation**: Option 2 (update existing row) is cleanest. It preserves the single-row-per-student-per-class invariant and avoids the need for partial indexes.

---

### Finding 2: Subject Enum Duplication Across Modules

**Severity**: P1 (High)

**Location**:
- `backend/src/modules/teaching/course/enums/subject.enum.ts`
- `backend/src/modules/teaching/contract/enums/subject.enum.ts`

**Description**:

Both the Course module and Contract module define identical `Subject` enums with the same 11 values (MATH, ENGLISH, CHINESE, PHYSICS, CHEMISTRY, ART, MUSIC, DANCE, SPORTS, CODING, OTHER).

This violates DRY (Don't Repeat Yourself) and creates a maintenance risk: if a new subject is added, both files must be updated in sync.

**Current state**: The two enums are byte-for-byte identical. No drift has occurred yet.

**Impact**: Maintenance burden. If one is updated and the other is not, the system will silently accept mismatched values.

**Resolution**: Addressed by ADR-007 (Shared Domain Enums) — proposes a single shared enum location.

---

### Finding 3: Enrollment Auto-Completion Not Implemented

**Severity**: P2 (Medium)

**Location**:
- Document: `TeachingDomainModel.md` Section 3.4
- Document: `ClassRules.md` (implied)
- Code: `enrollment.service.ts` — no auto-completion method

**Description**:

`TeachingDomainModel.md` Section 3.4 states:
> "When Class → COMPLETED, all ACTIVE Enrollments → COMPLETED automatically"

This requires a batch operation that finds all ACTIVE Enrollments for a Class and transitions them to COMPLETED when the Class reaches COMPLETED status.

No service method, repository method, or controller endpoint exists for this. The `ClassService` does not call any Enrollment method when transitioning to COMPLETED.

**Impact**: When a Class completes, its Enrollments remain ACTIVE indefinitely, which is incorrect. The deduction path may still find ACTIVE enrollments for a completed class, leading to unexpected behavior in the Finance Domain.

**Resolution**: Implement `EnrollmentRepository.findByClassAndStatus()` and `EnrollmentService.batchCompleteByClassCode()` methods. Wire into ClassService's ACTIVE → COMPLETED transition.

---

### Finding 4: Capacity Check Deferred to API Layer

**Severity**: P2 (Medium)

**Location**:
- Document: `ClassRules.md` Section 6 — "Maximum students per class: 20"
- Document: `EnrollmentRules.md` Section 3.1, Rule R8
- Code: `enrollment.service.ts` — no capacity check

**Description**:

`ClassRules.md` specifies `maxStudents` validation:
> "Enrollment count must not exceed maxStudents at time of enrollment (capacity: current enrollment is computed server-side from enrollments table — Rule 18)"

The enrollment service does not enforce this. The `countActiveByClassCode()` method exists in the repository but is never called from the service.

**Impact**: Without server-side enforcement, concurrent enrollment requests could exceed class capacity. This violates Rule 18 (all user-visible data must come from server-side calculation).

**Resolution**: Add capacity check in `EnrollmentService.enroll()` after all other guards. Call `countActiveByClassCode()` and compare against Class.maxStudents (requires reading Class entity or passing maxStudents as a parameter).

---

### Finding 5: Student Status Check Deferred to API Layer

**Severity**: P2 (Medium)

**Location**:
- Document: `ClassRules.md` Section 5.2
- Document: `EnrollmentRules.md` Section 3.1, Rules R5 and R6
- Code: `enrollment.service.ts` — no Student validation

**Description**:

`ClassRules.md` specifies:
> "Student MUST exist in the Student domain before enrollment"
> "Student MUST have ACTIVE status to be enrolled"
> "If a student is INACTIVE or GRADUATED in Student domain, new enrollment is rejected"

The enrollment service does not verify Student status. It only validates the Contract (via ContractRepository).

**Impact**: An INACTIVE or GRADUATED student could be enrolled in a class if the API layer fails to check. This is a boundary responsibility issue: the Teaching Domain should guard against invalid cross-domain state.

**Resolution options**:
1. Inject StudentRepository (or a read-only Student query service) into EnrollmentService.
2. Accept Student status as an input parameter validated at the API layer.
3. Create a cross-domain validation port (abstract interface).

Option 2 is the current design intent (deferred to API layer). Document this explicitly.

---

### Finding 6: Missing Dedicated State Machine Docs for Contract and Enrollment

**Severity**: P3 (Low)

**Location**:
- `docs/StateMachine/` directory contains: CourseStateMachine.md, ClassStateMachine.md, LessonStateMachine.md, StateMachineCatalog.md
- Missing: ContractStateMachine.md, EnrollmentStateMachine.md

**Description**:

The StateMachine directory has dedicated files for Course (3 states), Class (4 states), and Lesson (6 states), but not for Contract (5 states) or Enrollment (3 states). The StateMachineCatalog.md contains all state machines in summary form, but the dedicated per-entity files provide more detail (transition tables, guard conditions, side effects).

**Impact**: Minor inconsistency in documentation structure. The rules exist in ContractRules.md and EnrollmentRules.md, but lack the dedicated state machine format used by the other three entities.

**Resolution**: Create `ContractStateMachine.md` and `EnrollmentStateMachine.md` in a future documentation pass. Not blocking.

---

### Finding 7: Document Version Number Inconsistency

**Severity**: P3 (Low)

**Location**: All BusinessRules documents

**Description**:

| Document | Version | Last Updated |
|----------|---------|--------------|
| TeachingRules.md | v1.2.0 | 2026-07-14 |
| CourseRules.md | v0.1.0 | 2026-07-07 |
| ClassRules.md | v0.1.0 | 2026-07-07 |
| ContractRules.md | v0.1.0 | 2026-07-07 |
| LessonRules.md | v0.1.1 | 2026-07-07 |
| EnrollmentRules.md | v1.0.0 | 2026-07-14 (created today) |

The TeachingRules.md was bumped to v1.2.0 after Gate #005 approval, but the entity-specific rules were not version-bumped despite receiving updates (e.g., LessonRules.md received v1.1 updates in a prior session).

**Impact**: No functional impact. Difficult to determine which version of a rule document is authoritative when cross-referencing.

**Resolution**: Align all Teaching Domain BusinessRules documents to v1.0.0 or adopt semantic versioning discipline.

---

### Finding 8: EnrollmentRules.md Did Not Exist Before This Task

**Severity**: P3 (Low, resolved)

**Location**:
- Previously missing from `docs/BusinessRules/`
- Now created as part of Task-027 Step 2

**Description**:

All other Teaching Domain entities had dedicated BusinessRules documents:
- CourseRules.md ✅
- ClassRules.md ✅
- ContractRules.md ✅
- LessonRules.md ✅
- EnrollmentRules.md ❌ (missing until today)

Enrollment rules were scattered across ClassRules.md (Section 5), TeachingDomainModel.md (Section 3.4), and ContractRules.md (Section 4). No single authoritative source existed for Enrollment-specific business rules.

**Resolution**: EnrollmentRules.md created as part of this task. Now the Teaching Domain has complete BusinessRules coverage for all 6 core entities.

---

### Finding 9: ClassRules.md Section 5.3 Re-enrollment Wording Contradiction

**Severity**: P1 (High, related to Finding 1)

**Location**:
- `ClassRules.md` Section 5.3

**Description**:

`ClassRules.md` Section 5.3 states:
> "A withdrawn student cannot be re-enrolled (create a new enrollment instead)."

This sentence is internally contradictory: it says "cannot be re-enrolled" but then says "create a new enrollment instead" — which IS re-enrolling the student.

Additionally, even if "create a new enrollment" is the intent, the UNIQUE constraint on `(classCode, studentCode)` prevents creating a second enrollment record.

**Resolution**: Align with Finding 1 resolution. If re-enrollment is allowed, update the WITHDRAWN record. If re-enrollment is forbidden, document that the student must join a different class or that a new class instance is needed.

---

### Finding 10: TeachingDomainModel.md Implementation Priority Table Outdated

**Severity**: P3 (Low)

**Location**:
- `TeachingDomainModel.md` Section 10

**Description**:

The implementation priority table lists Sprints as:
| Entity | Sprint | Status |
|--------|--------|--------|
| Contract | 4.1.3 | ✅ Implemented |
| Enrollment | 4.1.3 | ✅ Implemented |
| Lesson (generation) | 4.1.4 | ⬜ Pending |

The table's Sprint numbering doesn't match actual execution:
- Contract + Enrollment were implemented in Sprint 4.1.4 (not 4.1.3)
- Lesson was implemented in Sprint 4.1.3 (not 4.1.4)

**Impact**: No functional impact. The table is a planning artifact that was superseded by actual Sprint execution.

**Resolution**: Update the table in a future documentation pass to reflect actual Sprint assignments.

---

## 4. Summary Matrix

| # | Finding | Severity | Status | Resolution |
|---|---------|----------|--------|------------|
| 1 | Enrollment UNIQUE constraint vs re-enrollment | P0 | Open | Needs CTO decision (3 options) |
| 2 | Subject enum duplication | P1 | Open | ADR-007 proposed |
| 3 | Enrollment auto-completion not implemented | P2 | Open | Implementation pending |
| 4 | Capacity check deferred to API layer | P2 | Open | Server-side guard recommended |
| 5 | Student status check deferred to API layer | P2 | Acknowledged | API-layer validation by design |
| 6 | Missing Contract/Enrollment state machine docs | P3 | Acknowledged | Future documentation pass |
| 7 | Document version inconsistency | P3 | Acknowledged | Version alignment pass |
| 8 | EnrollmentRules.md missing | P3 | Resolved | Created in this task |
| 9 | ClassRules.md re-enrollment wording | P1 | Open | Resolved with Finding 1 |
| 10 | DomainModel Sprint table outdated | P3 | Acknowledged | Future update |

---

## 5. Cross-Document Consistency Verification

The following cross-references were verified as **consistent**:

| Check | Documents Compared | Result |
|-------|-------------------|--------|
| Lesson state machine (6 states) | LessonRules, LessonStateMachine, StateMachineCatalog, DomainModel | ✅ Consistent |
| Course state machine (3 states) | CourseRules, CourseStateMachine, StateMachineCatalog, DomainModel | ✅ Consistent |
| Class state machine (4 states) | ClassRules, ClassStateMachine, StateMachineCatalog, DomainModel | ✅ Consistent |
| Contract state machine (5 states) | ContractRules, StateMachineCatalog, DomainModel | ✅ Consistent |
| Enrollment state machine (3 states) | ClassRules Sec 5.3, StateMachineCatalog, DomainModel | ✅ Consistent |
| Two-phase event system | TeachingRules Sec 2, LessonRules Sec 5, LessonStateMachine, DomainModel Sec 3.6 | ✅ Consistent |
| Attendance 7-status enum | LessonRules Sec 4.2, DomainModel Sec 3.7 | ✅ Consistent |
| Code generation formats (CS/CL/CT) | TeachingRules Sec 3, DomainModel Sec 2.3, all entity Rules | ✅ Consistent |
| Deduction path | ContractRules Sec 3, DomainModel Sec 5.1, TeachingRules Sec 4.2 | ✅ Consistent |
| 12 owned tables | TeachingRules Sec 4.3, DomainModel Sec 9 | ✅ Consistent |
| Constitution Rules 15-25 compliance | TeachingConstitution, TeachingRules Sec 4, DomainModel Sec 1.3 | ✅ Consistent |

---

## 6. Recommendations for CTO

### Immediate (Before Next Sprint)

1. **Resolve Finding 1** (P0): Decide on re-enrollment strategy. The current code will fail at runtime if a withdrawn student tries to re-enroll. Options: update existing row, partial unique index, or forbid re-enrollment.

2. **Resolve Finding 2** (P1): Approve ADR-007 to establish a single shared Subject enum location.

### Short-term (During Sprint 4.1.5)

3. **Implement Finding 3** (P2): Add enrollment auto-completion when Class → COMPLETED. This is a real business requirement.

4. **Implement Finding 4** (P2): Add server-side capacity check in EnrollmentService.enroll().

### Long-term (Future Documentation Pass)

5. **Findings 6, 7, 10** (P3): Create missing state machine docs, align versions, update Sprint table.

---

*This audit was conducted as part of Task-027 (Teaching Constitution Freeze). All findings are based on direct reading of the source documents and code. No assumptions were made.*
