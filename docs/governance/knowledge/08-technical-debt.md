# Technical Debt Inventory

> Updated by Engineering Loop — Sprint 4.7
> Last Updated: 2026-07-15

---

## Debt Summary

| Category | Items | Severity |
|----------|-------|----------|
| ~~Duplicate Enums~~ | ~~7~~ 0 (RESOLVED) | ~~HIGH~~ |
| Missing Test Coverage | 1 | MEDIUM |
| TODO/FIXME Markers | 1 | LOW |
| Empty Common Module Directories | 4 | LOW |
| Governance Findings | 3 | MEDIUM |
| Documentation Gaps | 3 | LOW |
| Entity Audit Field Inconsistency | 6 | LOW |
| **Total Active** | **18** | |

---

## ~~HIGH: Duplicate Enum Definitions~~ — RESOLVED

All 7 duplicate enum definitions identified in Sprint 4.3 have been consolidated into `common/enums/`:

| Enum | Status | Canonical Location |
|------|--------|-------------------|
| Subject | RESOLVED | `common/enums/subject.enum.ts` |
| TeacherRole | RESOLVED | `common/enums/teacher-role.enum.ts` |
| ChangeRequestType | RESOLVED | `common/enums/change-request-type.enum.ts` |
| EnrollmentStatus | RESOLVED | `common/enums/enrollment-status.enum.ts` |
| CreatedSource | RESOLVED | `common/enums/created-source.enum.ts` |
| AuditAction | RESOLVED | `common/enums/audit-action.enum.ts` (all 5 values) |
| AttendanceStatus | RESOLVED | Single canonical in `lesson-attendance/enums/` |

---

## MEDIUM: Missing Test Coverage

| Service | Has Spec | Risk |
|---------|----------|------|
| EventBusService | No | Medium — infrastructure component |

**Note**: TeacherAssignmentService, StudentService, and AuthService specs were added in Sprint 4.6.

---

## LOW: TODO/FIXME Markers

| File | Line | Marker | Description |
|------|------|--------|-------------|
| course.controller.ts | 37 | TODO | `replace hardcoded 1 with JWT-decoded userId from Guards` |

---

## LOW: Empty Common Module Directories

| Directory | Status |
|-----------|--------|
| common/constants/ | .gitkeep only |
| common/exceptions/ | .gitkeep only |
| common/interfaces/ | .gitkeep only |
| utils/helper/ | .gitkeep only |
| utils/validator/ | .gitkeep only |

**Note**: `common/enums/` was populated with 6 consolidated enum files (Sprint 4.4).

---

## MEDIUM: Governance Findings

| Finding | Source | Impact |
|---------|--------|--------|
| WP2.2: 5 DESIGNED events lack code classes | Event Validation | Catalog-code gap (by design — future events) |
| WP2.3: Schema attendance field not in event class | Event Validation | Schema-code gap |
| WP3.2-3.6: Catalog/code transition differences | State Machine | Catalog accuracy |

---

## LOW: Documentation Gaps

| Gap | Details |
|-----|---------|
| No API changelog | release/ directory has versions but no migration guides |
| No database migrations | No migration files found in repository |
| No deployment docs in code | DeployGuide.md exists but not verified current |

---

## LOW: Entity Audit Field Inconsistency

6 of 8 Teaching Domain entities are missing standard audit fields (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`). Only Course and Class have them. This is a known inconsistency that requires a database migration to resolve.

**Affected entities**: Contract, Enrollment, Lesson, LessonAttendance, LessonChangeRequest, TeacherAssignment

**Resolution**: Deferred to Sprint 5 (database migration required).

---

## Debt Priority Matrix

```
High Impact
  │
  │  [EventBusService spec]
  │  [TODO: hardcoded userId]
  │
  │  [Empty common/ dirs]    [No migrations]
  │  [Entity audit fields]
Low Impact ──────────────────────────────────── Easy to Fix
                                         │
                                         │
High Effort
```

## Recommended Debt Remediation Order

1. **EventBusService spec** (MEDIUM risk, LOW effort) — write basic event bus tests
2. **TODO: hardcoded userId** (LOW risk, LOW effort) — inject JWT-decoded user
3. **Empty common/ directories** (LOW risk, LOW effort) — populate or remove
4. **Entity audit fields** (LOW risk, HIGH effort) — requires DB migration (deferred to Sprint 5)
