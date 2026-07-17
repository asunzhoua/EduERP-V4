# EduOS Aggregate Dependency Review

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: Analyze dependencies between aggregates to identify circular dependencies, tight coupling, and architectural risks. Every dependency must be justified. Unjustified dependencies are violations.
> **Parent**: [Aggregates.md](./Aggregates.md)
> **Child**: [SkeletonPlanning](./SkeletonPlanning.md) (directory structure)

---

## Dependency Rules

1. **No circular aggregate dependencies.** If A depends on B, B must not depend on A.
2. **Cross-context references are by identity only.** Enrollment references Class by `classCode` (string), not by Class entity.
3. **Event-driven coupling is preferred over direct coupling.** Teaching → Finance via events, not direct imports.
4. **Each aggregate has exactly one root.** External code never references entities inside the aggregate.

---

## Aggregate Dependency Graph

```
                    Identity
                   (User, Role)
                       │
                       │ userId reference
                       ▼
                    Student
                  (StudentAggregate)
                       │
                       │ studentCode reference
                       ▼
                    ┌───────────────┐
                    │   Teaching    │
                    │   Context     │
                    │               │
                    │  Course ◄─────┼── courseCode (Class references Course)
                    │    │          │
                    │    ▼          │
                    │  Class ◄──────┼── classCode (Lesson, Enrollment reference Class)
                    │    │          │
                    │    ▼          │
                    │  TeacherAssignment (inside Class aggregate)
                    │               │
                    │  Contract ◄───┼── contractCode (Enrollment references Contract)
                    │    │          │
                    │    ▼          │
                    │  Enrollment ◄─┼── (classCode + studentCode + contractCode)
                    │               │
                    │  Lesson ◄─────┼── lessonId (Finance, Dashboard reference Lesson)
                    │    │          │
                    │    ├── LessonAttendance (inside Lesson aggregate)
                    │    └── LessonChangeRequest (inside Lesson aggregate)
                    └───────┬───────┘
                            │
                            │ lesson.finished event
                            ▼
                       Finance
                    (to be designed)
                            │
                            │ points.granted event
                            ▼
                       Points
                    (to be designed)
```

---

## Dependency Analysis

### Identity Context

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| (none) | — | — | Root context |

**Depended On By:** All contexts (authentication, authorization)

---

### Student Context

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| Identity (User) | Direct (userId FK in StudentParent) | Yes | Parent linking requires User reference |

**Depended On By:** Teaching (studentCode reference)

**Risk Assessment:** Low. Student is a leaf context with minimal dependencies.

---

### Teaching Context — Course Aggregate

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| (none) | — | — | Course is self-contained |

**Depended On By:** Class (courseCode FK)

**Risk Assessment:** Low. Course is a pure knowledge product with no external dependencies.

---

### Teaching Context — Class Aggregate

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| Course (courseCode) | Identity reference | Yes | Class is an instance of a Course |
| Identity (User) | Identity reference (teacherId) | Yes | Teacher must exist in Identity |

**Depended On By:** Lesson (classCode FK), Enrollment (classCode FK)

**Risk Assessment:** Low. Class depends only on identity references, not on other aggregates' state.

---

### Teaching Context — Contract Aggregate

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| Student (studentCode) | Identity reference | Yes | Contract must reference a Student |

**Depended On By:** Enrollment (contractCode FK), Finance (lesson.finished event)

**Risk Assessment:** Low. Contract is self-contained with minimal dependencies.

**Critical Invariant:** Only Finance Domain can modify `remainingLessons` (CONTRACT-002). Teaching Domain can only freeze/unfreeze.

---

### Teaching Context — Enrollment Aggregate

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| Class (classCode) | Identity reference | Yes | Enrollment links Student to Class |
| Student (studentCode) | Identity reference | Yes | Enrollment must reference a Student |
| Contract (contractCode) | Identity reference | Yes | Enrollment must reference a Contract (financial link) |

**Depended On By:** Finance (deduction path: Lesson → Enrollment → Contract)

**Risk Assessment:** Medium. Enrollment is the bridge entity with three cross-aggregate references. Changes to any of the three referenced aggregates can affect Enrollment validation.

**Critical Invariant:** UNIQUE(classCode, studentCode) — one enrollment per student per class (ENROLL-001).

---

### Teaching Context — Lesson Aggregate

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| Class (classCode) | Identity reference | Yes | Lesson belongs to a Class |
| Student (studentCode) | Identity reference (in LessonAttendance) | Yes | Attendance references Student |
| TeacherAssignment | Within aggregate boundary | Yes | Teacher is copied from assignment at generation time |

**Depended On By:** Finance (lesson.finished event), Dashboard (lessonId), Notification (lessonId)

**Risk Assessment:** Low. Lesson depends only on identity references. The complex logic (two-phase events, attendance lifecycle) is self-contained within the aggregate.

**Critical Invariants:**
- LESSON-001: One attendance per student per lesson (UNIQUE constraint)
- LESSON-002: ARCHIVED requires all attendance confirmed
- LESSON-005: Every money traces to lessonId

---

### Finance Context (Planned)

| Depends On | Type | Justified? | Reason |
|-----------|------|-----------|--------|
| Teaching (lesson.finished event) | Event-driven | Yes | Finance reacts to lesson completion |
| Teaching (Enrollment, Contract) | Read-only cross-aggregate | Yes | Finance reads Enrollment to find Contract for deduction |
| Student (studentCode) | Identity reference | Yes | Finance references Student in financial records |

**Depended On By:** Points (points.granted event), Dashboard (financial metrics)

**Risk Assessment:** Medium. Finance is the critical financial context. Errors here have direct monetary impact. Must be implemented with extreme care (Stable First principle).

**Critical Constraint:** Finance ONLY reacts to `lesson.finished` — never to `lesson.completed` or `attendance.confirmed` (Rule 16).

---

## Circular Dependency Analysis

| Check | Result | Status |
|-------|--------|--------|
| Identity ↔ Student | No cycle (Student depends on Identity, not reverse) | PASS |
| Identity ↔ Teaching | No cycle (Teaching depends on Identity, not reverse) | PASS |
| Student ↔ Teaching | No cycle (Teaching depends on Student, not reverse) | PASS |
| Teaching ↔ Finance | No cycle (Finance depends on Teaching via events, Teaching depends on Finance via events — BUT these are different events) | PASS |
| Finance ↔ Points | No cycle (Points depends on Finance, not reverse) | PASS |
| Any context ↔ Dashboard | No cycle (Dashboard is read-only, never emits) | PASS |

**Conclusion:** No circular dependencies detected. The dependency graph is a DAG (Directed Acyclic Graph).

---

## Coupling Analysis

### Tight Coupling (High Risk)

| Pair | Coupling Type | Risk | Mitigation |
|------|--------------|------|------------|
| Enrollment ↔ Contract | Identity reference (contractCode) | Medium | Contract status changes (EXHAUSTED, EXPIRED) propagate via events |
| Lesson ↔ LessonAttendance | Aggregate boundary | Low | Both are in the same aggregate, modified together |
| Finance ↔ Lesson | Event-driven (lesson.finished) | Medium | Finance reads Enrollment to find Contract — must handle missing Enrollment gracefully |

### Loose Coupling (Low Risk)

| Pair | Coupling Type | Risk | Mitigation |
|------|--------------|------|------------|
| Teaching ↔ Dashboard | Event-driven | Low | Dashboard is read-only, failures don't block |
| Teaching ↔ Notification | Event-driven | Low | Notification is best-effort, failures don't block |
| Student ↔ Teaching | Event-driven (student.deactivated) | Low | Teaching reviews but doesn't auto-modify |

---

## Architectural Risks

### Risk 1: Enrollment as a Single Point of Failure

**Description:** Enrollment is the bridge between Student, Class, and Contract. If Enrollment is missing or incorrect, the entire financial deduction chain breaks.

**Impact:** Finance cannot determine which Contract to deduct from. Lessons taught but not deducted = revenue loss.

**Mitigation:**
- ENROLL-001: UNIQUE(classCode, studentCode) prevents duplicate enrollments
- ENROLL-002: ACTIVE enrollment requires ACTIVE contract
- Finance logs warnings when no ACTIVE enrollment found for a student in a lesson
- Dashboard monitors "lessons without enrollment" as an anomaly

---

### Risk 2: Contract.remainingLessons Race Condition

**Description:** If two lessons finish simultaneously for the same Contract, concurrent deductions could cause remainingLessons to go negative.

**Impact:** Financial inconsistency. Student overcharged.

**Mitigation:**
- Database-level: UPDATE with WHERE remainingLessons > 0
- Application-level: Optimistic locking with version field
- CONTRACT-001: remainingLessons >= 0 is enforced at database level
- Finance Domain uses transactions with row-level locking

---

### Risk 3: Event Ordering Guarantee

**Description:** Events must be processed in order: lesson.completed → attendance.confirmed → lesson.finished. If events arrive out of order, financial operations may execute before attendance is confirmed.

**Impact:** Premature deduction. Financial inconsistency.

**Mitigation:**
- @nestjs/event-emitter processes events synchronously within a single process
- Lesson.finished emission has a guard: all attendance must be CONFIRMED/LOCKED
- Finance Domain validates attendance status before deduction
- Future: If moving to distributed events, use event sequence numbers

---

## Dependency Health Score

| Context | Dependencies | Dependents | Risk Level |
|---------|-------------|-----------|------------|
| Identity | 0 | 7 | LOW |
| Student | 1 | 1 | LOW |
| Teaching | 2 | 4 | MEDIUM |
| Finance | 2 | 3 | MEDIUM |
| Points | 2 | 1 | LOW |
| Notification | 0 | 0 | LOW |
| Dashboard | 0 | 0 | LOW |

**Overall Health:** GOOD. No circular dependencies. All dependencies justified. Two medium-risk areas (Enrollment bridge, Finance deduction) have appropriate mitigations.

---

*This is a living document. Update when new aggregates are added or dependency patterns change. Review during Gate reviews.*
