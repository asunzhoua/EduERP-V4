# EduOS Ubiquitous Language

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: Every term in EduOS has exactly one meaning. This glossary prevents miscommunication between developers, AI agents, and business stakeholders. When a term appears in code, documentation, or conversation, it means exactly what this document says.
> **Authority**: Constitution-v4.0.md, DomainCatalog.md, TeachingDomainModel.md

---

## How to Use This Document

1. **Before writing code**: Look up every term you plan to use in variable names, function names, or comments.
2. **Before writing documentation**: Verify your terms match this glossary.
3. **When confused**: If two people use the same word differently, this document resolves the conflict.
4. **When adding new terms**: New domain terms MUST be added here before implementation.

---

## Core Terms

### Student Domain Terms

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **Student** | A person (child) who attends classes at the institution. Has a unique StudentCode. | 学生 | User (User is the authentication identity) |
| **StudentCode** | Immutable, system-generated identifier: `STYYYYMMNNNN`. The ONLY way to reference a student across domains. | 学生编号 | studentId (internal DB PK) |
| **Parent** | A User with role=Parent. Linked to one or more Students. | 家长 | Guardian (use "Parent") |
| **StudentParent** | The many-to-many relationship between Parent and Student. | 家长学生关系 | Family |

### Identity Domain Terms

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **User** | An authentication identity. Has username, password, roles. | 用户 | Student, Teacher, Parent (these are roles played by Users) |
| **Role** | A set of permissions assigned to a User. Roles: Admin, Teacher, Parent. | 角色 | Permission |
| **Permission** | A specific capability (e.g., `course:create`, `lesson:approve`). | 权限 | Role |
| **RBAC** | Role-Based Access Control. Permissions are assigned to Roles, not Users. | 基于角色的访问控制 | — |

### Teaching Domain Terms

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **Course** | A teaching product definition. "What is taught." Has subject, type, duration. NO price, NO schedule. | 课程 | Class, Lesson |
| **CourseCode** | Immutable identifier: `CSYYYYMMNNNN`. | 课程编号 | courseId (internal DB PK) |
| **Class** | A specific teaching group instance of a Course. "When and where it meets." Has schedule, teacher, students. | 教学班 | Course, Lesson |
| **ClassCode** | Immutable identifier: `CLYYYYMMNNNN`. | 班级编号 | classId (internal DB PK) |
| **Lesson** | A single teaching session within a Class. THE atomic business unit. Everything revolves around Lesson. | 课次/课时 | Class, Session |
| **LessonNumber** | Sequential number within a Class (starts at 1). Part of the business composite key: `(classCode, lessonNumber)`. | 课次序号 | lessonId (internal DB PK) |
| **Schedule** | The recurring pattern of when a Class meets: dayOfWeek[], startTime, endTime. Embedded in Class entity (v1.0). | 课表 | Calendar, Timetable |
| **TeacherAssignment** | The link between a Teacher (User) and a Class. Roles: PRIMARY, SUBSTITUTE, ASSISTANT. | 教师分配 | — |
| **PRIMARY** | The main teacher responsible for a Class. Exactly one per ACTIVE Class. | 主教 | — |
| **SUBSTITUTE** | A temporary replacement teacher for a specific lesson or period. | 代课老师 | — |
| **ASSISTANT** | A teaching assistant for a Class. | 助教 | — |

### Financial Terms

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **Contract** | A purchased lesson package. "20 math lessons." THE financial unit. Tracks remainingLessons. | 课时合同/课程包 | Enrollment, Order |
| **ContractCode** | Immutable identifier: `CTYYYYMMNNNN`. | 合同编号 | contractId (internal DB PK) |
| **remainingLessons** | The number of lessons still available in a Contract. Decremented by Finance Domain only. | 剩余课时 | balance (use "remainingLessons") |
| **Enrollment** | The bridge connecting Student, Class, and Contract. "Which student is in which class, paid for by which contract." | 报名 | Registration, Signup |
| **Deduction** | The act of decrementing Contract.remainingLessons by 1. Only triggered by `lesson.finished`. | 扣课 | Charge, Payment |
| **Refund** | Returning money for unused lessons. Contract status → REFUNDED. | 退款 | Cancellation |

### Attendance Terms

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **LessonAttendance** | A record of what happened to a specific student during a specific lesson. Two-dimensional: workflowState + status. | 考勤记录 | Attendance (use "LessonAttendance" for the entity) |
| **workflowState** | The lifecycle stage: PENDING → CHECKED_IN → CONFIRMED → LOCKED. | 工作流状态 | status (these are different dimensions) |
| **status** | What happened: PRESENT, LATE, ONLINE, OFFLINE, ABSENT, LEAVE, MAKEUP. | 考勤状态 | workflowState |
| **Roll Call** | The act of recording attendance (PENDING → CHECKED_IN). Done by teacher. | 点名 | Check-in, Sign-in |
| **Confirmation** | Admin review of attendance (CHECKED_IN → CONFIRMED). | 确认 | Approval |
| **Lock** | Final immutability (CONFIRMED → LOCKED). Triggered by lesson archival. | 锁定 | Freeze |
| **Two-Phase Design** | workflowState tracks the process; status records the outcome. These must never be confused. | 双维度设计 | — |

### Lesson Change Terms

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **LessonChangeRequest** | A formal application to change a lesson. NOT a direct edit. Has reason, approval, audit trail. | 调课申请 | Edit, Update |
| **RESCHEDULE** | Change the date/time of a lesson. Max 3 per lesson. ±7 days range. | 调课 | Move, Postpone |
| **TEACHER_CHANGE** | Substitute the teacher for ONE lesson. Does NOT change Class-level assignment. | 换师 | Reassignment |
| **CANCEL** | Cancel a lesson. Requires reason. Existing attendance preserved. | 停课 | Delete |
| **REOPEN** | Reopen a cancelled/finished/archived lesson. Admin only. May have financial implications. | 复课 | Restore |

### Event Terms

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **lesson.completed** | Event emitted when Lesson: TEACHING → FINISHED. Teaching is done. NO money moves. | 课次完成 | lesson.finished |
| **lesson.finished** | Event emitted when Lesson: FINISHED → ARCHIVED. Financially settled. MONEY MOVES. | 课次结束 | lesson.completed |
| **attendance.confirmed** | Event emitted when ALL attendance for a Lesson reaches CONFIRMED or LOCKED. | 考勤确认 | lesson.finished |
| **Two-Phase Events** | lesson.completed (no money) → review window → lesson.finished (money). Safety mechanism. | 双阶段事件 | — |
| **Review Window** | Configurable period (default 24h) between lesson.completed and lesson.finished. Allows corrections. | 审核窗口 | Timeout |
| **Idempotency Key** | The field used to prevent duplicate processing. For lessons: `lessonId`. | 幂等键 | Primary Key |

### Status Terms (State Machine)

| Term | Definition | Chinese | NOT This |
|------|-----------|---------|----------|
| **DRAFT** | Being prepared. Not yet operational. | 草稿 | Created, New |
| **SCHEDULED** | On the calendar. Ready to happen. | 已排课 | Planned |
| **ACTIVE** | Currently operational. Running. | 进行中/激活 | In Progress, Running |
| **TEACHING** | Lesson is in progress. Teacher is teaching. | 授课中 | In Progress |
| **FINISHED** | Teaching done. Data provisional. NO money moved yet. Safe for corrections. | 已完成 | Completed, Done |
| **ARCHIVED** | Financially settled. Money moved. Terminal for Lesson. | 已归档 | Completed, Final |
| **CANCELLED** | Cancelled. Never deleted. Always retained for audit. | 已取消 | Deleted |
| **PENDING** | Awaiting action. Not yet processed. | 待处理 | New, Created |
| **CONFIRMED** | Reviewed and approved. Data is final. | 已确认 | Approved |
| **LOCKED** | Immutable. Cannot be modified under any circumstance. | 已锁定 | Frozen, Sealed |
| **EXHAUSTED** | All lessons in Contract consumed. remainingLessons = 0. | 已用完 | Empty, Zero |
| **EXPIRED** | Contract validity period has passed. | 已过期 | — |
| **FROZEN** | Temporarily suspended. No deductions allowed. Admin hold. | 已冻结 | Suspended, Paused |
| **REFUNDED** | Contract has been refunded. | 已退款 | Cancelled |
| **WITHDRAWN** | Student has left the class mid-term. | 已退课 | Removed, Dropped |
| **COMPLETED** | Class or Enrollment has naturally finished. Terminal. | 已结课 | Done, Finished |

---

## Anti-Patterns (Terms to Avoid)

| Don't Say | Say Instead | Why |
|-----------|-------------|-----|
| "session" | "lesson" | Session is ambiguous (could mean login session) |
| "class" alone | "class" or "course" depending on context | Class and Course are different entities |
| "check-in" | "roll call" | Check-in implies self-service; roll call implies teacher action |
| "balance" | "remainingLessons" | Balance is financial; remainingLessons is lesson count |
| "delete" | "soft delete" or "archive" | EduOS never hard-deletes business data |
| "user" when meaning student | "student" | User is authentication; Student is business entity |
| "money" | "deduction" or "salary" | Be specific about which financial operation |
| "attendance" alone | "LessonAttendance" for the entity, "attendance status" for the value | Avoid ambiguity between entity and attribute |

---

## Cross-Context Term Translation

Sometimes the same concept has different names in different contexts:

| Concept | Identity Context | Student Context | Teaching Context | Finance Context |
|---------|-----------------|-----------------|------------------|-----------------|
| Person who teaches | User (role=Teacher) | — | Teacher, teacherId | teacherId |
| Person who learns | — | Student, studentCode | studentCode, Enrollment | studentCode |
| Person who pays | User (role=Parent) | Parent | — | — |
| Teaching product | — | — | Course, courseCode | — |
| Teaching instance | — | — | Class, classCode | — |
| Single session | — | — | Lesson, lessonId | lessonId |
| Money package | — | — | Contract, contractCode | Contract, contractCode |
| Who is in what class | — | — | Enrollment | Enrollment (read-only) |

---

## Enum Value Reference

### Student Status
```
ACTIVE, PAUSED, GRADUATED, INACTIVE
```

### Course Status
```
DRAFT, PUBLISHED, ARCHIVED
```

### Class Status
```
DRAFT, ACTIVE, COMPLETED, CANCELLED
```

### Contract Status
```
ACTIVE, EXHAUSTED, EXPIRED, FROZEN, REFUNDED
```

### Lesson Status
```
DRAFT, SCHEDULED, TEACHING, FINISHED, ARCHIVED, CANCELLED
```

### Attendance Workflow State
```
PENDING, CHECKED_IN, CONFIRMED, LOCKED
```

### Attendance Status
```
PRESENT, LATE, ONLINE, OFFLINE, ABSENT, LEAVE, MAKEUP
```

### Enrollment Status
```
ACTIVE, WITHDRAWN, COMPLETED
```

### ChangeRequest Type
```
RESCHEDULE, TEACHER_CHANGE, CANCEL, REOPEN
```

### ChangeRequest Status
```
PENDING, APPROVED, REJECTED, EXECUTED
```

### Teacher Assignment Role
```
PRIMARY, SUBSTITUTE, ASSISTANT
```

### Subject
```
MATH, ENGLISH, CHINESE, PHYSICS, CHEMISTRY, ART, MUSIC, DANCE, SPORTS, CODING, OTHER
```

### Course Type
```
INDIVIDUAL, GROUP, TRIAL, CAMP
```

---

*This is a living document. Every new domain term MUST be added here before implementation. When terms conflict, this document is the authority.*
