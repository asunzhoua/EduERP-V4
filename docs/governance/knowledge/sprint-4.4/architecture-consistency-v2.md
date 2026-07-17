# Architecture Consistency Audit

> Sprint 4.4 — Phase 2: Architecture Consistency Audit
> Generated: 2026-07-15

---

## Architecture Overview

EduOS is a **NestJS monolith** using **Domain-Driven Design** patterns. 14 modules organized into 3 bounded contexts (Identity, Student, Teaching) with an EventBusModule infrastructure layer.

---

## Module Dependency Tree

```
AppModule
├── EventBusModule (infrastructure)
├── IdentityModule (bounded context)
├── StudentModule (bounded context)
├── TeachingModule (bounded context)
│   ├── CourseModule
│   ├── ClassModule
│   ├── ContractModule
│   ├── EnrollmentModule
│   ├── LessonModule
│   ├── TeacherAssignmentModule
│   ├── LessonAttendanceModule
│   └── LessonChangeRequestModule
└── DatabaseModule (infrastructure)
```

**Assessment**: Clean hierarchy. No circular dependencies detected. Teaching sub-modules have 2 cross-dependencies (class → teacher-assignment via TeacherRole, enrollment → contract via Subject) which are acceptable.

---

## DDD Pattern Compliance

### PASS: Module Isolation

| Pattern | Status | Evidence |
|---------|--------|----------|
| 14 NestJS modules with clean boundaries | PASS | All modules properly declared with imports/exports |
| TeachingModule aggregates 8 sub-modules | PASS | Clean composition pattern |
| No circular module dependencies | PASS | Manual verification + dependency graph |

### PASS: State Machine Discipline

| Pattern | Status | Evidence |
|---------|--------|----------|
| VALID_*_TRANSITIONS maps | PASS | 6 code state machines (lesson, course, class, contract, lesson-attendance, lesson-change-request) |
| Record<Status, Status[]> pattern | PASS | All use correct TypeScript Record type |
| Guard methods for transitions | PASS | BadRequestException thrown for invalid transitions |

### PASS: REST API Consistency

| Pattern | Status | Evidence |
|---------|--------|----------|
| Plural noun resource naming | PASS | /courses, /classes, /lessons, /students |
| HTTP method consistency | PASS | POST=create, GET=read, PUT=update, PATCH=status, DELETE=remove |
| Status change via PATCH | PASS | PATCH /:id/status with targetStatus body |
| Global JWT guard | PASS | JwtAuthGuard as APP_GUARD |
| Global exception filter | PASS | GlobalExceptionFilter as APP_FILTER |
| Global response interceptor | PASS | ResponseInterceptor as APP_INTERCEPTOR |

### PASS: DTO Validation

| Pattern | Status | Evidence |
|---------|--------|----------|
| class-validator decorators | PASS | 27 DTO files with validation decorators |
| Input DTOs for create/update | PASS | Consistent naming (CreateXxxDto, UpdateXxxDto, QueryXxxDto) |

### PASS: Event Architecture Foundation

| Pattern | Status | Evidence |
|---------|--------|----------|
| EventBusService wrapping EventEmitter2 | PASS | event-bus.service.ts with publish/subscribe |
| Event auto-enrichment (eventId, timestamp) | PASS | publish() adds eventId and timestamp |
| 1 event subscriber | PASS | lesson-event.subscriber.ts (logging only) |
| 2 events emitting | PASS | lesson.completed, lesson.finished |
| 6 event classes defined | PASS | In src/events/ |

### WARN: Event Utilisation

| Pattern | Status | Evidence |
|---------|--------|----------|
| 24 catalog events vs 2 emitting | WARN | 92% of catalog events not implemented |
| No cross-domain subscribers | WARN | Only lesson domain has subscriber |
| Event classes exist for finance/leave but no modules | WARN | premature code |

### FAIL: Repository Pattern Inconsistency

| Pattern | Status | Evidence |
|---------|--------|----------|
| Teaching module: explicit Repository classes | PASS | 8 repository files (class.repository.ts, etc.) |
| Student module: @InjectRepository in Service | FAIL | StudentService injects Repository directly, no repository layer |
| Identity module: no repository layer | FAIL | AuthService uses @InjectRepository directly |

**Impact**: Inconsistent data access pattern across bounded contexts. Teaching has clean separation; Student and Identity mix persistence logic into services.

**Recommendation**: This is an architectural decision — not auto-fixable. Record for CTO decision.

### FAIL: Missing Value Objects

| Pattern | Status | Evidence |
|---------|--------|----------|
| No explicit ValueObject base class | FAIL | No VO pattern anywhere |
| No shared value objects in common/ | FAIL | common/interfaces/ is empty (.gitkeep only) |
| Inline value objects in entities | WARN | Money, DateRange, Code are primitive fields |

**Impact**: Domain logic operates on primitives rather than typed value objects. Reduces type safety and domain expressiveness.

**Recommendation**: Record for Sprint 5.x architectural decision.

### FAIL: Missing Aggregate Root Enforcement

| Pattern | Status | Evidence |
|---------|--------|----------|
| 10 aggregates identified | INFO | From Sprint 4.3 analysis |
| No explicit aggregate root methods | FAIL | Only Class has guardActivation(); others lack invariant protection |
| No aggregate boundary enforcement | FAIL | No transactional boundaries per aggregate |

**Impact**: Aggregate invariants are not consistently enforced. Some status transitions are validated, others are not.

**Recommendation**: Record for Sprint 5.x. Each aggregate root should have `canTransitionTo()` or similar guard methods.

### WARN: Missing CQRS Separation

| Pattern | Status | Evidence |
|---------|--------|----------|
| Commands and queries mixed in services | WARN | No Command/Query objects |
| No command bus | WARN | Services handle both read and write |
| No query DTOs separated from command DTOs | WARN | Single DTOs serve both purposes |

**Impact**: Moderate. At current scale, mixed services are acceptable. Would become a problem with growth.

### WARN: No Anti-Corruption Layer

| Pattern | Status | Evidence |
|---------|--------|----------|
| No translation between bounded contexts | WARN | Modules import directly from each other |
| Shared enums in common/ (new) | PASS | Just consolidated in Phase 1 |

**Impact**: Low at current scale. Bounded contexts are still fairly isolated.

---

## Infrastructure Layer Assessment

| Component | Status | Evidence |
|-----------|--------|----------|
| TypeORM database config | PASS | database.config.ts |
| JWT authentication | PASS | Identity module with JwtModule |
| Role-based access | PASS | @Roles() decorator + RolesGuard |
| Input validation | PASS | DTOs with class-validator |
| Exception handling | PASS | GlobalExceptionFilter |
| Response formatting | PASS | ResponseInterceptor |
| Rate limiting | FAIL | Not implemented |
| Request logging | WARN | Logger exists but not all endpoints logged |

---

## Dependency Direction Assessment

| Direction | Status | Notes |
|-----------|--------|-------|
| AppModule → Feature Modules | PASS | Correct top-down |
| Feature Modules → Infrastructure | PASS | Teaching modules use EventBusModule |
| Cross-feature dependencies | PASS | No Student↔Teaching, No Identity↔Student |
| Teaching sub-module cross-deps | PASS | 2 acceptable (class→teacher-assignment, enrollment→contract) |
| Common → Domain | PASS | common/enums used by all modules |
| Domain → Common | PASS | Correct dependency direction |

---

## Key Findings Summary

| # | Finding | Severity | Type | Action |
|---|---------|----------|------|--------|
| 1 | Repository pattern inconsistency (Student/Identity vs Teaching) | HIGH | FAIL | Record for CTO decision |
| 2 | Missing aggregate root enforcement | MEDIUM | FAIL | Record for Sprint 5.x |
| 3 | Missing value objects | MEDIUM | FAIL | Record for Sprint 5.x |
| 4 | No rate limiting | LOW | FAIL | Record for Sprint 5.x |
| 5 | Event bus underutilisation (8%) | MEDIUM | WARN | Record for Sprint 4.5+ |
| 6 | No CQRS separation | LOW | WARN | Record for future |
| 7 | No anti-corruption layer | LOW | WARN | Record for future |
| 8 | common/constants, common/exceptions, common/interfaces empty | LOW | WARN | Record for Sprint 5.x |

---

## Decisions Required (Not Auto-Fixable)

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Repository pattern | (A) Add repositories to Student/Identity, (B) Remove repositories from Teaching | Option A — consistent data access layer |
| Value objects | (A) Add VO base class + shared VOs, (B) Keep primitives | Option A — improves domain model |
| Aggregate guards | (A) Add guard methods to all aggregate roots, (B) Keep current partial enforcement | Option A — consistent invariant protection |
| Rate limiting | (A) Add @nestjs/throttler, (B) Defer | Option A — security best practice |
