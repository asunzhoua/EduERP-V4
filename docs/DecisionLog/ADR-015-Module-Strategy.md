# ADR-015: Module Strategy

> **Status**: PROPOSED
> **Date**: 2026-07-15
> **Sprint**: 5 WP1
> **Supersedes**: (none — formalizes existing NestJS module architecture)
> **Relates to**: Constitution Rule 24 (Skeleton First), Rule 25 (One Domain At A Time), BoundedContexts.md

---

## Context

EduOS uses NestJS modules to organize code. The module system provides:
1. Dependency injection scoping
2. Import/export boundaries
3. Compile-time enforcement of dependencies

Without formal module strategy rules, developers may:
1. Create modules that are too large (violating single responsibility)
2. Create modules that are too small (violating cohesion)
3. Import modules that create circular dependencies
4. Skip module boundaries and import services directly

---

## Decision

**Adopt the following module strategy rules:**

### Rule MS-001: One Context = One Module

Each bounded context maps to exactly one NestJS module. The module IS the context boundary.

| Context | Module | Status |
|---------|--------|--------|
| Identity | `identity.module.ts` | Frozen |
| Student | `student.module.ts` | Frozen |
| Teaching | `teaching.module.ts` | In Progress |
| Finance | `finance.module.ts` | Planned |
| Points | `points.module.ts` | Planned |
| Notification | `notification.module.ts` | Planned |
| Dashboard | `dashboard.module.ts` | Planned |

### Rule MS-002: One Aggregate = One Sub-Module

Each aggregate maps to a sub-module within its context module. The sub-module IS the aggregate boundary.

| Aggregate | Sub-Module | Parent Module |
|-----------|-----------|---------------|
| Course | `course.module.ts` | teaching |
| Class | `class.module.ts` | teaching |
| Contract | `contract.module.ts` | teaching |
| Enrollment | `enrollment.module.ts` | teaching |
| Lesson | `lesson.module.ts` | teaching |
| Attendance | `attendance.module.ts` | teaching (inside lesson) |
| ChangeRequest | `change-request.module.ts` | teaching (inside lesson) |
| Student | `student.module.ts` | student |
| User | `user.module.ts` | identity |

### Rule MS-003: Import Rules

**Allowed imports:**
- Context modules import `common.module` (shared utilities)
- Context modules may import other context modules for identity references (e.g., Teaching imports Student for studentCode validation)
- Sub-modules import their parent context module

**Prohibited imports:**
- Context modules importing future context modules (e.g., Teaching importing Finance)
- Circular imports between any two modules
- Sub-modules importing sub-modules from different contexts

### Rule MS-004: Export Rules

Each module exports only what other modules need. Internal services are NOT exported.

**Teaching module exports:**
- `CourseService` (for Class module to validate courseCode)
- `ClassService` (for Lesson module to validate classCode)
- `ContractService` (for Enrollment module to validate contractCode)
- `EnrollmentService` (for Finance module to find Contract during deduction)

**Teaching module does NOT export:**
- Internal repository classes
- Internal DTO types
- Internal event handlers

### Rule MS-005: Module Registration Order

Modules are registered in `app.module.ts` following the dependency order (Constitution Rule 15):

```typescript
@Module({
  imports: [
    CommonModule,           // 1. Shared utilities
    IdentityModule,         // 2. Authentication/Authorization
    StudentModule,          // 3. Student management
    TeachingModule,         // 4. Teaching operations
    FinanceModule,          // 5. Financial operations (future)
    PointsModule,           // 6. Points/rewards (future)
    NotificationModule,     // 7. Notifications (future)
    DashboardModule,        // 8. Analytics (future)
  ],
})
export class AppModule {}
```

### Rule MS-006: Module Testing Strategy

Each module must have:
1. Unit tests for services (isolated, mocked dependencies)
2. Integration tests for controllers (HTTP layer)
3. Module-level tests (dependency injection, import/export)

**Test file location:** `__tests__/` directory within each sub-module.

---

## Module Dependency Graph

```
app.module
    │
    ├── common.module (no dependencies)
    │
    ├── identity.module
    │   └── imports: common.module
    │
    ├── student.module
    │   └── imports: common.module, identity.module
    │
    ├── teaching.module
    │   ├── imports: common.module, identity.module, student.module
    │   ├── course.module (sub-module)
    │   ├── class.module (sub-module)
    │   │   └── imports: course.module
    │   ├── contract.module (sub-module)
    │   ├── enrollment.module (sub-module)
    │   │   └── imports: class.module, contract.module
    │   └── lesson.module (sub-module)
    │       ├── imports: class.module
    │       ├── attendance.module (sub-module)
    │       └── change-request.module (sub-module)
    │
    ├── finance.module (planned)
    │   └── imports: common.module
    │
    ├── points.module (planned)
    │   └── imports: common.module
    │
    ├── notification.module (planned)
    │   └── imports: common.module
    │
    └── dashboard.module (planned)
        └── imports: common.module
```

**Critical Rule:** No circular imports. The dependency graph is a DAG.

---

## Module File Structure

Each module follows this standard structure:

```
{module-name}/
├── {module-name}.module.ts          # Module definition
├── {entity}/
│   ├── {entity}.entity.ts           # TypeORM entity
│   ├── {entity}.service.ts          # Business logic
│   ├── {entity}.controller.ts       # HTTP endpoints
│   ├── {entity}.repository.ts       # Data access (optional, can use TypeORM)
│   ├── dto/                         # Data Transfer Objects
│   │   ├── create-{entity}.dto.ts
│   │   ├── update-{entity}.dto.ts
│   │   └── query-{entity}.dto.ts
│   ├── enums/                       # Entity-specific enums
│   │   └── {entity}-status.enum.ts
│   └── events/                      # Event definitions (if this entity emits events)
│       └── {event-name}.event.ts
└── __tests__/                       # Tests
    ├── {entity}.service.spec.ts
    └── {entity}.controller.spec.ts
```

---

## Consequences

### Positive
- Clear, enforceable module strategy rules
- Prevents circular dependencies at compile time
- Aligns with Constitution Rules 24, 25
- Standard file structure reduces cognitive load

### Negative
- Requires discipline to maintain module boundaries
- Some cross-context reads (Finance reading Enrollment) need explicit module imports

---

*This ADR defines the module strategy. All developers must comply. Module boundaries are the primary architectural enforcement mechanism in EduOS.*
