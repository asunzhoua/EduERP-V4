# EduOS Context Interaction Matrix

> **Version**: v1.0.0
> **Last Updated**: 2026-07-15
> **Sprint**: 5 WP1
> **Purpose**: Maps every cross-context interaction: who produces what, who consumes what, and through which mechanism. This matrix is the authoritative source for inter-context communication.
> **Parent**: [BoundedContexts.md](./BoundedContexts.md)
> **Child**: [AggregateDependencyReview.md](./AggregateDependencyReview.md)

---

## Interaction Patterns

| Pattern | Description | EduOS Usage |
|---------|-------------|-------------|
| **Event Notification** | Producer emits event, consumer reacts independently | Teaching → Finance (lesson.finished) |
| **Shared Kernel** | Shared types/concepts used by multiple contexts | Identity (User, Role) used by all |
| **Customer-Supplier** | Producer supplies data, consumer defines the contract | Teaching produces events, Finance defines what it needs |
| **Conformist** | Consumer conforming to producer's model | Dashboard conforms to all event schemas |
| **Anti-Corruption Layer** | Consumer translates producer's model into its own | Finance translates Teaching events into financial operations |
| **Separate Ways** | No interaction needed | Identity does not interact with Dashboard |

---

## Complete Interaction Matrix

### Rows = Producers, Columns = Consumers

| | Identity | Student | Teaching | Finance | Points | Notification | Dashboard |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Identity** | — | auth | auth | auth | auth | auth | auth |
| **Student** | — | — | events | events | — | — | events |
| **Teaching** | — | — | — | events | events | events | events |
| **Finance** | — | — | events | — | events | events | events |
| **Points** | — | — | — | — | — | events | events |
| **Notification** | — | — | — | — | — | — | — |
| **Dashboard** | — | — | — | — | — | — | — |

**Legend:**
- `auth` = Authentication/Authorization (synchronous, via Identity module)
- `events` = Event-driven communication (asynchronous, via EventBus)
- `—` = No interaction

---

## Detailed Interaction Specifications

### Identity → All Contexts

| Interaction | Mechanism | Direction | Data Flow |
|-------------|-----------|-----------|-----------|
| User authentication | JWT validation | Synchronous (middleware) | userId, roles, permissions |
| Role-based authorization | Permission check | Synchronous (guard) | permission codes |

**Notes:**
- Identity is the root context. All other contexts depend on it for authentication.
- Identity does NOT depend on any other context.
- Cross-context reference: `userId` (integer PK) is used everywhere.

---

### Student → Teaching

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `student.deactivated` | Student | Teaching | studentId, studentCode, reason, operatedBy | Student: ACTIVE → INACTIVE |
| `student.status.changed` | Student | Teaching, Finance, Dashboard | studentCode, previousStatus, newStatus, reason | Any status transition (PLANNED) |

**Teaching's Response to student.deactivated:**
- Review all ACTIVE Enrollments for the deactivated student
- No automatic withdrawal (Student boundary rule: XD6)
- Admin must manually handle enrollment status

**Data Reference:**
- Teaching reads `studentCode` (string) to identify students in Enrollment and LessonAttendance
- Teaching does NOT read Student entity directly (Rule 17)
- Student context does NOT know about Teaching entities

---

### Teaching → Finance

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `lesson.finished` | Teaching | Finance | lessonId, classCode, courseCode, teacherId, scheduledDate, attendance[], confirmedBy, confirmedAt | Lesson: FINISHED → ARCHIVED |

**Finance's Response to lesson.finished:**
```
FOR EACH attendance WHERE status IN (PRESENT, LATE, ONLINE, OFFLINE):
  1. FIND: Enrollment WHERE classCode = event.classCode
           AND studentCode = attendance.studentCode
           AND status = 'ACTIVE'
  2. FIND: Contract WHERE contractCode = enrollment.contractCode
  3. DEDUCT: Contract.remainingLessons -= 1
  4. IF remainingLessons = 0 → emit contract.exhausted
  5. LOG: contract_audit_log (lessonId, oldBalance, newBalance)
```

**Critical Safety Rules:**
- Finance ONLY reacts to `lesson.finished` — never to `lesson.completed` or `attendance.confirmed`
- Finance reads Enrollment (bridge entity) to find the Contract — this is a read-only cross-aggregate reference
- Finance does NOT modify Teaching tables (Rule 17)

---

### Teaching → Points

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `attendance.confirmed` | Teaching | Points, Dashboard | lessonId | ALL attendance for lesson CONFIRMED/LOCKED |
| `lesson.finished` | Teaching | Points | lessonId, attendance[] | Lesson: FINISHED → ARCHIVED |

**Points' Response (FUTURE):**
- `attendance.confirmed`: Award points based on attendance status
- `lesson.finished`: Additional point calculations (if needed)

---

### Teaching → Notification

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `lesson.completed` | Teaching | Notification | lessonId, classCode, teacherId | Lesson: TEACHING → FINISHED (FUTURE) |
| `lesson.finished` | Teaching | Notification | lessonId, classCode, confirmedBy | Lesson: FINISHED → ARCHIVED (FUTURE) |
| `leave.submitted` | Teaching | Notification | leaveId, studentId, lessonId | Parent submits leave request (FUTURE) |
| `leave.approved` | Teaching | Notification | leaveId, studentId, approvedBy | Admin approves leave (FUTURE) |
| `lesson.feedback.created` | Teaching | Notification | lessonId, studentId, teacherId | Student submits feedback (FUTURE) |

**Notification's Response (FUTURE):**
- All notifications are best-effort — failures do NOT block business operations
- Notification context may use WeChat templates, push notifications, email

---

### Teaching → Dashboard

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `lesson.completed` | Teaching | Dashboard | lessonId, classCode, attendance[] | Lesson: TEACHING → FINISHED |
| `lesson.finished` | Teaching | Dashboard | lessonId, confirmedBy | Lesson: FINISHED → ARCHIVED |
| `attendance.confirmed` | Teaching | Dashboard | lessonId | All attendance confirmed |

**Dashboard's Response:**
- Update real-time teaching stats ("3 lessons today")
- Update financial metrics
- Update attendance statistics

---

### Finance → Teaching

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `contract.exhausted` | Finance | Teaching, Dashboard | contractId, contractCode, studentCode | remainingLessons reaches 0 |
| `contract.expired` | Finance | Teaching, Dashboard | contractId, validTo, remainingLessons | validTo date passed |
| `contract.refunded` | Finance | Teaching, Dashboard | contractId, refundAmount, processedBy | Refund processed |

**Teaching's Response:**
- `contract.exhausted`: Sync contract status display
- `contract.expired`: Sync contract status display
- `contract.refunded`: Sync contract status display

**Note:** Teaching does NOT modify Contract entity in response to these events. It only updates its own view/display.

---

### Finance → Points

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `points.granted` | Finance | Points, Dashboard | studentId, lessonId, points | Points awarded to student |

---

### Finance → Notification

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `contract.expiring` | Finance | Notification | contractCode, remainingDays | Contract approaching expiry (PLANNED) |
| `salary.calculated` | Finance | Notification | teacherId, periodStart, periodEnd, totalAmount | Salary batch calculated (PLANNED) |

---

### Finance → Dashboard

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `contract.exhausted` | Finance | Dashboard | contractCode | remainingLessons = 0 |
| `contract.expired` | Finance | Dashboard | contractCode | validTo passed |
| `contract.refunded` | Finance | Dashboard | contractCode, refundAmount | Refund processed |
| `salary.calculated` | Finance | Dashboard | teacherId, totalAmount | Salary calculated (PLANNED) |

---

### Points → Dashboard

| Event | Producer | Consumer | Payload | Trigger |
|-------|----------|----------|---------|---------|
| `points.awarded` | Points | Dashboard, Notification | studentCode, points | Points awarded (FUTURE) |
| `points.redeemed` | Points | Dashboard | studentCode, pointsSpent | Points redeemed (FUTURE) |

---

### Dashboard → (none)

Dashboard is a pure consumer. It reads events from all contexts but never emits business events.

---

## Event Sequence Diagrams

### Happy Path: Lesson Lifecycle

```
Teaching          Finance         Points        Dashboard      Notification
   │                 │               │              │              │
   │ lesson.completed│               │              │              │
   ├────────────────►│               │              │              │
   │                 │               │              │              │
   │ attendance.     │               │              │              │
   │ confirmed       │               │              │              │
   ├─────────────────┼──────────────►│              │              │
   │                 │               │              │              │
   │ lesson.finished │               │              │              │
   ├────────────────►│               │              │              │
   │                 │               │              │              │
   │                 │ points.granted│              │              │
   │                 ├──────────────►│              │              │
   │                 │               │              │              │
   │                 │ contract.     │              │              │
   │                 │ deducted      │              │              │
   │                 ├───────────────┼─────────────►│              │
   │                 │               │              │              │
   │                 │ salary.       │              │              │
   │                 │ calculated    │              │              │
   │                 ├───────────────┼─────────────┼─────────────►│
```

### Edge Case: Student Deactivation

```
Student           Teaching         Finance        Dashboard
   │                 │                │              │
   │ student.        │                │              │
   │ deactivated     │                │              │
   ├────────────────►│                │              │
   │                 │                │              │
   │                 │ (review        │              │
   │                 │  enrollments)  │              │
   │                 │                │              │
   │ student.status. │                │              │
   │ changed         │                │              │
   ├────────────────►│                │              │
   │                 ├───────────────►│              │
   │                 │                ├─────────────►│
```

---

## Interaction Constraints

1. **No Circular Event Dependencies**: A context cannot emit an event that triggers another context to emit an event that triggers the first context. This prevents infinite loops.
2. **No Synchronous Cross-Context Calls**: All business data exchange happens through events. Only authentication is synchronous.
3. **Event Payload Immutability**: Event payloads are immutable for the lifetime of the major version.
4. **Idempotent Consumers**: All event consumers MUST be idempotent. Processing the same event twice must produce the same result.
5. **No Direct DB Access Across Contexts**: Each context owns its tables. Cross-context data access is via events only.

---

*This is a living document. Update when new events are added or interaction patterns change. Each new event MUST be registered here before implementation.*
