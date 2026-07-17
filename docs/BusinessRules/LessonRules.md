# Lesson — Business Rules

> **Domain**: Teaching > Lesson
> **Sprint**: 4
> **Version**: v0.1.1 (Design Freeze v1.1)
> **Last Updated**: 2026-07-07

---

## 1. Core Entity: Lesson

### 1.1 Description

A Lesson is a single teaching session (课次/课时) within a Class. It represents one specific time when a teacher meets students.

Per **Rule 19 (Constitution)**, Lesson is the **only business timeline** in EduOS. Everything — attendance, salary, deductions, points, notifications — revolves around the Lesson. Not Class. Not Course.

Per **Rule 20 (Constitution)**, every financial record must trace back to a Lesson ID. Every cent the system moves must answer: *"Which lesson caused this?"*

### 1.2 Required Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | Number | ✅ | Internal primary key (auto-increment) |
| `classCode` | String | ✅ | FK → Class.classCode |
| `courseCode` | String | ✅ | Denormalized from Course for query efficiency |
| `lessonNumber` | Number | ✅ | Sequential within Class (starts at 1) |
| `status` | Enum | ✅ | See Section 2 |
| `scheduledDate` | Date | ✅ | Date lesson is scheduled for |
| `startTime` | String | ✅ | e.g., `"14:00"` |
| `endTime` | String | ✅ | e.g., `"15:30"` |
| `teacherId` | Number | ✅ | Teacher who taught (copied from assignment at generation time) |
| `actualStartTime` | DateTime | ❌ | Filled when lesson starts |
| `actualEndTime` | DateTime | ❌ | Filled when lesson completes |
| `note` | Text | ❌ | Teacher's lesson notes/feedback |
| `cancelledReason` | String | ❌ | Reason if cancelled |
| `isMakeup` | Boolean | ❌ | True if this is a makeup lesson |
| `originLessonId` | Number | ❌ | **NEW v1.1** — Links makeup lesson to original missed lesson |
| `changeRequestId` | Number | ❌ | **NEW v1.1** — Links to LessonChangeRequest if rescheduled |

### 1.3 Lesson Identity

- `id` is the internal primary key (integer) — used for system operations
- `classCode` + `lessonNumber` is the **business composite key** — used for external references
- Every financial record (salary, deduction) stores `lessonId` — enabling full traceability (Rule 20)

---

## 2. Lesson Status Lifecycle

### 2.1 Status Definitions

```typescript
enum LessonStatus {
  DRAFT     = 'DRAFT',      // Being prepared (new in v1.1)
  SCHEDULED = 'SCHEDULED',  // On the calendar
  TEACHING  = 'TEACHING',   // In progress (renamed from IN_PROGRESS)
  FINISHED  = 'FINISHED',   // Teaching done, attendance recorded. Emits LessonCompleted.
  ARCHIVED  = 'ARCHIVED',   // Financially settled. Emits LessonFinished. Terminal.
  CANCELLED = 'CANCELLED',  // Cancelled. Never deleted. Always retained for audit.
}
```

### 2.2 State Transitions

```
                        ┌──────────┐
                        │  DRAFT   │
                        └────┬─────┘
                             │ schedule
                             ▼
                      ┌──────────┐
                      │SCHEDULED │ ◄──── (reopen from CANCELLED)
                      └────┬─────┘
                           │ start
                           ▼
                      ┌──────────┐
                      │ TEACHING │
                      └────┬─────┘
                           │ complete + attendance
                           ▼
                      ┌──────────┐
                      │ FINISHED │ ◄──── (reopen from ARCHIVED)
                      └────┬─────┘
                           │ confirm (admin or auto-timeout)
                           ▼
                      ┌──────────┐
                      │ ARCHIVED │  ← Terminal
                      └──────────┘

DRAFT ────cancel────► CANCELLED
SCHEDULED ──cancel──► CANCELLED
TEACHING ───cancel──► CANCELLED
```

### 2.3 Transition Rules

| From | To | Who | Conditions | Side Effects |
|------|----|-----|-----------|-------------|
| DRAFT | SCHEDULED | Admin/System | Lesson has date/time set | — |
| SCHEDULED | TEACHING | Teacher | None | Records `actualStartTime` |
| TEACHING | FINISHED | Teacher | All students have attendance status | Emits **LessonCompleted** event |
| FINISHED | ARCHIVED | Admin/Auto | Timeout or admin confirms | Emits **LessonFinished** event |
| SCHEDULED | CANCELLED | Admin/Teacher | `cancelledReason` required | — |
| TEACHING | CANCELLED | Admin | Emergency, `cancelledReason` required | — |
| FINISHED | SCHEDULED | Admin | Reopen for corrections, reason required | No financial rollback needed (no money moved yet) |
| ARCHIVED | FINISHED | Admin | Reopen, reason required | Financial rollback may be needed |
| CANCELLED | SCHEDULED | Admin | Reopen, reason required | — |

### 2.4 Critical Business Rules

- **CANCELLED lessons are NEVER deleted** — they remain in the database permanently for audit
- **FINISHED is a safe state** — teaching is done but no money has moved. Corrections are safe here.
- **Only ARCHIVED triggers financial settlement** — this is the safety gate
- Lessons SHOULD NOT remain in DRAFT indefinitely — auto-cancel after 7 days (future)
- Lessons SHOULD NOT remain in FINISHED indefinitely — auto-archive after configurable timeout (default 24h)

---

## 3. Lesson Generation

### 3.1 Auto-Generation Process

Lessons are auto-generated when a Class transitions from **DRAFT → ACTIVE**:

```
Input:  Class schedule (dayOfWeek[], startTime, endTime, startDate, totalLessons)
Output: Lesson records (one per scheduled day)

Algorithm:
  1. currentDate = startDate
  2. FOR lessonNumber = 1 TO totalLessons:
       a. Find next date where dayOfWeek matches currentDate
       b. CREATE Lesson:
            - classCode, courseCode (from Class)
            - lessonNumber
            - status = SCHEDULED (not DRAFT — system-generated lessons start as SCHEDULED)
            - scheduledDate = matched date
            - startTime, endTime (from schedule)
            - teacherId (from current PRIMARY teacher assignment)
            - isMakeup = false
       c. currentDate = matched date + 1 day
  3. All lessons created in one transaction
```

### 3.2 Generation Rules

- All lessons for the class are generated in **one batch** at activation time
- Lessons are NOT generated one-by-one (no daily cron job for v1.0)
- Maximum 200 lessons per class (safety limit)
- If startDate is in the future, all lessons have future dates
- If startDate is today/past, past-dates lessons are still created as SCHEDULED

### 3.3 Draft Lesson

- **DRAFT** status is for manually created lessons (admin adds a one-off lesson)
- System-generated lessons skip DRAFT and go directly to SCHEDULED
- Draft lessons must be explicitly scheduled (→ SCHEDULED) before they appear on teacher calendars

### 3.4 Manual Lesson Override

| Operation | Rules |
|-----------|-------|
| Create ad-hoc lesson | DRAFT → SCHEDULED. Must belong to ACTIVE class. Reason recommended. |
| Cancel lesson | Requires `cancelledReason`. Cannot cancel ARCHIVED lessons. |
| Reschedule lesson | MUST use LessonChangeRequest (see Section 6). Never directly edit. |
| Reopen finished lesson | Admin only. Requires reason. If ARCHIVED, rollback financial effects. |

---

## 4. Attendance

### 4.1 Attendance Model

```typescript
interface LessonAttendance {
  id: number;
  lessonId: number;             // FK → Lesson.id
  studentCode: string;          // FK → Student.studentCode
  status: AttendanceStatus;     // NOT_STARTED | PRESENT | LATE | LEAVE_APPROVED | LEAVE_REJECTED | ABSENT | MAKEUP
  checkInTime: DateTime | null;
  recordedBy: number;           // userId who recorded
  note: string | null;          // Optional remark
}
```

### 4.2 Attendance Status Definitions (NEW v1.1)

```typescript
enum AttendanceStatus {
  NOT_STARTED    = 'NOT_STARTED',    // Default before attendance is taken
  PRESENT        = 'PRESENT',        // 出勤 — attended full lesson
  LATE           = 'LATE',           // 迟到 — arrived past threshold (>15 min)
  LEAVE_APPROVED = 'LEAVE_APPROVED', // 请假获批 — parent notified in advance, no charge
  LEAVE_REJECTED = 'LEAVE_REJECTED', // 请假驳回 — parent notified but not approved, treated as ABSENT
  ABSENT         = 'ABSENT',         // 缺勤 — did not attend, no notice
  MAKEUP         = 'MAKEUP',         // 补课 — attending as makeup for a previous absence
}
```

### 4.3 Business Meaning of Each Status

| Status | Charge Lesson? | Award Points? | Triggers Notification? |
|--------|---------------|---------------|----------------------|
| PRESENT | ✅ Yes | ✅ Yes | ✅ Yes |
| LATE | ✅ Yes | ✅ Yes | ✅ Yes |
| LEAVE_APPROVED | ❌ No | ❌ No | ✅ Yes (acknowledged) |
| LEAVE_REJECTED | ✅ Yes | ❌ No | ✅ Yes (rejected notice) |
| ABSENT | ✅ Yes | ❌ No | ✅ Yes (absence alert) |
| MAKEUP | ❌ No (charged on original) | ✅ Yes | ✅ Yes |
| NOT_STARTED | N/A | N/A | N/A |

### 4.4 Attendance Rules

- Attendance MUST be recorded for **all enrolled students** before lesson can be marked FINISHED
- Only students with `ACTIVE` enrollment status at lesson time are eligible for attendance
- Default status before roll call: `NOT_STARTED`
- Attendance records are **immutable** once lesson is FINISHED (no edits without reopen)
- If a lesson is reopened (FINISHED → SCHEDULED), attendance records are unlocked for editing
- Attendance changes after ARCHIVE require a formal correction process (future sprint)

### 4.5 Roll Call Flow (v1.1)

```
1. Teacher opens the lesson
2. System displays all actively enrolled students (status: NOT_STARTED)
3. Teacher marks each student:
   - Quick action: "Mark all PRESENT"
   - Individual: PRESENT / LATE / LEAVE_APPROVED / ABSENT
4. Teacher adds lesson notes (optional)
5. Teacher confirms
6. System validates: no student still at NOT_STARTED
7. System saves attendance records
8. System sets lesson status → FINISHED
9. System emits LessonCompleted event
10. Countdown begins for admin confirmation (default 24h)
```

---

## 5. Two-Phase Event System

### 5.1 Design Rationale

In the real world, a teacher clicking "Complete Lesson" should NOT immediately deduct money. There needs to be a review window for:

- Parent calls to report absence after attendance was taken
- Admin corrects "LATE" to "LEAVE_APPROVED"
- Teacher marks a student PRESENT who was actually absent

The two-phase system solves this:

```
LessonCompleted = "Teaching is done, data is provisional"
LessonFinished  = "Data is confirmed, money can move"
```

### 5.2 LessonCompleted Event

```typescript
// File: @events/lesson-completed.event.ts
export class LessonCompletedEvent {
  constructor(
    public readonly lessonId: number,
    public readonly classCode: string,
    public readonly courseCode: string,
    public readonly teacherId: number,
    public readonly scheduledDate: Date,
    public readonly actualStartTime: Date,
    public readonly actualEndTime: Date,
    public readonly durationMinutes: number,
    public readonly attendance: Array<{
      studentCode: string;
      status: 'NOT_STARTED' | 'PRESENT' | 'LATE' | 'LEAVE_APPROVED' | 'ABSENT';
    }>,
    public readonly timestamp: Date = new Date(),
  ) {}
}
```

**Emission rules:**
- Emitted when lesson → FINISHED
- Does NOT trigger financial operations
- Only used for real-time dashboard updates and pre-notifications

### 5.3 LessonFinished Event

```typescript
// File: @events/lesson-finished.event.ts
export class LessonFinishedEvent {
  constructor(
    public readonly lessonId: number,
    public readonly classCode: string,
    public readonly courseCode: string,
    public readonly teacherId: number,
    public readonly scheduledDate: Date,
    public readonly actualStartTime: Date,
    public readonly actualEndTime: Date,
    public readonly durationMinutes: number,
    public readonly attendance: Array<{
      studentCode: string;
      status: 'PRESENT' | 'LATE' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'ABSENT' | 'MAKEUP';
    }>,
    public readonly confirmedBy: number,     // userId or 0 for auto-approve
    public readonly confirmedAt: Date,
    public readonly timestamp: Date = new Date(),
  ) {}
}
```

**Emission rules:**
- Emitted when lesson → ARCHIVED (admin confirm or auto-timeout)
- **This is the only event that triggers financial operations**
- Finance domain MUST NOT react to LessonCompleted — only LessonFinished
- The `confirmedBy` field tracks who confirmed (0 = auto-approve)
- All listeners MUST be idempotent (key: `lessonId`)

### 5.4 Review & Auto-Approval

| Config | Default | Notes |
|--------|---------|-------|
| Review window | 24 hours | Configurable per institution |
| Auto-approval enabled | Yes | Can be disabled for strict mode |
| Notification to admin | Yes | "Lessons awaiting confirmation" reminder |
| Correction allowed | Yes | Admin can reopen FINISHED lesson to edit attendance |

### 5.5 Event Emission Code

```typescript
// Inside LessonService.completeLesson():
// Phase 1: Finish the lesson
lesson.status = LessonStatus.FINISHED;
lesson.actualEndTime = new Date();
await this.lessonRepository.save(lesson);
await this.attendanceRepository.save(attendanceRecords);

// Emit LessonCompleted (no money)
this.eventEmitter.emit(
  'lesson.completed',
  new LessonCompletedEvent(/* ... */),
);

// --- Later, in LessonService.confirmLesson(): ---
// Phase 2: Archive the lesson (manual or auto)
lesson.status = LessonStatus.ARCHIVED;
lesson.confirmedBy = userId;
lesson.confirmedAt = new Date();
await this.lessonRepository.save(lesson);

// Emit LessonFinished (money moves)
this.eventEmitter.emit(
  'lesson.finished',
  new LessonFinishedEvent(/* ... */),
);
```

---

## 6. LessonChangeRequest (NEW v1.1)

### 6.1 Purpose

Instead of directly modifying lesson fields (date, time, teacher), all changes go through a **LessonChangeRequest**. This ensures:

- Every change has a reason
- Every change is approved
- Audit trail is clean
- Rollback is possible

### 6.2 Change Request Model

```typescript
interface LessonChangeRequest {
  id: number;
  lessonId: number;              // FK → Lesson.id
  requestType: ChangeType;       // RESCHEDULE | TEACHER_CHANGE | CANCEL | REOPEN
  requestedBy: number;           // userId
  reason: string;                // WHY the change is needed (required for all types)

  // What changed (before → after)
  previousDate: Date | null;
  newDate: Date | null;
  previousStartTime: string | null;
  newStartTime: string | null;
  previousEndTime: string | null;
  newEndTime: string | null;
  previousTeacherId: number | null;
  newTeacherId: number | null;

  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy: number | null;
  approvedAt: Date | null;
  rejectionReason: string | null;

  createdAt: Date;
}
```

### 6.3 Change Request Flow

```
1. Teacher/Admin identifies need for change
2. Creates LessonChangeRequest with reason
3. Admin reviews (for teacher requests) or auto-approves (for admin requests)
4. If APPROVED → Lesson is updated accordingly
5. If REJECTED → Lesson stays unchanged, requester notified
6. All steps logged in lesson_audit_log
```

### 6.4 Change Rules

| Change Type | Who Can Request | Who Approves | Notes |
|---|---|---|---|
| RESCHEDULE | Teacher, Admin | Admin | Max 3 reschedules per lesson |
| TEACHER_CHANGE | Admin | Auto (admin action) | Substitute teacher assignment |
| CANCEL | Teacher, Admin | Admin | Requires `cancelledReason` |
| REOPEN (FINISHED → SCHEDULED) | Admin | Auto (admin action) | Must verify no financial impact |
| REOPEN (ARCHIVED → FINISHED) | Admin | Auto (admin action) | Financial rollback required |

### 6.5 Reschedule Rules (via ChangeRequest)

| Rule | Value |
|------|-------|
| Max reschedules per lesson | 3 |
| Reschedule reason required | ✅ Always |
| Reschedule date range | Within ±7 days of original date |
| Same-day reschedule (time only) | Allowed without ChangeRequest (minor change) |
| Date change | MUST go through ChangeRequest |

---

## 7. Makeup and Reschedule

### 7.1 Makeup Lesson Rules (Updated v1.1)

- A makeup lesson replaces a lesson that was missed (student absence) or cancelled
- Makeup lessons are flagged with `isMakeup = true`
- The original lesson's attendance records remain unchanged
- The makeup lesson links back to the original via `originLessonId`
- Makeup lessons follow the exact same lifecycle (DRAFT → SCHEDULED → TEACHING → FINISHED → ARCHIVED)
- Makeup lessons also emit both LessonCompleted and LessonFinished events

**Example flow:**
```
Original Lesson #5 (2026-07-10):
  - Xiao Ming: ABSENT

Makeup Lesson (2026-07-14):
  - originLessonId = #5
  - isMakeup = true
  - Xiao Ming: PRESENT (charged against original lesson's Contract)
```

### 7.2 Teacher Substitution on a Lesson

- A substitute teacher can be assigned to an individual lesson via LessonChangeRequest
- If `lesson.teacherId` differs from the class's current PRIMARY teacher, the substitute is recorded
- This does NOT change the class's teacher assignment — only affects this one lesson

---

## 8. Audit Requirements (Updated v1.1)

### 8.1 lesson_audit_log Table

| Field | Type | Notes |
|-------|------|-------|
| `id` | Number | PK |
| `lessonId` | Number | FK → Lesson.id |
| `action` | Enum | `CREATE` / `STATUS_CHANGE` / `RESCHEDULE` / `ATTENDANCE_CHANGE` / `REOPEN` / `CONFIRM` / `CANCEL` |
| `fieldName` | String | Changed field |
| `oldValue` | Text | Previous value |
| `newValue` | Text | New value |
| **`reason`** | **Text** | **NEW v1.1 — WHY this change happened (required for all modification actions)** |
| `operatedBy` | Number | User ID |
| `operateTime` | DateTime | Auto-set |

### 8.2 Mandatory Audit Events

| Event | Always Audited? | Includes Reason? |
|-------|----------------|-----------------|
| Lesson auto-generated | ✅ | N/A (system) |
| Status change (any) | ✅ | ✅ |
| Reschedule (via ChangeRequest) | ✅ | ✅ (from ChangeRequest.reason) |
| Attendance override | ✅ | ✅ |
| Lesson reopened | ✅ | ✅ |
| Lesson cancelled | ✅ | ✅ |
| Lesson confirmed (→ ARCHIVED) | ✅ | N/A (confirmation) |
| LessonFinished emitted | ✅ | N/A (system) |

### 8.3 Audit Usage Examples

```
Audit Log Entry Example 1:
  lessonId: 42
  action: RESCHEDULE
  fieldName: scheduledDate
  oldValue: "2026-07-10"
  newValue: "2026-07-12"
  reason: "台风停课，调至周六"
  operatedBy: 1001

Audit Log Entry Example 2:
  lessonId: 42
  action: STATUS_CHANGE
  fieldName: status
  oldValue: "FINISHED"
  newValue: "SCHEDULED"
  reason: "家长反馈学生当天请假，需重新记录考勤"
  operatedBy: 1 (admin)
```

---

## 9. Database Table Design (Updated v1.1)

### 9.1 lesson Table

```sql
CREATE TABLE lesson (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  class_code        VARCHAR(20) NOT NULL,
  course_code       VARCHAR(20) NOT NULL,
  lesson_number     INT NOT NULL,
  status            ENUM('DRAFT','SCHEDULED','TEACHING','FINISHED','ARCHIVED','CANCELLED')
                    NOT NULL DEFAULT 'SCHEDULED',
  scheduled_date    DATE NOT NULL,
  start_time        VARCHAR(5) NOT NULL,     -- 'HH:MM'
  end_time          VARCHAR(5) NOT NULL,     -- 'HH:MM'
  teacher_id        BIGINT NOT NULL,
  actual_start_time DATETIME NULL,
  actual_end_time   DATETIME NULL,
  note              TEXT NULL,
  cancelled_reason  VARCHAR(255) NULL,
  is_makeup         TINYINT NOT NULL DEFAULT 0,
  origin_lesson_id  BIGINT NULL,            -- NEW v1.1
  change_request_id BIGINT NULL,            -- NEW v1.1
  confirmed_by      BIGINT NULL,            -- NEW v1.1 (userId or 0 for auto)
  confirmed_at      DATETIME NULL,          -- NEW v1.1
  created_by        BIGINT NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by        BIGINT NULL,
  updated_at        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted           TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_class_lesson (class_code, lesson_number),
  INDEX idx_class_code (class_code),
  INDEX idx_scheduled_date (scheduled_date),
  INDEX idx_status (status)
);
```

### 9.2 lesson_attendance Table (Updated v1.1)

```sql
CREATE TABLE lesson_attendance (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  lesson_id       BIGINT NOT NULL,
  student_code    VARCHAR(20) NOT NULL,
  status          ENUM('NOT_STARTED','PRESENT','LATE','LEAVE_APPROVED',
                       'LEAVE_REJECTED','ABSENT','MAKEUP')
                  NOT NULL DEFAULT 'NOT_STARTED',
  check_in_time   DATETIME NULL,
  recorded_by     BIGINT NOT NULL,
  note            TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lesson_student (lesson_id, student_code),
  INDEX idx_lesson_id (lesson_id),
  INDEX idx_student_code (student_code)
);
```

### 9.3 lesson_audit_log Table (Updated v1.1)

```sql
CREATE TABLE lesson_audit_log (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  lesson_id       BIGINT NOT NULL,
  action          ENUM('CREATE','STATUS_CHANGE','RESCHEDULE','ATTENDANCE_CHANGE',
                       'REOPEN','CONFIRM','CANCEL')
                  NOT NULL,
  field_name      VARCHAR(100) NULL,
  old_value       TEXT NULL,
  new_value       TEXT NULL,
  reason          TEXT NULL,                -- NEW v1.1 — WHY this change
  operated_by     BIGINT NOT NULL,
  operate_time    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lesson_id (lesson_id)
);
```

### 9.4 lesson_change_request Table (NEW v1.1)

```sql
CREATE TABLE lesson_change_request (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  lesson_id           BIGINT NOT NULL,
  request_type        ENUM('RESCHEDULE','TEACHER_CHANGE','CANCEL','REOPEN') NOT NULL,
  requested_by        BIGINT NOT NULL,
  reason              TEXT NOT NULL,

  previous_date       DATE NULL,
  new_date            DATE NULL,
  previous_start_time VARCHAR(5) NULL,
  new_start_time      VARCHAR(5) NULL,
  previous_end_time   VARCHAR(5) NULL,
  new_end_time        VARCHAR(5) NULL,
  previous_teacher_id BIGINT NULL,
  new_teacher_id      BIGINT NULL,

  status              ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_by         BIGINT NULL,
  approved_at         DATETIME NULL,
  rejection_reason    TEXT NULL,

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lesson_id (lesson_id),
  INDEX idx_status (status)
);
```

---

## 10. API Endpoints (Design v1.1)

### Lesson Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/classes/:code/lessons | JWT+Role | List lessons for a class (paginated) |
| GET | /api/v1/classes/:code/lessons/:lessonNumber | JWT+Role | Get lesson by number |
| PATCH | /api/v1/classes/:code/lessons/:lessonNumber/start | JWT+Role | Mark lesson TEACHING |
| PATCH | /api/v1/classes/:code/lessons/:lessonNumber/complete | JWT+Role | Complete lesson + attendance → FINISHED + LessonCompleted |
| PATCH | /api/v1/classes/:code/lessons/:lessonNumber/confirm | JWT+Role | Confirm → ARCHIVED + LessonFinished (admin) |
| PATCH | /api/v1/classes/:code/lessons/:lessonNumber/cancel | JWT+Role | Cancel lesson (via ChangeRequest) |
| POST | /api/v1/classes/:code/lessons/makeup | JWT+Role | Create makeup lesson |
| POST | /api/v1/lessons/:id/change-request | JWT+Role | Request lesson change |

### LessonChangeRequest Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/lessons/:id/change-requests | JWT+Role | List change requests for a lesson |
| PATCH | /api/v1/lesson-change-requests/:id/approve | JWT+Role | Approve change request |
| PATCH | /api/v1/lesson-change-requests/:id/reject | JWT+Role | Reject change request |

### Attendance Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/lessons/:lessonId/attendance | JWT+Role | Get attendance for lesson |
| PUT | /api/v1/lessons/:lessonId/attendance | JWT+Role | Set attendance (bulk update, only when lesson is TEACHING) |

### Lesson Confirmations (Admin Dashboard)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/lessons/pending-confirmation | JWT+Role | List all FINISHED lessons awaiting confirmation |
| POST | /api/v1/lessons/:id/confirm | JWT+Role | Confirm a single lesson |
| POST | /api/v1/lessons/batch-confirm | JWT+Role | Confirm multiple lessons at once |

---

## 11. Business Flow Verification

### 11.1 Happy Path (Normal Lesson)

```
1. Class ACTIVE, lessons auto-generated (SCHEDULED)
2. Teacher starts lesson → TEACHING
3. Teacher teaches
4. Teacher completes → takes attendance, marks FINISHED
5. System emits LessonCompleted
6. Review window (default 24h)
7. Admin confirms (or auto-timeout)
8. Lesson → ARCHIVED, system emits LessonFinished
9. Finance Domain: deduct Contract, calculate salary
```

### 11.2 Boundary Cases

| Case | Behavior |
|------|----------|
| Teacher forgets to complete | Lesson stays TEACHING. Admin can override. |
| Attendance correction needed | Lesson is FINISHED. Admin reopens → SCHEDULED, edits, re-completes. |
| No admin confirms for days | Auto-approve after timeout (configurable, default 24h). |
| Lesson cancelled mid-term | CANCELLED with reason. No financial impact. |
| System crash during completion | Lesson stays TEACHING. Teacher resumes. |
| Student joins mid-term | Attendance only required from enrollment date. |
| Duplicate LessonFinished event | Listeners use lessonId as idempotency key. |

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Lesson code. See also: [TeachingRules.md](./TeachingRules.md), [ContractRules.md](./ContractRules.md), [ClassRules.md](./ClassRules.md).*
