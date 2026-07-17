# Repository Consolidation Report

> Sprint 4.4 — Phase 1: Repository Truth Consolidation
> Generated: 2026-07-15

---

## Summary

| Action | Count |
|--------|-------|
| Identical enums consolidated | 5 |
| Divergent enums resolved | 2 |
| Dead code removed | 1 |
| Import path updates | 42 |
| Old enum files deleted | 13 |
| Tests passing | 223 (149 backend + 74 governance) |

---

## Identical Enum Consolidation (5)

All moved to `common/enums/` as single source of truth.

| Enum | Old Locations | Canonical |
|------|--------------|-----------|
| Subject | course + contract | `common/enums/subject.enum.ts` |
| TeacherRole | class + teacher-assignment | `common/enums/teacher-role.enum.ts` |
| ChangeRequestType | lesson + lesson-change-request | `common/enums/change-request-type.enum.ts` |
| EnrollmentStatus | class + enrollment | `common/enums/enrollment-status.enum.ts` |
| CreatedSource | student + course | `common/enums/created-source.enum.ts` |

---

## Divergent Enum Resolution (2)

### AuditAction

**Before:** student (5 values: CREATE, UPDATE, STATUS_CHANGE, DELETE, MERGE) vs course (4 values: missing MERGE)

**After:** Unified to `common/enums/audit-action.enum.ts` with superset (5 values). MERGE added to canonical version.

**Risk:** LOW — course module never used MERGE, adding it is additive and non-breaking.

### AttendanceStatus

**Before:** lesson (7 values: NOT_STARTED, PRESENT, LATE, LEAVE_APPROVED, LEAVE_REJECTED, ABSENT, MAKEUP) vs lesson-attendance (7 values: PRESENT, ABSENT, LATE, LEAVE, MAKEUP, ONLINE, OFFLINE) — completely incompatible value sets.

**After:** lesson module's version was **dead code** (exported via interfaces/index.ts but never imported anywhere). Deleted. lesson-attendance version retained as the sole canonical source.

**Risk:** NONE — dead code deletion. No runtime impact.

---

## Dead Code Removed

| File | Reason |
|------|--------|
| `teaching/lesson/enums/attendance-status.enum.ts` | Never imported by any code. Exported via interfaces but unused. |
| `teaching/lesson/interfaces/index.ts` — AttendanceStatus export | Removed stale export line. |

---

## Import Path Migration

All 42 imports across 34 files updated from module-local paths to `@common/enums/...` path alias, consistent with existing codebase convention (`@common/*`, `@events/*`, `@modules/*`).

---

## Files Deleted (13)

1. `teaching/course/enums/subject.enum.ts`
2. `teaching/contract/enums/subject.enum.ts`
3. `teaching/class/enums/teacher-role.enum.ts`
4. `teaching/teacher-assignment/enums/teacher-role.enum.ts`
5. `teaching/lesson/enums/change-request-type.enum.ts`
6. `teaching/lesson-change-request/enums/change-request-type.enum.ts`
7. `teaching/class/enums/enrollment-status.enum.ts`
8. `teaching/enrollment/enums/enrollment-status.enum.ts`
9. `student/enums/created-source.enum.ts`
10. `teaching/course/enums/created-source.enum.ts`
11. `student/enums/audit-action.enum.ts`
12. `teaching/course/enums/audit-action.enum.ts`
13. `teaching/lesson/enums/attendance-status.enum.ts`

---

## Remaining Enum Files (Non-Duplicated)

| File | Domain |
|------|--------|
| `student/enums/gender.enum.ts` | Student (unique) |
| `student/enums/parent-relation.enum.ts` | Student (unique) |
| `student/enums/student-status.enum.ts` | Student (unique) |
| `teaching/class/enums/class-status.enum.ts` | Teaching (unique) |
| `teaching/contract/enums/contract-status.enum.ts` | Teaching (unique) |
| `teaching/course/enums/course-status.enum.ts` | Teaching (unique) |
| `teaching/course/enums/course-type.enum.ts` | Teaching (unique) |
| `teaching/lesson/enums/lesson-status.enum.ts` | Teaching (unique) |
| `teaching/lesson-attendance/enums/attendance-status.enum.ts` | Teaching (unique, canonical) |
| `teaching/lesson-attendance/enums/attendance-source.enum.ts` | Teaching (unique) |
| `teaching/lesson-attendance/enums/attendance-workflow-state.enum.ts` | Teaching (unique) |
| `teaching/lesson-change-request/enums/change-request-status.enum.ts` | Teaching (unique) |
| `common/enums/subject.enum.ts` | Shared (canonical) |
| `common/enums/teacher-role.enum.ts` | Shared (canonical) |
| `common/enums/change-request-type.enum.ts` | Shared (canonical) |
| `common/enums/enrollment-status.enum.ts` | Shared (canonical) |
| `common/enums/created-source.enum.ts` | Shared (canonical) |
| `common/enums/audit-action.enum.ts` | Shared (canonical) |

**Total enum files: 18 (was 25, reduced by 7 duplicates)**

---

## Verification

- [x] TypeScript compilation: 0 new errors (1 pre-existing in course.service.spec.ts)
- [x] Backend tests: 149/149 passing
- [x] Governance tests: 74/74 passing
- [x] Zero references to deleted enum paths
- [x] All imports resolve to `@common/enums/...`
