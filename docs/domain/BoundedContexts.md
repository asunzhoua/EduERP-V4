# EduOS Bounded Contexts

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: Precise definition of each bounded context: what it owns, what it exposes, what it consumes, and where the boundaries are enforced.
> **Parent**: [DomainMap.md](./DomainMap.md)
> **Child**: [Aggregates.md](./Aggregates.md)

---

## What Is a Bounded Context?

A bounded context is a strict boundary within which a particular domain model applies. Inside the boundary, every term has exactly one meaning (Ubiquitous Language). Across boundaries, terms may have different meanings and are translated via events.

**EduOS Rule**: Each bounded context maps to one NestJS module. The module boundary IS the context boundary. Cross-context communication happens only through the EventBus.

---

## Context Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    Identity Context                              │
│  "Who can do what?"                                              │
│                                                                  │
│  User ──has many──► Role ──has many──► Permission                │
│                                                                  │
│  Exposes: userId, role, permissions                              │
│  Consumes: Nothing (root context)                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ events: user.login, user.logout
                           │ (FUTURE)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Student Context                               │
│  "Who is learning?"                                              │
│                                                                  │
│  Student ──linked to──► StudentParent ──links to──► User          │
│                                                                  │
│  Exposes: studentCode, status                                    │
│  Consumes: Identity (User for parent linking)                    │
│  Events Out: student.deactivated, student.status.changed         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ events: student.deactivated
                           │         student.status.changed
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Teaching Context                              │
│  "What is taught, who teaches, who learns, when, and what       │
│   package pays for it"                                           │
│                                                                  │
│  Course ──has many──► Class ──has many──► Lesson                 │
│                        │    │                                    │
│                        │    ├── TeacherAssignment                │
│                        │    └── Enrollment ──funded by──► Contract│
│                        │                                         │
│                        └── LessonAttendance (per Lesson)         │
│                        └── LessonChangeRequest (per Lesson)      │
│                                                                  │
│  Exposes: lesson.completed, lesson.finished,                     │
│           attendance.confirmed                                   │
│  Consumes: Identity (teacher User), Student (studentCode)        │
│  Events Out: lesson.completed, lesson.finished,                  │
│              attendance.confirmed, leave.submitted,               │
│              leave.approved, lesson.feedback.created              │
│  Events In: contract.exhausted, contract.expired,                │
│             contract.refunded, student.deactivated                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ events: lesson.finished
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Finance Context                               │
│  "How much money moves, and why?"                                │
│                                                                  │
│  (Entities to be designed in Sprint 6)                           │
│                                                                  │
│  Exposes: contract.exhausted, contract.expired,                  │
│           contract.refunded, salary.calculated                   │
│  Consumes: Teaching (lesson.finished, contractCode)              │
│  Events In: lesson.finished                                      │
│  Events Out: contract.exhausted, contract.expired,               │
│              contract.refunded, contract.deducted,               │
│              salary.calculated, points.granted                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ events: points.granted
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Points Context                                │
│  "How are students rewarded?"                                    │
│                                                                  │
│  (Entities to be designed)                                       │
│                                                                  │
│  Exposes: points.awarded, points.redeemed                        │
│  Consumes: Finance (points.granted), Teaching (attendance)       │
│  Events In: points.granted                                       │
│  Events Out: points.awarded, points.redeemed                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ events: points.awarded
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Notification Context                          │
│  "How does the system talk to people?"                           │
│                                                                  │
│  (Entities to be designed)                                       │
│                                                                  │
│  Exposes: Nothing (consumes only)                                │
│  Consumes: All domains (listens to events)                       │
│  Events In: lesson.completed, lesson.finished,                   │
│             leave.submitted, leave.approved,                     │
│             contract.expiring, attendance.anomaly,               │
│             salary.calculated, points.awarded                    │
│  Events Out: None                                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Dashboard Context                             │
│  "What is happening right now?"                                  │
│                                                                  │
│  (Entities to be designed — read-only)                           │
│                                                                  │
│  Exposes: Nothing (read-only)                                    │
│  Consumes: All domains (reads data, aggregates)                  │
│  Events In: All events (for real-time updates)                   │
│  Events Out: None                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Context Definitions

### Identity Context

| Property | Value |
|----------|-------|
| **Classification** | Generic |
| **Status** | Frozen |
| **NestJS Module** | `src/modules/identity/` |
| **Database Tables** | `user`, `role`, `permission` |
| **Entities** | User, Role, Permission |
| **Aggregates** | User (root), Role (root) |

**Boundary Rules:**
- Identity does NOT know about Student, Teaching, Finance, or any business domain
- Identity provides authentication (who is this user?) and authorization (what can this user do?)
- Other contexts reference users by `userId` (integer PK)
- Role names: `Admin`, `Teacher`, `Parent`, `Student` (future)

**Cross-Context References:**
- Teaching context references `teacherId` (User.id where role=Teacher)
- Student context references `parentId` (User.id where role=Parent)
- No other context imports Identity entities directly

---

### Student Context

| Property | Value |
|----------|-------|
| **Classification** | Supporting |
| **Status** | Frozen |
| **NestJS Module** | `src/modules/student/` |
| **Database Tables** | `student`, `student_parent` |
| **Entities** | Student, StudentParent |
| **Aggregates** | Student (root) |

**Boundary Rules:**
- Student context owns student demographics and parent relationships
- Student context does NOT know about classes, lessons, contracts, or enrollment
- Other contexts reference students by `studentCode` (string, immutable, format: STYYYYMMNNNN)
- Student status changes emit events that Teaching context consumes

**Cross-Context References:**
- Teaching context reads `studentCode` and `status` (for enrollment validation)
- Teaching context never writes to student tables (Rule 17)
- Finance context reads `studentCode` (for contract operations)

**Events Emitted:**
- `student.deactivated` → Teaching (review enrollments)
- `student.status.changed` → Teaching, Finance, Dashboard (PLANNED)

---

### Teaching Context

| Property | Value |
|----------|-------|
| **Classification** | Core |
| **Status** | In Progress |
| **NestJS Module** | `src/modules/teaching/` |
| **Sub-Modules** | `course/`, `class/`, `contract/`, `enrollment/`, `lesson/`, `teacher-assignment/` |
| **Database Tables** | `course`, `class`, `contract`, `enrollment`, `lesson`, `lesson_attendance`, `lesson_change_request`, `teacher_assignment` |
| **Entities** | Course, Class, Contract, Enrollment, Lesson, LessonAttendance, LessonChangeRequest, TeacherAssignment |
| **Aggregates** | Course (root), Class (root), Contract (root), Lesson (root), Enrollment (root), Attendance (root) |

**Boundary Rules:**
- Teaching context owns ALL teaching operation data
- Teaching context does NOT perform financial operations (Rule 16, Rule 17)
- Teaching context does NOT modify student records (Rule 17)
- Teaching context does NOT modify user/role/permission records (Rule 17)
- Cross-domain communication is via events only (Rule 21)

**Cross-Context References:**
- References Identity: `teacherId` (User.id where role=Teacher)
- References Student: `studentCode` (Student.studentCode, read-only)
- Referenced by Finance: `lessonId`, `classCode`, `contractCode` (via events)
- Referenced by Points: `lessonId`, `studentCode` (via events)
- Referenced by Notification: `lessonId`, `studentCode` (via events)
- Referenced by Dashboard: all entity data (read-only via events)

**Events Emitted:**
- `lesson.completed` → Dashboard, Notification (FUTURE)
- `lesson.finished` → Finance, Points, Notification, Dashboard
- `attendance.confirmed` → Dashboard
- `lesson.feedback.created` → Dashboard, Notification (FUTURE)
- `leave.submitted` → Notification (FUTURE)
- `leave.approved` → Notification (FUTURE)

**Events Consumed:**
- `contract.exhausted` → sync contract status
- `contract.expired` → sync contract status
- `contract.refunded` → sync contract status
- `student.deactivated` → review enrollments

---

### Finance Context

| Property | Value |
|----------|-------|
| **Classification** | Core |
| **Status** | Planned (Sprint 6) |
| **NestJS Module** | `src/modules/finance/` (to be created) |
| **Database Tables** | (to be designed) |
| **Entities** | (to be designed) |
| **Aggregates** | (to be designed) |

**Boundary Rules:**
- Finance context performs ALL financial operations (Rule 16)
- Finance context is the ONLY context that modifies `Contract.remainingLessons`
- Finance context does NOT modify teaching data (Rule 17)
- Finance context only reacts to `lesson.finished` event (never `lesson.completed`)

**Cross-Context References:**
- Reads Teaching: `lessonId`, `classCode`, `contractCode`, `studentCode` (via events)
- Reads Teaching: `Enrollment` (to find which Contract to deduct from)
- Emits events that Teaching and Dashboard consume

**Events Consumed:**
- `lesson.finished` → trigger deduction, salary calculation

**Events Emitted:**
- `contract.exhausted` → Teaching, Dashboard
- `contract.expired` → Teaching, Dashboard
- `contract.refunded` → Teaching, Dashboard
- `contract.deducted` → Dashboard, Notification (PLANNED)
- `salary.calculated` → Notification, Dashboard (PLANNED)

---

### Points Context

| Property | Value |
|----------|-------|
| **Classification** | Supporting |
| **Status** | Planned |
| **NestJS Module** | `src/modules/points/` (to be created) |
| **Database Tables** | (to be designed) |
| **Entities** | (to be designed) |
| **Aggregates** | (to be designed) |

**Boundary Rules:**
- Points context manages student rewards
- Points context reads attendance data via events (never direct DB access)
- Points balance is non-negative

**Events Consumed:**
- `points.granted` → update student balance
- `attendance.confirmed` → award points based on attendance (future)

**Events Emitted:**
- `points.awarded` → Dashboard, Notification
- `points.redeemed` → Dashboard

---

### Notification Context

| Property | Value |
|----------|-------|
| **Classification** | Generic |
| **Status** | Planned |
| **NestJS Module** | `src/modules/notification/` (to be created) |
| **Database Tables** | (to be designed — may be minimal) |
| **Entities** | (to be designed) |
| **Aggregates** | (to be designed) |

**Boundary Rules:**
- Notification context is a pure consumer — it never emits business events
- Notification failures do NOT block business operations (best-effort delivery)
- Notification context may use WeChat templates, push notifications, email

**Events Consumed:**
- `lesson.completed` → "class completed" notice to parents (FUTURE)
- `lesson.finished` → confirmed lesson notification (FUTURE)
- `leave.submitted` → admin alert (FUTURE)
- `leave.approved` → parent notification (FUTURE)
- `contract.expiring` → renewal reminder (PLANNED)
- `attendance.anomaly` → admin and parent alert (PLANNED)
- `salary.calculated` → salary statement to teacher (PLANNED)
- `points.awarded` → student notification (FUTURE)

---

### Dashboard Context

| Property | Value |
|----------|-------|
| **Classification** | Generic |
| **Status** | Planned |
| **NestJS Module** | `src/modules/dashboard/` (to be created) |
| **Database Tables** | None (read-only, may have materialized views) |
| **Entities** | (to be designed) |
| **Aggregates** | None |

**Boundary Rules:**
- Dashboard context is read-only — it NEVER modifies business data
- Dashboard context aggregates data from all other contexts
- Dashboard context may cache data for performance
- Dashboard context powers both WeChat mini-program and admin web interface

**Events Consumed:**
- All events (for real-time updates and aggregation)

---

## Context Interaction Patterns

| Pattern | Where Used | Example |
|---------|-----------|---------|
| **Event Notification** | Teaching → Finance | `lesson.finished` triggers deduction |
| **Event Notification** | Teaching → Dashboard | `lesson.completed` updates stats |
| **Event Notification** | Student → Teaching | `student.deactivated` triggers review |
| **Shared Kernel** | Identity → All | User authentication/authorization |
| **Customer-Supplier** | Teaching → Finance | Teaching produces events, Finance consumes |
| **Conformist** | Dashboard → All | Dashboard conforms to all event schemas |
| **Anti-Corruption Layer** | Finance → Teaching | Finance translates Teaching events into financial operations |

---

## Context Boundary Enforcement

1. **Module Boundaries**: Each context is a NestJS module. Module imports are explicit.
2. **Import Restrictions**: Teaching module does NOT import Finance module. Finance module does NOT import Teaching module.
3. **Event Bus**: All cross-context communication goes through `@nestjs/event-emitter`.
4. **Database Isolation**: Each context owns its tables. No context reads another context's tables directly.
5. **Type Sharing**: Event payload types are shared via `src/common/events/`. Entity types are NOT shared.

---

*This is a living document. Update when context boundaries change or new contexts are added. Each context definition should be reviewed during Gate reviews.*
