# Teaching Domain — Business Rules

> **Domain**: Teaching
> **Sprint**: 4
> **Version**: v1.2.0 (Domain Freeze — Gate #005 Approved)
> **Last Updated**: 2026-07-14
> **Author**: Chief Architect
> **Authoritative Source**: [TeachingDomainModel.md](../DomainModel/TeachingDomainModel.md)

---

## 1. Domain Overview

The Teaching Domain is the operational core of EduOS. It manages everything related to **what is taught, who teaches it, who learns it, when it happens, and what lesson package pays for it**. This domain originates the two most important business events — **LessonCompleted** and **LessonFinished** — which drive finance, points, notifications, and dashboards across the entire system.

### 1.1 Domain Boundary

**Within scope:**
- Course definitions (product catalog)
- Contract management (lesson packages purchased by parents)
- Class management (teaching group instances)
- Teacher assignment to classes
- Student enrollment in classes (linked to Contracts)
- Lesson schedule and execution
- LessonCompleted and LessonFinished event emission

**Out of scope (handled by other domains):**
- Teacher payroll calculation → Finance Domain
- Student points/credits → Points Domain
- Payment and billing → Finance Domain
- Contract financial transactions → Finance Domain
- Notifications to parents → Notification Domain
- Student profile management → Student Domain
- User/role management → Identity Domain

### 1.2 Core Entities

```
Course            — What is taught (product definition)
  └── Class       — Who learns it, when, with whom (teaching group instance)
        ├── TeacherAssignment — Who teaches it
        ├── Enrollment       — Which students + which Contract funds this seat
        └── Lesson           — Individual teaching session (THE business timeline)

Contract          — Purchased lesson package (Student → Contract → Enrollment → Class)
```

**Key difference from v1.0:** Enrollment is no longer "student joins class." It is now "student joins class, **funded by Contract X**." This is the bridge between teaching operations and financial tracking.

### 1.3 Entity Relationships

| Relationship | Type | Description |
|---|---|---|
| Course → Class | One-to-many | A Course can have many Class instances |
| Class → TeacherAssignment | One-to-many | A Class has one primary teacher + optional substitutes |
| Class → Enrollment | One-to-many | A Class can have many enrolled students |
| Class → Lesson | One-to-many | A Class generates many lessons from its schedule |
| Student → Contract | One-to-many | A Student can have many lesson packages |
| Contract → Enrollment | One-to-many | One Contract can fund multiple Class enrollments |
| Student → Enrollment | One-to-many | A Student can enroll in multiple Classes |

### 1.4 Cross-Module References

When other domains reference Teaching entities:
- **Course**: Referenced by `courseCode` (auto-generated, immutable, `CSYYYYMMNNNN`)
- **Class**: Referenced by `classCode` (auto-generated, immutable, `CLYYYYMMNNNN`)
- **Lesson**: Referenced by `lessonId` (internal integer PK)
- **Contract**: Referenced by `contractCode` (auto-generated, immutable, `CTYYYYMMNNNN`)

Other domains MUST NOT directly read/write Teaching domain tables. All cross-domain communication occurs through the EventBus.

---

## 2. Event Flow

### 2.1 Two-Phase Event System (NEW in v1.1)

The Teaching domain uses a **two-phase event** system to separate teaching completion from financial settlement. This is the most important safety mechanism in EduOS.

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Teaching Completion                                    │
│                                                                  │
│  Teacher completes lesson                                        │
│  Lesson status → FINISHED                                        │
│  Attendance records saved                                        │
│  ═══ LessonCompleted event emitted ═══                          │
│  No money moves. Teaching done. Waiting for confirmation.        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Review Window (configurable, default 24h)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Financial Settlement                                   │
│                                                                  │
│  Admin confirms (or auto-approve on timeout)                     │
│  Lesson status → ARCHIVED                                        │
│  ═══ LessonFinished event emitted ═══                           │
│  Money moves: Contract deduction, teacher salary, points         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 LessonCompleted Event

**Emitted when:** Lesson transitions from TEACHING → FINISHED
**Meaning:** Teaching is done. Attendance is recorded. Awaiting confirmation.
**Does NOT trigger:** Financial operations, contract deductions, salary calculations.

```typescript
interface LessonCompletedEvent {
  lessonId: number;
  classCode: string;
  courseCode: string;
  teacherId: number;
  scheduledDate: Date;
  actualStartTime: Date;
  actualEndTime: Date;
  durationMinutes: number;
  attendance: Array<{
    studentCode: string;
    status: 'NOT_STARTED' | 'PRESENT' | 'LATE' | 'LEAVE_APPROVED' | 'ABSENT';
  }>;
  timestamp: Date;
}
```

**Consumers:**
| Domain | Action |
|--------|--------|
| Dashboard | Update real-time stats ("3 lessons completed today") |
| Notification (future) | Send "class completed" notice to parents |

### 2.3 LessonFinished Event

**Emitted when:** Lesson transitions from FINISHED → ARCHIVED (manual confirm or auto-timeout)
**Meaning:** Lesson is financially settled. Money can move.
**DOES trigger:** All financial operations.

```typescript
interface LessonFinishedEvent {
  lessonId: number;
  classCode: string;
  courseCode: string;
  teacherId: number;
  scheduledDate: Date;
  actualStartTime: Date;
  actualEndTime: Date;
  durationMinutes: number;
  attendance: Array<{
    studentCode: string;
    status: 'PRESENT' | 'LATE' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'ABSENT' | 'MAKEUP';
  }>;
  timestamp: Date;
}
```

**Consumers:**
| Domain | Action |
|--------|--------|
| Finance Domain | Deduct Contract remainingLessons, calculate teacher salary |
| Points Domain | Award attendance points |
| Notification Domain | Notify parents of confirmed lesson |
| Dashboard Domain | Update financial stats |

### 2.4 Event Safety Rules

- LessonFinished MUST NOT be emitted until LessonCompleted has been emitted first
- If a lesson is reopened (ARCHIVED → FINISHED), both events are re-emitted
- All listeners MUST be idempotent (key: `lessonId`)
- The review window is configurable per institution (default: 24 hours)
- Auto-approval on timeout is configurable (default: enabled)

---

## 3. Code Generation

### 3.1 Code Formats

| Entity | Prefix | Format | Example |
|--------|--------|--------|---------|
| Course | `CS` | `CSYYYYMMNNNN` | `CS2026070001` |
| Class | `CL` | `CLYYYYMMNNNN` | `CL2026070001` |
| Contract | `CT` | `CTYYYYMMNNNN` | `CT2026070001` |

### 3.2 Code Rules

- All codes are **immutable** after creation
- All codes are **never recycled** (even after soft delete)
- All codes MUST be globally unique across the entire system
- Code generation uses the same centralized pattern as StudentCodeGeneratorService

---

## 4. Domain Constraints & Constitution Alignment

### 4.1 Business Object Dependency (Rule 15)

| Dependency | Required Before | Reason |
|---|---|---|
| Student entity | Creating a Contract | Student must exist to buy lesson package |
| Teacher (User with role=Teacher) | TeacherAssignment | Teacher must exist in Identity domain |
| Course | Creating a Class | Class is an instance of a Course |
| Contract | Enrollment | Enrollment must reference which Contract pays for it |

**Order of implementation:** Student exists → Teacher exists → Course → Contract → Class → Enrollment → TeacherAssignment → Lesson

### 4.2 Financial Trigger Rule (Rule 16)

**Only LessonFinished triggers financial operations — NOT LessonCompleted, NOT the Teaching domain directly.**

- Teaching domain emits LessonFinished (after confirmation)
- Finance domain listens and processes deductions/salary
- Teaching domain MUST NOT calculate or store any financial values
- Teaching domain MUST NOT deduct lesson hours or calculate teacher pay

### 4.3 Data Ownership (Rule 17)

**Teaching domain owns these tables:**
- `course`
- `class` (or `teaching_class`)
- `teacher_assignment`
- `contract` (NEW)
- `enrollment`
- `lesson`
- `lesson_attendance`
- `lesson_change_request` (NEW)
- `course_audit_log`
- `class_audit_log`
- `contract_audit_log` (NEW)
- `lesson_audit_log`

**Teaching domain MUST NOT modify tables owned by other domains:**
- `student` or `student_audit_log` (Student domain)
- `user`, `role`, `permission` (Identity domain)
- Any Finance, Points, or Notification tables (future domains)

### 4.4 Server-Side Calculation (Rule 18)

| Calculation | Where | Why |
|---|---|---|
| Remaining lessons on Contract | Server | Deduction happens in Finance domain |
| Contract balance for student | Server | Sum across all ACTIVE contracts |
| Course progress percentage | Server | Depends on completed lesson count |
| Teacher's upcoming lessons | Server | Depends on schedule + current date |
| Class attendance rate | Server | Depends on all lesson attendance records |
| Class current enrollment count | Server | Computed from enrollments table |

### 4.5 Lesson as Business Timeline (Rule 19 — NEW)

All business operations revolve around **Lesson**, not Class or Course:
- Teacher salary: calculated per completed lesson
- Student attendance: recorded per lesson
- Contract deduction: triggered per finished lesson
- Points awarded: per lesson
- Parent notifications: per lesson

### 4.6 Every Money Has a Lesson (Rule 20 — NEW)

Every financial record (salary, deduction, refund) MUST trace back to a `lessonId`.
No orphan financial transactions. No batch charges without lesson references.

---

## 5. Audit Requirements

| Entity | Audit Table | Audit Scope |
|---|---|---|
| Course | `course_audit_log` | Create, update (field-level), status change |
| Class | `class_audit_log` | Create, update, status change, schedule change, teacher change |
| Contract | `contract_audit_log` | Create, deduction, adjustment, freeze, refund |
| Lesson | `lesson_audit_log` | Create, status change, reschedule, attendance change, reopen |

Each audit entry contains: `action`, `fieldName`, `oldValue`, `newValue`, **`reason`**, `operatedBy`, `operateTime`, `source`.

---

## 6. Permission Mapping

| Permission Code | Teaching Domain Operations |
|---|---|
| `course:read` | View courses |
| `course:create` | Create courses |
| `course:update` | Update/edit courses |
| `class:read` | View classes |
| `class:create` | Create classes |
| `class:update` | Update/edit classes, assign teachers |
| `contract:read` | View contracts |
| `contract:create` | Create contracts |
| `contract:update` | Freeze/unfreeze contracts |
| `lesson:read` | View lessons, schedules, attendance |
| `lesson:checkin` | Take attendance, complete lessons |
| `lesson:approve` | Confirm finished lessons (→ Archived) |

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Teaching Domain code. Companion documents: [CourseRules.md](./CourseRules.md), [ClassRules.md](./ClassRules.md), [LessonRules.md](./LessonRules.md), [ContractRules.md](./ContractRules.md).*
