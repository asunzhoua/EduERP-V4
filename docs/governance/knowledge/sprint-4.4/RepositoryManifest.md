# Repository Manifest

> Sprint 4.4 — Phase 7: Repository Manifest
> Generated: 2026-07-15
> Auto-generated baseline — single source of truth for repository state

---

## Version Information

| Dimension | Version |
|-----------|---------|
| Repository Version | EduERP-V4 |
| Sprint Version | 4.4 |
| Architecture Version | v1.0 (NestJS Monolith + DDD) |
| Governance Version | v1.0 (7 CLI validators) |
| Knowledge Version | Sprint 4.4 (11+5 artifacts) |

---

## Codebase Metrics

### File Counts

| Category | Count |
|----------|-------|
| TypeScript files (backend/src) | 154 |
| Entity files | 19 |
| Service files | 17 |
| Controller files | 10 |
| Module files | 14 |
| DTO files | 27 |
| Repository files | 8 |
| Enum files | 18 |
| Event class files | 6 |
| Subscriber files | 1 |
| Test spec files | 8 |

### DDD Metrics

| Category | Count |
|----------|-------|
| Bounded Contexts | 3 (Identity, Student, Teaching) |
| Modules | 14 |
| Aggregates | 10 |
| Entities | 19 |
| Value Objects | 0 (not implemented) |
| Domain Services | 0 (services are application-level) |
| Application Services | 17 |
| Repositories | 8 (Teaching only) |
| Events (catalog) | 24 |
| Events (code classes) | 6 |
| Events (emitting) | 2 |
| State Machines (catalog) | 9 |
| State Machines (code) | 6 |

### Governance Metrics

| Category | Count |
|----------|-------|
| ADR/DEC files | 5 |
| Validators (CLI scripts) | 7 |
| Governance tests | 74 |
| Governance checks | 25 (20 PASS, 1 FAIL, 4 WARN) |

### Test Metrics

| Category | Count |
|----------|-------|
| Backend test suites | 8 |
| Backend tests | 166 |
| Governance test suites | 9 |
| Governance tests | 74 |
| **Total tests** | **240** |

---

## Module Inventory

| # | Module | Type | Entities | Services | Controllers | Status |
|---|--------|------|----------|----------|-------------|--------|
| 1 | AppModule | Root | — | — | — | Complete |
| 2 | EventBusModule | Infrastructure | — | 1 | — | Complete |
| 3 | DatabaseModule | Infrastructure | — | 1 | — | Complete |
| 4 | IdentityModule | Bounded Context | 6 | 1 | 1 | Complete |
| 5 | StudentModule | Bounded Context | 4 | 2 | 1 | Complete |
| 6 | TeachingModule | Aggregate Facade | — | — | — | Complete |
| 7 | CourseModule | Sub-module | 2 | 2 | 1 | Complete |
| 8 | ClassModule | Sub-module | 1 | 2 | 1 | Complete |
| 9 | ContractModule | Sub-module | 1 | 2 | 1 | Skeleton |
| 10 | EnrollmentModule | Sub-module | 1 | 1 | 1 | Skeleton |
| 11 | LessonModule | Sub-module | 1 | 1 | 1 | Skeleton |
| 12 | TeacherAssignmentModule | Sub-module | 1 | 1 | 1 | Skeleton |
| 13 | LessonAttendanceModule | Sub-module | 1 | 1 | 1 | Skeleton |
| 14 | LessonChangeRequestModule | Sub-module | 1 | 1 | 1 | Skeleton |

---

## Shared Kernel (common/)

| Directory | Status | Contents |
|-----------|--------|----------|
| common/enums/ | **Active** | 6 canonical enums (Subject, TeacherRole, ChangeRequestType, EnrollmentStatus, CreatedSource, AuditAction) |
| common/decorators/ | Active | Public, Roles decorators |
| common/dto/ | Active | ApiResponse |
| common/filters/ | Active | GlobalExceptionFilter |
| common/guards/ | Active | RolesGuard |
| common/interceptors/ | Active | ResponseInterceptor |
| common/constants/ | Empty | .gitkeep only |
| common/exceptions/ | Empty | .gitkeep only |
| common/interfaces/ | Empty | .gitkeep only |

---

## Enum Inventory (Post-Consolidation)

### Shared (common/enums/) — 6

| Enum | Values | Used By |
|------|--------|---------|
| Subject | 11 values | Course, Contract, Enrollment |
| TeacherRole | 3 values | Class, TeacherAssignment |
| ChangeRequestType | 4 values | Lesson, LessonChangeRequest |
| EnrollmentStatus | 3 values | Class, Enrollment |
| CreatedSource | 3 values | Student, Course |
| AuditAction | 5 values | Student, Course |

### Domain-Specific — 12

| Enum | Module | Values |
|------|--------|--------|
| Gender | Student | 3 |
| ParentRelation | Student | 5 |
| StudentStatus | Student | 5 |
| ClassStatus | Class | 5 |
| ContractStatus | Contract | 5 |
| CourseStatus | Course | 5 |
| CourseType | Course | 3 |
| LessonStatus | Lesson | 6 |
| AttendanceStatus | LessonAttendance | 7 |
| AttendanceSource | LessonAttendance | 3 |
| AttendanceWorkflowState | LessonAttendance | 4 |
| ChangeRequestStatus | LessonChangeRequest | 5 |

---

## Event Inventory

### Event Classes (code) — 6

| Event | Domain | Imported | Status |
|-------|--------|----------|--------|
| LessonCompletedEvent | Lesson | No | Dead code (design intent) |
| LessonFinishedEvent | Lesson | No | Dead code (design intent) |
| LessonFeedbackCreatedEvent | Lesson | No | Dead code (design intent) |
| LeaveSubmittedEvent | Leave | No | Dead code (design intent) |
| LeaveApprovedEvent | Leave | No | Dead code (design intent) |
| PointsGrantedEvent | Finance | No | Dead code (design intent) |

### Emitting Events — 2

| Event | Publisher | Subscriber |
|-------|-----------|------------|
| lesson.completed | LessonService | LessonEventSubscriber (logging) |
| lesson.finished | LessonService | LessonEventSubscriber (logging) |

---

## Health Score

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Test Coverage | 70% (166 tests, 8/17 services tested) | 25% | 17.5 |
| Architecture Consistency | 75% (8 inconsistencies found) | 25% | 18.75 |
| Governance Compliance | 80% (20/25 PASS) | 20% | 16.0 |
| Code Quality | 85% (0 circular deps, clean patterns) | 15% | 12.75 |
| Documentation | 70% (11 knowledge artifacts, 5 ADRs) | 15% | 10.5 |
| **Repository Health Score** | | **100%** | **75.5/100** |

---

## Last Scan

| Metric | Value |
|--------|-------|
| Scan Date | 2026-07-15 |
| Sprint | 4.4 |
| Total Files Scanned | 154 |
| Tests Passing | 240 (166 backend + 74 governance) |
| TypeScript Errors | 1 (pre-existing in course.service.spec.ts) |
| Known Debt Items | 39 (0 HIGH, 11 MEDIUM, 28 LOW) |
