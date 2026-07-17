# ADR-007: Shared Domain Enums

> **Status**: PROPOSED
> **Date**: 2026-07-14
> **Deciders**: CTO (approval required)
> **Related**: TeachingConsistencyAudit.md Finding #2

---

## Context

The Teaching Domain has multiple enums that are used by more than one entity or module. Currently, some of these enums are duplicated across modules, creating a maintenance risk.

### Current State

| Enum | Defined In | Used By | Identical? |
|------|-----------|---------|------------|
| `Subject` | `course/enums/subject.enum.ts` AND `contract/enums/subject.enum.ts` | Course, Contract | ✅ Yes — byte-for-byte identical (11 values) |
| `Gender` | `student/` domain | Student only | N/A — single consumer |
| `CourseType` | `course/enums/` | Course only | N/A — single consumer |
| `AttendanceStatus` | `lesson/` domain | LessonAttendance only | N/A — single consumer |
| `EnrollmentStatus` | `enrollment/enums/` | Enrollment only | N/A — single consumer |
| `ContractStatus` | `contract/enums/` | Contract only | N/A — single consumer |
| `LessonStatus` | `lesson/enums/` | Lesson only | N/A — single consumer |

**The problem is specifically the `Subject` enum**, which is defined identically in two separate locations:
- `backend/src/modules/teaching/course/enums/subject.enum.ts`
- `backend/src/modules/teaching/contract/enums/subject.enum.ts`

Both contain:
```typescript
export enum Subject {
  MATH = 'MATH',
  ENGLISH = 'ENGLISH',
  CHINESE = 'CHINESE',
  PHYSICS = 'PHYSICS',
  CHEMISTRY = 'CHEMISTRY',
  ART = 'ART',
  MUSIC = 'MUSIC',
  DANCE = 'DANCE',
  SPORTS = 'SPORTS',
  CODING = 'CODING',
  OTHER = 'OTHER',
}
```

### Risk

If a new Subject is added (e.g., `SCIENCE`), both files must be updated in sync. If only one is updated, the Course module and Contract module will have different enum values, leading to silent data corruption.

---

## Decision

**Move shared cross-domain enums to `backend/src/common/enums/`.**

### Enums to Relocate

| Enum | New Location | Reason |
|------|-------------|--------|
| `Subject` | `common/enums/subject.enum.ts` | Used by both Course and Contract modules. Identical definitions. |
| `Gender` | `common/enums/gender.enum.ts` | Will be needed by Student module and potentially by Teaching module (student gender in reports). Move preemptively. |

### Enums to Keep in Domain Modules

| Enum | Location | Reason |
|------|----------|--------|
| `CourseType` | `course/enums/` | Course-specific. Only Course module uses it. |
| `LessonStatus` | `lesson/enums/` | Lesson-specific. Only Lesson module uses it. |
| `ContractStatus` | `contract/enums/` | Contract-specific. Only Contract module uses it. |
| `EnrollmentStatus` | `enrollment/enums/` | Enrollment-specific. Only Enrollment module uses it. |
| `AttendanceStatus` | `lesson/enums/` | Lesson-specific. Only LessonAttendance uses it. |

### Future Consideration

When the Finance Domain is implemented, it may need to reference `ContractStatus` (to validate contract state during deduction). At that point, `ContractStatus` should be evaluated for relocation to `common/enums/`. The same applies to `AttendanceStatus` if the Points Domain needs to know attendance status for point awards.

**Principle**: An enum moves to `common/enums/` when it is referenced by **two or more** domain modules. Single-consumer enums stay in their domain.

---

## Consequences

### Positive

- **Single source of truth** for Subject and Gender enums
- **No drift risk** — one file to update
- **Clear import path** — `import { Subject } from '@/common/enums/subject.enum'`
- **Follows existing structure** — `src/common/enums/` already exists (currently empty)

### Negative

- **Import path change** — All files importing from `course/enums/subject.enum.ts` or `contract/enums/subject.enum.ts` must be updated
- **Module boundary softening** — Teaching sub-modules now reference a shared location outside their module boundary (acceptable for enums)

### Migration Steps

1. Create `backend/src/common/enums/subject.enum.ts` with the canonical Subject definition
2. Create `backend/src/common/enums/gender.enum.ts` with the canonical Gender definition
3. Update `course/enums/subject.enum.ts` to re-export from common (or delete and update imports)
4. Update `contract/enums/subject.enum.ts` to re-export from common (or delete and update imports)
5. Update all import statements across the codebase
6. Run `npm run lint` and `npm run test` to verify no regressions

### Re-export Strategy (Recommended)

To minimize import changes and maintain backward compatibility, the domain-level enum files can be converted to re-exports:

```typescript
// course/enums/subject.enum.ts
export { Subject } from '@/common/enums/subject.enum';

// contract/enums/subject.enum.ts
export { Subject } from '@/common/enums/subject.enum';
```

This way, existing imports within each module continue to work. New code should import directly from `common/enums/`.

---

## Alternatives Considered

### Alternative A: Keep Duplicated Enums (Status Quo)

**Rejected.** Maintenance risk is real. The two Subject enums are identical today but could drift tomorrow.

### Alternative B: One Domain Owns the Enum, Others Import

**Rejected.** Which domain "owns" Subject? Course defines courses, but Contract also uses Subject for the same purpose. Neither has a stronger claim. A shared location is cleaner.

### Alternative C: TypeScript Union Types Instead of Enums

**Rejected.** The codebase uses TypeORM enums backed by MySQL ENUM columns. TypeScript enums map directly to database column types. Switching to union types would break the TypeORM integration.

---

## Approval

| Role | Status | Date |
|------|--------|------|
| CTO | ⬜ Pending | — |

---

*This ADR addresses TeachingConsistencyAudit.md Finding #2 (Subject Enum Duplication). Implementation requires CTO approval and a code migration task.*
