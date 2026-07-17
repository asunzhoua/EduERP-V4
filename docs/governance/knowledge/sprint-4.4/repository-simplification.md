# Repository Simplification Report

> Sprint 4.4 — Phase 5: Repository Simplification
> Generated: 2026-07-15

---

## Summary

| Category | Found | Auto-Fixed | Recorded for Decision |
|----------|-------|------------|----------------------|
| Redundant .gitkeep files | 5 | 5 | 0 |
| Empty placeholder directories | 4 | 4 | 0 |
| Dead event classes (unused) | 6 | 0 | 6 (design intent) |
| Empty DTO stubs | 11 | 0 | 11 (intentional scaffolding) |
| Skeleton services (NotImplementedException) | 5 | 0 | 5 (intentional scaffolding) |
| TODO markers | 1 | 0 | 1 (JWT-decoded userId) |
| **Total** | **32** | **9** | **23** |

---

## Auto-Fixed (9 items)

### Redundant .gitkeep Files Removed

| File | Reason |
|------|--------|
| `modules/course/.gitkeep` | Directory is empty placeholder; teaching/course/ has actual implementation |
| `modules/lesson/.gitkeep` | Directory is empty placeholder; teaching/lesson/ has actual implementation |
| `modules/attendance/.gitkeep` | Directory is empty placeholder; teaching/lesson-attendance/ has actual implementation |
| `modules/student/.gitkeep` | Directory has actual files (student.controller.ts etc.) — .gitkeep was redundant |
| `modules/teacher/.gitkeep` | Directory is empty placeholder; teaching/teacher-assignment/ has actual implementation |

### Empty Placeholder Directories Removed

| Directory | Reason |
|-----------|--------|
| `modules/course/` | Empty after .gitkeep removal |
| `modules/lesson/` | Empty after .gitkeep removal |
| `modules/attendance/` | Empty after .gitkeep removal |
| `modules/teacher/` | Empty after .gitkeep removal |

---

## Recorded for Decision (23 items)

### Dead Event Classes (6) — DO NOT DELETE

All 6 event classes in `src/events/` are defined but never imported or instantiated:

| File | Status |
|------|--------|
| `events/lesson/lesson-completed.event.ts` | Dead code but design-intent |
| `events/lesson/lesson-finished.event.ts` | Dead code but design-intent |
| `events/lesson/lesson-feedback-created.event.ts` | Dead code but design-intent |
| `events/leave/leave-submitted.event.ts` | Dead code but design-intent |
| `events/leave/leave-approved.event.ts` | Dead code but design-intent |
| `events/finance/points-granted.event.ts` | Dead code but design-intent |

**Recommendation**: Keep until event bus utilisation is implemented (Sprint 4.5+). These are typed event definitions that will be needed.

### Empty DTO Stubs (11) — INTENTIONAL SCAFFOLDING

| Module | Files | Status |
|--------|-------|--------|
| Contract | create, update, query DTOs | Controller throws NotImplementedException |
| Enrollment | create, update, query DTOs | Controller throws NotImplementedException |
| Lesson | create, update, query DTOs | Controller throws NotImplementedException |
| TeacherAssignment | update DTO | Controller throws NotImplementedException |

**Recommendation**: Keep. These are placeholders for future implementation.

### Skeleton Controllers/Services (5 modules)

| Module | Controller | Service |
|--------|-----------|---------|
| Lesson | 13 NotImplementedException | Implemented |
| LessonAttendance | 5 NotImplementedException | 10 NotImplementedException |
| LessonChangeRequest | 4 NotImplementedException | 7 NotImplementedException |
| Enrollment | 6 NotImplementedException | Implemented |
| Contract | 6 NotImplementedException | Implemented |
| TeacherAssignment | 4 NotImplementedException | Implemented |

**Recommendation**: Keep. Skeleton controllers will be implemented when controllers are wired up.

### TODO Marker (1)

| File | Line | Description |
|------|------|-------------|
| `course.controller.ts` | 37 | `replace hardcoded 1 with JWT-decoded userId from Guards` |

**Recommendation**: Fix in Sprint 4.5 when auth integration is completed.

---

## Duplicate Code Patterns

| Pattern | Location | Assessment |
|---------|----------|------------|
| CRUD service methods | All teaching services | Consistent pattern, not duplicate — intentional convention |
| State machine validation | 6 services | Same structure but different transitions — not duplicate |
| NotImplementedException scaffolding | 5 controllers | Intentional future-work markers |

**No actionable duplicate code found.** The codebase follows consistent patterns across modules.

---

## Verification

- [x] Removed files are truly redundant (not needed by any import)
- [x] Empty directories have no hidden content
- [x] No tests broken by removals
