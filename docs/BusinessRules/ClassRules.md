# Class — Business Rules

> **Domain**: Teaching > Class
> **Sprint**: 4
> **Version**: v0.1.0 (Design Freeze)
> **Last Updated**: 2026-07-07

---

## 1. Core Entity: Class

### 1.1 Description

A Class (教学班) is a specific teaching group instance of a Course. It defines:
- **What** is taught: links to a Course via `courseCode`
- **Who teaches it**: TeacherAssignment (primary teacher + optional substitutes)
- **Who learns it**: Enrollment (list of students)
- **When it meets**: Schedule (recurring day/time pattern)
- **What happens**: Individual Lesson sessions are generated from the schedule

A Class is the central operational unit — teachers see their classes, students are enrolled in classes, lessons belong to classes.

### 1.2 Required Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `classCode` | String | ✅ | Auto-generated, immutable (`CLYYYYMMNNNN`) |
| `courseCode` | String | ✅ | FK → Course.courseCode |
| `name` | String | ✅ | Display name (e.g., "周六上午10点班") |
| `status` | Enum | ✅ | See Section 2 |
| `startDate` | Date | ✅ | First lesson date |
| `totalLessons` | Number | ✅ | Total lessons to generate |
| `maxStudents` | Number | ✅ | Maximum enrollment capacity |
| `defaultDuration` | Number | ✅ | Minutes per lesson (inherited from Course, but overridable) |
| `room` | String | ❌ | Classroom/location |
| `note` | Text | ❌ | Internal notes |
| `tags` | JSON/String[] | ❌ | Class tags |

### 1.3 Schedule Fields (Embedded in Class)

These fields define the recurring schedule pattern:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `dayOfWeek` | JSON/Number[] | ✅ | Days class meets (0=Sun, 1=Mon, ... 6=Sat). e.g., `[2, 4]` = Tue & Thu |
| `startTime` | String | ✅ | Start time, e.g., `"14:00"` |
| `endTime` | String | ✅ | End time, e.g., `"15:30"` |

**Design decision:** The schedule is stored directly on the Class entity (not a separate table) for simplicity in v1.0. A separate Schedule table can be introduced later if multi-schedule-per-class or exception-day support is needed.

---

## 2. Class Status Lifecycle

### 2.1 Status Definitions

```typescript
enum ClassStatus {
  DRAFT     = 'DRAFT',     // Being set up, no lessons generated
  ACTIVE    = 'ACTIVE',    // Running — lessons generated and being taught
  COMPLETED = 'COMPLETED', // All lessons finished
  CANCELLED = 'CANCELLED', // Cancelled before/during operation
}
```

### 2.2 State Transitions

```
                ┌─────────────┐
                │   DRAFT     │
                └──────┬──────┘
                       │ activate (requires: teacher assigned, schedule set)
                       ▼
                ┌─────────────┐
                │   ACTIVE    │ ◄──── (re-activate from CANCELLED)
                └──────┬──────┘
               ┌───────┴───────┐
               │               │
               ▼               ▼
        ┌──────────┐    ┌──────────┐
        │COMPLETED │    │CANCELLED │
        └──────────┘    └──────────┘
```

**Transition rules:**

| From | To | Conditions | Side Effects |
|------|----|-----------|-------------|
| DRAFT | ACTIVE | Teacher assigned, schedule defined | Lessons auto-generated |
| ACTIVE | COMPLETED | All lessons in COMPLETED status | Final class report |
| ACTIVE | CANCELLED | Admin approval required | All future lessons → CANCELLED |
| COMPLETED | — | Terminal state | No transitions allowed |
| CANCELLED | ACTIVE | Admin override | Future lessons re-generated |
| DRAFT | CANCELLED | No students enrolled yet | No side effects |

### 2.3 Status Change Rules

- DRAFT → ACTIVE is an **irreversible operational start** — schedule is frozen
- ACTIVE → COMPLETED is automatic when the last lesson is completed
- ACTIVE → CANCELLED requires a `reason` and `approvedBy` audit field
- COMPLETED is terminal — no lessons can be modified
- CANCELLED → ACTIVE re-activation must be explicitly logged as an override

---

## 3. Schedule & Lesson Generation

### 3.1 Schedule Definition

Each Class has one schedule defined by three fields:
- `dayOfWeek`: which days of the week (e.g., Tuesday and Thursday)
- `startTime`: when each lesson starts
- `endTime`: when each lesson ends

### 3.2 Lesson Generation Algorithm

When a Class transitions from DRAFT → ACTIVE:

```
1. Read schedule: dayOfWeek[], startTime, endTime, startDate, totalLessons
2. currentDate = startDate
3. lessonNumber = 1
4. WHILE lessonNumber <= totalLessons:
     a. Find the next date matching dayOfWeek from currentDate
     b. Create Lesson with:
        - lessonNumber = lessonNumber
        - scheduledDate = found date
        - startTime, endTime from schedule
        - status = SCHEDULED
        - teacherId from current primary teacher
     c. lessonNumber++
     d. currentDate = found date + 1 day
5. All lessons created in a single database transaction
```

### 3.3 Schedule Modification Rules

| Scenario | Allowed? | Rules |
|----------|----------|-------|
| Change schedule before activation | ✅ | Free modification |
| Change schedule after activation (future lessons) | ✅ | Existing completed lessons unchanged. Future lessons regenerated. |
| Change schedule after activation (past lessons) | ❌ | Cannot modify completed lesson schedule |
| Cancel individual lesson | ✅ | Specific lesson → CANCELLED |
| Add makeup lesson | ✅ | Ad-hoc lesson creation (marked as makeup) |

### 3.4 Schedule Constraints

- Maximum 6 days per week per class (at least 1 day off)
- A class cannot have two lessons on the same day
- endTime must be after startTime
- Minimum lesson duration: 15 minutes
- Maximum lesson duration: 240 minutes (4 hours)
- Start date must be today or in the future (not in the past)

---

## 4. Teacher Assignment

### 4.1 Assignment Model

```typescript
interface TeacherAssignment {
  classCode: string;
  teacherId: number;          // FK → User.id (role = Teacher)
  role: TeacherRole;          // PRIMARY | SUBSTITUTE | ASSISTANT
  effectiveFrom: Date;        // When this assignment takes effect (NEW v1.1)
  effectiveTo: Date | null;   // When assignment ends (null = currently active)
  assignedBy: number;         // userId who made the assignment
  reason: string | null;      // Why the assignment/change was made
}
```

### 4.2 Teacher Roles

| Role | Description | Count per Class |
|------|-------------|-----------------|
| PRIMARY | Main teacher responsible for the class | Exactly 1 (when ACTIVE) |
| SUBSTITUTE | Temporary replacement teacher | 0 or more |
| ASSISTANT | Teaching assistant | 0 or more |

### 4.3 Assignment Rules

- Each ACTIVE Class MUST have exactly one PRIMARY teacher
- The PRIMARY teacher assignment must exist BEFORE Class can become ACTIVE
- A teacher can be PRIMARY in multiple classes (scheduling conflicts are a business concern, not a system constraint for v1.0)
- Assignment history is preserved: when a teacher is replaced, the old assignment gets an `effectiveTo` date
- Completed lessons retain the teacher who taught them (copied into the Lesson record, not dynamically resolved)
- Reassigning teacher for future lessons: set `effectiveTo` on current assignment, create new assignment with `effectiveFrom` = future date
- A substitute teacher assignment uses `effectiveFrom`/`effectiveTo` to define the coverage period — after `effectiveTo`, the PRIMARY teacher auto-resumes

### 4.4 Teacher Constraints

- Teacher MUST have role `Teacher` in the Identity domain
- Teacher must be ACTIVE (not disabled) in the Identity domain
- A teacher must not be assigned to more than the configured maximum classes (configurable, default: 20)

---

## 5. Student Enrollment

### 5.1 Enrollment Model

```typescript
interface Enrollment {
  classCode: string;           // FK → Class.classCode
  studentCode: string;         // FK → Student.studentCode
  contractCode: string;        // FK → Contract.contractCode (NEW v1.1)
  enrolledAt: Date;
  enrolledBy: number;          // userId
  status: EnrollmentStatus;    // ACTIVE | WITHDRAWN | COMPLETED
  withdrawReason: string | null;
}
```

### 5.2 Enrollment Rules

- Student MUST exist in the Student domain before enrollment
- Student MUST have `ACTIVE` status to be enrolled
- **Contract MUST exist and be ACTIVE before enrollment (NEW v1.1)** — enrollment references a `contractCode`
- Student CAN be enrolled in multiple classes simultaneously
- Student CANNOT be enrolled in the same class twice
- Enrollment count must not exceed `maxStudents` at time of enrollment (**capacity: current enrollment is computed server-side from enrollments table — Rule 18**)
- If a student is `INACTIVE` or `GRADUATED` in Student domain, new enrollment is rejected
- Enrolling does NOT check for scheduling conflicts (v1.0 limitation — will be added later)

### 5.3 Enrollment Status Lifecycle

```
ACTIVE ──(withdraw)──► WITHDRAWN
ACTIVE ──(complete)──► COMPLETED  (auto when Class → COMPLETED)
```

- `WITHDRAWN`: Student left mid-term. Financial implications handled by Finance domain.
- `COMPLETED`: Student finished the class. Set automatically when Class becomes COMPLETED.
- A withdrawn student cannot be re-enrolled (create a new enrollment instead).

### 5.4 Waitlist (Reserved for Future)

- When enrollment reaches `maxStudents`, additional students are placed on a waitlist
- When a slot opens (withdrawal), the first waitlisted student is auto-enrolled
- Implementation deferred to a future sprint

---

## 6. Class Size Validation

| Rule | Default | Configurable? |
|------|---------|---------------|
| Minimum students to activate | 1 | ✅ Per course |
| Maximum students per class | 20 | ✅ Per class |
| Override reason required for exceeding max | Yes | Always enforced |
| Waitlist enabled | No | ✅ Future feature |

---

## 7. Class Audit

All Class state changes MUST be logged:

| Event | Audit Fields |
|-------|-------------|
| Class created | `CREATE` — operator, timestamp, source |
| Status change | `STATUS_CHANGE` — oldStatus, newStatus, operator, reason |
| Schedule changed | `SCHEDULE_CHANGE` — oldDayOfWeek, newDayOfWeek, oldTime, newTime |
| Teacher assigned | `TEACHER_ASSIGN` — teacherId, role, operator |
| Teacher removed | `TEACHER_REMOVE` — teacherId, role, operator |

---

## 8. API Endpoints (Design)

### Class Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/classes | JWT+Role | Create class (DRAFT) |
| GET | /api/v1/classes | JWT+Role | List classes (paginated, filterable) |
| GET | /api/v1/classes/:code | JWT+Role | Get class by classCode |
| PUT | /api/v1/classes/:code | JWT+Role | Update class |
| PATCH | /api/v1/classes/:code/status | JWT+Role | Change class status (→ACTIVE/COMPLETED/CANCELLED) |
| DELETE | /api/v1/classes/:code | JWT+Role | Soft delete (DRAFT only) |

### Teacher Assignment Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/classes/:code/teachers | JWT+Role | Assign teacher to class |
| DELETE | /api/v1/classes/:code/teachers/:teacherId | JWT+Role | Remove teacher assignment |
| GET | /api/v1/classes/:code/teachers | JWT+Role | Get class teachers |

### Enrollment Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/classes/:code/enrollments | JWT+Role | Enroll student |
| DELETE | /api/v1/classes/:code/enrollments/:studentCode | JWT+Role | Withdraw student |
| GET | /api/v1/classes/:code/enrollments | JWT+Role | List enrolled students |
| GET | /api/v1/students/:studentCode/classes | JWT+Role | Get student's classes |

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Class code. See also: [TeachingRules.md](./TeachingRules.md), [CourseRules.md](./CourseRules.md), [LessonRules.md](./LessonRules.md).*
