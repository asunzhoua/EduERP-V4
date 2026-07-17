# EduOS Architecture Handbook

> **Version**: v1.0.0
> **Last Updated**: 2026-07-14
> **Sprint**: 4.1.6 (Governance Assets)
> **Purpose**: The first document any AI agent or developer reads. Top-level navigation for the entire EduOS architecture.

---

## How to Read This Document

This handbook is the **entry point** for understanding EduOS. It does not contain detailed specifications. Instead, it provides a concise overview of each architectural concern and points to the authoritative document for deeper reading.

**Reading order for new team members / AI agents:**

```
1. This Handbook (you are here)
2. Constitution (00-Constitution/) — the rules that never change
3. Domain Catalog (DomainCatalog/) — who owns what
4. Domain Model (DomainModel/) — entities and relationships
5. Business Rules (BusinessRules/) — invariants and constraints
6. State Machines (StateMachine/) — how entities evolve
7. Events (EventCatalog/) — how domains communicate
8. ADRs (DecisionLog/) — why decisions were made
```

---

## Chapter 00: System Overview

**EduOS** (Education Operating System) is not a school management app. It is the operational backbone for education businesses.

**Core Design Principles** (from Constitution):

1. **Reality First** — System records what actually happened. Teacher finishes class -> system deducts lessons. Not admin clicks "deduct."
2. **Event First** — All business logic flows through events. `lesson.finished` -> Finance deduction -> Salary calculation -> Notification. New features listen to events; they never modify existing code.
3. **Document First** — Every modification creates a business document. Audit trails are permanent.
4. **Rule First** — No hardcoded values. Salaries, lesson prices, point rules are all configurable.

**Technology Stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | WeChat Mini Program |
| Backend | NestJS 11 + TypeScript 5 |
| Database | MySQL 8.0.41 + TypeORM 1.0.0 |
| Event Bus | @nestjs/event-emitter (EventEmitter2) |
| Auth | JWT + RBAC |

**Architecture Pattern:** Classic 4-layer (API -> Event Bus -> Business Domain -> Data).

**Reference**: [Constitution-v4.0.md](../00-Constitution/Constitution-v4.0.md), [SAD-v4.0.md](../02-SAD/SAD-v4.0.md)

---

## Chapter 01: Domain Model

EduOS is organized into **bounded contexts** (domains). Each domain owns its data and communicates with others exclusively through events.

| Domain | Status | Owns Tables |
|--------|--------|-------------|
| Identity | Frozen | user, role, permission |
| Student | Frozen | student, student_parent |
| Teaching | Sprint 4 (In Progress) | course, class, lesson, contract, enrollment, lesson_attendance, lesson_change_request, teacher_assignment |
| Finance | Planned (Sprint 6) | (to be designed) |
| Points | Planned | (to be designed) |
| Notification | Planned | (to be designed) |
| Dashboard | Planned | (none — read-only) |

**Key Rule**: Each field has exactly one owning domain (Single Writer Principle). Cross-domain data access is via events only, never direct DB queries.

**Reference**: [DomainCatalog.md](../DomainCatalog/DomainCatalog.md), [TeachingDomainModel.md](../DomainModel/TeachingDomainModel.md), [AttendanceDomainModel.md](../DomainModel/AttendanceDomainModel.md)

---

## Chapter 02: Business Rules

Every domain has a set of **Domain Invariants** — unconditional business rules that can never be violated, regardless of code changes.

**Teaching Domain Invariants:**

| ID | Rule | Enforced By |
|----|------|-------------|
| A001 | One attendance record per student per lesson | @Unique constraint |
| A002 | Status must be set before confirmation | Nullable status field |
| A003 | LOCKED records are immutable | Terminal workflow state |
| A004 | Attendance never triggers deduction directly | Event chain design |
| A005 | All students must have attendance before archive | Guard in LessonService |
| CR001 | Every lesson change goes through ChangeRequest | Application workflow |
| CR002 | One active request per lesson per type | countPendingByLessonAndType |
| CR003 | Executed request references Lesson | Entity foreign key |

**Constitution Rules (non-negotiable):**

| Rule | Description |
|------|-------------|
| Rule 16 | Only `lesson.finished` triggers financial operations |
| Rule 17 | Single Writer — each field has one owner domain |
| Rule 18 | All calculations server-side |
| Rule 19 | Lesson is the core business timeline |
| Rule 20 | Every financial trace links to a lesson |
| Rule 21 | Events are the only cross-domain communication |
| Rule 22 | State transitions are unidirectional |
| Rule 25 | One domain at a time — no cross-domain code dependencies |

**Reference**: [AttendanceRules.md](../BusinessRules/AttendanceRules.md), [LessonChangeRequestRules.md](../BusinessRules/LessonChangeRequestRules.md), [EnrollmentRules.md](../BusinessRules/EnrollmentRules.md), [TeachingConstitution_v1.1.md](../architecture/TeachingConstitution_v1.1.md)

---

## Chapter 03: Event Architecture

Domains communicate exclusively through domain events. No direct API calls between business domains.

**Event Bus**: `@nestjs/event-emitter` (EventEmitter2), wrapped by `EventBusService` which adds `eventId` (UUID) and `timestamp` to every event.

**Event Naming**: `<domain>.<action>[.<context>]` — lowercase dot notation.

**Current Event Chain (Teaching):**

```
lesson.completed  (TEACHING -> FINISHED)
       |
       v  [review window]
attendance.confirmed  (all attendance confirmed/locked)
       |
       v  [guard: all confirmed]
lesson.finished  (FINISHED -> ARCHIVED) --> triggers Finance deduction
```

**Total Events**: 24 registered (2 CURRENT, 9 DESIGNED, 5 PLANNED, 8 FUTURE).

**Safety Constraints:**
- `attendance.confirmed` MUST precede `lesson.finished`
- `lesson.completed` MUST precede `lesson.finished`
- Finance ONLY reacts to `lesson.finished` — never to `attendance.confirmed` or `lesson.completed`
- All listeners MUST be idempotent (keyed by `lessonId`)

**Reference**: [EventCatalog.md](../EventCatalog/EventCatalog.md), [EventSchema.md](../EventCatalog/EventSchema.md), [EventBusSpecification.md](../05-EventBus/EventBusSpecification.md), [ADR-010](../DecisionLog/ADR-010-Attendance-Event-Ownership.md)

---

## Chapter 04: State Management

Every entity with mutable status follows a formal state machine. State transitions are unidirectional (Rule 22). Reverse transitions require admin authority and a logged reason.

**9 Registered State Machines:**

| # | Entity | States | Terminal |
|---|--------|--------|----------|
| 1 | Student | ACTIVE, PAUSED, GRADUATED, INACTIVE | GRADUATED |
| 2 | Course | DRAFT, PUBLISHED, ARCHIVED | ARCHIVED |
| 3 | Class | DRAFT, ACTIVE, COMPLETED, CANCELLED | COMPLETED |
| 4 | Contract | ACTIVE, EXHAUSTED, EXPIRED, FROZEN, REFUNDED | EXHAUSTED, EXPIRED, REFUNDED |
| 5 | Lesson | DRAFT, SCHEDULED, TEACHING, FINISHED, ARCHIVED, CANCELLED | ARCHIVED |
| 6 | Attendance Workflow | PENDING, CHECKED_IN, CONFIRMED, LOCKED | LOCKED |
| 7 | ChangeRequest | PENDING, APPROVED, REJECTED, EXECUTED | REJECTED, EXECUTED |
| 8 | Enrollment | ACTIVE, WITHDRAWN, COMPLETED | COMPLETED |
| 9 | TeacherAssignment | ACTIVE, INACTIVE | INACTIVE |

**Testing Standard**: Every state machine MUST have 100% transition coverage in unit tests (Sprint 4.1.5+ standard).

**Reference**: [StateMachineCatalog.md](../StateMachine/StateMachineCatalog.md), [AttendanceStateMachine.md](../StateMachine/AttendanceStateMachine.md)

---

## Chapter 05: API Design

> TO BE DESIGNED

API versioning strategy, authentication flow, and endpoint conventions will be documented here once the API layer is formalized.

**Current State**: Teaching Domain endpoints are skeleton (NotImplementedException). Full API design pending.

**Reference**: [API-Specification.md](../04-API/API-Specification.md)

---

## Chapter 06: Data Architecture

**Database**: MySQL 8.0.41 with TypeORM 1.0.0.

**Ownership**: Each domain owns its tables. No shared tables between domains.

**Teaching Domain Tables:**

| Table | Entity | Unique Constraints |
|-------|--------|-------------------|
| `course` | Course | code |
| `class` | Class | code |
| `lesson` | Lesson | (classCode, scheduledDate, sessionIndex) |
| `contract` | Contract | code |
| `enrollment` | Enrollment | (classCode, studentCode) |
| `teacher_assignment` | TeacherAssignment | (classCode, teacherId, startDate) |
| `lesson_attendance` | LessonAttendance | (lessonId, studentCode) |
| `lesson_change_request` | LessonChangeRequest | — |

**Naming**: snake_case for tables and columns. PascalCase for entities.

**Reference**: [ER.md](../03-Database/ER.md), [TableDictionary.md](../03-Database/TableDictionary.md)

---

## Chapter 07: Infrastructure

> TO BE DESIGNED

Deployment architecture, scaling strategy, and infrastructure details will be documented here.

**Current State**: Development environment only. Production deployment planned.

**Reference**: [DeployGuide.md](../10-Deploy/DeployGuide.md)

---

## Chapter 08: Security

> TO BE DESIGNED

Authentication model (JWT), authorization (RBAC), data protection, and audit requirements will be documented here.

**Current State**: Permission module exists but is not yet connected to Teaching Domain.

**Reference**: [PermissionDesign.md](../06-Permission/PermissionDesign.md)

---

## Chapter 09: Observability

> TO BE DESIGNED

Logging standards, monitoring approach, and alerting strategy will be documented here.

**Current State**: Logger integrated in NestJS services. No centralized logging or monitoring yet.

---

## Chapter 10: Testing Strategy

**Test Pyramid:**

```
        ┌──────────┐
        │ E2E      │  ← Few, high confidence
        ├──────────┤
        │Integration│  ← Moderate, test module boundaries
        ├──────────┤
        │  Unit    │  ← Many, fast, isolated
        └──────────┘
```

**Current Focus** (Sprint 4.1.5+): Unit tests for state machines and domain invariants.

**Standard**: Every state machine MUST have 100% transition coverage. Every domain invariant MUST have a dedicated test.

**What we test:**
- State machine transitions (valid, invalid, reverse, forbidden)
- Domain invariants (invariant preservation under all transitions)
- Entity structure (fields, enums, constraints)

**What we do NOT test** (in Phase 2-3):
- Controller endpoints (tested in Phase 4+ with business logic)
- Database queries (tested in integration phase)

**Reference**: [TestPlan.md](../09-Test/TestPlan.md)

---

## Chapter 11: Decision Records

All architectural decisions are recorded as ADRs (Architecture Decision Records) in `docs/DecisionLog/`.

| ADR | Title | Status | Sprint |
|-----|-------|--------|--------|
| ADR-007 | Shared Domain Enum | ACCEPTED | 3 |
| ADR-008 | Unified Code Generator | ACCEPTED | 3 |
| ADR-009 | Enrollment Reactivation | ACCEPTED | 4 |
| ADR-010 | Attendance Event Ownership | PROPOSED | 4.1.5 |
| DEC-005 | Teaching Domain Decision | ACCEPTED | 4 |

**Reference**: [DecisionLog/](../DecisionLog/)

---

## Appendix A: Document Index

| Category | Document | Version | Location |
|----------|----------|---------|----------|
| **Constitution** | Constitution-v4.0 | v4.0 | `00-Constitution/Constitution-v4.0.md` |
| **Constitution** | TeachingConstitution | v1.1.0 | `architecture/TeachingConstitution_v1.1.md` |
| **Domain** | DomainCatalog | v0.1.0 | `DomainCatalog/DomainCatalog.md` |
| **Domain** | TeachingDomainModel | v1.0.0 | `DomainModel/TeachingDomainModel.md` |
| **Domain** | AttendanceDomainModel | v1.0.0 | `DomainModel/AttendanceDomainModel.md` |
| **Rules** | AttendanceRules | v1.0.0 | `BusinessRules/AttendanceRules.md` |
| **Rules** | LessonChangeRequestRules | v1.0.0 | `BusinessRules/LessonChangeRequestRules.md` |
| **Rules** | EnrollmentRules | v1.1.0 | `BusinessRules/EnrollmentRules.md` |
| **Rules** | LessonRules | v1.0.0 | `BusinessRules/LessonRules.md` |
| **Rules** | ClassRules | v1.0.0 | `BusinessRules/ClassRules.md` |
| **Rules** | CourseRules | v1.0.0 | `BusinessRules/CourseRules.md` |
| **Rules** | ContractRules | v1.0.0 | `BusinessRules/ContractRules.md` |
| **Rules** | StudentRules | v1.0.0 | `BusinessRules/StudentRules.md` |
| **Rules** | TeachingRules | v1.0.0 | `BusinessRules/TeachingRules.md` |
| **Events** | EventCatalog | v0.2.0 | `EventCatalog/EventCatalog.md` |
| **Events** | EventSchema | v1.0.0 | `EventCatalog/EventSchema.md` |
| **Events** | EventBusSpecification | — | `05-EventBus/EventBusSpecification.md` |
| **State** | StateMachineCatalog | v0.2.0 | `StateMachine/StateMachineCatalog.md` |
| **State** | AttendanceStateMachine | v1.0.0 | `StateMachine/AttendanceStateMachine.md` |
| **State** | LessonStateMachine | — | `StateMachine/LessonStateMachine.md` |
| **State** | CourseStateMachine | — | `StateMachine/CourseStateMachine.md` |
| **State** | ClassStateMachine | — | `StateMachine/ClassStateMachine.md` |
| **Decisions** | ADR-007 | ACCEPTED | `DecisionLog/ADR-007-SharedDomainEnum.md` |
| **Decisions** | ADR-008 | ACCEPTED | `DecisionLog/ADR-008-UnifiedCodeGenerator.md` |
| **Decisions** | ADR-009 | ACCEPTED | `DecisionLog/ADR-009-Enrollment-Reactivation.md` |
| **Decisions** | ADR-010 | PROPOSED | `DecisionLog/ADR-010-Attendance-Event-Ownership.md` |
| **Decisions** | DEC-005 | ACCEPTED | `DecisionLog/DEC-005-TeachingDomain.md` |
| **Audit** | TeachingConsistencyAudit-v2 | — | `TeachingConsistencyAudit-v2.md` |
| **Audit** | AttendanceConsistencyAudit | v1.0.0 | `AttendanceConsistencyAudit.md` |
| **Data** | ER | — | `03-Database/ER.md` |
| **Data** | TableDictionary | — | `03-Database/TableDictionary.md` |
| **API** | APISpecification | — | `04-API/API-Specification.md` |
| **Navigation** | README | — | `docs/README.md` |

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **Domain** | A bounded context with its own data, rules, and events. Examples: Teaching, Finance, Student. |
| **Entity** | A domain object with a unique identity (has an `id` field). Examples: Lesson, Student, Contract. |
| **Aggregate** | A cluster of entities treated as a unit for data changes. The aggregate root is the only entry point. |
| **Domain Invariant** | An unconditional business rule that must always be true. Examples: "One attendance record per student per lesson." |
| **State Machine** | A formal model defining allowed status transitions for an entity. |
| **Event** | A fact about something that happened. Published by one domain, consumed by others. |
| **ADR** | Architecture Decision Record. A document capturing a significant architectural decision. |
| **Single Writer** | Each field has exactly one owning domain. No two domains write to the same field. |
| **Terminal State** | A state with no transitions out. Once entered, the entity cannot change status. |
| **Guard** | A condition that must be met for a state transition to be allowed. |
| **Idempotency** | The property that processing the same event twice produces the same result as processing it once. |
| **Constitution** | The highest-level architectural document. Rules here cannot be overridden by lower-level documents. |

---

*This is a living document. Update it when new domains, events, or state machines are added. The Handbook should always reflect the current state of EduOS architecture.*
