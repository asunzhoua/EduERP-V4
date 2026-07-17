# Enrollment — Business Rules

> **Domain**: Teaching > Enrollment
> **Sprint**: 4
> **Version**: v1.1.0 (Task-028 Architecture Consistency Closure)
> **Last Updated**: 2026-07-14
> **Author**: Chief Architect
> **Authority**: [TeachingConstitution_v1.1.md](../architecture/TeachingConstitution_v1.1.md), [ADR-009-Enrollment-Reactivation.md](../DecisionLog/ADR-009-Enrollment-Reactivation.md)

---

## 1. Core Entity: Enrollment

### 1.1 Description

Enrollment (报名) is the **bridge entity** connecting Student, Class, and Contract. It answers the question: *"Which student is in which class, paid for by which contract?"*

This is the critical link in the deduction chain. When a Lesson finishes, the system traces:

```
Lesson.classCode → Enrollment (matching classCode + studentCode)
  → Enrollment.contractCode → Contract
    → Contract.remainingLessons (deducted by Finance Domain)
```

Without Enrollment, the financial chain is broken. The system cannot determine which Contract to deduct from.

### 1.2 Why Enrollment Exists

In the old model (v1.0):

```
Student → Enrollment → Class
(Lessons deducted from Enrollment directly)
```

In the new model (v1.1, current):

```
Student → Contract → Enrollment → Class
(Lessons deducted from Contract, Enrollment is the bridge)
```

The key insight: a parent buys a Contract ("20 math lessons"), then the student enrolls in a Class ("Saturday 10am class"). If the student changes classes, the Contract stays — only the Enrollment changes.

### 1.3 Required Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `classCode` | String | ✅ | FK → Class.classCode |
| `studentCode` | String | ✅ | FK → Student.studentCode |
| `contractCode` | String | ✅ | FK → Contract.contractCode — the financial link |
| `status` | Enum | ✅ | See Section 2 |
| `enrolledBy` | Number | ✅ | userId of admin who performed enrollment |
| `enrolledAt` | DateTime | ✅ | Auto-set timestamp |
| `withdrawReason` | Text | ❌ | Required only when status = WITHDRAWN |

### 1.4 Identity

Enrollment does NOT have an auto-generated integer PK as its primary business identifier. The **composite key** is `(classCode, studentCode)` — a student can only be enrolled in a given class once.

The database may use an auto-increment `id` for internal purposes, but all business operations reference Enrollment by `(classCode, studentCode)`.

### 1.5 Unique Constraint

```sql
UNIQUE KEY uk_enrollment_student_class (class_code, student_code)
```

This prevents a student from being enrolled in the same class twice. The constraint enforces a core business invariant: **one row per student-class pair**. A withdrawn student who re-enrolls is handled via Reactivation (UPDATE the existing record back to ACTIVE), not by creating a new row. See ADR-009.

---

## 2. Enrollment Status Lifecycle

### 2.1 Status Definitions

```typescript
enum EnrollmentStatus {
  ACTIVE    = 'ACTIVE',    // Student is actively enrolled, attending classes
  WITHDRAWN = 'WITHDRAWN', // Student left mid-term (manual withdrawal)
  COMPLETED = 'COMPLETED', // Class completed, enrollment auto-finalized
}
```

| Status | Meaning | Can attend lessons? | Financial implication |
|--------|---------|--------------------|-----------------------|
| ACTIVE | Student is attending | ✅ Yes | Lessons deducted from linked Contract |
| WITHDRAWN | Student left mid-term | ❌ No | No further deductions. Refund handled by Finance Domain. |
| COMPLETED | Class finished naturally | ❌ (no more lessons) | All lessons already deducted or accounted for. |

### 2.2 State Transitions

```
ACTIVE ──(admin withdraw)──► WITHDRAWN    (student leaves mid-term)
ACTIVE ──(auto)────────────► COMPLETED   (set automatically when Class → COMPLETED)
WITHDRAWN ──(reactivate)──► ACTIVE       (student returns, new Contract required)
```

**State machine rules (Rule 22):**
- **WITHDRAWN → ACTIVE (Reactivation)**: Allowed. Requires a new ACTIVE Contract. The existing record is UPDATEd (not INSERTed). See ADR-009.
- **COMPLETED is terminal**: No transitions out of COMPLETED.

### 2.3 Transition Rules

| From | To | Trigger | Guard | Side Effect |
|------|----|---------|-------|-------------|
| ACTIVE | WITHDRAWN | Admin action | `withdrawReason` required, non-empty | Student removed from class roster. Finance Domain may process refund. |
| ACTIVE | COMPLETED | System (auto) | Class status → COMPLETED | All ACTIVE Enrollments in that Class auto-transition to COMPLETED. |
| WITHDRAWN | ACTIVE | Admin action (Reactivation) | New ACTIVE Contract required (`contractCode` updated). `withdrawReason` cleared. | Student restored to class roster. New contractCode linked. Audit log entry: REACTIVATE. |

---

## 3. Enrollment Business Rules

### 3.1 Creation Rules (enroll)

| Rule | Description | Guard Enforcement |
|------|-------------|-------------------|
| **R1: Contract must exist** | The `contractCode` must reference a valid Contract. | `ContractRepository.findOneByCode()` must return a result. |
| **R2: Contract must be ACTIVE** | Enrollment is only allowed against ACTIVE Contracts. FROZEN, EXHAUSTED, EXPIRED, or REFUNDED Contracts are rejected. | `Contract.status === ContractStatus.ACTIVE` check. |
| **R3: No duplicate ACTIVE enrollment** | A student cannot be actively enrolled in the same class twice. | `EnrollmentRepository.findByClassAndStudent()` — if result exists with status=ACTIVE, reject. |
| **R4: Reactivation after withdrawal** | If a previous enrollment for the same student+class was WITHDRAWN, the existing record is reactivated (UPDATE back to ACTIVE). A new Contract must be provided. No new row is created. See ADR-009. | `EnrollmentRepository.findByClassAndStudent()` — if result exists with status=WITHDRAWN → UPDATE existing record (status=ACTIVE, contractCode=new, withdrawReason=null). |
| **R5: Student must exist** | The `studentCode` must reference a valid Student. | Validated at the API layer before calling service (Student Domain boundary). |
| **R6: Student must be ACTIVE** | INACTIVE or GRADUATED Students cannot be enrolled. | Validated at the API layer before calling service (Student Domain boundary). |
| **R7: Class must be ACTIVE** | Only ACTIVE Classes accept new enrollments. | Validated at the API layer (Class Domain boundary). |
| **R8: Capacity check** | Current ACTIVE enrollment count must not exceed Class `maxStudents`. | `EnrollmentRepository.countActiveByClassCode()` + comparison. Server-side computation (Rule 18). |

### 3.2 Withdrawal Rules

| Rule | Description |
|------|-------------|
| **W1: Only ACTIVE can withdraw** | WITHDRAWN or COMPLETED enrollments cannot be withdrawn again. |
| **W2: Reason required** | `withdrawReason` must be non-empty (trimmed). Empty or whitespace-only reasons are rejected. |
| **W3: No automatic financial handling** | Withdrawal only changes enrollment status. Financial implications (refund calculation) are handled by Finance Domain when it receives the appropriate event. |
| **W4: Withdrawal does not affect Contract** | The Contract remains ACTIVE. If lessons were already deducted, they stay deducted. |

### 3.3 Auto-Completion Rules

| Rule | Description |
|------|-------------|
| **A1: Trigger** | When Class transitions to COMPLETED, all ACTIVE Enrollments in that Class auto-transition to COMPLETED. |
| **A2: No guard** | Auto-completion requires no admin action. It is a system-side batch operation. |
| **A3: Batch operation** | All ACTIVE Enrollments are updated in a single database transaction. |

### 3.4 Cross-Domain Interaction Rules

| Rule | Description |
|------|-------------|
| **X1: Teaching Domain owns Enrollment** | No other Domain may create, modify, or delete Enrollment records (Rule 17). |
| **X2: Finance Domain reads Enrollment** | When processing LessonFinished events, Finance Domain reads Enrollment to find the Contract. This is a read-only cross-domain reference via the deduction path. |
| **X3: Student Domain boundary** | Enrollment does NOT modify Student status. If a Student becomes INACTIVE, existing ACTIVE Enrollments remain ACTIVE until manually withdrawn. |
| **X4: No direct Contract modification** | Enrollment never modifies `Contract.remainingLessons`. That is Finance Domain's responsibility. |

---

## 4. Deduction Path Role

Enrollment plays a critical role in the financial deduction chain. Here is the complete path with Enrollment's role highlighted:

```
1. Lesson (id=42) → FINISHED → ARCHIVED
2. LessonFinished event emitted
3. Finance Domain receives event
4. For each attendance record where status ∈ {PRESENT, LATE}:
   a. Read: Lesson.classCode + attendance.studentCode
   b. FIND: Enrollment WHERE classCode = lesson.classCode
           AND studentCode = attendance.studentCode
           AND status = 'ACTIVE'                    ◄── Enrollment's role
   c. READ: Enrollment.contractCode                  ◄── Enrollment's role
   d. FIND: Contract WHERE contractCode = enrollment.contractCode
   e. DEDUCT: Contract.remainingLessons -= 1
   f. If remainingLessons == 0 → Contract → EXHAUSTED
   g. LOG: {lessonId, contractCode, oldBalance, newBalance}
```

**Key point:** If no ACTIVE Enrollment exists for a student in a given class, the deduction is skipped for that student. This is a safety mechanism — unenrolled students are never charged.

---

## 5. Audit Requirements

### 5.1 enrollment_audit_log Table (Future)

| Field | Type | Notes |
|-------|------|-------|
| `id` | Number | PK |
| `classCode` | String | FK → Class.classCode |
| `studentCode` | String | FK → Student.studentCode |
| `action` | Enum | `ENROLL` / `WITHDRAW` / `REACTIVATE` / `AUTO_COMPLETE` |
| `contractCode` | String | FK → Contract.contractCode (snapshot at time of action) |
| `oldStatus` | Enum | Previous status |
| `newStatus` | Enum | New status |
| `reason` | Text | Withdraw reason (nullable for ENROLL and AUTO_COMPLETE) |
| `operatedBy` | Number | userId (system = 0 for AUTO_COMPLETE) |
| `operateTime` | DateTime | Auto-set |

### 5.2 Audit Events

| Event | Always Audited? | Includes Reason? |
|-------|----------------|-----------------|
| Student enrolled | ✅ | N/A (creation) |
| Student withdrawn | ✅ | ✅ (withdrawReason) |
| Student reactivated | ✅ | ✅ (oldContractCode, newContractCode) |
| Auto-complete (Class → COMPLETED) | ✅ | N/A (system) |

---

## 6. API Endpoints (Design)

### Enrollment Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/classes/:code/enrollments | JWT+Role | Enroll student in class (requires contractCode) |
| DELETE | /api/v1/classes/:code/enrollments/:studentCode | JWT+Role | Withdraw student (requires reason) |
| GET | /api/v1/classes/:code/enrollments | JWT+Role | List enrolled students for a class |
| GET | /api/v1/students/:studentCode/enrollments | JWT+Role | List all enrollments for a student |
| GET | /api/v1/students/:studentCode/classes | JWT+Role | List active classes for a student |

### Enrollment Request Body

```typescript
// POST /api/v1/classes/:code/enrollments
interface EnrollRequest {
  studentCode: string;     // Required
  contractCode: string;    // Required — links to Contract
}

// DELETE /api/v1/classes/:code/enrollments/:studentCode
interface WithdrawRequest {
  reason: string;          // Required — why the student is withdrawing
}
```

---

## 7. Permission Mapping

| Permission Code | Operations |
|---|---|
| `class:update` | Enroll student, withdraw student (enrollment is a class operation) |
| `class:read` | View enrolled students |
| `student:read` | View student's enrollments (cross-reference) |

---

## 8. State Machine Summary

```
                    ┌──────────┐
                    │  ACTIVE  │◄─────┐
                    └────┬─────┘      │
                         │            │ Reactivation
              ┌──────────┴───┐        │ (WITHDRAWN → ACTIVE)
              ▼              ▼        │
       ┌──────────┐   ┌──────────┐    │
       │WITHDRAWN │───┘          │    │
       └──────────┘   │COMPLETED │    │
                      └──────────┘    │

ACTIVE → WITHDRAWN:  Admin withdraws student (reason required)
ACTIVE → COMPLETED:  Auto when Class → COMPLETED (terminal)
WITHDRAWN → ACTIVE:  Reactivation — admin reactivates with new Contract (ADR-009)
COMPLETED: Terminal (no transitions)
```

**Quick reference:**

| Transition | Reversible? | Guard |
|------------|-------------|-------|
| ACTIVE → WITHDRAWN | Via Reactivation | Reason required, non-empty |
| ACTIVE → COMPLETED | No (auto) | Class status = COMPLETED |
| WITHDRAWN → ACTIVE | **Yes (Reactivation)** | New ACTIVE Contract required. See ADR-009. |
| COMPLETED → anything | **Not allowed** | Terminal state |

---

## 9. Domain Invariants

Domain Invariants are **unconditional business rules** that must hold at all times, in all states, under all operations. They are enforced at the domain layer, not the API layer. Violation of a Domain Invariant is a system-level bug.

### Invariant-001: ACTIVE Enrollment Requires ACTIVE Contract

```
IF Enrollment.status = ACTIVE
THEN Enrollment.contractCode MUST reference a Contract
     WHERE Contract.status = ACTIVE
```

**Owner**: Teaching Domain (enforcement at enrollment creation and reactivation).
**Rationale**: An ACTIVE Enrollment funds lessons from a Contract. If the Contract is not ACTIVE (FROZEN, EXHAUSTED, EXPIRED, REFUNDED), deductions would fail or produce incorrect results. The deduction path (`Lesson → Enrollment → Contract`) requires an ACTIVE Contract at the other end.
**Enforcement**: Checked at `enroll()` and `reactivate()` time. If a Contract becomes non-ACTIVE after enrollment, the Finance Domain handles the implications (not the Teaching Domain).

### Invariant-002: One ACTIVE Enrollment Per Student Per Class

```
COUNT(Enrollment WHERE classCode = X AND studentCode = Y AND status = ACTIVE) ≤ 1
```

**Owner**: Teaching Domain.
**Rationale**: A student can only be in one enrollment state per class at any time. Two ACTIVE enrollments for the same student-class pair would cause double-counting in the deduction path and capacity calculations. The UNIQUE constraint on `(classCode, studentCode)` enforces this at the database level (one row total), and the status field ensures at most one is ACTIVE.
**Enforcement**: Database UNIQUE constraint + service-level check before INSERT/UPDATE.

### Invariant-003: Contract.remainingLessons Non-Negative

```
Contract.remainingLessons ≥ 0
```

**Owner**: Finance Domain.
**Rationale**: A negative balance would mean the institution owes the student lessons, which is not a valid business state. This invariant is the responsibility of the Finance Domain, which performs all deductions. The Teaching Domain never modifies `remainingLessons`.
**Enforcement**: Finance Domain enforces this during deduction. Teaching Domain respects this by never directly modifying `remainingLessons`.

### Invariant-004: Class COMPLETED Implies Enrollment COMPLETED

```
IF Class.status = COMPLETED
THEN ALL Enrollment WHERE classCode = Class.classCode AND status = ACTIVE
     MUST transition to COMPLETED
```

**Owner**: Teaching Domain.
**Rationale**: When a Class completes, there are no more lessons. ACTIVE enrollments in a completed class are meaningless and would pollute queries like "How many active enrollments does this student have?" Auto-completion ensures data consistency.
**Enforcement**: Batch operation triggered by Class → COMPLETED transition. All ACTIVE Enrollments in that Class are UPDATEd to COMPLETED in a single transaction.

### Invariant-005: Enrollment Cannot Be Deleted

```
DELETE FROM enrollment WHERE ... — PROHIBITED
```

**Owner**: Teaching Domain.
**Rationale**: Enrollment records are part of the financial chain. Deleting an enrollment would break the deduction path for any lesson that was taught while the student was enrolled. Historical financial records reference `(classCode, studentCode)` to trace which Contract funded a lesson. Deleting the enrollment breaks this traceability. The only allowed operations are status transitions (ACTIVE → WITHDRAWN, ACTIVE → COMPLETED, WITHDRAWN → ACTIVE).
**Enforcement**: No DELETE endpoint exists. No soft-delete flag on the Enrollment entity. Database-level: no `deleted` column.

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Enrollment code. See also: [TeachingRules.md](./TeachingRules.md), [ContractRules.md](./ContractRules.md), [ClassRules.md](./ClassRules.md), [LessonRules.md](./LessonRules.md), [ADR-009-Enrollment-Reactivation.md](../DecisionLog/ADR-009-Enrollment-Reactivation.md).*
