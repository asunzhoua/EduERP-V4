# Course State Machine

> **Entity**: Course
> **Version**: v1.0.0
> **Rule Reference**: Constitution Rule 22 (Unidirectional States)
> **Last Updated**: 2026-07-14

---

## States

```typescript
enum CourseStatus {
  DRAFT     = 'DRAFT',     // Being created, not yet available
  PUBLISHED = 'PUBLISHED', // Active — classes can be created
  ARCHIVED  = 'ARCHIVED',  // Discontinued — no new classes allowed
}
```

## State Diagram

```
              ┌──────────┐
              │  DRAFT   │
              └────┬─────┘
                   │ publish
                   │ (all required fields filled)
                   ▼
              ┌──────────┐
              │PUBLISHED │◄──── re-publish
              └────┬─────┘
                   │ archive
                   ▼
              ┌──────────┐
              │ ARCHIVED │
              └──────────┘
```

## Transitions

| # | From | To | Trigger | Guard | Side Effects |
|---|------|----|---------|-------|-------------|
| T1 | DRAFT | PUBLISHED | Admin action | All required fields filled: name, subject, type, totalHours, totalLessons, defaultDuration | Classes can now be created |
| T2 | PUBLISHED | ARCHIVED | Admin action | None | No new Classes allowed. Existing Classes unaffected. |
| T3 | ARCHIVED | PUBLISHED | Admin action | None | Re-activation. Classes creatable again. |
| T4 | DRAFT | (soft deleted) | Admin action | No existing Classes under this Course | Course removed. Code never recycled. |

## Constraints

| Constraint | Value | Enforced By |
|------------|-------|-------------|
| DRAFT can be soft-deleted | Only if no Classes exist | CourseService.create validation |
| PUBLISHED can be archived with active Classes | Allowed | Existing Classes continue |
| ARCHIVED is NOT terminal | Can re-publish | By design |
| DRAFT → PUBLISHED requires complete data | All required fields | Server validation |

## Implementation Notes

- Status changes are **audited** in `course_audit_log` with field-level granularity
- ARCHIVED Courses still appear in historical reports and lesson records
- Course metadata changes (name, description) are reflected in all associated Classes via JOIN on courseCode
- The `courseCode` (CSYYYYMMNNNN) is immutable after creation and never recycled
