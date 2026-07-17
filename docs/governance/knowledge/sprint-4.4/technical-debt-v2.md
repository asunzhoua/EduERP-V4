# Technical Debt Inventory v2

> Sprint 4.4 — Phase 6: Technical Debt Review
> Generated: 2026-07-15

---

## Debt Summary

| Category | Items | Severity | Status |
|----------|-------|----------|--------|
| Duplicate Enums | 0 | ~~HIGH~~ | **RESOLVED** (Phase 1) |
| Missing Test Coverage | 3 | MEDIUM | Reduced (AuthService added) |
| Architecture Inconsistencies | 8 | MEDIUM | Recorded |
| Governance Findings | 5 | MEDIUM | Pre-existing |
| Dead Code (Event Classes) | 6 | LOW | Recorded |
| Empty Scaffolding | 16 | LOW | Intentional |
| TODO Markers | 1 | LOW | Recorded |
| **Total** | **39** | | |

---

## Resolved in Sprint 4.4

| Item | Sprint 4.3 Severity | Resolution |
|------|---------------------|------------|
| AttendanceStatus enum divergence | HIGH | RESOLVED — dead code deleted, canonical version retained |
| 5 identical duplicate enums | MEDIUM | RESOLVED — consolidated into common/enums/ |
| AuditAction divergence | LOW | RESOLVED — superset values in common/enums/ |
| .gitkeep in common/enums/ | LOW | RESOLVED — removed (directory now has real files) |
| 5 redundant .gitkeep files | LOW | RESOLVED — removed |
| 4 empty placeholder directories | LOW | RESOLVED — removed |

---

## Remaining Debt Items

### MEDIUM: Missing Test Coverage (3 services)

| Service | Has Tests | Risk | Suggested Fix | Priority |
|---------|-----------|------|---------------|----------|
| StudentService | No | MEDIUM — largest service, handles import + CRUD | Write spec file | Sprint 4.5 |
| TeacherAssignmentService | No | MEDIUM — handles teacher assignment logic | Write spec file | Sprint 4.5 |
| EventBusService | No | LOW — thin wrapper, low test value | Defer | Deferred |

**Evidence**: `backend/src/modules/student/services/student.service.ts` — 200+ lines, no spec file. `backend/src/modules/teaching/teacher-assignment/teacher-assignment.service.ts` — 100+ lines, no spec file.

### MEDIUM: Architecture Inconsistencies (8 items)

| Finding | Evidence | Impact | Risk | Suggested Fix | Priority |
|---------|----------|--------|------|---------------|----------|
| Student module bypasses Repository pattern | `student.service.ts:20-26` injects raw Repository<T> | Inconsistent data access | MEDIUM | Add StudentRepository wrapper | Sprint 4.5 |
| DatabaseModule imports Identity entities | `database.module.ts:4-9` | Infrastructure-to-domain coupling | MEDIUM | Decouple seed logic | Sprint 5.x |
| StudentParent imports User from Identity | `student-parent.entity.ts:10` | Cross-aggregate entity import | MEDIUM | Reference by ID, not entity | Sprint 5.x |
| Event payload untyped (any) | `event-bus.service.ts:12` | No type safety | MEDIUM | Use typed event classes | Sprint 4.5 |
| Event classes never instantiated | `events/**/*.event.ts` | Dead code | LOW | Wire up or remove | Sprint 4.5 |
| No aggregate root guard methods | Most aggregates lack invariant protection | Partial enforcement | MEDIUM | Add guard methods | Sprint 5.x |
| Audit field naming inconsistency | createTime/updateTime vs createdAt | Maintenance burden | LOW | Standardise naming | Sprint 5.x |
| Repository raw getter leak | `class.repository.ts`, `course.repository.ts` | Leaks persistence abstraction | LOW | Remove raw getter | Sprint 5.x |

### MEDIUM: Governance Findings (5 items)

| Finding | Source | Impact | Risk | Suggested Fix | Priority |
|---------|--------|--------|------|---------------|----------|
| WP5.3: Non-standard ADR statuses | ADR-009="DECIDED", DEC-005="APPROVED" | Documentation inconsistency | LOW | Standardise to PROPOSED/ACCEPTED/DEPRECATED/SUPERSEDED | Sprint 4.5 |
| WP2.2: 5 DESIGNED events lack code classes | Event Validation | Catalog-code gap | LOW | Create event classes when domains built | Sprint 5.x |
| WP2.3: Schema attendance field not in event class | Event Validation | Schema-code gap | LOW | Add field to event class | Sprint 4.5 |
| WP3.2-3.6: Catalog/code transition differences | State Machine | Catalog accuracy | MEDIUM | Update catalog to match code | Sprint 4.5 |
| WP4.3: 10 docs missing version headers | Handbook | Documentation hygiene | LOW | Add version headers | Sprint 4.5 |

### LOW: Dead Code (6 event classes)

| File | Reason for Keeping |
|------|-------------------|
| `events/lesson/lesson-completed.event.ts` | Design intent — will be used when event bus utilised |
| `events/lesson/lesson-finished.event.ts` | Design intent |
| `events/lesson/lesson-feedback-created.event.ts` | Design intent |
| `events/leave/leave-submitted.event.ts` | Design intent |
| `events/leave/leave-approved.event.ts` | Design intent |
| `events/finance/points-granted.event.ts` | Design intent |

### LOW: Empty Scaffolding (16 items)

- 11 empty DTO files (Contract, Enrollment, Lesson, TeacherAssignment)
- 5 skeleton controllers with NotImplementedException

**All intentional.** Not debt — planned future work.

### LOW: TODO Markers (1)

| File | Line | Description |
|------|------|-------------|
| `course.controller.ts` | 37 | `replace hardcoded 1 with JWT-decoded userId from Guards` |

---

## Debt Trend

| Metric | Sprint 4.3 | Sprint 4.4 | Change |
|--------|-----------|-----------|--------|
| Duplicate enums | 7 | 0 | -7 (RESOLVED) |
| Missing test coverage | 4 services | 3 services | -1 (AuthService added) |
| Architecture inconsistencies | Not assessed | 8 items | New assessment |
| Governance findings | 5 | 5 | 0 (pre-existing) |
| Dead code (event classes) | 6 | 6 | 0 (design intent) |
| TODO markers | 1 | 1 | 0 |
| **Total debt items** | **24** | **39** | +15 (more thorough assessment) |

**Note**: Total increased because Sprint 4.4 performed deeper architecture analysis (8 new items). Duplicate enum debt was fully resolved (-7 items). Net useful debt reduction: 7 items resolved, 8 new architectural items identified.

---

## Recommended Debt Remediation Order

1. **Event payload typing** (MEDIUM risk, LOW effort) — use existing event classes in publish() calls
2. **StudentRepository wrapper** (MEDIUM risk, MEDIUM effort) — add repository layer for consistency
3. **StudentService spec** (MEDIUM risk, MEDIUM effort) — write tests for largest service
4. **ADP status standardisation** (LOW risk, LOW effort) — update 2 ADR files
5. **StateMachine catalog update** (MEDIUM risk, LOW effort) — sync catalog with code
6. **Version headers** (LOW risk, LOW effort) — add to 10 documents
7. **TODO: hardcoded userId** (LOW risk, LOW effort) — inject JWT-decoded user
8. **DatabaseModule decoupling** (MEDIUM risk, HIGH effort) — refactor seed logic
