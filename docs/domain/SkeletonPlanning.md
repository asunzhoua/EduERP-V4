# EduOS Skeleton Planning

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: Define the complete directory structure for all contexts. This is a SKELETON ONLY — no business logic, no database queries, no event handlers. The skeleton defines WHERE code goes, not WHAT it does.
> **Parent**: [AggregateDependencyReview.md](./AggregateDependencyReview.md)
> **Rule**: Constitution Rule 24 — Skeleton First. Complete skeleton before business logic.

---

## Skeleton Principles

1. **Directory structure only.** No implementation files with business logic.
2. **Each context = one NestJS module.** Module boundary = context boundary.
3. **Each aggregate = one sub-module.** Aggregate root = module entry point.
4. **Standard file pattern per aggregate:** entity, service, controller, repository, DTO, enum, events.
5. **Shared code in `src/common/`.** Enums, event types, utilities shared across contexts.

---

## Complete Directory Structure

```
backend/src/
├── common/                              # Shared across all contexts
│   ├── enums/
│   │   ├── subject.enum.ts              # MATH, ENGLISH, CHINESE, etc.
│   │   └── gender.enum.ts              # MALE, FEMALE
│   ├── events/
│   │   ├── event-types.ts              # All event type definitions
│   │   └── event-bus.service.ts        # EventBus wrapper
│   ├── services/
│   │   └── unified-code-generator.service.ts  # ADR-008
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   └── audit.interceptor.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   └── common.module.ts
│
├── modules/
│   ├── identity/                        # Identity Context (Frozen)
│   │   ├── identity.module.ts
│   │   ├── user/
│   │   │   ├── user.entity.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.repository.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   └── update-user.dto.ts
│   │   │   └── user.module.ts
│   │   ├── role/
│   │   │   ├── role.entity.ts
│   │   │   ├── role.service.ts
│   │   │   ├── role.controller.ts
│   │   │   ├── role.repository.ts
│   │   │   └── role.module.ts
│   │   └── permission/
│   │       ├── permission.entity.ts
│   │       ├── permission.service.ts
│   │       └── permission.module.ts
│   │
│   ├── student/                         # Student Context (Frozen)
│   │   ├── student.module.ts
│   │   ├── student/
│   │   │   ├── student.entity.ts
│   │   │   ├── student.service.ts
│   │   │   ├── student.controller.ts
│   │   │   ├── student.repository.ts
│   │   │   ├── student-code-generator.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-student.dto.ts
│   │   │   │   ├── update-student.dto.ts
│   │   │   │   └── import-student.dto.ts
│   │   │   └── student.module.ts
│   │   ├── student-parent/
│   │   │   ├── student-parent.entity.ts
│   │   │   ├── student-parent.service.ts
│   │   │   ├── student-parent.controller.ts
│   │   │   └── student-parent.module.ts
│   │   └── events/
│   │       ├── student-deactivated.event.ts
│   │       └── student-status-changed.event.ts
│   │
│   ├── teaching/                        # Teaching Context (In Progress)
│   │   ├── teaching.module.ts
│   │   │
│   │   ├── course/                      # Course Aggregate (T1)
│   │   │   ├── course.entity.ts
│   │   │   ├── course.service.ts
│   │   │   ├── course.controller.ts
│   │   │   ├── course.repository.ts
│   │   │   ├── course-code-generator.service.ts
│   │   │   ├── enums/
│   │   │   │   ├── course-status.enum.ts
│   │   │   │   └── course-type.enum.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-course.dto.ts
│   │   │   │   ├── update-course.dto.ts
│   │   │   │   └── query-course.dto.ts
│   │   │   └── course.module.ts
│   │   │
│   │   ├── class/                       # Class Aggregate (T2)
│   │   │   ├── class.entity.ts
│   │   │   ├── class.service.ts
│   │   │   ├── class.controller.ts
│   │   │   ├── class.repository.ts
│   │   │   ├── class-code-generator.service.ts
│   │   │   ├── teacher-assignment/
│   │   │   │   ├── teacher-assignment.entity.ts
│   │   │   │   ├── teacher-assignment.service.ts
│   │   │   │   ├── teacher-assignment.controller.ts
│   │   │   │   └── enums/
│   │   │   │       └── teacher-role.enum.ts
│   │   │   ├── enums/
│   │   │   │   └── class-status.enum.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-class.dto.ts
│   │   │   │   ├── update-class.dto.ts
│   │   │   │   └── query-class.dto.ts
│   │   │   └── class.module.ts
│   │   │
│   │   ├── contract/                    # Contract Aggregate (T3)
│   │   │   ├── contract.entity.ts
│   │   │   ├── contract.service.ts
│   │   │   ├── contract.controller.ts
│   │   │   ├── contract.repository.ts
│   │   │   ├── contract-code-generator.service.ts
│   │   │   ├── enums/
│   │   │   │   └── contract-status.enum.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-contract.dto.ts
│   │   │   │   ├── update-contract.dto.ts
│   │   │   │   └── query-contract.dto.ts
│   │   │   └── contract.module.ts
│   │   │
│   │   ├── enrollment/                  # Enrollment Aggregate (T5)
│   │   │   ├── enrollment.entity.ts
│   │   │   ├── enrollment.service.ts
│   │   │   ├── enrollment.controller.ts
│   │   │   ├── enrollment.repository.ts
│   │   │   ├── enums/
│   │   │   │   └── enrollment-status.enum.ts
│   │   │   ├── dto/
│   │   │   │   ├── enroll-student.dto.ts
│   │   │   │   └── withdraw-student.dto.ts
│   │   │   └── enrollment.module.ts
│   │   │
│   │   └── lesson/                      # Lesson Aggregate (T4)
│   │       ├── lesson.entity.ts
│   │       ├── lesson.service.ts
│   │       ├── lesson.controller.ts
│   │       ├── lesson.repository.ts
│   │       ├── enums/
│   │       │   ├── lesson-status.enum.ts
│   │       │   └── attendance-status.enum.ts
│   │       ├── attendance/
│   │       │   ├── lesson-attendance.entity.ts
│   │       │   ├── attendance.service.ts
│   │       │   ├── attendance.controller.ts
│   │       │   ├── attendance.repository.ts
│   │       │   ├── enums/
│   │       │   │   └── attendance-workflow-state.enum.ts
│   │       │   └── attendance.module.ts
│   │       ├── change-request/
│   │       │   ├── lesson-change-request.entity.ts
│   │       │   ├── change-request.service.ts
│   │       │   ├── change-request.controller.ts
│   │       │   ├── change-request.repository.ts
│   │       │   ├── enums/
│   │       │   │   ├── change-request-type.enum.ts
│   │       │   │   └── change-request-status.enum.ts
│   │       │   └── change-request.module.ts
│   │       ├── dto/
│   │       │   ├── complete-lesson.dto.ts
│   │       │   ├── confirm-lesson.dto.ts
│   │       │   ├── cancel-lesson.dto.ts
│   │       │   └── query-lesson.dto.ts
│   │       ├── events/
│   │       │   ├── lesson-completed.event.ts
│   │       │   └── lesson-finished.event.ts
│   │       └── lesson.module.ts
│   │
│   ├── finance/                         # Finance Context (Planned Sprint 6)
│   │   ├── finance.module.ts
│   │   ├── deduction/
│   │   │   ├── deduction.service.ts
│   │   │   ├── deduction.controller.ts
│   │   │   └── deduction.repository.ts
│   │   ├── salary/
│   │   │   ├── salary.service.ts
│   │   │   ├── salary.controller.ts
│   │   │   └── salary.repository.ts
│   │   └── events/
│   │       ├── contract-exhausted.event.ts
│   │       ├── contract-expired.event.ts
│   │       ├── contract-refunded.event.ts
│   │       ├── contract-deducted.event.ts
│   │       └── salary-calculated.event.ts
│   │
│   ├── points/                          # Points Context (Planned)
│   │   ├── points.module.ts
│   │   ├── points/
│   │   │   ├── points.entity.ts
│   │   │   ├── points.service.ts
│   │   │   ├── points.controller.ts
│   │   │   └── points.repository.ts
│   │   └── events/
│   │       ├── points-awarded.event.ts
│   │       └── points-redeemed.event.ts
│   │
│   ├── notification/                    # Notification Context (Planned)
│   │   ├── notification.module.ts
│   │   ├── notification.service.ts
│   │   ├── notification.controller.ts
│   │   └── templates/
│   │       ├── lesson-completed.template.ts
│   │       └── lesson-finished.template.ts
│   │
│   └── dashboard/                       # Dashboard Context (Planned)
│       ├── dashboard.module.ts
│       ├── dashboard.service.ts
│       ├── dashboard.controller.ts
│       └── aggregators/
│           ├── teaching-stats.aggregator.ts
│           └── financial-stats.aggregator.ts
│
├── app.module.ts                        # Root module
└── main.ts                              # Application entry point
```

---

## File Count Summary

| Context | Modules | Entity Files | Service Files | Controller Files | Total Files |
|---------|---------|-------------|---------------|-----------------|-------------|
| Common | 1 | 0 | 2 | 0 | 10 |
| Identity | 4 | 3 | 3 | 2 | 12 |
| Student | 3 | 2 | 2 | 2 | 10 |
| Teaching | 7 | 8 | 8 | 7 | 35 |
| Finance (planned) | 1 | 0 | 2 | 2 | 8 |
| Points (planned) | 1 | 1 | 1 | 1 | 5 |
| Notification (planned) | 1 | 0 | 1 | 1 | 4 |
| Dashboard (planned) | 1 | 0 | 1 | 1 | 4 |
| **Total** | **19** | **14** | **20** | **16** | **88** |

---

## Module Dependency Graph

```
app.module.ts
    │
    ├── common.module.ts
    │
    ├── identity.module.ts
    │   └── imports: common.module
    │
    ├── student.module.ts
    │   └── imports: common.module, identity.module
    │
    ├── teaching.module.ts
    │   ├── course.module
    │   ├── class.module
    │   ├── contract.module
    │   ├── enrollment.module
    │   ├── lesson.module
    │   │   ├── attendance.module
    │   │   └── change-request.module
    │   └── imports: common.module, identity.module, student.module
    │
    ├── finance.module.ts (planned)
    │   └── imports: common.module
    │
    ├── points.module.ts (planned)
    │   └── imports: common.module
    │
    ├── notification.module.ts (planned)
    │   └── imports: common.module
    │
    └── dashboard.module.ts (planned)
        └── imports: common.module
```

**Critical Rule:** Teaching module does NOT import Finance module. Finance module does NOT import Teaching module. They communicate ONLY through events.

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Entity file | `{name}.entity.ts` | `course.entity.ts` |
| Service file | `{name}.service.ts` | `course.service.ts` |
| Controller file | `{name}.controller.ts` | `course.controller.ts` |
| Repository file | `{name}.repository.ts` | `course.repository.ts` |
| DTO file | `{action}-{name}.dto.ts` | `create-course.dto.ts` |
| Enum file | `{name}.enum.ts` | `course-status.enum.ts` |
| Event file | `{event-name}.event.ts` | `lesson-completed.event.ts` |
| Module file | `{name}.module.ts` | `course.module.ts` |

---

## Implementation Order (Per Constitution Rule 25)

| Phase | Context | Aggregates | Sprint |
|-------|---------|-----------|--------|
| Phase 1 | Identity | User, Role | Frozen |
| Phase 2 | Student | Student, StudentParent | Frozen |
| Phase 3a | Teaching | Course, Class | Sprint 4 |
| Phase 3b | Teaching | Contract, Enrollment | Sprint 4 |
| Phase 3c | Teaching | Lesson, Attendance, ChangeRequest | Sprint 5 |
| Phase 4 | Finance | Deduction, Salary | Sprint 6 |
| Phase 5 | Points | Points | Sprint 7 |
| Phase 6 | Notification | Notification | Sprint 8 |
| Phase 7 | Dashboard | Dashboard | Sprint 9 |

---

*This is a living document. Update when new contexts or aggregates are added. The skeleton must be complete before any business logic is implemented (Rule 24).*
