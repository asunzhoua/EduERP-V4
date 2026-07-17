# Class State Machine

> **Entity**: Class (教学班)
> **Version**: v1.0.0
> **Rule Reference**: Constitution Rule 22 (Unidirectional States), Rule 19 (Lesson = Timeline)
> **Last Updated**: 2026-07-14

---

## States

```typescript
enum ClassStatus {
  DRAFT     = 'DRAFT',     // Being set up, no lessons generated
  ACTIVE    = 'ACTIVE',    // Running — lessons generated and being taught
  COMPLETED = 'COMPLETED', // All lessons finished
  CANCELLED = 'CANCELLED', // Cancelled before/during operation
}
```

## State Diagram

```
              ┌──────────┐
              │  DRAFT   │
              └────┬─────┘
                   │ activate
                   │ (teacher assigned + schedule defined)
                   ▼
              ┌──────────┐         ┌──────────────┐
              │  ACTIVE  │◄────────│ CANCELLED    │
              └────┬─────┘         └──────────────┘
             ┌─────┴──────┐
             ▼            ▼
       ┌──────────┐  ┌──────────┐
       │COMPLETED │  │CANCELLED │
       └──────────┘  └──────────┘
```

## Transitions

| # | From | To | Trigger | Guard | Side Effects |
|---|------|----|---------|-------|-------------|
| T1 | DRAFT | ACTIVE | Admin action | 1) At least one PRIMARY TeacherAssignment exists. 2) Schedule defined: dayOfWeek[], startTime, endTime, startDate. 3) totalLessons > 0. | **All Lessons auto-generated** in batch (SCHEDULED status). Class becomes operational. |
| T2 | ACTIVE | COMPLETED | System (automatic) | All Lessons are in ARCHIVED or CANCELLED status (none in DRAFT/SCHEDULED/TEACHING/FINISHED). | All ACTIVE Enrollments → COMPLETED. Terminal state. |
| T3 | ACTIVE | CANCELLED | Admin action | Admin approval + `cancelledReason` required | All future SCHEDULED Lessons → CANCELLED. ACTIVE enrollments → WITHDRAWN. |
| T4 | CANCELLED | ACTIVE | Admin override | Reason required, logged as override | Future Lessons regenerated from remaining schedule. |
| T5 | DRAFT | CANCELLED | Admin action | No students enrolled yet | No side effects. |

## Constraints

| Constraint | Value | Reason |
|------------|-------|--------|
| DRAFT → ACTIVE requires PRIMARY teacher | Exactly 1 PRIMARY TeacherAssignment | A class cannot operate without a teacher |
| DRAFT → ACTIVE requires schedule | dayOfWeek[], startTime, endTime, startDate | Cannot generate Lessons without schedule |
| COMPLETED is terminal | No transitions allowed | All lessons are settled. Audit complete. |
| CANCELLED → ACTIVE requires audit log | Override reason mandatory | Prevents accidental reactivation |
| Schedule frozen on activation | dayOfWeek cannot change after ACTIVE | Prevents lesson misalignment |

## Lesson Generation on Activation

When T1 fires (DRAFT → ACTIVE):

```
1. Read Class schedule fields
2. Read PRIMARY TeacherAssignment
3. Calculate lesson dates:
   - Start from startDate
   - Match dayOfWeek pattern
   - Generate totalLessons lesson records
4. Create all Lessons in ONE transaction
5. Status = SCHEDULED (skip DRAFT)
6. teacherId = PRIMARY teacher
```

## Cancellation Impact

When T3 fires (ACTIVE → CANCELLED):
- All Lessons in SCHEDULED status → CANCELLED
- Lessons in TEACHING, FINISHED, or ARCHIVED status: **NOT affected** (they complete normally)
- All ACTIVE Enrollments → WITHDRAWN
- No financial impact (no deduction until LessonFinished)
- Re-activation (T4) regenerates Lessons for the remaining schedule
