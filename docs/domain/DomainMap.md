# EduOS Domain Map

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: DDD strategic design showing bounded contexts, their relationships, and domain classification. This is the authoritative source for domain ownership.
> **Parent**: [BusinessCapabilityMap.md](./BusinessCapabilityMap.md)
> **Child**: [BoundedContexts.md](./BoundedContexts.md)

---

## Domain Classification (DDD Strategic Design)

### Core Domains

> Core domains provide competitive advantage. They receive the most investment and the strictest governance.

| Domain | Description | Why Core |
|--------|-------------|----------|
| **Teaching** | Everything about what is taught, who teaches, who learns, when it happens | The business IS teaching. This is the product. |
| **Finance** | Contract deduction, teacher salary, payment tracking | Direct revenue impact. Accuracy is non-negotiable. |

### Supporting Domains

> Supporting domains support the core but are not the primary product.

| Domain | Description | Why Supporting |
|--------|-------------|----------------|
| **Student** | Student lifecycle, parent linking, demographics | Essential for Teaching but not the primary value proposition |
| **Points** | Attendance-based rewards, redemption | Engagement tool, not core business |

### Generic Domains

> Generic domains are common across industries. Buy or use standard solutions.

| Domain | Description | Why Generic |
|--------|-------------|-------------|
| **Identity** | User management, authentication, RBAC | Every system needs this. Not differentiated. |
| **Notification** | WeChat templates, push notifications, email | Commodity functionality |
| **Dashboard** | Analytics, reporting, real-time stats | Read-only aggregation. No business logic. |

---

## Domain Map (Visual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EduOS Domain Map                                  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Identity   │  │   Student    │  │   Teaching   │  │   Finance    │   │
│  │   (Generic)  │  │ (Supporting) │  │    (Core)    │  │    (Core)    │   │
│  │              │  │              │  │              │  │              │   │
│  │  user        │  │  student     │  │  course      │  │  (planned)   │   │
│  │  role        │  │  student_    │  │  class       │  │              │   │
│  │  permission  │  │  parent      │  │  contract    │  │              │   │
│  │              │  │              │  │  enrollment  │  │              │   │
│  │  FROZEN      │  │  FROZEN      │  │  lesson      │  │  PLANNED     │   │
│  │              │  │              │  │  attendance  │  │  Sprint 6    │   │
│  │              │  │              │  │  change_req  │  │              │   │
│  │              │  │              │  │  teacher_asn │  │              │   │
│  │              │  │              │  │              │  │              │   │
│  │              │  │              │  │  IN PROGRESS │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         │    events       │    events       │    events       │            │
│         └─────────────────┴────────┬────────┴─────────────────┘            │
│                                    │                                       │
│                                    ▼                                       │
│                          ┌──────────────────┐                              │
│                          │    EventBus      │                              │
│                          │ (@nestjs/event-  │                              │
│                          │    emitter)      │                              │
│                          └────────┬─────────┘                              │
│                                   │                                        │
│                    ┌──────────────┼──────────────┐                         │
│                    ▼              ▼              ▼                         │
│             ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│             │  Points  │  │Notifi-   │  │Dashboard │                     │
│             │(Support) │  │cation    │  │(Generic) │                     │
│             │          │  │(Generic) │  │          │                     │
│             │ PLANNED  │  │ PLANNED  │  │ PLANNED  │                     │
│             └──────────┘  └──────────┘  └──────────┘                     │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Domain Details

### 1. Identity Domain

| Property | Value |
|----------|-------|
| **Classification** | Generic |
| **Status** | Frozen |
| **Sprint** | 1-2 |
| **Owns Tables** | `user`, `role`, `permission` |
| **Owns Events** | `user.login` (FUTURE), `user.logout` (FUTURE), `rule.updated` (FUTURE), `config.changed` (FUTURE) |
| **Depends On** | None |
| **Depended On By** | All domains (authentication, authorization) |
| **Key Entities** | User, Role, Permission |
| **Key Invariants** | User must have at least one role. Permission codes are globally unique. |

### 2. Student Domain

| Property | Value |
|----------|-------|
| **Classification** | Supporting |
| **Status** | Frozen |
| **Sprint** | 3 |
| **Owns Tables** | `student`, `student_parent` |
| **Owns Events** | `student.deactivated` (DESIGNED), `student.status.changed` (PLANNED), `student.created` (FUTURE) |
| **Depends On** | Identity (User for parent linking) |
| **Depended On By** | Teaching (studentCode references) |
| **Key Entities** | Student, StudentParent |
| **Key Invariants** | StudentCode immutable, never recycled. Soft delete only. One parent can have multiple students. |

### 3. Teaching Domain

| Property | Value |
|----------|-------|
| **Classification** | Core |
| **Status** | In Progress |
| **Sprint** | 4-5 |
| **Owns Tables** | `course`, `class`, `contract`, `enrollment`, `lesson`, `lesson_attendance`, `lesson_change_request`, `teacher_assignment` |
| **Owns Events** | `lesson.completed` (CURRENT), `lesson.finished` (CURRENT), `attendance.confirmed` (DESIGNED), `lesson.feedback.created` (DESIGNED), `leave.submitted` (DESIGNED), `leave.approved` (DESIGNED) |
| **Depends On** | Identity (teacher User), Student (studentCode) |
| **Depended On By** | Finance (lesson.finished triggers deduction), Points (attendance-based awards), Notification, Dashboard |
| **Key Entities** | Course, Class, Contract, Enrollment, Lesson, LessonAttendance, LessonChangeRequest, TeacherAssignment |
| **Key Invariants** | Lesson is the only business timeline (Rule 19). Every money must have a lesson (Rule 20). One attendance per student per lesson. |

### 4. Finance Domain

| Property | Value |
|----------|-------|
| **Classification** | Core |
| **Status** | Planned |
| **Sprint** | 6 |
| **Owns Tables** | (to be designed) |
| **Owns Events** | `contract.exhausted` (DESIGNED), `contract.expired` (DESIGNED), `contract.refunded` (DESIGNED), `contract.deducted` (PLANNED), `salary.calculated` (PLANNED) |
| **Depends On** | Teaching (lesson.finished event, contractCode, enrollment) |
| **Depended On By** | Dashboard |
| **Key Entities** | (to be designed) |
| **Key Invariants** | Only lesson.finished triggers deduction (Rule 16). Contract.remainingLessons non-negative. |

### 5. Points Domain

| Property | Value |
|----------|-------|
| **Classification** | Supporting |
| **Status** | Planned |
| **Sprint** | 7-8 |
| **Owns Tables** | (to be designed) |
| **Owns Events** | `points.awarded` (FUTURE), `points.redeemed` (FUTURE) |
| **Depends On** | Teaching (attendance.confirmed), Finance (points.granted) |
| **Depended On By** | Dashboard |
| **Key Entities** | (to be designed) |
| **Key Invariants** | Points balance non-negative. |

### 6. Notification Domain

| Property | Value |
|----------|-------|
| **Classification** | Generic |
| **Status** | Planned |
| **Sprint** | 7-8 |
| **Owns Tables** | (to be designed) |
| **Owns Events** | None (consumes only) |
| **Depends On** | All domains (consumes events) |
| **Depended On By** | None |
| **Key Entities** | (to be designed) |
| **Key Invariants** | Notifications are best-effort. Failures do not block business operations. |

### 7. Dashboard Domain

| Property | Value |
|----------|-------|
| **Classification** | Generic |
| **Status** | Planned |
| **Sprint** | 9+ |
| **Owns Tables** | None (read-only, may have materialized views) |
| **Owns Events** | None (consumes only) |
| **Depends On** | All domains (reads data via events) |
| **Depended On By** | None |
| **Key Entities** | (to be designed) |
| **Key Invariants** | Dashboard never modifies business data. Read-only. |

---

## Domain Dependencies (Event Flow)

```
Identity ─────────────────────────────────────────────────────────┐
    │                                                              │
    ▼                                                              │
Student ──────────────────────────────────────────────────────────┤
    │                                                              │
    ▼                                                              │
Teaching ──► lesson.completed ──► Dashboard                       │
    │                                                              │
    ├──► attendance.confirmed ──► Dashboard, Points (future)      │
    │                                                              │
    ├──► lesson.finished ──► Finance ──► contract.exhausted ──►┐  │
    │                                          │                │  │
    │                                          ├──► Teaching    │  │
    │                                          ├──► Dashboard   │  │
    │                                          │                │  │
    │                                          ▼                │  │
    │                                   contract.expired        │  │
    │                                   contract.refunded       │  │
    │                                   salary.calculated       │  │
    │                                          │                │  │
    │                                          ▼                │  │
    │                                     Notification          │  │
    │                                     Dashboard             │  │
    │                                                              │
    ├──► leave.submitted ──► Notification (future)               │
    ├──► leave.approved ──► Notification (future)                │
    │                                                              │
    ▼                                                              │
Points ──► points.awarded ──► Dashboard, Notification            │
    │                                                              │
    ▼                                                              │
Points ──► points.redeemed ──► Dashboard                         │
                                                                             
Student ──► student.deactivated ──► Teaching                    
Student ──► student.status.changed ──► Teaching, Finance, Dashboard
```

---

## Domain Boundary Rules

1. **Single Writer Principle (Rule 17)**: Each field has exactly one owning domain. No two domains write to the same field.
2. **Event-Only Communication (Rule 21)**: Domains communicate exclusively through events. No direct API calls between business domains.
3. **One Domain At A Time (Rule 25)**: Current domain must complete Gate/Release/Freeze before entering the next domain.
4. **Skeleton First (Rule 24)**: New domains must complete skeleton before business logic.
5. **Dependency Order (Rule 15)**: Business objects must exist before dependent operations.

---

## Sprint Alignment

| Sprint | Domain | Gate |
|--------|--------|------|
| Sprint 1-2 | Identity | Frozen |
| Sprint 3 | Student | Frozen |
| Sprint 4 | Teaching (skeleton + deep modeling) | In Progress |
| Sprint 5 | Teaching (domain blueprint + implementation) | In Progress |
| Sprint 6 | Finance | Planned |
| Sprint 7-8 | Points, Notification | Planned |
| Sprint 9+ | Dashboard | Planned |

---

*This is a living document. Update when domain boundaries change or new domains are added. The domain map should always reflect the current DDD strategic design.*
