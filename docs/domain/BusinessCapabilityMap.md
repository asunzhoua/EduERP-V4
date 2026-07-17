# EduOS Business Capability Map

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: The highest-level view of what EduOS does. Every capability answers "What does the business need?" without specifying "How does the system implement it?"
> **Audience**: CTO, Product Owner, new developers, AI agents.

---

## How to Read This Document

This is the **top of the documentation hierarchy**. It shows the business capabilities that EduOS must deliver. Each capability is independent of implementation. The Domain Map (`docs/domain/DomainMap.md`) shows how these capabilities are organized into bounded contexts.

```
Business Capability Map (WHAT the business needs)
        │
        ▼
Domain Map (WHO owns what)
        │
        ▼
Bounded Contexts (WHERE are the boundaries)
        │
        ▼
Aggregates (WHAT are the consistency units)
        │
        ▼
Domain Events (HOW do contexts talk)
```

---

## Capability Hierarchy

### Level 1: Business Capabilities

```
EduOS Education Operating System
├── 1. Identity & Access Management
├── 2. Student Lifecycle Management
├── 3. Teaching Operations
├── 4. Financial Operations
├── 5. Engagement & Rewards
├── 6. Communication
└── 7. Analytics & Reporting
```

---

### Level 2: Sub-Capabilities

#### 1. Identity & Access Management

| Capability | Description | Status |
|-----------|-------------|--------|
| 1.1 User Management | Create, update, deactivate user accounts (Admin, Teacher, Parent roles) | Frozen |
| 1.2 Authentication | JWT-based login/logout, session management | Frozen |
| 1.3 Authorization | Role-Based Access Control (RBAC), permission assignment | Frozen |
| 1.4 Parent-Student Linking | Associate parents with their children, multi-parent support | Frozen |

#### 2. Student Lifecycle Management

| Capability | Description | Status |
|-----------|-------------|--------|
| 2.1 Student Registration | Create student profiles with demographics, assign unique StudentCode | Frozen |
| 2.2 Student Status Management | Track student lifecycle: Active, Paused, Graduated, Inactive | Frozen |
| 2.3 Student Import | Batch import students from Excel/CSV files | Frozen |
| 2.4 Student Deactivation | Deactivate students with audit trail, notify dependent domains | Planned |

#### 3. Teaching Operations

| Capability | Description | Status |
|-----------|-------------|--------|
| 3.1 Course Catalog | Define teaching products (courses) with subject, type, duration | In Progress |
| 3.2 Class Management | Create teaching group instances with schedule, capacity, teacher assignment | In Progress |
| 3.3 Lesson Scheduling | Auto-generate lessons from class schedule, manage individual lessons | In Progress |
| 3.4 Attendance Tracking | Two-dimensional attendance: workflow state (PENDING→LOCKED) + status (PRESENT/ABSENT/etc.) | In Progress |
| 3.5 Lesson Change Management | Formal change requests for reschedule, teacher change, cancel, reopen | In Progress |
| 3.6 Contract Management | Purchase lesson packages, track remaining lessons, manage lifecycle | In Progress |
| 3.7 Enrollment Management | Bridge between students, classes, and contracts | In Progress |
| 3.8 Teacher Assignment | Assign primary/substitute teachers to classes with effective dates | In Progress |

#### 4. Financial Operations

| Capability | Description | Status |
|-----------|-------------|--------|
| 4.1 Contract Deduction | Deduct lessons from contract when lesson is confirmed | Planned (Sprint 6) |
| 4.2 Teacher Salary Calculation | Calculate teacher pay based on completed lessons | Planned (Sprint 6) |
| 4.3 Contract Lifecycle | Handle contract expiry, exhaustion, refund | Planned (Sprint 6) |
| 4.4 Financial Audit | Every financial record traces to a Lesson ID | Planned (Sprint 6) |

#### 5. Engagement & Rewards

| Capability | Description | Status |
|-----------|-------------|--------|
| 5.1 Points System | Award points for attendance, track balance | Planned |
| 5.2 Points Redemption | Redeem points for rewards | Future |
| 5.3 Attendance-based Awards | Automatic point awards based on attendance patterns | Future |

#### 6. Communication

| Capability | Description | Status |
|-----------|-------------|--------|
| 6.1 Parent Notifications | Notify parents of lesson completion, attendance, balance | Planned |
| 6.2 Teacher Notifications | Notify teachers of schedule changes, assignments | Future |
| 6.3 Admin Alerts | Alert admins of expiring contracts, anomalies | Future |
| 6.4 WeChat Mini Program | Parent-facing mobile interface | Planned |

#### 7. Analytics & Reporting

| Capability | Description | Status |
|-----------|-------------|--------|
| 7.1 Real-time Dashboard | Live teaching stats, financial metrics | Planned |
| 7.2 Attendance Analytics | Attendance rates, trends, anomaly detection | Future |
| 7.3 Financial Reports | Revenue, costs, profit margins | Future |
| 7.4 Teacher Performance | Teaching hours, student feedback, salary history | Future |

---

## Capability Dependencies

```
1. Identity & Access ──────────────────────────────────────┐
        │                                                    │
        ▼                                                    │
2. Student Lifecycle ──────┐                                 │
        │                   │                                 │
        ▼                   ▼                                 │
3. Teaching Operations ──────────────────┐                   │
        │    (Course, Class, Lesson,     │                   │
        │     Contract, Enrollment)      │                   │
        │                                │                   │
        ▼                                ▼                   │
4. Financial Operations ────────────────────────────────────┘
        │
        ▼
5. Engagement & Rewards
        │
        ▼
6. Communication
        │
        ▼
7. Analytics & Reporting (reads from all above)
```

**Critical Path**: Identity → Student → Teaching → Finance

This dependency chain follows Constitution Rule 15: business objects must exist before dependent operations can be developed.

---

## Capability Implementation Order

| Phase | Capabilities | Sprints | Status |
|-------|-------------|---------|--------|
| Phase 1 | 1. Identity, 2. Student | Sprint 1-3 | Frozen |
| Phase 2 | 3. Teaching Operations | Sprint 4-5 | In Progress |
| Phase 3 | 4. Financial Operations | Sprint 6 | Planned |
| Phase 4 | 5. Engagement, 6. Communication | Sprint 7-8 | Planned |
| Phase 5 | 7. Analytics & Reporting | Sprint 9+ | Future |

---

## Cross-Cutting Concerns

These capabilities span multiple business capabilities:

| Concern | Description | Enforcement |
|---------|-------------|-------------|
| Audit Trail | Every state change logged with who, when, why | Constitution Rule 5 |
| Event-Driven Communication | Domains communicate via events, never direct calls | Constitution Rule 21 |
| Server-Side Calculation | All business calculations happen on the server | Constitution Rule 18 |
| Data Ownership | Each field has exactly one owning domain | Constitution Rule 17 |
| Financial Safety | Only lesson.finished triggers money moves | Constitution Rule 16 |

---

## Relationship to Domain Map

This capability map is **implementation-agnostic**. The same capabilities may be served by different domain boundaries depending on architectural decisions. The Domain Map (`docs/domain/DomainMap.md`) shows how these capabilities are currently organized.

**Key Mapping:**

| Capability | Current Domain |
|-----------|---------------|
| 1. Identity & Access | Identity Domain |
| 2. Student Lifecycle | Student Domain |
| 3.1-3.2 Course, Class | Teaching Domain |
| 3.3-3.5 Lesson, Attendance | Teaching Domain (Attendance Subdomain) |
| 3.6-3.7 Contract, Enrollment | Teaching Domain |
| 3.8 Teacher Assignment | Teaching Domain |
| 4. Financial Operations | Finance Domain (future) |
| 5. Engagement | Points Domain (future) |
| 6. Communication | Notification Domain (future) |
| 7. Analytics | Dashboard Domain (future, read-only) |

---

*This is a living document. Update when new business capabilities are identified. The capability map should always reflect the complete scope of EduOS.*
