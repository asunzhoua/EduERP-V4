# Teaching Domain — Constitution v1.0

> **Version**: v1.1.0
> **Status**: Frozen (Architecture Consistency Closure)
> **Last Updated**: 2026-07-14
> **Authority**: Constitution-v4.0.md (Architect Constitution)
> **Scope**: Teaching Domain only — the operational core of EduOS
> **Change Log**: v1.0.0 (Task-027) → v1.1.0 (Task-028 — added Sections 9, 10, 11)

---

## 1. Teaching Domain Mission

**Teaching Domain manages everything related to what is taught, who teaches it, who learns it, when it happens, and what lesson package pays for it.**

It answers four questions:

1. **What** is being taught? → Course
2. **Who** is teaching and learning? → Class (TeacherAssignment + Enrollment)
3. **When** does it happen? → Class Schedule → Lesson instances
4. **How is it paid for?** → Contract

The Teaching Domain originates the two most important business events in EduOS: **LessonCompleted** (teaching is done) and **LessonFinished** (money can move). These events drive Finance, Points, Notification, and Dashboard across the entire system.

---

## 2. Six Core Entities

### 2.1 Course (课程) — Knowledge Product Definition

| Attribute | Value |
|-----------|-------|
| **What** | A course is a catalog entry describing a subject, content area, level, and format. |
| **Why** | Institutions offer multiple courses (e.g., "少儿英语一级", "小学数学提高班"). The Course is the product catalog. |
| **Owner** | Teaching Domain exclusively. |
| **Boundary** | Course has NO pricing, NO scheduling, NO teacher assignment, NO student enrollment. Those concerns live at Class or Contract level. |
| **Do** | Define subject, type (INDIVIDUAL/GROUP/TRIAL/CAMP), totalHours, totalLessons, defaultDuration. Manage catalog lifecycle (DRAFT → PUBLISHED ↔ ARCHIVED). |
| **Don't** | Never store price. Never reference Student or Teacher. Never generate Lessons directly. |
| **Identity** | `courseCode` — format `CSYYYYMMNNNN`, immutable, never recycled. |
| **State Machine** | 3 states: DRAFT, PUBLISHED, ARCHIVED. ARCHIVED is NOT terminal (can re-publish). |
| **Constitution Alignment** | Rule 15 (depends on nothing), Rule 17 (owns course + course_audit_log tables). |

---

### 2.2 Class (教学班) — Teaching Group Instance

| Attribute | Value |
|-----------|-------|
| **What** | A specific run of a Course: who teaches, who learns, when it meets, how many lessons. |
| **Why** | Same Course can run at multiple times with different teachers and students. Class is the operational unit. |
| **Owner** | Teaching Domain exclusively. |
| **Boundary** | Class depends on Course (via courseCode) and TeacherAssignment. Class does NOT store financial data. |
| **Do** | Define schedule (dayOfWeek, startTime, endTime, startDate), manage teacher assignment, trigger batch Lesson generation on activation (DRAFT → ACTIVE), manage enrollment capacity. |
| **Don't** | Never store price or financial data. Never directly modify Lesson attendance. Never auto-complete without teacher action. |
| **Identity** | `classCode` — format `CLYYYYMMNNNN`, immutable, never recycled. |
| **State Machine** | 4 states: DRAFT, ACTIVE, COMPLETED, CANCELLED. COMPLETED is terminal. Activation requires teacher + schedule. |
| **Constitution Alignment** | Rule 15 (depends on Course, Teacher), Rule 17 (owns class + class_audit_log tables), Rule 19 (class is NOT the timeline — Lesson is). |

---

### 2.3 Contract (课时合同) — Purchased Lesson Package

| Attribute | Value |
|-----------|-------|
| **What** | A financial unit representing a purchased lesson package. When a parent pays, they buy a Contract. |
| **Why** | Without Contract, the system cannot answer: "How many lessons does this student have left?" Contract carries `remainingLessons` — the single source of truth for lesson balance. |
| **Owner** | Teaching Domain creates and maintains Contracts. Finance Domain performs deductions. |
| **Boundary** | Teaching Domain manages Contract lifecycle (create, freeze, unfreeze). Finance Domain deducts from `remainingLessons`. Teaching Domain MUST NOT deduct. |
| **Do** | Create with `remainingLessons = totalLessons`. Manage status (ACTIVE/FROZEN/EXHAUSTED/EXPIRED/REFUNDED). Validate student exists. |
| **Don't** | Never directly decrement `remainingLessons`. Never calculate teacher salary. Never process refunds. |
| **Identity** | `contractCode` — format `CTYYYYMMNNNN`, immutable, never recycled. |
| **State Machine** | 5 states: ACTIVE, EXHAUSTED, EXPIRED, FROZEN, REFUNDED. Only FROZEN ↔ ACTIVE is reversible. |
| **Constitution Alignment** | Rule 16 (financial trigger is LessonFinished, not Contract), Rule 17 (owns contract + contract_audit_log), Rule 18 (remainingLessons computed server-side). |

---

### 2.4 Enrollment (报名) — Student-Class-Contract Bridge

| Attribute | Value |
|-----------|-------|
| **What** | The bridge entity linking a Student to a Class, funded by a specific Contract. |
| **Why** | Without Enrollment, the deduction path is broken. When a Lesson finishes, the system must trace: Lesson.classCode → Enrollment → Contract → remainingLessons. |
| **Owner** | Teaching Domain exclusively. |
| **Boundary** | Enrollment depends on Class (classCode), Student (studentCode), and Contract (contractCode). Enrollment does NOT store financial data. |
| **Do** | Validate Contract exists and is ACTIVE. Validate no duplicate ACTIVE enrollment for same student+class. Manage withdraw (ACTIVE → WITHDRAWN with reason). Auto-complete when Class → COMPLETED. |
| **Don't** | Never deduct lessons. Never modify Contract. Never modify Student status. Never enroll INACTIVE/GRADUATED students. |
| **Identity** | Composite key: `(classCode, studentCode)`. Unique constraint enforced. |
| **State Machine** | 3 states: ACTIVE, WITHDRAWN, COMPLETED. COMPLETED is set automatically when Class completes. |
| **Constitution Alignment** | Rule 15 (depends on Student, Contract, Class), Rule 17 (owns enrollment table), Rule 20 (links lesson to contract for audit trail). |

---

### 2.5 Lesson (课次) — The Business Timeline

| Attribute | Value |
|-----------|-------|
| **What** | A single teaching session within a Class. The **smallest business atom** in EduOS. |
| **Why** | Per Rule 19, Lesson is the ONLY business timeline. All operations (attendance, salary, deductions, points, notifications) revolve around Lesson. Per Rule 20, every financial record must trace to a lessonId. |
| **Owner** | Teaching Domain exclusively. |
| **Boundary** | Lesson depends on Class (classCode), Course (courseCode, denormalized), TeacherAssignment (teacherId, copied). Lesson does NOT store financial data. |
| **Do** | Auto-generate from Class schedule (batch on DRAFT → ACTIVE). Track teaching lifecycle (DRAFT → SCHEDULED → TEACHING → FINISHED → ARCHIVED). Emit LessonCompleted (Phase 1, no money) and LessonFinished (Phase 2, money moves). Record attendance per student. |
| **Don't** | Never skip states (Rule 22). Never emit LessonFinished before LessonCompleted. Never deduct from Contract. Never auto-complete without attendance for all students. |
| **Identity** | Internal PK: `id` (bigint auto-increment). Business key: `(classCode, lessonNumber)`. |
| **State Machine** | 6 states: DRAFT, SCHEDULED, TEACHING, FINISHED, ARCHIVED, CANCELLED. ARCHIVED is terminal. CANCELLED is NOT terminal (reopenable). |
| **Constitution Alignment** | Rule 19 (Lesson = timeline), Rule 20 (every money → lessonId), Rule 21 (events publicly registered), Rule 22 (unidirectional states), Rule 23 (replayable). |

---

### 2.6 TeacherAssignment (教师分配) — Teacher-to-Class Link

| Attribute | Value |
|-----------|-------|
| **What** | Connects a Teacher (User with role=Teacher) to a Class with a defined role and time period. |
| **Why** | Each Class needs exactly one PRIMARY teacher. Teachers can be substituted temporarily. Assignment history must be preserved. |
| **Owner** | Teaching Domain exclusively. |
| **Boundary** | TeacherAssignment depends on Class (classCode) and User (teacherId). Does NOT depend on Identity Domain tables directly — only references teacherId. |
| **Do** | Enforce exactly one PRIMARY teacher per ACTIVE Class. Track assignment history via effectiveFrom/effectiveTo. Copy teacherId to Lesson at generation time (historical preservation). |
| **Don't** | Never modify Identity Domain user records. Never allow more than one active PRIMARY teacher. Never change teacher on already-completed lessons. |
| **Identity** | Composite key: `(classCode, teacherId)`. |
| **State Machine** | 2 states: ACTIVE (effective), INACTIVE (expired). Time-bounded. |
| **Constitution Alignment** | Rule 15 (depends on Class, Identity Teacher), Rule 17 (owns teacher_assignment table). |

---

## 3. Unique Lifecycle Chain

The Teaching Domain's lifecycle chain follows a strict dependency order defined by Constitution Rule 15. Each entity must exist before the next can be created.

### 3.1 Creation Chain

```
Student (Student Domain)
  └──► Contract       "Parent buys 20 lessons for their child"
        └──► Course   "What is taught (catalog entry)"
              └──► Class  "Operational instance: who teaches, when it meets"
                    ├──► TeacherAssignment  "Who teaches this class"
                    ├──► Enrollment         "Which students, funded by which Contract"
                    └──► Lesson             "Individual teaching sessions (batch generated)"
```

**Single Source of Truth annotations:**

| Entity | Single Source of Truth for |
|--------|---------------------------|
| Course | What is taught (subject, type, content metrics) |
| Class | When it meets (schedule), who is enrolled (via Enrollment), capacity |
| Contract | How many lessons remain (`remainingLessons`), pricing reference, validity period |
| Enrollment | Which Student is in which Class, funded by which Contract |
| Lesson | The business timeline (attendance, status, teacher at time of teaching) |
| TeacherAssignment | Who teaches the Class, with role and time period |

### 3.2 Operational Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Course Definition                                            │
│     Admin creates Course (DRAFT) → publishes (PUBLISHED)        │
│     [Single Source of Truth: subject, type, totalLessons]       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Contract Purchase                                            │
│     Parent pays → Contract created (ACTIVE)                     │
│     remainingLessons = totalLessons                             │
│     [Single Source of Truth: lesson balance]                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Class Setup                                                  │
│     Admin creates Class (DRAFT) under Course                    │
│     Assigns PRIMARY Teacher (TeacherAssignment)                 │
│     Sets schedule (dayOfWeek, startTime, endTime, startDate)    │
│     [Single Source of Truth: schedule, teacher]                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Class Activation (DRAFT → ACTIVE)                           │
│     Batch: ALL Lessons generated (status: SCHEDULED)            │
│     teacherId copied from PRIMARY TeacherAssignment             │
│     [Batch operation — single transaction]                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Student Enrollment                                           │
│     Student enrolled in Class, linked to Contract               │
│     Guard: Contract must be ACTIVE                              │
│     Guard: No duplicate ACTIVE enrollment                       │
│     [Single Source of Truth: which Contract funds this seat]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Teaching Execution                                           │
│     Teacher: SCHEDULED → TEACHING (start)                       │
│     Teacher: records attendance for ALL students                │
│     Teacher: TEACHING → FINISHED (complete)                     │
│     ═══ Emits LessonCompleted ═══                               │
│     [NO money moves. Teaching done. Provisional data.]          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Review window (default 24h)
                              │ Admin can correct attendance
                              │ Auto-approve on timeout
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Financial Settlement                                         │
│     Admin confirms (or auto-timeout)                            │
│     Lesson: FINISHED → ARCHIVED                                 │
│     ═══ Emits LessonFinished ═══                                │
│     Finance Domain: deduct Contract.remainingLessons            │
│     [MONEY MOVES. Data confirmed. Irreversible.]               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. Class Completion                                             │
│     All Lessons ARCHIVED or CANCELLED                           │
│     Class → COMPLETED (terminal)                                │
│     All ACTIVE Enrollments → COMPLETED (auto)                   │
│     [Batch terminal operation]                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Deduction Chain (Cross-Domain)

The deduction path is the most critical data flow in EduOS:

```
Lesson (id=42) finishes
  → LessonFinished event emitted
    → Finance Domain receives event
      → For each PRESENT/LATE attendance:
        → Lesson.classCode → Enrollment (matching studentCode + classCode)
          → Enrollment.contractCode → Contract
            → Contract.remainingLessons -= 1
              → If remainingLessons == 0 → Contract → EXHAUSTED
                → Log: {lessonId, oldBalance, newBalance} to contract_audit_log
```

**Critical constraint:** Only Finance Domain may decrement `remainingLessons`. Teaching Domain never touches this value after Contract creation.

---

## 4. Event Contract

The Teaching Domain emits exactly two events. All other domains consume them. No cross-domain guessing (Rule 21).

### 4.1 LessonCompleted (Phase 1)

| Property | Value |
|----------|-------|
| **Trigger** | Lesson: TEACHING → FINISHED |
| **Meaning** | Teaching is done. Attendance is recorded. Awaiting confirmation. |
| **Money moves?** | No |
| **Consumers** | Dashboard (real-time stats), Notification (future: parent notice) |
| **Idempotency key** | `lessonId` |

### 4.2 LessonFinished (Phase 2)

| Property | Value |
|----------|-------|
| **Trigger** | Lesson: FINISHED → ARCHIVED |
| **Meaning** | Data is confirmed. Money can move. |
| **Money moves?** | Yes |
| **Consumers** | Finance (deduction, salary), Points (awards), Notification (confirmation), Dashboard (financial stats) |
| **Idempotency key** | `lessonId` |

### 4.3 Event Safety Rules

- LessonFinished MUST NOT be emitted until LessonCompleted has been emitted first
- If a lesson is reopened (ARCHIVED → FINISHED), both events are re-emitted
- All listeners MUST be idempotent (key: `lessonId`)
- The review window is configurable per institution (default: 24 hours)

---

## 5. Cross-Domain Reference Protocol

Other domains reference Teaching entities **only through EventBus events**, never direct DB reads.

| Entity | Event Reference Field | Format |
|--------|----------------------|--------|
| Course | `courseCode` | `CSYYYYMMNNNN` |
| Class | `classCode` | `CLYYYYMMNNNN` |
| Contract | `contractCode` | `CTYYYYMMNNNN` |
| Lesson | `lessonId` | Integer PK |

All codes are **immutable** after creation and **never recycled** (even after soft delete).

---

## 6. Data Ownership

Teaching Domain owns 12 tables (Constitution Rule 17):

| Table | Entity |
|-------|--------|
| `course` | Course |
| `course_audit_log` | Course audit |
| `class` | Class |
| `class_audit_log` | Class audit |
| `teacher_assignment` | TeacherAssignment |
| `contract` | Contract |
| `contract_audit_log` | Contract audit |
| `enrollment` | Enrollment |
| `lesson` | Lesson |
| `lesson_attendance` | LessonAttendance |
| `lesson_audit_log` | Lesson audit |
| `lesson_change_request` | LessonChangeRequest |

**Teaching Domain MUST NOT modify tables owned by other domains:**
- Student Domain tables (student, student_audit_log, student_parent)
- Identity Domain tables (user, role, permission)
- Finance, Points, Notification tables (future domains)

---

## 7. Constitution Rule Compliance Map

| Rule | Teaching Domain Implementation |
|------|-------------------------------|
| Rule 15 (Dependency Order) | Student → Teacher → Course → Contract → Class → Enrollment → TeacherAssignment → Lesson |
| Rule 16 (Financial Trigger) | Only LessonFinished triggers money moves. Teaching Domain never touches finance. |
| Rule 17 (Data Ownership) | 12 tables owned. Never touches Student, User, or Finance tables. |
| Rule 18 (Server-Side Calc) | remainingLessons, attendance rate, enrollment count — all computed server-side. |
| Rule 19 (Lesson = Timeline) | All operations revolve around Lesson. Not Class. Not Course. |
| Rule 20 (Every Money → Lesson) | Every financial record traces to lessonId. No orphan transactions. |
| Rule 21 (Event Publishing) | lesson.completed and lesson.finished are publicly registered. No guessing. |
| Rule 22 (Unidirectional States) | All 6 state machines are unidirectional. Reverse transitions require admin override + reason. |
| Rule 23 (Replayable) | All auto-calculated results re-derivable by replaying LessonFinished events. |
| Rule 24 (Skeleton First) | Skeleton completed Sprint 4.0. This Constitution governs business logic implementation. |
| Rule 25 (One Domain At A Time) | Teaching Domain self-contained. No cross-domain code dependencies. |

---

## 8. Implementation Boundary

### 8.1 In Scope

- Course management (CRUD, status lifecycle)
- Contract management (CRUD, status lifecycle, freeze/unfreeze)
- Class management (CRUD, activation, enrollment)
- TeacherAssignment management
- Enrollment management (enroll, withdraw)
- Lesson lifecycle (generation, start, complete, confirm, cancel, reopen)
- LessonAttendance (roll call, status tracking)
- LessonChangeRequest (reschedule, teacher change, cancel, reopen)
- LessonCompleted and LessonFinished event emission
- All audit logs for owned entities

### 8.2 Out of Scope (handled by other domains)

| Concern | Domain |
|---------|--------|
| Contract deduction (remainingLessons decrement) | Finance Domain |
| Teacher salary calculation | Finance Domain |
| Payment and billing | Finance Domain |
| Points and rewards | Points Domain |
| Parent/teacher notifications | Notification Domain |
| Dashboard statistics | Dashboard Domain |
| Student profile management | Student Domain |
| User/role/permission management | Identity Domain |

---

## 9. Single Writer Principle (NEW — Task-028)

Every field in the system has **exactly one owner Domain** that may write to it. No other Domain may directly modify that field. This is the enforcement mechanism for Constitution Rule 17 (Data Ownership) and Rule 16 (Financial Trigger).

### 9.1 Field Ownership Table

| Field | Owner Domain | Write Permission | Read Permission |
|-------|-------------|-----------------|-----------------|
| `Course.name`, `Course.subject`, `Course.status` | Teaching | ✅ Write | Teaching, Dashboard |
| `Class.schedule`, `Class.status`, `Class.name` | Teaching | ✅ Write | Teaching, Dashboard |
| `Class.maxStudents` | Teaching | ✅ Write | Teaching |
| `Contract.status` (ACTIVE/FROZEN only) | Teaching | ✅ Write (freeze/unfreeze) | Teaching, Finance |
| `Contract.remainingLessons` | **Finance** | ✅ Write (deduction only) | Teaching (read-only), Finance |
| `Contract.status` (EXHAUSTED/EXPIRED/REFUNDED) | **Finance** | ✅ Write (auto-transition) | Teaching, Finance |
| `Enrollment.status` | Teaching | ✅ Write | Teaching, Finance (read-only) |
| `Enrollment.contractCode` | Teaching | ✅ Write (at enroll/reactivate) | Finance (read-only) |
| `Lesson.status` | Teaching | ✅ Write | Teaching, Finance, Dashboard |
| `LessonAttendance.status` | Teaching | ✅ Write (teacher records) | Teaching, Finance |
| `LessonAttendance.recordedBy` | Teaching | ✅ Write | Teaching |
| `Student.status` | **Student** | ✅ Write | Teaching (read-only, boundary check) |
| `Student.name`, `Student.phone` | **Student** | ✅ Write | Teaching (boundary check) |
| `User.role` | **Identity** | ✅ Write | All (read-only) |

### 9.2 Violation Examples

| Violation | Why It's Wrong |
|-----------|---------------|
| Teaching Domain sets `Contract.remainingLessons -= 1` | Only Finance Domain may decrement remainingLessons |
| Finance Domain updates `Enrollment.status` | Only Teaching Domain may change enrollment status |
| Teaching Domain sets `Student.status = INACTIVE` | Only Student Domain may change student status |
| Dashboard Domain writes `Lesson.status` | Only Teaching Domain may change lesson status |

### 9.3 Cross-Domain Read Protocol

When a Domain needs data it does not own:
1. **Preferred**: Read via EventBus event payload (data arrives with the event)
2. **Acceptable**: Direct DB read (SELECT only, no JOINs across domain tables in write queries)
3. **Prohibited**: Direct DB write to another Domain's tables

---

## 10. Read Model / Write Model (NEW — Task-028)

Each entity has a clear distinction between **who writes** and **who reads**. This prevents cross-domain coupling and ensures data consistency.

### 10.1 Write Models (Single Writer)

| Entity | Writer Domain | Operations |
|--------|--------------|------------|
| Course | Teaching | create, update, archive, delete (soft) |
| Class | Teaching | create, update, activate, complete, cancel |
| Contract | Teaching (lifecycle) + Finance (deduction) | create, freeze, unfreeze, exhaust, expire, refund |
| Enrollment | Teaching | enroll, withdraw, reactivate, auto-complete |
| Lesson | Teaching | generate, start, complete, confirm, cancel, reopen |
| LessonAttendance | Teaching | record, update (during TEACHING only) |
| LessonChangeRequest | Teaching | create, approve, reject |
| TeacherAssignment | Teaching | assign, reassign, expire |
| Student | Student | create, update, pause, graduate, deactivate |
| User | Identity | create, update, assign role |

### 10.2 Read Models (Shared Read)

| Data | Readable By | Method |
|------|------------|--------|
| Course catalog | Teaching, Dashboard | Direct DB (Teaching-owned tables) |
| Class schedule | Teaching, Dashboard, Teacher (via API) | Direct DB |
| Contract status | Teaching, Finance | Direct DB (Teaching-owned table) |
| Contract remainingLessons | Teaching (display only), Finance (authoritative) | Direct DB (Finance authoritative) |
| Enrollment status | Teaching, Finance (deduction path) | Direct DB |
| Lesson status | Teaching, Finance, Dashboard | Direct DB |
| Attendance status | Teaching, Finance (deduction rules) | Direct DB |
| Student basic info | Teaching (boundary check) | Direct DB (Student-owned table, read-only) |
| Teacher info | Teaching (assignment) | Direct DB (Identity-owned table, read-only) |

### 10.3 Shared Read Exceptions

Some data is **readable by multiple domains but writable by only one**:

```
Contract.remainingLessons:
  Finance: WRITE (deduction)
  Teaching: READ-ONLY (display to parents, enrollment checks)
  Dashboard: READ-ONLY (statistics)
```

```
Enrollment.status:
  Teaching: WRITE (enroll, withdraw, reactivate)
  Finance: READ-ONLY (find contract for deduction path)
```

```
LessonAttendance.status:
  Teaching: WRITE (teacher records)
  Finance: READ-ONLY (determine if lesson charges the contract)
  Points (future): READ-ONLY (determine point awards)
```

---

## 11. Domain Event Ownership (NEW — Task-028)

Events are the **only** mechanism for cross-domain communication. Each event has a single **emitter** Domain and one or more **consumer** Domains. No domain may emit an event it does not own.

### 11.1 Event Ownership Table

| Event | Emitter Domain | Consumers | Trigger |
|-------|---------------|-----------|---------|
| `lesson.completed` | **Teaching** | Dashboard, Notification (future) | Lesson: TEACHING → FINISHED |
| `lesson.finished` | **Teaching** | Finance, Points (future), Notification (future), Dashboard | Lesson: FINISHED → ARCHIVED |
| `contract.exhausted` | **Finance** | Teaching (status sync), Dashboard | Contract.remainingLessons reaches 0 |
| `contract.expired` | **Finance** | Teaching (status sync), Dashboard | Contract.validTo date passed |
| `contract.refunded` | **Finance** | Teaching (status sync), Dashboard | Contract refund processed |
| `student.deactivated` | **Student** | Teaching (enrollment review) | Student: ACTIVE → INACTIVE |

### 11.2 The LessonFinished Trigger Chain

This is the **only** path that moves money in EduOS. It is non-negotiable and must not be bypassed.

```
Teaching Domain
  │
  │  Lesson: FINISHED → ARCHIVED
  │
  ├──► emits: lesson.finished
        │
        ▼
Finance Domain
  │
  │  Receives lesson.finished event
  │  Reads: Enrollment (Teaching-owned, read-only)
  │  Reads: Contract (Teaching-owned, read-only)
  │
  ├──► FOR EACH PRESENT/LATE attendance:
  │     Contract.remainingLessons -= 1       (Finance WRITE)
  │     IF remainingLessons == 0:
  │       Contract.status → EXHAUSTED       (Finance WRITE)
  │       emits: contract.exhausted
  │
  ├──► FOR EACH teacher:
  │     Calculate salary per lesson           (Finance WRITE)
  │
  └──► Audit: contract_audit_log             (Finance WRITE)

Points Domain (future)
  │
  │  Receives lesson.finished event
  ├──► Award attendance points                (Points WRITE)

Notification Domain (future)
  │
  │  Receives lesson.finished event
  ├──► Notify parents of confirmed lesson     (Notification WRITE)
```

### 11.3 Event Safety Constraints

| Constraint | Rule | Enforcement |
|------------|------|-------------|
| lesson.completed MUST precede lesson.finished | Constitution Rule 16 | Teaching Domain: FINISHED emits lesson.completed; ARCHIVED emits lesson.finished. Sequential by design. |
| No direct financial operations | Constitution Rule 16 | Finance Domain ONLY reacts to lesson.finished. Never reacts to lesson.completed. |
| All listeners idempotent | Architecture requirement | Event payload includes `lessonId`. Consumers use `lessonId` as idempotency key. |
| No cross-domain event guessing | Constitution Rule 21 | Finance does NOT check if a lesson is finished. It waits for the event. |
| Re-emission on reopen | Architecture requirement | If ARCHIVED → FINISHED → FINISHED → ARCHIVED (reopen), both events are re-emitted. |

---

*This document is the Teaching Domain's constitutional authority. It was produced during Task-027 (Teaching Constitution Freeze) and updated during Task-028 (Architecture Consistency Closure). Any changes to this constitution require a Change Request (CR) per Constitution Rule 7 and Rule 25.*

*Companion documents: [TeachingRules.md](../BusinessRules/TeachingRules.md), [TeachingDomainModel.md](../DomainModel/TeachingDomainModel.md), [StateMachineCatalog.md](../StateMachine/StateMachineCatalog.md), [ADR-009-Enrollment-Reactivation.md](../DecisionLog/ADR-009-Enrollment-Reactivation.md).*
