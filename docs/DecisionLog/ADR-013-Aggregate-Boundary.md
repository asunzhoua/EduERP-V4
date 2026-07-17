# ADR-013: Aggregate Boundary Design

> **Status**: PROPOSED
> **Date**: 2026-07-15
> **Sprint**: 5 WP1
> **Supersedes**: (none — new decision)
> **Relates to**: Aggregates.md, Constitution Rule 19 (Lesson as Business Timeline), Rule 20 (Every Money Must Have a Lesson)

---

## Context

EduOS has 9 state machines and 8 entities in the Teaching context alone. Without formal aggregate boundaries, developers may:
1. Place entities in the wrong aggregate
2. Create transactions that span multiple aggregates
3. Violate consistency boundaries
4. Create circular aggregate dependencies

---

## Decision

**Define aggregate boundaries using the following five principles:**

### Principle AB-001: Aggregate Root Is the Only Entry Point

External code never references entities inside an aggregate directly. All operations go through the aggregate root.

**Example:**
```typescript
// ALLOWED: Through Lesson aggregate root
await lessonService.completeLesson(lessonId, attendanceData);

// PROHIBITED: Direct access to LessonAttendance
await attendanceRepository.save(attendanceRecord); // Bypasses Lesson
```

### Principle AB-002: Consistency Within Aggregate, Eventual Across

All entities within an aggregate are modified in a single transaction. Cross-aggregate consistency is achieved through events.

**Within Aggregate (Strong Consistency):**
- Lesson + LessonAttendance + LessonChangeRequest: single transaction
- Class + TeacherAssignment: single transaction
- Student + StudentParent: single transaction

**Across Aggregates (Eventual Consistency):**
- Teaching → Finance: via `lesson.finished` event
- Student → Teaching: via `student.deactivated` event
- Teaching → Dashboard: via `lesson.completed` event

### Principle AB-003: Aggregates Are Small

Aggregates should contain only the entities that MUST be consistent together. If two entities can be consistent eventually, they should be in separate aggregates.

**Good (Small):**
- Contract Aggregate: only Contract (self-contained)
- Enrollment Aggregate: only Enrollment (self-contained)
- Course Aggregate: only Course (self-contained)

**Good (Justified):**
- Lesson Aggregate: Lesson + LessonAttendance[] + LessonChangeRequest[] (must be consistent for LESSON-001, LESSON-002)
- Class Aggregate: Class + TeacherAssignment[] (must be consistent for CLASS-001)
- Student Aggregate: Student + StudentParent[] (must be consistent for parent linking)

### Principle AB-004: Cross-Aggregate References Are by Identity

Aggregates reference each other by identity (code, ID) only, not by entity object.

**Example:**
```typescript
// ALLOWED: Enrollment references Class by classCode (string)
interface Enrollment {
  classCode: string;      // Identity reference
  studentCode: string;    // Identity reference
  contractCode: string;   // Identity reference
}

// PROHIBITED: Enrollment contains Class entity
interface Enrollment {
  class: Class;           // Entity reference — VIOLATION
}
```

### Principle AB-005: Aggregate Boundaries Align with Module Boundaries

Each aggregate maps to a NestJS sub-module. The sub-module boundary IS the aggregate boundary.

| Aggregate | NestJS Sub-Module |
|-----------|------------------|
| Course | `teaching/course/` |
| Class | `teaching/class/` |
| Contract | `teaching/contract/` |
| Enrollment | `teaching/enrollment/` |
| Lesson | `teaching/lesson/` |
| Student | `student/student/` |
| User | `identity/user/` |

---

## Aggregate Boundary Matrix

| Aggregate | Root | Contains | References (by identity) | Referenced By |
|-----------|------|----------|-------------------------|---------------|
| Course | Course | (none) | — | Class |
| Class | Class | TeacherAssignment[] | Course (courseCode) | Lesson, Enrollment |
| Contract | Contract | (none) | Student (studentCode) | Enrollment |
| Enrollment | Enrollment | (none) | Class (classCode), Student (studentCode), Contract (contractCode) | Finance (deduction path) |
| Lesson | Lesson | LessonAttendance[], LessonChangeRequest[] | Class (classCode), Student (studentCode in attendance) | Finance, Dashboard, Notification |
| Student | Student | StudentParent[] | User (parentId) | Teaching (studentCode) |
| User | User | (none) | — | All contexts (userId) |

---

## Consequences

### Positive
- Clear aggregate boundaries prevent consistency violations
- Small aggregates reduce lock contention
- Identity references prevent circular dependencies
- Module alignment provides compile-time enforcement

### Negative
- Some operations require multiple aggregate modifications (e.g., enrollment requires checking Contract status)
- Cross-aggregate reads during event processing require careful design

---

*This ADR defines the aggregate boundary design. All developers must comply. Aggregate boundaries are the primary consistency mechanism in EduOS.*
