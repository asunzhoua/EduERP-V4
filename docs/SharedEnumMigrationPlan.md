# Shared Enum Migration Plan

> **Created**: 2026-07-14
> **Task**: Task-028 (Architecture Consistency Closure)
> **Authority**: ADR-007-SharedDomainEnum
> **Scope**: All enums across Teaching Domain, Student Domain, and future domains
> **Constraint**: Documentation only. No code changes in this task.

---

## 1. Purpose

This plan determines which TypeScript enums should be moved to a shared location (`src/common/enums/`) and which should remain in their domain modules. The decision criteria:

1. **Shared**: Enum is used by 2+ domain modules with identical values
2. **Keep**: Enum is used by only 1 domain module, or values diverge across domains

---

## 2. Immediate Sharing (Move to `common/enums/`)

### 2.1 Subject

| Property | Value |
|----------|-------|
| **Current locations** | `course/enums/subject.enum.ts` AND `contract/enums/subject.enum.ts` |
| **Values** | MATH, ENGLISH, CHINESE, PHYSICS, CHEMISTRY, ART, MUSIC, DANCE, SPORTS, CODING, OTHER (11 values) |
| **Identical?** | ✅ Yes — byte-for-byte identical |
| **Used by** | Course (subject of course), Contract (subject of lesson package) |
| **Risk if not shared** | Drift risk: adding a subject in one module but not the other leads to silent data corruption |
| **Migration** | Move to `common/enums/subject.enum.ts`. Re-export from `course/enums/` and `contract/enums/` for backward compatibility. |
| **Priority** | **Immediate** — already causing maintenance risk |

### 2.2 Gender

| Property | Value |
|----------|-------|
| **Current location** | `student/` domain (inside Student entity or student module) |
| **Values** | MALE, FEMALE |
| **Used by** | Student (student gender field) |
| **Will be needed by** | Teaching (student gender in class rosters, reports), Dashboard (gender-based analytics) |
| **Migration** | Move to `common/enums/gender.enum.ts`. Re-export from Student module. |
| **Priority** | **Immediate** — pre-move before Teaching Domain needs it in Sprint 4.1.5 (attendance reports may show student gender) |

---

## 3. Future Sharing (Keep in Domain for Now)

### 3.1 AttendanceStatus

| Property | Value |
|----------|-------|
| **Current location** | `lesson/enums/` (within Lesson module) |
| **Values** | NOT_STARTED, PRESENT, LATE, LEAVE_APPROVED, LEAVE_REJECTED, ABSENT, MAKEUP (7 values) |
| **Used by** | LessonAttendance (Teaching Domain) |
| **Future consumers** | Points Domain (award rules based on attendance), Finance Domain (deduction rules: PRESENT/LATE = charge, LEAVE_APPROVED = no charge) |
| **When to move** | When Points Domain or Finance Domain is implemented and needs to import the enum for type-safe comparisons |
| **Rationale for delay** | Moving now adds no benefit — Teaching Domain is the sole consumer. Move when the second consumer appears. |

### 3.2 ContractStatus

| Property | Value |
|----------|-------|
| **Current location** | `contract/enums/contract-status.enum.ts` |
| **Values** | ACTIVE, EXHAUSTED, EXPIRED, FROZEN, REFUNDED (5 values) |
| **Used by** | Contract (Teaching Domain) |
| **Future consumers** | Finance Domain (reads Contract.status to determine if deduction is allowed) |
| **When to move** | When Finance Domain is implemented |
| **Rationale for delay** | Finance Domain may only need a subset (ACTIVE, EXHAUSTED, REFUNDED). Premature sharing could force Finance to depend on Teaching-specific values. |

### 3.3 EnrollmentStatus

| Property | Value |
|----------|-------|
| **Current location** | `enrollment/enums/enrollment-status.enum.ts` |
| **Values** | ACTIVE, WITHDRAWN, COMPLETED (3 values) |
| **Used by** | Enrollment (Teaching Domain) |
| **Future consumers** | Finance Domain (reads Enrollment.status in deduction path: only ACTIVE enrollments are valid for deduction) |
| **When to move** | When Finance Domain is implemented |
| **Rationale for delay** | Finance only cares about "is it ACTIVE?" — a simple string comparison. Full enum import is not needed yet. |

---

## 4. Keep in Domain (Never Share)

### 4.1 CourseType

| Property | Value |
|----------|-------|
| **Current location** | `course/enums/` |
| **Values** | INDIVIDUAL, GROUP, TRIAL, CAMP |
| **Used by** | Course only |
| **Why keep** | Course-specific business concept. No other domain references course type. |

### 4.2 LessonStatus

| Property | Value |
|----------|-------|
| **Current location** | `lesson/enums/` |
| **Values** | DRAFT, SCHEDULED, TEACHING, FINISHED, ARCHIVED, CANCELLED |
| **Used by** | Lesson (Teaching Domain) |
| **Why keep** | Other domains receive lesson status via event payloads (strings), not via enum import. Finance Domain does not need to import the LessonStatus enum — it receives the `lesson.finished` event and processes it. |

### 4.3 TeacherRole

| Property | Value |
|----------|-------|
| **Current location** | `teaching/teacher-assignment/` (or inline) |
| **Values** | PRIMARY, SUBSTITUTE, ASSISTANT |
| **Used by** | TeacherAssignment only |
| **Why keep** | Teaching-specific concept. No other domain references teacher roles. |

### 4.4 ChangeRequestStatus

| Property | Value |
|----------|-------|
| **Current location** | `lesson/enums/` (or inline in LessonChangeRequest) |
| **Values** | PENDING, APPROVED, REJECTED |
| **Used by** | LessonChangeRequest only |
| **Why keep** | Teaching-specific workflow concept. |

### 4.5 ChangeRequestType

| Property | Value |
|----------|-------|
| **Current location** | `lesson/enums/` (or inline) |
| **Values** | RESCHEDULE, TEACHER_CHANGE, CANCEL, REOPEN |
| **Used by** | LessonChangeRequest only |
| **Why keep** | Teaching-specific workflow concept. |

---

## 5. Migration Execution Plan

### Phase 1: Immediate (Sprint 4.1.5 or next documentation Sprint)

| Step | Action | Files Affected |
|------|--------|---------------|
| 1 | Create `src/common/enums/subject.enum.ts` | New file |
| 2 | Create `src/common/enums/gender.enum.ts` | New file |
| 3 | Update `course/enums/subject.enum.ts` → re-export from common | 1 file |
| 4 | Update `contract/enums/subject.enum.ts` → re-export from common | 1 file |
| 5 | Update Student module → re-export Gender from common | 1 file |
| 6 | Run `npm run lint && npm run test` | — |
| 7 | Verify no import breaks | — |

**Total files touched**: 3 existing + 2 new = 5 files

### Phase 2: When Finance Domain is Implemented

| Step | Action | Trigger |
|------|--------|---------|
| 1 | Evaluate AttendanceStatus for sharing | Finance needs type-safe attendance comparison |
| 2 | Evaluate ContractStatus for sharing | Finance needs to check contract status |
| 3 | Evaluate EnrollmentStatus for sharing | Finance needs to check enrollment status |
| 4 | Move applicable enums to `common/enums/` | Per evaluation results |

### Phase 3: When Points Domain is Implemented

| Step | Action | Trigger |
|------|--------|---------|
| 1 | Evaluate AttendanceStatus for sharing | Points needs to map attendance to point awards |
| 2 | Move if needed | Per evaluation results |

---

## 6. Decision Log

| Enum | Decision | Reason | ADR |
|------|----------|--------|-----|
| Subject | **Immediate share** | Identical in 2 modules, drift risk | ADR-007 |
| Gender | **Immediate share** | Will be needed across domains | ADR-007 |
| AttendanceStatus | **Future share** | Single consumer now, multi-consumer when Finance/Points exist | — |
| ContractStatus | **Future share** | Single consumer now, Finance needs it later | — |
| EnrollmentStatus | **Future share** | Single consumer now, Finance needs it later | — |
| CourseType | **Never share** | Course-specific | — |
| LessonStatus | **Never share** | Event payloads, not enum imports | — |
| TeacherRole | **Never share** | Teaching-specific | — |
| ChangeRequestStatus | **Never share** | Teaching-specific | — |
| ChangeRequestType | **Never share** | Teaching-specific | — |

---

*This migration plan is part of Task-028 (Architecture Consistency Closure). Code changes are deferred to the Sprint that implements the migration (Phase 1 can be done in Sprint 4.1.5 as a low-risk housekeeping task).*
