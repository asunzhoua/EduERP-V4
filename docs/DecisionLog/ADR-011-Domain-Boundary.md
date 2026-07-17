# ADR-011: Domain Boundary Definition

> **Status**: PROPOSED
> **Date**: 2026-07-15
> **Sprint**: 5 WP1
> **Supersedes**: DomainCatalog.md (formalizes boundary rules)
> **Relates to**: Constitution Rule 17 (Data Ownership), Rule 21 (Event Publishing), Rule 25 (One Domain At A Time)

---

## Context

EduOS has 7 planned domains. Without formal boundary definitions, developers (human and AI) may:
1. Accidentally create cross-domain dependencies
2. Place entities in the wrong domain
3. Bypass event-driven communication with direct imports
4. Violate the Single Writer Principle

The DomainCatalog.md lists domains but does not formally define boundaries or enforcement mechanisms.

---

## Decision

**Formalize domain boundaries using the following five rules:**

### Rule DB-001: One Owner Per Table

Each database table has exactly one owning domain. No other domain may INSERT, UPDATE, or DELETE rows in that table.

| Table | Owner Domain | Others May Read? |
|-------|-------------|-----------------|
| `user` | Identity | Yes (by userId reference) |
| `role` | Identity | Yes (for RBAC checks) |
| `permission` | Identity | Yes (for RBAC checks) |
| `student` | Student | Yes (by studentCode reference) |
| `student_parent` | Student | Yes (for parent linking) |
| `course` | Teaching | Yes |
| `class` | Teaching | Yes |
| `contract` | Teaching (creation, freeze) / Finance (deduction) | Yes |
| `enrollment` | Teaching | Yes (Finance reads for deduction path) |
| `lesson` | Teaching | Yes |
| `lesson_attendance` | Teaching | Yes |
| `lesson_change_request` | Teaching | Yes |
| `teacher_assignment` | Teaching | Yes |

**Exception:** `contract` is owned by Teaching for lifecycle management (create, freeze, unfreeze) but by Finance for financial operations (deduction, refund). This is a controlled exception documented in ADR-012.

### Rule DB-002: Event-Only Cross-Domain Communication

Domains communicate exclusively through domain events. No direct API calls, no shared database queries, no shared service imports.

**Allowed:**
- Teaching emits `lesson.finished` → Finance listens
- Student emits `student.deactivated` → Teaching listens

**Prohibited:**
- Finance importing TeachingService to check lesson status
- Dashboard querying Teaching tables directly
- Notification calling StudentService to get parent contact info

### Rule DB-003: Identity References Only

Cross-aggregate references are by identity (code, ID) only, not by entity object.

**Allowed:**
- Enrollment references Class by `classCode` (string)
- Enrollment references Contract by `contractCode` (string)
- Lesson references Student by `studentCode` (string)

**Prohibited:**
- Enrollment containing a Class entity object
- Lesson containing a Student entity object

### Rule DB-004: No Shared Mutable State

Domains do not share mutable state. Read-only access to other domains' data is permitted only through events.

**Allowed:**
- Finance reads Enrollment to find Contract (read-only, during event processing)
- Dashboard reads all domains for aggregation (read-only)

**Prohibited:**
- Two domains both updating the same field
- A domain caching another domain's mutable data

### Rule DB-005: Boundary Enforcement at Module Level

Domain boundaries are enforced at the NestJS module level. Each domain is a module. Module imports are explicit and logged.

**Teaching module imports:**
- `common.module` (shared utilities)
- `identity.module` (for user authentication)
- `student.module` (for studentCode validation)

**Teaching module does NOT import:**
- `finance.module`
- `points.module`
- `notification.module`
- `dashboard.module`

---

## Consequences

### Positive
- Clear, enforceable rules for domain boundaries
- Prevents accidental cross-domain coupling
- Aligns with Constitution Rules 17, 21, 25
- NestJS module system provides runtime enforcement

### Negative
- Requires discipline to maintain boundaries
- Some legitimate cross-domain reads (Finance reading Enrollment) need explicit documentation

---

## Compliance Check

| Rule | Teaching | Finance | Student | Identity |
|------|---------|---------|---------|----------|
| One Owner Per Table | PASS | PASS | PASS | PASS |
| Event-Only Communication | PASS | PASS | PASS | PASS |
| Identity References Only | PASS | PASS | PASS | PASS |
| No Shared Mutable State | PASS | PASS | PASS | PASS |
| Module-Level Enforcement | PASS | PASS | PASS | PASS |

---

*This ADR formalizes the domain boundary rules. All developers (human and AI) must comply. Violations are architecture bugs.*
