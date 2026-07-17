# EduOS Aggregate Discovery

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: Define every aggregate in EduOS: its root entity, contained entities, invariants, lifecycle, and consistency boundaries. Aggregates are the units of data consistency — all entities within an aggregate are modified together in a single transaction.
> **Parent**: [BoundedContexts.md](./BoundedContexts.md)
> **Child**: [AggregateDependencyReview.md](./AggregateDependencyReview.md)

---

## What Is an Aggregate?

An aggregate is a cluster of entities treated as a single unit for data changes. The **aggregate root** is the only entry point — external code never references entities inside the aggregate directly.

**EduOS Rule**: All entities within an aggregate are persisted in a single database transaction. If any entity fails validation, the entire aggregate is rejected.

---

## Aggregate Catalog

### Teaching Context Aggregates

| # | Aggregate | Root Entity | Contained Entities | Context |
|---|-----------|-------------|-------------------|---------|
| T1 | **Course Aggregate** | Course | (none — Course is self-contained) | Teaching |
| T2 | **Class Aggregate** | Class | TeacherAssignment[] | Teaching |
| T3 | **Contract Aggregate** | Contract | (none — Contract is self-contained) | Teaching |
| T4 | **Lesson Aggregate** | Lesson | LessonAttendance[], LessonChangeRequest | Teaching |
| T5 | **Enrollment Aggregate** | Enrollment | (none — Enrollment is self-contained) | Teaching |

### Student Context Aggregates

| # | Aggregate | Root Entity | Contained Entities | Context |
|---|-----------|-------------|-------------------|---------|
| S1 | **Student Aggregate** | Student | StudentParent[] | Student |

### Identity Context Aggregates

| # | Aggregate | Root Entity | Contained Entities | Context |
|---|-----------|-------------|-------------------|---------|
| I1 | **User Aggregate** | User | (roles and permissions are separate aggregates) | Identity |
| I2 | **Role Aggregate** | Role | RolePermission[] | Identity |

---

## Aggregate Definitions

### T1: Course Aggregate

```
┌─────────────────────────────────────┐
│         Course Aggregate            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Course (ROOT)               │   │
│  │  - courseCode (immutable)   │   │
│  │  - name                     │   │
│  │  - subject (enum)           │   │
│  │  - type (enum)              │   │
│  │  - totalHours               │   │
│  │  - totalLessons             │   │
│  │  - defaultDuration          │   │
│  │  - status: DRAFT→PUBLISHED→ │   │
│  │            ARCHIVED         │   │
│  └─────────────────────────────┘   │
│                                     │
│  Invariant: COURSE-001              │
│  Only DRAFT courses can be          │
│  soft-deleted.                      │
│                                     │
│  Invariant: COURSE-002              │
│  ARCHIVED is not terminal.          │
│  Course can be re-published.        │
│                                     │
│  Consistency Boundary:              │
│  Course is self-contained.          │
│  No child entities.                 │
└─────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Root** | Course |
| **Identity** | courseCode (string, immutable, format: CSYYYYMMNNNN) |
| **Database Table** | `course` |
| **State Machine** | DRAFT → PUBLISHED → ARCHIVED (ARCHIVED can return to PUBLISHED) |
| **Invariants** | COURSE-001: Only DRAFT can be soft-deleted. COURSE-002: ARCHIVED is not terminal. |
| **Referenced By** | Class (courseCode FK) |
| **Never Deleted** | courseCode is never recycled, even after soft delete |

---

### T2: Class Aggregate

```
┌─────────────────────────────────────────────────────────────┐
│                      Class Aggregate                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Class (ROOT)                                        │    │
│  │  - classCode (immutable)                            │    │
│  │  - courseCode (FK → Course.courseCode)              │    │
│  │  - name, status, startDate, totalLessons            │    │
│  │  - maxStudents, defaultDuration                     │    │
│  │  - dayOfWeek[], startTime, endTime (schedule)       │    │
│  │  - status: DRAFT→ACTIVE→COMPLETED/CANCELLED         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ TeacherAssignment[] (contained)                     │    │
│  │  - classCode (FK → Class.classCode)                 │    │
│  │  - teacherId (FK → User.id where role=Teacher)      │    │
│  │  - role: PRIMARY | SUBSTITUTE | ASSISTANT           │    │
│  │  - effectiveFrom, effectiveTo                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Invariant: CLASS-001                                        │
│  ACTIVE Class MUST have exactly one PRIMARY TeacherAssignment│
│                                                              │
│  Invariant: CLASS-002                                        │
│  DRAFT→ACTIVE requires teacher + schedule defined            │
│                                                              │
│  Invariant: CLASS-003                                        │
│  ACTIVE→COMPLETED is automatic when all lessons finish       │
│                                                              │
│  Consistency Boundary:                                       │
│  Class and its TeacherAssignments are modified together.     │
│  Class does NOT contain Enrollment or Lesson.                │
└─────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Root** | Class |
| **Identity** | classCode (string, immutable, format: CLYYYYMMNNNN) |
| **Database Tables** | `class`, `teacher_assignment` |
| **State Machine** | DRAFT → ACTIVE → COMPLETED / CANCELLED |
| **Invariants** | CLASS-001: ACTIVE requires exactly one PRIMARY teacher. CLASS-002: Activation requires teacher + schedule. CLASS-003: COMPLETED is automatic. |
| **Contains** | TeacherAssignment[] |
| **Referenced By** | Lesson (classCode FK), Enrollment (classCode FK) |
| **Side Effects on Activate** | Lessons are auto-generated (batch) |
| **Side Effects on Complete** | All ACTIVE Enrollments auto-transition to COMPLETED |

**Why TeacherAssignment Is Inside Class Aggregate:**
- TeacherAssignment is meaningless without its Class
- A Class without a teacher assignment is incomplete (cannot become ACTIVE)
- Teacher changes are always scoped to a Class
- Assignment history (effectiveFrom/effectiveTo) belongs to the Class's lifecycle

**Why Enrollment Is NOT Inside Class Aggregate:**
- Enrollment has its own lifecycle (ACTIVE → WITHDRAWN → ACTIVE via reactivation)
- Enrollment references Contract (financial entity outside Teaching)
- Enrollment is a bridge between Student, Class, and Contract
- Modifying Enrollment does not require modifying Class

**Why Lesson Is NOT Inside Class Aggregate:**
- Lesson has its own complex lifecycle (6 states)
- Lesson contains LessonAttendance and LessonChangeRequest
- Lesson is the atomic business unit (Rule 19)
- Lesson modifications are independent of Class modifications

---

### T3: Contract Aggregate

```
┌─────────────────────────────────────┐
│        Contract Aggregate           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Contract (ROOT)             │   │
│  │  - contractCode (immutable) │   │
│  │  - studentCode (FK)         │   │
│  │  - subject (enum)           │   │
│  │  - totalLessons             │   │
│  │  - remainingLessons         │   │
│  │  - unitPrice, totalAmount   │   │
│  │  - validFrom, validTo       │   │
│  │  - status: ACTIVE→          │   │
│  │    EXHAUSTED/EXPIRED/       │   │
│  │    FROZEN/REFUNDED          │   │
│  └─────────────────────────────┘   │
│                                     │
│  Invariant: CONTRACT-001            │
│  remainingLessons >= 0              │
│                                     │
│  Invariant: CONTRACT-002            │
│  Only Finance Domain can modify     │
│  remainingLessons (Rule 16, 17)     │
│                                     │
│  Invariant: CONTRACT-003            │
│  FROZEN → ACTIVE: admin action      │
│  ACTIVE → FROZEN: admin action      │
│                                     │
│  Consistency Boundary:              │
│  Contract is self-contained.        │
│  No child entities.                 │
└─────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Root** | Contract |
| **Identity** | contractCode (string, immutable, format: CTYYYYMMNNNN) |
| **Database Table** | `contract` |
| **State Machine** | ACTIVE → EXHAUSTED / EXPIRED / FROZEN / REFUNDED |
| **Invariants** | CONTRACT-001: remainingLessons non-negative. CONTRACT-002: Only Finance modifies remainingLessons. CONTRACT-003: FROZEN ↔ ACTIVE is bidirectional. |
| **Referenced By** | Enrollment (contractCode FK) |
| **Modified By** | Finance Domain (deduction), Teaching Domain (freeze/unfreeze, creation) |

**Why Contract Is Its Own Aggregate:**
- Contract is the financial unit (DEC-005-02)
- Contract has independent lifecycle (ACTIVE → EXHAUSTED/EXPIRED/FROZEN/REFUNDED)
- Contract is modified by Finance Domain (deduction) — cannot be inside Teaching aggregate
- Contract references Student (cross-aggregate reference via studentCode)

---

### T4: Lesson Aggregate

```
┌─────────────────────────────────────────────────────────────┐
│                     Lesson Aggregate                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Lesson (ROOT)                                       │    │
│  │  - id (internal PK)                                 │    │
│  │  - classCode (FK → Class.classCode)                 │    │
│  │  - courseCode (denormalized)                        │    │
│  │  - lessonNumber                                     │    │
│  │  - scheduledDate, startTime, endTime                │    │
│  │  - teacherId                                        │    │
│  │  - status: DRAFT→SCHEDULED→TEACHING→FINISHED→       │    │
│  │            ARCHIVED / CANCELLED                     │    │
│  │  - actualStartTime, actualEndTime                   │    │
│  │  - confirmedBy, confirmedAt                         │    │
│  │  - isMakeup, originLessonId                         │    │
│  │  - changeRequestId                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ LessonAttendance[] (contained)                      │    │
│  │  - lessonId (FK → Lesson.id)                        │    │
│  │  - studentCode (FK → Student.studentCode)           │    │
│  │  - workflowState: PENDING→CHECKED_IN→CONFIRMED→     │    │
│  │                   LOCKED                            │    │
│  │  - status: PRESENT/LATE/ONLINE/OFFLINE/ABSENT/      │    │
│  │            LEAVE/MAKEUP                             │    │
│  │  - checkInTime, recordedBy, note                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ LessonChangeRequest[] (contained)                   │    │
│  │  - lessonId (FK → Lesson.id)                        │    │
│  │  - requestType: RESCHEDULE/TEACHER_CHANGE/CANCEL/   │    │
│  │                  REOPEN                             │    │
│  │  - status: PENDING→APPROVED→EXECUTED / REJECTED     │    │
│  │  - reason, before/after fields                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Invariant: LESSON-001                                       │
│  One attendance record per student per lesson                │
│  (UNIQUE constraint on lessonId + studentCode)               │
│                                                              │
│  Invariant: LESSON-002                                       │
│  ARCHIVED requires ALL attendance CONFIRMED or LOCKED        │
│                                                              │
│  Invariant: LESSON-003                                       │
│  FINISHED → ARCHIVED emits lesson.finished (money moves)     │
│                                                              │
│  Invariant: LESSON-004                                       │
│  CANCELLED lessons are NEVER deleted                         │
│                                                              │
│  Invariant: LESSON-005                                       │
│  Every financial record traces to lessonId (Rule 20)         │
│                                                              │
│  Consistency Boundary:                                       │
│  Lesson, LessonAttendance[], and LessonChangeRequest[]       │
│  are modified together in a single transaction.              │
│  Attendance records are created when Lesson → TEACHING.      │
│  Attendance records are locked when Lesson → ARCHIVED.       │
└─────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Root** | Lesson |
| **Identity** | id (integer PK). Business key: (classCode, lessonNumber). |
| **Database Tables** | `lesson`, `lesson_attendance`, `lesson_change_request` |
| **State Machine** | DRAFT → SCHEDULED → TEACHING → FINISHED → ARCHIVED / CANCELLED |
| **Invariants** | LESSON-001: One attendance per student per lesson. LESSON-002: ARCHIVED requires all attendance confirmed. LESSON-003: FINISHED→ARCHIVED emits lesson.finished. LESSON-004: CANCELLED never deleted. LESSON-005: Every money must have a lesson. |
| **Contains** | LessonAttendance[], LessonChangeRequest[] |
| **Referenced By** | Finance (lessonId via events), Dashboard (lessonId), Notification (lessonId) |
| **Events Emitted** | lesson.completed (TEACHING→FINISHED), lesson.finished (FINISHED→ARCHIVED) |

**Why LessonAttendance Is Inside Lesson Aggregate:**
- Attendance is meaningless without its Lesson
- Attendance records are created when Lesson transitions to TEACHING
- Attendance records are locked when Lesson transitions to ARCHIVED
- One attendance per student per lesson (LESSON-001) is enforced within the aggregate
- Attendance confirmation is a prerequisite for lesson archival (LESSON-002)

**Why LessonChangeRequest Is Inside Lesson Aggregate:**
- ChangeRequest is meaningless without its Lesson
- ChangeRequest modifies Lesson fields (date, time, teacher)
- ChangeRequest execution is a single transaction with Lesson update
- ChangeRequest lifecycle is scoped to the Lesson it modifies

---

### T5: Enrollment Aggregate

```
┌─────────────────────────────────────┐
│       Enrollment Aggregate          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Enrollment (ROOT)           │   │
│  │  - classCode (FK)           │   │
│  │  - studentCode (FK)         │   │
│  │  - contractCode (FK)        │   │
│  │  - status: ACTIVE→          │   │
│  │    WITHDRAWN / COMPLETED    │   │
│  │  - enrolledAt, enrolledBy   │   │
│  │  - withdrawReason           │   │
│  └─────────────────────────────┘   │
│                                     │
│  Invariant: ENROLL-001              │
│  UNIQUE(classCode, studentCode)     │
│  One row per student-class pair     │
│                                     │
│  Invariant: ENROLL-002              │
│  ACTIVE enrollment requires         │
│  ACTIVE contract                    │
│                                     │
│  Invariant: ENROLL-003              │
│  WITHDRAWN → ACTIVE: reactivation   │
│  requires new ACTIVE contract       │
│                                     │
│  Invariant: ENROLL-004              │
│  COMPLETED is terminal              │
│                                     │
│  Invariant: ENROLL-005              │
│  Enrollment can never be deleted    │
│                                     │
│  Consistency Boundary:              │
│  Enrollment is self-contained.      │
│  Composite key: (classCode,         │
│  studentCode).                      │
└─────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Root** | Enrollment |
| **Identity** | Composite key: (classCode, studentCode). No auto-increment PK as business identifier. |
| **Database Table** | `enrollment` |
| **State Machine** | ACTIVE → WITHDRAWN / COMPLETED; WITHDRAWN → ACTIVE (reactivation) |
| **Invariants** | ENROLL-001: UNIQUE(classCode, studentCode). ENROLL-002: ACTIVE requires ACTIVE contract. ENROLL-003: Reactivation requires new contract. ENROLL-004: COMPLETED is terminal. ENROLL-005: Never deleted. |
| **Referenced By** | Finance (deduction path: Lesson → Enrollment → Contract) |
| **Cross-Aggregate References** | Class (classCode), Student (studentCode), Contract (contractCode) |

**Why Enrollment Is Its Own Aggregate:**
- Enrollment is the bridge between Student, Class, and Contract (DEC-005-08)
- Enrollment has independent lifecycle (ACTIVE → WITHDRAWN → ACTIVE via reactivation, ADR-009)
- Enrollment references three other aggregates (Class, Student, Contract)
- Enrollment reactivation requires Contract update — a cross-aggregate operation

---

### S1: Student Aggregate

```
┌─────────────────────────────────────────────────────────────┐
│                    Student Aggregate                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Student (ROOT)                                      │    │
│  │  - studentCode (immutable, format: STYYYYMMNNNN)    │    │
│  │  - name, gender, birthDate                          │    │
│  │  - school, grade, phone                             │    │
│  │  - status: ACTIVE→PAUSED/GRADUATED/INACTIVE         │    │
│  │  - tags (JSON array)                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ StudentParent[] (contained)                         │    │
│  │  - parentId (FK → User.id where role=Parent)        │    │
│  │  - studentId (FK → Student.id)                      │    │
│  │  - relation: 父亲/母亲/祖父/祖母/监护人/Other        │    │
│  │  - isPrimary (boolean)                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Invariant: STUDENT-001                                      │
│  StudentCode is immutable and never recycled                 │
│                                                              │
│  Invariant: STUDENT-002                                      │
│  Student must be soft-deleted, never hard-deleted            │
│                                                              │
│  Invariant: STUDENT-003                                      │
│  GRADUATED is terminal (no transitions out)                  │
│                                                              │
│  Consistency Boundary:                                       │
│  Student and StudentParent[] are modified together.          │
└─────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Root** | Student |
| **Identity** | studentCode (string, immutable, format: STYYYYMMNNNN) |
| **Database Tables** | `student`, `student_parent` |
| **State Machine** | ACTIVE → PAUSED / GRADUATED / INACTIVE; PAUSED → ACTIVE; INACTIVE → ACTIVE |
| **Invariants** | STUDENT-001: StudentCode immutable, never recycled. STUDENT-002: Soft delete only. STUDENT-003: GRADUATED is terminal. |
| **Contains** | StudentParent[] |
| **Referenced By** | Teaching (studentCode in Enrollment, LessonAttendance) |
| **Events Emitted** | student.deactivated (DESIGNED), student.status.changed (PLANNED) |

---

### I1: User Aggregate

```
┌─────────────────────────────────────┐
│         User Aggregate              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ User (ROOT)                 │   │
│  │  - id (internal PK)         │   │
│  │  - username                 │   │
│  │  - password (hashed)        │   │
│  │  - status: ACTIVE/DISABLED  │   │
│  │  - roleIds[] (FK → Role)    │   │
│  └─────────────────────────────┘   │
│                                     │
│  Invariant: USER-001                │
│  Username is unique                 │
│                                     │
│  Invariant: USER-002                │
│  Password is hashed, never plain    │
│                                     │
│  Consistency Boundary:              │
│  User is self-contained.            │
│  Roles are separate aggregates.     │
└─────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Root** | User |
| **Identity** | id (integer PK) |
| **Database Table** | `user` |
| **Invariants** | USER-001: Username unique. USER-002: Password hashed. |
| **Referenced By** | Teaching (teacherId), Student (parentId), all contexts (userId for audit) |

---

## Aggregate Invariants Summary

| ID | Aggregate | Invariant | Enforcement |
|----|-----------|-----------|-------------|
| COURSE-001 | Course | Only DRAFT can be soft-deleted | Service layer check |
| COURSE-002 | Course | ARCHIVED is not terminal | State machine allows ARCHIVED→PUBLISHED |
| CLASS-001 | Class | ACTIVE requires exactly one PRIMARY TeacherAssignment | Service layer check |
| CLASS-002 | Class | DRAFT→ACTIVE requires teacher + schedule | Service layer guard |
| CLASS-003 | Class | ACTIVE→COMPLETED is automatic when all lessons finish | System trigger |
| CONTRACT-001 | Contract | remainingLessons >= 0 | Finance Domain enforcement |
| CONTRACT-002 | Contract | Only Finance modifies remainingLessons | Module boundary enforcement |
| LESSON-001 | Lesson | One attendance per student per lesson | UNIQUE constraint + service check |
| LESSON-002 | Lesson | ARCHIVED requires all attendance CONFIRMED/LOCKED | Guard in LessonService.archive() |
| LESSON-003 | Lesson | FINISHED→ARCHIVED emits lesson.finished | Event emission in service |
| LESSON-004 | Lesson | CANCELLED lessons never deleted | No DELETE operation exists |
| LESSON-005 | Lesson | Every money traces to lessonId | Finance Domain enforcement |
| ENROLL-001 | Enrollment | UNIQUE(classCode, studentCode) | Database UNIQUE constraint |
| ENROLL-002 | Enrollment | ACTIVE requires ACTIVE contract | Service layer check |
| ENROLL-003 | Enrollment | Reactivation requires new ACTIVE contract | Service layer check |
| ENROLL-004 | Enrollment | COMPLETED is terminal | State machine enforcement |
| ENROLL-005 | Enrollment | Never deleted | No DELETE operation exists |
| STUDENT-001 | Student | StudentCode immutable, never recycled | Service layer enforcement |
| STUDENT-002 | Student | Soft delete only | No hard DELETE operation |
| STUDENT-003 | Student | GRADUATED is terminal | State machine enforcement |
| USER-001 | User | Username unique | Database UNIQUE constraint |
| USER-002 | User | Password hashed | Service layer hashing |

---

## Aggregate Reference Rules

1. **Cross-aggregate references are by identity only.** Enrollment references Class by `classCode` (string), not by object reference.
2. **No entity inside an aggregate references an entity inside another aggregate.** LessonAttendance references Student by `studentCode`, not by Student entity.
3. **Consistency within aggregate, eventual consistency across aggregates.** Class and TeacherAssignment are consistent in one transaction. Class and Enrollment are eventually consistent via events.
4. **Aggregate roots are the only entry points.** External code never directly accesses LessonAttendance without going through Lesson.

---

*This is a living document. Update when new aggregates are discovered or invariant boundaries change. Each aggregate should be reviewed during Gate reviews.*
