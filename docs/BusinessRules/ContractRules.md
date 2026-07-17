# Contract — Business Rules

> **Domain**: Teaching > Contract
> **Sprint**: 4
> **Version**: v0.1.0 (Design Freeze v1.1)
> **Last Updated**: 2026-07-07

---

## 1. Core Entity: Contract

### 1.1 Description

A Contract (课时合同 / 课程包) represents a purchased lesson package. When a parent pays for lessons, they buy a Contract — not a Class enrollment. The Contract is the **financial unit** of the system: all lesson deductions, salary calculations, and balance tracking operate against the Contract.

This is a critical distinction:

| Old Model (v1.0) | New Model (v1.1) |
|---|---|
| Student → Enrollment → Class | Student → **Contract** → Enrollment → Class |
| Lessons deducted from Enrollment | **Lessons deducted from Contract** |
| No package tracking | Full package lifecycle |
| Price on Course | **Price on Contract** |

### 1.2 Why Contract?

In real-world training operations:

- A parent buys **"20 math lessons"** — that's a Contract
- The student is assigned to **"Saturday 10am class"** — that's an Enrollment
- If the student changes classes, the Contract stays — only the Enrollment changes
- If the student uses 15 of 20 lessons, the remaining 5 are visible on the Contract

Without Contracts, the system cannot answer: *"How many lessons does this student have left?"*

### 1.3 Required Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `contractCode` | String | ✅ | Auto-generated, immutable (`CTYYYYMMNNNN`) |
| `studentCode` | String | ✅ | FK → Student.studentCode |
| `subject` | Enum | ✅ | Subject category (same enum as Course.subject) |
| `totalLessons` | Number | ✅ | Total lessons purchased |
| `remainingLessons` | Number | ✅ | Current balance (starts = totalLessons) |
| `status` | Enum | ✅ | See Section 2 |
| `validFrom` | Date | ✅ | Contract validity start |
| `validTo` | Date | ❌ | Contract validity end (null = perpetual) |
| `unitPrice` | Decimal | ❌ | Price per lesson (reference only) |
| `totalAmount` | Decimal | ❌ | Total paid amount (reference only, authoritative record in Finance domain) |
| `note` | Text | ❌ | Free-text remarks |
| `tags` | JSON/String[] | ❌ | Contract tags |

### 1.4 contractCode Format

```
Format: CTYYYYMMNNNN
- CT: prefix (Contract)
- YYYY: creation year
- MM: creation month (01–12)
- NNNN: sequential number (zero-padded, 4 digits)
```

Example: `CT2026070001` — first contract created in July 2026

---

## 2. Contract Status Lifecycle

### 2.1 Status Definitions

```typescript
enum ContractStatus {
  ACTIVE    = 'ACTIVE',     // Has remaining lessons, within validity
  EXHAUSTED = 'EXHAUSTED',  // All lessons consumed
  EXPIRED   = 'EXPIRED',    // Past validity period with lessons remaining
  REFUNDED  = 'REFUNDED',   // Refunded (partial or full)
  FROZEN    = 'FROZEN',     // Temporarily frozen (admin hold)
}
```

### 2.2 State Transitions

```
                    ┌──────────────┐
                    │   ACTIVE     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │EXHAUSTED │ │ EXPIRED  │ │  FROZEN  │
        └──────────┘ └──────────┘ └────┬─────┘
                                        │ unfreeze
                                        ▼
                                  ┌──────────┐
                                  │  ACTIVE  │
                                  └──────────┘

ACTIVE ─────► REFUNDED (at any point, with reason)
FROZEN ─────► REFUNDED
```

### 2.3 Transition Triggers

| Transition | Trigger | Side Effects |
|---|---|---|
| ACTIVE → EXHAUSTED | `remainingLessons` reaches 0 | Auto-transition on last lesson deduction |
| ACTIVE → EXPIRED | `validTo` date passed | Auto-cron job (future Sprint) |
| ACTIVE → FROZEN | Admin action | Prevents further deductions |
| FROZEN → ACTIVE | Admin action | Resumes normal operation |
| Any → REFUNDED | Finance domain action | Requires refund record in Finance domain |

---

## 3. Lesson Deduction Rules

### 3.1 Deduction Flow

This is the core financial operation of EduOS:

```
LessonFinished event emitted
        │
        ▼
Finance Domain listener receives event
        │
        ▼
For each attendance record with status = PRESENT or LATE:
        │
        ▼
Find Contract linked to (studentCode, classCode) via Enrollment
        │
        ▼
Deduct 1 lesson from Contract.remainingLessons
        │
        ▼
If remainingLessons == 0 → Contract status → EXHAUSTED
        │
        ▼
Log deduction in contract_audit_log (lessonId, oldBalance, newBalance)
```

### 3.2 Deduction Rules

- Exactly **1 lesson per PRESENT/LATE attendance** record
- ABSENT, LEAVE_APPROVED, LEAVE_REJECTED students: **no deduction**
- MAKEUP attendance: deduction against the **makeup student's** Contract
- Deduction is performed by the **Finance domain**, not the Teaching domain (Rule 17)
- Deduction is **irreversible** — corrections require a separate adjustment (课时修正单, future)

### 3.3 Negative Balance Protection

- `remainingLessons` MUST NOT go below 0
- If a deduction would bring `remainingLessons` to negative, the operation is rejected
- Admin can override with a special approval + reason (logged to audit)

---

## 4. Contract-Enrollment Relationship

### 4.1 How It Works

```
Contract #CT2026070001 (20 lessons)
        │
        └──► Enrollment #1: Student A → Class "周六10点班" ← contractCode: CT2026070001
        └──► Enrollment #2: Student A → Class "周二集训班" ← contractCode: CT2026070001
```

**Key rules:**
- One Contract can fund **multiple Enrollments** (e.g., two concurrent classes)
- One Enrollment references exactly **one Contract**
- When a Lesson is completed, deduction finds the Contract via:
  `Lesson.classCode → Enrollment.classCode → Enrollment.contractCode → Contract`
- If a student is in multiple classes under the same Contract, lessons from either class deduct from the same pool

### 4.2 Enrollment Update

```typescript
interface Enrollment {
  classCode: string;
  studentCode: string;
  contractCode: string;       // NEW: links to Contract
  enrolledAt: Date;
  enrolledBy: number;
  status: 'ACTIVE' | 'WITHDRAWN' | 'COMPLETED';
}
```

The Enrollment now carries a `contractCode` field. This is the bridge between "who is in which class" and "which lesson package pays for it."

---

## 5. Contract Modification Rules

### 5.1 Allowed Modifications

| Operation | Rules |
|-----------|-------|
| Add lessons to Contract | Create adjustment record. Reason required. Only for ACTIVE contracts. |
| Refund Contract | Status → REFUNDED. Requires Finance domain record. |
| Freeze Contract | Status → FROZEN. Reason required. No deductions while frozen. |
| Extend validity | Update `validTo`. Reason required. |
| Change subject | Not allowed. Create new Contract instead. |

### 5.2 Prohibited Operations

- ❌ Directly modifying `remainingLessons` (must go through deduction or adjustment)
- ❌ Deleting a Contract (soft delete only, and only if no lessons ever used)
- ❌ Changing `totalLessons` after creation (correction requires void + recreate)

---

## 6. API Endpoints (Design)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/contracts | JWT+Role | Create contract |
| GET | /api/v1/contracts | JWT+Role | List contracts (paginated, filterable by studentCode/status/subject) |
| GET | /api/v1/contracts/:code | JWT+Role | Get contract by contractCode |
| PATCH | /api/v1/contracts/:code/freeze | JWT+Role | Freeze contract |
| PATCH | /api/v1/contracts/:code/unfreeze | JWT+Role | Unfreeze contract |
| GET | /api/v1/students/:studentCode/contracts | JWT+Role | Get student's contracts with remaining balances |

---

## 7. Audit Requirements

### 7.1 contract_audit_log Table

| Field | Type | Notes |
|-------|------|-------|
| `id` | Number | PK |
| `contractCode` | String | FK → Contract.contractCode |
| `action` | Enum | `CREATE` / `DEDUCTION` / `ADJUSTMENT` / `FREEZE` / `UNFREEZE` / `REFUND` |
| `lessonId` | Number | FK → Lesson.id (nullable, for DEDUCTION actions) |
| `fieldName` | String | Changed field |
| `oldValue` | Text | Previous value (e.g., old remainingLessons) |
| `newValue` | Text | New value (e.g., new remainingLessons) |
| `reason` | Text | **Why** this change happened (required for all modification actions) |
| `operatedBy` | Number | User ID |
| `operateTime` | DateTime | Auto-set |

### 7.2 Cross-Domain Audit

When Finance domain deducts from Contract:
- **Contract domain** logs: DEDUCTION, lessonId, oldRemaining → newRemaining
- **Finance domain** logs: the financial transaction
- These two records are linked by `lessonId` — enabling full traceability (Rule 20)

---

## 8. Permission Mapping

| Permission Code | Operations |
|---|---|
| `contract:read` | View contracts and balances |
| `contract:create` | Create contracts |
| `contract:update` | Freeze/unfreeze, modify contracts |

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Contract code. See also: [TeachingRules.md](./TeachingRules.md), [LessonRules.md](./LessonRules.md), [ClassRules.md](./ClassRules.md).*
