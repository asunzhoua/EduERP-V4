# Teaching Domain — Deep Domain Model

> **Version**: v1.0.0 (Domain Freeze)
> **Status**: Gate #005 Domain Review
> **Last Updated**: 2026-07-14
> **Sprint**: Task-EduOS-005
> **Author**: Chief Architect

---

## Purpose

This is the **single source of truth** for the Teaching Domain. It defines every entity, every relationship, every state machine, and every business rule at a level of precision that eliminates ambiguity. Any developer (human or AI) reading this document should be able to implement the entire Teaching Domain without guessing.

This document supersedes all prior Teaching Domain design notes. Companion documents provide implementation detail:

| Document | Purpose |
|----------|---------|
| [TeachingRules.md](../BusinessRules/TeachingRules.md) | Business rules and cross-cutting concerns |
| [CourseRules.md](../BusinessRules/CourseRules.md) | Course entity implementation rules |
| [ClassRules.md](../BusinessRules/ClassRules.md) | Class entity implementation rules |
| [ContractRules.md](../BusinessRules/ContractRules.md) | Contract entity implementation rules |
| [LessonRules.md](../BusinessRules/LessonRules.md) | Lesson entity implementation rules |
| [StateMachineCatalog.md](../StateMachine/StateMachineCatalog.md) | All state machines in one place |
| [EventCatalog.md](../EventCatalog/EventCatalog.md) | All events in the system |
| [CoreBusinessFlow.md](../BusinessFlow/CoreBusinessFlow.md) | End-to-end business narrative |

---

## 1. Domain Overview

### 1.1 What Is the Teaching Domain?

The Teaching Domain is the operational heart of EduOS. It answers four questions:

1. **What** is being taught? → Course
2. **Who** is teaching and learning? → Class (TeacherAssignment + Enrollment)
3. **When** does it happen? → Class Schedule → Lesson instances
4. **How is it paid for? → Contract

### 1.2 Domain Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                    TEACHING DOMAIN                           │
│                                                              │
│  Course ─── Class ─── TeacherAssignment                     │
│              │                                               │
│              ├── Enrollment ←── Contract                     │
│              │                                               │
│              └── Lesson ─── LessonAttendance                 │
│                          └── LessonChangeRequest             │
│                                                              │
│  Events OUT: lesson.completed, lesson.finished               │
│  Events IN:  (none in v1.0)                                 │
└─────────────────────────────────────────────────────────────┘

OUT OF SCOPE:
  Finance   → Contract deduction, teacher salary, billing
  Points    → Attendance points, rewards
  Notify    → Parent/teacher notifications
  Dashboard → Statistics and analytics
  Student   → Student profiles and parent links
  Identity  → User accounts, roles, permissions
```

### 1.3 Constitution Alignment

| Rule | How Teaching Domain Complies |
|------|------------------------------|
| Rule 15 (Dependency Order) | Student exists → Teacher exists → Course → Contract → Class → Enrollment → TeacherAssignment → Lesson |
| Rule 16 (Financial Trigger) | Only LessonFinished triggers money moves. Teaching domain never touches finance. |
| Rule 17 (Data Ownership) | Teaching owns 12 tables. Never touches Student, User, or Finance tables. |
| Rule 18 (Server-Side Calc) | All computed values (remaining lessons, attendance rate, enrollment count) are server-calculated. |
| Rule 19 (Lesson = Timeline) | All business operations revolve around Lesson, not Class or Course. |
| Rule 20 (Every Money → Lesson) | Every financial record traces to a lessonId. No orphan transactions. |
| Rule 21 (Event Publishing) | lesson.completed and lesson.finished are publicly registered. No cross-domain guessing. |
| Rule 22 (Unidirectional States) | All state machines are unidirectional. Reverse transitions require admin override + reason. |
| Rule 23 (Replayable) | All auto-calculated results can be re-derived by replaying LessonFinished events. |
| Rule 24 (Skeleton First) | Skeleton completed in Sprint 4.0. This document governs business logic implementation. |

---

## 2. Entity Map

### 2.1 Core Entities

```
┌──────────────────────────────────────────────────────────────────┐
│                        ENTITY RELATIONSHIPS                       │
│                                                                   │
│  Course (1) ──────────────< (N) Class                             │
│                                                                   │
│  Class (1) ───────────────< (N) TeacherAssignment                │
│  Class (1) ───────────────< (N) Enrollment                       │
│  Class (1) ───────────────< (N) Lesson                           │
│                                                                   │
│  Student (1) ──────────────< (N) Contract                        │
│  Student (1) ──────────────< (N) Enrollment                      │
│                                                                   │
│  Contract (1) ─────────────< (N) Enrollment                      │
│                                                                   │
│  Lesson (1) ───────────────< (N) LessonAttendance                │
│  Lesson (1) ───────────────< (N) LessonChangeRequest             │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Entity Count Summary

| Entity | Purpose | Identity | Lifecycle |
|--------|---------|----------|-----------|
| **Course** | Knowledge product definition | `courseCode` (CS...) | DRAFT → PUBLISHED ↔ ARCHIVED |
| **Class** | Teaching group instance | `classCode` (CL...) | DRAFT → ACTIVE → COMPLETED \| CANCELLED |
| **Contract** | Purchased lesson package | `contractCode` (CT...) | ACTIVE → EXHAUSTED \| EXPIRED \| FROZEN \| REFUNDED |
| **Enrollment** | Student-Class-Contract bridge | Composite (classCode + studentCode) | ACTIVE → WITHDRAWN \| COMPLETED |
| **TeacherAssignment** | Teacher-to-Class link | Composite (classCode + teacherId) | ACTIVE ↔ INACTIVE |
| **Lesson** | Individual teaching session | `id` (integer PK) + business key (classCode + lessonNumber) | DRAFT/SCHEDULED → TEACHING → FINISHED → ARCHIVED \| CANCELLED |
| **LessonAttendance** | Per-student lesson attendance | Composite (lessonId + studentCode) | NOT_STARTED → PRESENT \| LATE \| LEAVE_APPROVED \| ABSENT \| MAKEUP |
| **LessonChangeRequest** | Change management document | `id` (integer PK) | PENDING → APPROVED \| REJECTED |

### 2.3 Cross-Domain References

Other domains reference Teaching entities **only through EventBus events**, never direct DB reads. When cross-domain data is needed in events:

| Entity | Event Reference Field | Format |
|--------|----------------------|--------|
| Course | `courseCode` | `CSYYYYMMNNNN` |
| Class | `classCode` | `CLYYYYMMNNNN` |
| Contract | `contractCode` | `CTYYYYMMNNNN` |
| Lesson | `lessonId` | Integer PK |

---

## 3. The Teaching Chain

The central concept in the Teaching Domain is the **Teaching Chain**: the progression from abstract product definition to concrete teaching session.

```
Course                    "What is taught"
  │
  └──► Class              "Who teaches, who learns, when it meets"
         │
         ├──► Schedule    "Recurring day/time pattern (embedded in Class)"
         │
         └──► Lesson      "One specific teaching session (THE business atom)"
```

### 3.1 Course (课程)

**Definition:** A Course is a knowledge product. It describes what subject and content area is taught, at what level, and in what format.

**Key insight:** A Course has **no pricing, no scheduling, no teacher, and no students**. Those concerns live at the Class or Contract level. The Course is pure knowledge definition.

```
Course
├── courseCode: CS2026070001     (immutable, auto-generated)
├── name: "少儿英语一级"          (display name)
├── subject: ENGLISH             (subject category enum)
├── type: GROUP                  (INDIVIDUAL | GROUP | TRIAL | CAMP)
├── totalHours: 40               (total teaching hours)
├── totalLessons: 40             (total lesson count)
├── defaultDuration: 60          (default minutes per lesson)
├── description: "..."           (optional)
├── coverImage: "..."            (optional, future)
├── tags: ["少儿", "英语"]        (optional)
├── note: "..."                  (optional)
└── status: PUBLISHED            (DRAFT | PUBLISHED | ARCHIVED)
```

**State Machine:**

```
         ┌──────────┐
         │  DRAFT   │
         └────┬─────┘
              │ publish (all required fields)
              ▼
         ┌──────────────┐
         │  PUBLISHED   │◄──── re-publish
         └──────┬───────┘
                │ archive
                ▼
         ┌──────────────┐
         │  ARCHIVED    │
         └──────────────┘
```

| Transition | Guard | Side Effect |
|------------|-------|-------------|
| DRAFT → PUBLISHED | All required fields filled | Classes can now be created under this Course |
| PUBLISHED → ARCHIVED | None (even with active classes) | No new Classes allowed. Existing classes unaffected. |
| ARCHIVED → PUBLISHED | None | Re-activation. Classes creatable again. |
| DRAFT → (soft delete) | No existing Classes | Course removed from catalog. Code never recycled. |

**Pricing rule (v1.1):** Price is NOT on Course. Price is on Contract. Course is a knowledge product, not a financial product.

---

### 3.2 Class (教学班)

**Definition:** A Class is a specific teaching group instance of a Course. It defines the operational parameters: who teaches, who learns, when it meets, and how many lessons it runs.

**Key insight:** Class is the central operational entity. Teachers see their classes. Students are enrolled in classes. Lessons belong to classes. The schedule is embedded directly in the Class.

```
Class
├── classCode: CL2026070001      (immutable, auto-generated)
├── courseCode: CS2026070001     (FK → Course)
├── name: "周六上午10点班"         (display name)
├── status: ACTIVE               (DRAFT | ACTIVE | COMPLETED | CANCELLED)
├── startDate: 2026-07-12        (first lesson date)
├── totalLessons: 20             (lessons to generate)
├── maxStudents: 20              (enrollment capacity)
├── defaultDuration: 60          (minutes, inheritable from Course)
├── dayOfWeek: [6]               (0=Sun..6=Sat, JSON array)
├── startTime: "10:00"           (HH:MM)
├── endTime: "11:30"             (HH:MM)
├── room: "301教室"               (optional)
├── tags: ["周六班"]              (optional)
└── note: "..."                  (optional)
```

**State Machine:**

```
         ┌──────────┐
         │  DRAFT   │
         └────┬─────┘
              │ activate (teacher assigned + schedule set)
              ▼
         ┌──────────┐          ┌──────────────┐
         │  ACTIVE  │◄─────────│ CANCELLED    │ (re-activate)
         └────┬─────┘          └──────────────┘
        ┌─────┴──────┐
        ▼            ▼
  ┌──────────┐  ┌──────────┐
  │COMPLETED │  │CANCELLED │
  └──────────┘  └──────────┘
```

| Transition | Guard | Side Effect |
|------------|-------|-------------|
| DRAFT → ACTIVE | Teacher assigned (PRIMARY) + schedule defined (dayOfWeek, startTime, endTime, startDate) | All Lessons auto-generated in batch |
| ACTIVE → COMPLETED | All Lessons in ARCHIVED or CANCELLED status | Automatic terminal state |
| ACTIVE → CANCELLED | Admin approval + `cancelledReason` | All future SCHEDULED Lessons → CANCELLED |
| CANCELLED → ACTIVE | Admin override + reason logged | Future Lessons regenerated |
| COMPLETED | Terminal | No transitions. No modifications. |

**Schedule embedding:** The schedule (dayOfWeek, startTime, endTime) lives on the Class entity. This is a v1.0 simplification. A separate Schedule table can be introduced later for multi-schedule-per-class or exception-day support.

---

### 3.3 Contract (课时合同)

**Definition:** A Contract represents a purchased lesson package. When a parent pays, they buy a Contract, not a Class enrollment. The Contract is the **financial unit**: all lesson deductions, balance tracking, and expiry operate against the Contract.

**Key insight:** This is the bridge between the Teaching domain and the Finance domain. The Teaching domain creates and maintains Contracts, but only the Finance domain deducts from them (via LessonFinished events).

```
Contract
├── contractCode: CT2026070001   (immutable, auto-generated)
├── studentCode: ST2026010001    (FK → Student)
├── subject: MATH                (subject category)
├── totalLessons: 20             (original purchase)
├── remainingLessons: 15         (current balance, decremented by Finance)
├── status: ACTIVE               (ACTIVE | EXHAUSTED | EXPIRED | FROZEN | REFUNDED)
├── validFrom: 2026-07-01        (start date)
├── validTo: 2026-12-31          (nullable — null = perpetual)
├── unitPrice: 80.00             (reference only, not authoritative)
├── totalAmount: 1600.00         (reference only, authoritative in Finance)
├── tags: ["暑期班"]              (optional)
└── note: "..."                  (optional)
```

**State Machine:**

```
                 ┌──────────┐
                 │  ACTIVE  │
                 └────┬─────┘
        ┌─────────────┼──────────────┬──────────────┐
        ▼             ▼              ▼              ▼
  ┌──────────┐ ┌──────────┐  ┌──────────┐  ┌──────────┐
  │EXHAUSTED │ │ EXPIRED  │  │  FROZEN  │  │ REFUNDED │
  └──────────┘ └──────────┘  └────┬─────┘  └──────────┘
                                   │ unfreeze
                                   ▼
                             ┌──────────┐
                             │  ACTIVE  │
                             └──────────┘
```

| Transition | Trigger | Side Effect |
|------------|---------|-------------|
| ACTIVE → EXHAUSTED | `remainingLessons` reaches 0 | Auto-transition on last deduction |
| ACTIVE → EXPIRED | `validTo` date passed | Auto-cron (future Sprint) |
| ACTIVE → FROZEN | Admin action | Prevents further deductions |
| FROZEN → ACTIVE | Admin action | Resumes deductions |
| Any → REFUNDED | Finance domain action | Requires refund record |

**Remaining Lessons Calculation:**

```
remainingLessons = totalLessons - total_deductions

Where total_deductions = COUNT(LessonFinished event where:
  - studentCode matches this Contract's studentCode
  - lesson was taught in a Class linked via Enrollment to this Contract
  - attendance status = PRESENT or LATE
)
```

This calculation is **always server-side** (Rule 18). The frontend never computes this.

---

### 3.4 Enrollment (报名)

**Definition:** Enrollment is the bridge entity connecting Student, Class, and Contract. It answers: "Which student is in which class, paid for by which contract?"

```
Enrollment
├── classCode: CL2026070001      (FK → Class)
├── studentCode: ST2026010001    (FK → Student)
├── contractCode: CT2026070001   (FK → Contract) — the financial link
├── enrolledAt: 2026-07-01       (timestamp)
├── enrolledBy: 1001             (admin userId)
├── status: ACTIVE               (ACTIVE | WITHDRAWN | COMPLETED)
└── withdrawReason: null         (reason if WITHDRAWN)
```

**Rules:**
- Student MUST exist and be ACTIVE in Student domain
- Contract MUST exist and be ACTIVE
- Student CAN be enrolled in multiple Classes (same or different)
- Student CANNOT be enrolled in the same Class twice
- Enrollment count cannot exceed `maxStudents` (computed server-side)
- One Contract can fund multiple Enrollments (concurrent classes)
- When Class → COMPLETED, all ACTIVE Enrollments → COMPLETED automatically

**Enrollment Status:**
```
ACTIVE ──(withdraw)──► WITHDRAWN   (student leaves mid-term)
ACTIVE ──(complete)──► COMPLETED   (auto when Class → COMPLETED)
```

---

### 3.5 TeacherAssignment (教师分配)

**Definition:** Links a teacher to a class with a defined role and time period.

```
TeacherAssignment
├── classCode: CL2026070001      (FK → Class)
├── teacherId: 5001              (FK → User.id, role=Teacher)
├── role: PRIMARY                (PRIMARY | SUBSTITUTE | ASSISTANT)
├── effectiveFrom: 2026-07-01    (assignment start date)
├── effectiveTo: null            (null = currently active)
├── assignedBy: 1001             (admin userId)
└── reason: "初始分配"            (assignment reason)
```

**Roles:**

| Role | Count per Class | Description |
|------|----------------|-------------|
| PRIMARY | Exactly 1 (when ACTIVE) | Main teacher. Required for Class activation. |
| SUBSTITUTE | 0 or more | Temporary replacement. Time-bounded via effectiveFrom/effectiveTo. |
| ASSISTANT | 0 or more | Teaching assistant. |

**Assignment history:** When a teacher is replaced, the old assignment gets `effectiveTo` set, and a new assignment is created. The Lesson entity **copies** the `teacherId` at generation time, so historical lessons retain the original teacher.

---

### 3.6 Lesson (课次)

**Definition:** A Lesson is a single teaching session within a Class. Per **Rule 19**, Lesson is the **only business timeline** in EduOS. All business operations (attendance, salary, deductions, points, notifications) revolve around the Lesson.

**Key insight:** Lesson is the **smallest business atom**. It cannot be subdivided. Every cent the system moves must answer: "Which lesson caused this?" (Rule 20).

```
Lesson
├── id: 42                       (integer PK, auto-increment)
├── classCode: CL2026070001      (FK → Class)
├── courseCode: CS2026070001     (denormalized for query efficiency)
├── lessonNumber: 5              (sequential within Class, starts at 1)
├── status: SCHEDULED            (DRAFT|SCHEDULED|TEACHING|FINISHED|ARCHIVED|CANCELLED)
├── scheduledDate: 2026-07-12    (date of lesson)
├── startTime: "10:00"           (HH:MM)
├── endTime: "11:30"             (HH:MM)
├── teacherId: 5001              (copied from TeacherAssignment at generation)
├── actualStartTime: null        (filled when → TEACHING)
├── actualEndTime: null          (filled when → FINISHED)
├── note: null                   (teacher's lesson notes)
├── cancelledReason: null        (reason if cancelled)
├── isMakeup: false              (true for makeup lessons)
├── originLessonId: null         (links makeup to original missed lesson)
├── changeRequestId: null        (links to LessonChangeRequest if rescheduled)
├── confirmedBy: null            (userId who confirmed, or 0 for auto-approve)
├── confirmedAt: null            (confirmation timestamp)
├── createdBy: 1001              (system or admin userId)
└── createdAt: 2026-07-01        (creation timestamp)
```

**State Machine:**

```
                  ┌──────────┐
                  │  DRAFT   │ (manual only, system-generated lessons skip this)
                  └────┬─────┘
                       │ schedule
                       ▼
                ┌──────────┐        ┌──────────────┐
                │SCHEDULED │◄───────│ CANCELLED    │ (reopen)
                └────┬─────┘        └──────────────┘
                     │ start
                     ▼
                ┌──────────┐
                │ TEACHING │
                └────┬─────┘
                     │ complete + attendance
                     ▼
                ┌──────────┐        ┌──────────────┐
                │ FINISHED │◄───────│ ARCHIVED     │ (reopen, financial rollback)
                └────┬─────┘        └──────────────┘
                     │ confirm (admin/auto)
                     ▼
                ┌──────────┐
                │ ARCHIVED │ ← Terminal
                └──────────┘
```

| Transition | Who | Guard | Side Effect |
|------------|-----|-------|-------------|
| DRAFT → SCHEDULED | Admin/System | Date/time set | — |
| SCHEDULED → TEACHING | Teacher | None | Records `actualStartTime` |
| TEACHING → FINISHED | Teacher | All enrolled students have attendance | **Emits LessonCompleted** |
| FINISHED → ARCHIVED | Admin/Auto | Timeout (default 24h) or admin confirms | **Emits LessonFinished** |
| SCHEDULED → CANCELLED | Admin/Teacher | `cancelledReason` required | — |
| TEACHING → CANCELLED | Admin | Emergency, reason required | — |
| FINISHED → SCHEDULED | Admin | Reason required. Safe — no money moved. | Unlocks attendance for editing |
| ARCHIVED → FINISHED | Admin | Reason required. | May need financial rollback. |
| CANCELLED → SCHEDULED | Admin | Reason required | — |

**Two-phase event system:**

```
FINISHED state:
  ┌────────────────────────────────────────────────────┐
  │  LESSON COMPLETED                                  │
  │                                                    │
  │  Teaching is done. Attendance is recorded.         │
  │  Awaiting admin confirmation.                      │
  │                                                    │
  │  ✅ Dashboard updates (real-time stats)             │
  │  ❌ No money moves                                 │
  │  ❌ No contract deduction                          │
  │  ❌ No teacher salary                              │
  └────────────────────────────────────────────────────┘
                         │
                         │ Review window (configurable, default 24h)
                         │ Admin can correct attendance
                         │ Auto-approve on timeout
                         ▼
  ┌────────────────────────────────────────────────────┐
  │  LESSON FINISHED                                   │
  │                                                    │
  │  Data is confirmed. Money can move.                │
  │                                                    │
  │  ✅ Contract deduction (per PRESENT/LATE student)  │
  │  ✅ Teacher salary calculation                     │
  │  ✅ Points awarded                                 │
  │  ✅ Parent notification                            │
  │  ✅ Dashboard financial update                     │
  └────────────────────────────────────────────────────┘
```

---

### 3.7 LessonAttendance (考勤记录)

**Definition:** One record per student per lesson. Captures attendance status at the time of teaching.

```
LessonAttendance
├── id: 1001                     (integer PK)
├── lessonId: 42                 (FK → Lesson.id)
├── studentCode: ST2026010001    (FK → Student)
├── status: PRESENT              (NOT_STARTED|PRESENT|LATE|LEAVE_APPROVED|LEAVE_REJECTED|ABSENT|MAKEUP)
├── checkInTime: null            (timestamp of check-in)
├── recordedBy: 5001             (teacher userId)
└── note: null                   (optional remark)
```

**Attendance Status Business Meaning:**

| Status | Name (CN) | Deduct Lesson? | Award Points? | Notify Parent? |
|--------|-----------|---------------|---------------|----------------|
| PRESENT | 出勤 | Yes | Yes | Yes |
| LATE | 迟到 | Yes | Yes | Yes |
| LEAVE_APPROVED | 请假获批 | **No** | No | Yes (acknowledged) |
| LEAVE_REJECTED | 请假驳回 | Yes | No | Yes (rejected) |
| ABSENT | 缺勤 | Yes | No | Yes (absence alert) |
| MAKEUP | 补课 | **No** (charged on original) | Yes | Yes |
| NOT_STARTED | 未开始 | N/A | N/A | N/A |

**Critical rule:** ALL enrolled students MUST have a non-NOT_STARTED status before the lesson can transition to FINISHED. This is enforced server-side.

**Immutability:** Once a lesson reaches FINISHED, attendance records are locked. Editing requires reopening the lesson (FINISHED → SCHEDULED).

---

### 3.8 LessonChangeRequest (调课申请)

**Definition:** Instead of directly editing lesson fields, all changes go through a LessonChangeRequest. This ensures every change has a reason, an approval, and an audit trail.

```
LessonChangeRequest
├── id: 2001                     (integer PK)
├── lessonId: 42                 (FK → Lesson.id)
├── requestType: RESCHEDULE      (RESCHEDULE|TEACHER_CHANGE|CANCEL|REOPEN)
├── requestedBy: 5001            (userId)
├── reason: "老师出差"            (required — WHY the change)
├── previousDate: "2026-07-12"   (before state)
├── newDate: "2026-07-14"        (after state)
├── previousStartTime: "10:00"   (before)
├── newStartTime: "10:00"        (after)
├── previousEndTime: "11:30"     (before)
├── newEndTime: "11:30"          (after)
├── previousTeacherId: 5001      (before, for TEACHER_CHANGE)
├── newTeacherId: 5002            (after, for TEACHER_CHANGE)
├── status: PENDING              (PENDING|APPROVED|REJECTED)
├── approvedBy: null             (admin userId)
├── approvedAt: null             (approval timestamp)
├── rejectionReason: null        (if REJECTED)
└── createdAt: 2026-07-10        (request timestamp)
```

**Change Rules:**

| Change Type | Who Requests | Who Approves | Constraints |
|-------------|-------------|-------------|-------------|
| RESCHEDULE | Teacher, Admin | Admin | Max 3 per lesson. Within ±7 days of original date. |
| TEACHER_CHANGE | Admin | Auto (admin action) | One-lesson scope. Does not change class assignment. |
| CANCEL | Teacher, Admin | Admin | `cancelledReason` required. |
| REOPEN (FINISHED→SCHEDULED) | Admin | Auto (admin action) | No financial impact (safe). |
| REOPEN (ARCHIVED→FINISHED) | Admin | Auto (admin action) | Financial rollback may be needed. |

---

## 4. Lesson Generation

### 4.1 Generation Trigger

Lessons are **auto-generated** when a Class transitions from **DRAFT → ACTIVE**. This is a one-time batch operation, not a daily cron.

### 4.2 Generation Algorithm

```
Input:
  classCode, courseCode
  dayOfWeek: [6]           (Saturday)
  startTime: "10:00"
  endTime: "11:30"
  startDate: 2026-07-12
  totalLessons: 20
  teacherId: 5001          (from PRIMARY TeacherAssignment)

Algorithm:
  1. currentDate = startDate
  2. lessonNumber = 1
  3. WHILE lessonNumber <= totalLessons:
       a. Find the NEXT date ≥ currentDate where dayOfWeek matches
       b. CREATE Lesson:
            - classCode, courseCode (from Class)
            - lessonNumber
            - scheduledDate = found date
            - startTime, endTime (from Class schedule)
            - teacherId (from current PRIMARY TeacherAssignment)
            - status = SCHEDULED  (skips DRAFT)
            - isMakeup = false
       c. lessonNumber++
       d. currentDate = found date + 1 day
  4. All lessons created in ONE database transaction
```

### 4.3 Generation Rules

| Rule | Value |
|------|-------|
| Batch or one-by-one | **Batch** — all lessons in one transaction |
| Maximum lessons per class | 200 (safety limit) |
| Initial status | SCHEDULED (system-generated lessons skip DRAFT) |
| DRAFT lessons | Only for manually created ad-hoc lessons |
| Teacher at generation time | Copied from current PRIMARY assignment |
| Date conflict handling | N/A (Class can only meet on configured days) |

### 4.4 Schedule Constraints

| Constraint | Value |
|------------|-------|
| Maximum days per week | 6 (at least 1 day off) |
| Same-day duplicate lessons | Not allowed |
| Minimum lesson duration | 15 minutes |
| Maximum lesson duration | 240 minutes (4 hours) |
| Start date | Must be today or future |

---

## 5. The Financial Chain

The Teaching Domain defines the structural path for financial operations but does NOT execute them. The Finance domain listens for LessonFinished events and performs deductions.

### 5.1 Deduction Path

```
Lesson (id=42) → LessonFinished event
    │
    ▼
Finance Domain receives event
    │
    ▼
For each attendance record where status ∈ {PRESENT, LATE}:
    │
    ▼
Look up: Lesson.classCode → Enrollment (matching studentCode + classCode)
    │
    ▼
Read: Enrollment.contractCode → Contract
    │
    ▼
Deduct: Contract.remainingLessons -= 1
    │
    ▼
If remainingLessons == 0 → Contract.status → EXHAUSTED
    │
    ▼
Log to contract_audit_log: {lessonId, oldBalance, newBalance}
```

### 5.2 Deduction Rules

| Rule | Value |
|------|-------|
| Deduction per | 1 lesson per PRESENT/LATE attendance |
| No-charge statuses | LEAVE_APPROVED, ABSENT (absence = no charge), MAKEUP (charged on original) |
| Deduction performed by | Finance domain only (Rule 17) |
| Negative balance protection | remainingLessons MUST NOT go below 0 |
| Idempotency key | lessonId (same lesson must not deduct twice) |
| Audit trail | Every deduction logs: lessonId, contractCode, oldBalance, newBalance, timestamp |

### 5.3 Parent's View: Remaining Lessons

```
parent sees "15 remaining lessons"

This number = SUM(Contract.remainingLessons)
             WHERE Contract.studentCode = studentCode
             AND Contract.status = 'ACTIVE'

Computed server-side. Never calculated by frontend (Rule 18).
```

### 5.4 Teacher's View: Lesson Schedule

```
teacher sees "this week: 8 lessons"

This data = SELECT * FROM lesson
            WHERE teacherId = currentUser.id
            AND scheduledDate BETWEEN weekStart AND weekEnd
            AND status IN ('SCHEDULED', 'TEACHING')
            ORDER BY scheduledDate, startTime

Includes both PRIMARY and SUBSTITUTE assignments.
```

---

## 6. Makeup and Reschedule

### 6.1 Makeup Lesson (补课)

A makeup lesson replaces a missed lesson. It is a **new Lesson** entity linked to the original.

```
Original Lesson #5 (2026-07-10):
  Xiao Ming: ABSENT
  Contract CT2026070001 was NOT charged for this absence

Makeup Lesson (2026-07-14):
  isMakeup = true
  originLessonId = 42  (links back to Lesson #5)
  Xiao Ming: PRESENT
  Contract CT2026070001 IS charged for this makeup
```

**Makeup rules:**
- Makeup lessons follow the full lifecycle (SCHEDULED → TEACHING → FINISHED → ARCHIVED)
- Makeup lessons emit both LessonCompleted and LessonFinished events
- The original lesson's attendance records are NOT modified
- Makeup attendance charges against the student's Contract (same deduction path)

### 6.2 Reschedule (调课)

Rescheduling MUST go through a LessonChangeRequest. Direct field edits are forbidden.

**Rules:**
- Max 3 reschedules per lesson
- Date must remain within ±7 days of original
- Same-day time-only changes: allowed without ChangeRequest (minor adjustment)
- Date changes: MUST go through ChangeRequest with approval

---

## 7. Complete Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEACHING DOMAIN                              │
│                                                                  │
│  1. Teacher starts lesson     → Lesson: SCHEDULED → TEACHING    │
│  2. Teacher takes attendance  → Attendance records saved         │
│  3. Teacher completes lesson  → Lesson: TEACHING → FINISHED     │
│                                                                  │
│  ═══ EMIT: lesson.completed ═══                                  │
│                                                                  │
│  4. Review window (24h)       → Admin corrects if needed        │
│  5. Admin confirms / timeout  → Lesson: FINISHED → ARCHIVED     │
│                                                                  │
│  ═══ EMIT: lesson.finished ═══                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FINANCE DOMAIN (future)                      │
│                                                                  │
│  6. Deduct Contract.remainingLessons (per PRESENT/LATE)         │
│  7. Calculate teacher salary                                     │
│  8. If remainingLessons == 0 → Contract → EXHAUSTED            │
│  ═══ EMIT: contract.deducted ═══                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     POINTS DOMAIN (future)                       │
│                                                                  │
│  9. Award attendance points to students                          │
│  ═══ EMIT: points.awarded ═══                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION DOMAIN (future)                 │
│                                                                  │
│  10. Notify parents of confirmed lesson                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Answers to the 8 Acceptance Questions

### Q1: Course 的定义和边界是什么？

**Course** is a knowledge product definition. It describes what subject and content area is taught (subject, type), how much content there is (totalHours, totalLessons), and how long each lesson typically lasts (defaultDuration).

**Boundary:**
- **In scope:** Subject, type, content metrics, catalog status
- **Out of scope:** Pricing (→ Contract), scheduling (→ Class), teacher assignment (→ TeacherAssignment), student enrollment (→ Enrollment)
- Course has NO direct relationship with Student, Teacher, or Contract
- Course is referenced by Class via `courseCode`; Class carries the operational details

### Q2: Class 如何关联 Course 和 Teacher？

**Course link:** Class stores `courseCode` as a foreign key. One Course can have many Classes. Class inherits subject and type from Course but can override `defaultDuration`.

**Teacher link:** TeacherAssignment connects Teacher to Class. Each ACTIVE Class MUST have exactly one PRIMARY teacher. The assignment has a time period (effectiveFrom/effectiveTo). When a teacher is replaced, the old assignment is archived (effectiveTo set) and a new one is created.

**The chain:** `Class → courseCode → Course` (what is taught) + `Class → TeacherAssignment → teacherId → User` (who teaches it).

### Q3: Contract 如何与 Enrollment 和 Lesson 产生关系？

**Contract → Enrollment:** One Contract funds many Enrollments. Each Enrollment references exactly one Contract via `contractCode`. This means a student with one Contract can be enrolled in multiple classes, and all those enrollments draw from the same lesson pool.

**Lesson → Contract (deduction path):** When a Lesson finishes, the deduction path is:
```
Lesson.classCode → Enrollment (matching classCode + studentCode) → Enrollment.contractCode → Contract.remainingLessons
```

**Critical:** Contract is the ONLY entity where `remainingLessons` lives. No other entity tracks remaining lessons.

### Q4: Lesson 如何从 Class 的 Schedule 中生成？

When Class transitions **DRAFT → ACTIVE**, the system runs the Lesson generation algorithm:
1. Read Class schedule: dayOfWeek[], startTime, endTime, startDate, totalLessons
2. For each lesson number (1 to totalLessons): find the next matching weekday from the current date
3. Create Lesson records with status SCHEDULED (skipping DRAFT)
4. Copy teacherId from the current PRIMARY TeacherAssignment
5. All lessons created in a single database transaction

System-generated lessons start as **SCHEDULED**, not DRAFT. DRAFT is only for manually created ad-hoc lessons.

### Q5: 课时扣减的完整链路是什么？

```
1. Teacher completes lesson → Lesson status → FINISHED
2. LessonCompleted event emitted (NO money moves)
3. Review window (default 24 hours)
4. Admin confirms → Lesson status → ARCHIVED
5. LessonFinished event emitted
6. Finance domain receives event
7. For each PRESENT/LATE attendance:
   a. Find Contract via: Lesson → Enrollment → contractCode
   b. Contract.remainingLessons -= 1
   c. If remainingLessons = 0 → Contract → EXHAUSTED
8. Log deduction with lessonId (Rule 20 compliance)
```

**Key constraints:** Deduction is performed by Finance domain only (Rule 17). Teaching domain never touches Contract.remainingLessons directly. Every deduction traces to a lessonId.

### Q6: 调课/补课的规则是什么？

**Reschedule (调课):**
- MUST go through LessonChangeRequest (no direct field edits)
- Max 3 reschedules per lesson
- Date must remain within ±7 days of original
- Requires admin approval
- Same-day time-only changes: minor adjustment, no ChangeRequest needed

**Makeup (补课):**
- Create a new Lesson with `isMakeup = true` and `originLessonId` pointing to the missed lesson
- Follows full lesson lifecycle (SCHEDULED → ... → ARCHIVED)
- Emits both LessonCompleted and LessonFinished
- Original lesson's attendance is NOT modified
- Makeup attendance charges against the student's Contract (same deduction path)

**Teacher substitution:**
- Via LessonChangeRequest (TEACHER_CHANGE type)
- One-lesson scope only. Does not change Class teacher assignment.
- Recorded on the Lesson entity as `teacherId`

### Q7: 家长看到的课时余额是什么数据？

The parent sees the sum of `remainingLessons` across all **ACTIVE** Contracts for their child:

```
parentRemainingLessons = SUM(Contract.remainingLessons)
  WHERE Contract.studentCode = studentCode
  AND Contract.status = 'ACTIVE'
```

This is computed **server-side** and returned by API. The frontend displays it but never calculates it (Rule 18).

If a student has multiple active contracts (e.g., 5 remaining for math + 12 remaining for English), the parent sees the total: 17.

### Q8: Teacher 看到的课表是什么数据？

The teacher sees a list of Lessons filtered by:

```
teacherLessons = SELECT Lesson.* FROM Lesson
  WHERE Lesson.teacherId = currentUserId
  AND Lesson.scheduledDate >= today
  AND Lesson.status IN ('SCHEDULED', 'TEACHING')
  ORDER BY Lesson.scheduledDate, Lesson.startTime
```

Each lesson entry shows: class name (via JOIN on classCode), course name (via JOIN on courseCode), scheduled time, room (from Class), and enrolled student count. The teacher sees lessons for both PRIMARY and SUBSTITUTE assignments.

---

## 9. Database Table Summary

| Table | Key | Row Estimation (1 year) |
|-------|-----|------------------------|
| `course` | courseCode | 50-200 |
| `class` | classCode | 100-500 |
| `contract` | contractCode | 500-2000 |
| `enrollment` | (classCode, studentCode) | 1000-5000 |
| `teacher_assignment` | (classCode, teacherId) | 200-1000 |
| `lesson` | id (PK), (classCode, lessonNumber) | 5000-25000 |
| `lesson_attendance` | (lessonId, studentCode) | 25000-125000 |
| `lesson_change_request` | id (PK) | 200-1000 |
| `course_audit_log` | id (PK) | 500-2000 |
| `class_audit_log` | id (PK) | 1000-5000 |
| `contract_audit_log` | id (PK) | 2000-10000 |
| `lesson_audit_log` | id (PK) | 10000-50000 |

---

## 10. Implementation Priority

Based on Constitution Rule 15 (dependency order) and Rule 24 (Skeleton First):

| Phase | Entity | Sprint | Depends On |
|-------|--------|--------|------------|
| 1 | Course | 4.1.1 | — |
| 2 | TeacherAssignment | 4.1.2 | Identity (Teacher role) |
| 3 | Class | 4.1.2 | Course, TeacherAssignment |
| 4 | Contract | 4.1.3 | Student |
| 5 | Enrollment | 4.1.3 | Class, Contract, Student |
| 6 | Lesson (generation) | 4.1.4 | Class, TeacherAssignment |
| 7 | LessonAttendance | 4.1.4 | Lesson |
| 8 | LessonChangeRequest | 4.1.4 | Lesson |
| 9 | Events (LessonCompleted/LessonFinished) | 4.2 | All above |

---

*This document is the authoritative domain model for the Teaching Domain. It was produced during Task-EduOS-005 (Teaching Domain Deep Modeling) and approved through Gate #005 (Domain Review). All implementation must conform to this model. Any changes to this model require a Change Request (CR) per Rule 7 and Rule 25.*
