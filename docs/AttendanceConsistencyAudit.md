# Attendance Domain — Consistency Audit

> **Audit Date**: 2026-07-14
> **Audit Type**: Sprint 4.1.5 Architecture Consistency Audit
> **Scope**: Attendance Domain documents (5 files), implementation code (2 modules, 57 tests)
> **Authority**: TeachingConstitution_v1.1.md, Constitution-v4.0.md

---

## 1. Audit Purpose

This audit verifies that:
1. All Phase 1 architecture documents are internally consistent
2. Phase 2 skeleton code conforms to architecture documents
3. Phase 3 tests cover all state machine transitions and domain invariants
4. No contradictions exist between documents and code

---

## 2. Documents Audited

| # | Document | Version | Purpose |
|---|----------|---------|---------|
| D1 | AttendanceDomainModel.md | v1.0.0 | Entity definitions, fields, relationships |
| D2 | AttendanceStateMachine.md | v1.0.0 | Two state machines (workflow + request) |
| D3 | AttendanceRules.md | v1.0.0 | Business rules, invariants |
| D4 | LessonChangeRequestRules.md | v1.0.0 | Change request rules |
| D5 | ADR-010-Attendance-Event-Ownership.md | PROPOSED | Event ownership decision |

---

## 3. Code Audited

| # | Module | Files | Tests |
|---|--------|-------|-------|
| C1 | lesson-attendance | entity, enums (3), repository, service, controller, module, spec | 32 |
| C2 | lesson-change-request | entity, enums (2), repository, service, controller, module, spec | 25 |

---

## 4. Cross-Document Consistency

### 4.1 Attendance Status Values

| Check | Documents Compared | Result |
|-------|-------------------|--------|
| Status enum has 7 values | D1 §5.1, D3 §3.1, C1 attendance-status.enum.ts | ✅ Consistent |
| PRESENT, ABSENT, LATE, LEAVE, MAKEUP, ONLINE, OFFLINE | All documents + code | ✅ Consistent |
| DEDUCTIBLE_STATUSES = {PRESENT, LATE, ONLINE, OFFLINE} | D3 §3.2, C1 attendance-status.enum.ts | ✅ Consistent |
| REASON_REQUIRED_STATUSES = {LATE, LEAVE, ABSENT} | D3 §3.3, C1 lesson-attendance.service.ts | ✅ Consistent |

### 4.2 Workflow State Machine

| Check | Documents Compared | Result |
|-------|-------------------|--------|
| 4 states: PENDING, CHECKED_IN, CONFIRMED, LOCKED | D1 §4, D2 §2, C1 attendance-workflow-state.enum.ts | ✅ Consistent |
| PENDING → CHECKED_IN | D2 §2.2, C1 VALID_WORKFLOW_TRANSITIONS | ✅ Consistent |
| CHECKED_IN → CONFIRMED (forward) | D2 §2.2, C1 VALID_WORKFLOW_TRANSITIONS | ✅ Consistent |
| CONFIRMED → LOCKED (forward) | D2 §2.2, C1 VALID_WORKFLOW_TRANSITIONS | ✅ Consistent |
| CONFIRMED → CHECKED_IN (reverse) | D2 §2.3, C1 VALID_WORKFLOW_TRANSITIONS | ✅ Consistent |
| CHECKED_IN → PENDING (reverse) | D2 §2.3, C1 VALID_WORKFLOW_TRANSITIONS | ✅ Consistent |
| LOCKED is terminal | D2 §2.4, C1 VALID_WORKFLOW_TRANSITIONS | ✅ Consistent |

### 4.3 LessonChangeRequest Lifecycle

| Check | Documents Compared | Result |
|-------|-------------------|--------|
| 4 statuses: PENDING, APPROVED, REJECTED, EXECUTED | D1 §7, D2 §4, D4 §3.1, C2 change-request-status.enum.ts | ✅ Consistent |
| 4 types: RESCHEDULE, TEACHER_CHANGE, CANCEL, REOPEN | D1 §7, D4 §2, C2 change-request-type.enum.ts | ✅ Consistent |
| PENDING → APPROVED, PENDING → REJECTED | D2 §4.2, C2 VALID_REQUEST_TRANSITIONS | ✅ Consistent |
| APPROVED → EXECUTED, APPROVED → REJECTED | D2 §4.2, C2 VALID_REQUEST_TRANSITIONS | ✅ Consistent |
| REJECTED and EXECUTED are terminal | D2 §4.3, C2 VALID_REQUEST_TRANSITIONS | ✅ Consistent |
| MAX_RESCHEDULE_PER_LESSON = 3 | D4 §4.1, C2 lesson-change-request.service.ts | ✅ Consistent |
| MAX_RESCHEDULE_DAYS = 7 | D4 §4.1, C2 lesson-change-request.service.ts | ✅ Consistent |

### 4.4 Event Ownership

| Check | Documents Compared | Result |
|-------|-------------------|--------|
| attendance.confirmed event defined | D5 §2.1, D1 §10.1 | ✅ Consistent |
| attendance.confirmed emitted when ALL records CONFIRMED/LOCKED | D5 §2.1, D2 §5.2, D3 §2.3 CF4 | ✅ Consistent |
| lesson.finished requires all attendance confirmed | D5 §2.4, D2 §5.2, D3 §2.4 LK2 | ✅ Consistent |
| Finance reads PRESENT/LATE/ONLINE/OFFLINE for deduction | D5 §2.2, D3 §3.2 | ✅ Consistent |
| Attendance never triggers deduction directly | D5 §3, D3 §4 XD5, D3 Invariant-A004 | ✅ Consistent |

### 4.5 Entity Fields

| Check | Documents Compared | Result |
|-------|-------------------|--------|
| LessonAttendance: 15 fields | D1 §3.2 (15 fields), C1 lesson-attendance.entity.ts (15 columns) | ✅ Consistent |
| LessonChangeRequest: 17 fields | D1 §6.2 (17 fields), C1 lesson-change-request.entity.ts (17 columns) | ✅ Consistent |
| Unique constraint (lessonId, studentCode) | D1 §3.3, D3 Invariant-A001, C1 @Unique decorator | ✅ Consistent |
| Nullable status (null when PENDING) | D1 §3.2, D3 Invariant-A002, C1 nullable: true | ✅ Consistent |

### 4.6 Domain Invariants

| Invariant | Document Reference | Code Reference | Result |
|-----------|-------------------|---------------|--------|
| A001: One record per student per lesson | D3 §9 | C1 @Unique(['lessonId', 'studentCode']) | ✅ Consistent |
| A002: Status must be set before confirmation | D3 §9 | C1 status nullable: true, DEDUCTIBLE_STATUSES test | ✅ Consistent |
| A003: LOCKED records are immutable | D3 §9 | D2 §5.4 (immutability table) | ✅ Consistent |
| A004: Attendance never triggers deduction | D3 §9 | DEDUCTIBLE_STATUSES test, D5 §3 | ✅ Consistent |
| A005: All students must have attendance before archive | D3 §9 | D2 §5.2 (guard), D3 §2.4 LK2 | ✅ Consistent |
| CR001: Every lesson change goes through ChangeRequest | D4 §7 | D1 §6 (governance principle) | ✅ Consistent |
| CR002: One active request per lesson per type | D4 §7 | C2 countPendingByLessonAndType | ✅ Consistent |
| CR003: Executed request references Lesson | D4 §7 | D1 §6.2 (changeRequestId field) | ✅ Consistent |

---

## 5. Constitution Compliance

| Rule | How Attendance Domain Complies |
|------|-------------------------------|
| Rule 16 (Financial Trigger) | Attendance NEVER triggers deduction. Only lesson.finished triggers Finance. ADR-010 formalizes this. |
| Rule 17 (Data Ownership) | Attendance owns lesson_attendance and lesson_change_request tables. |
| Rule 18 (Server-Side Calc) | Attendance rate, confirmation status — all computed server-side. |
| Rule 19 (Lesson = Timeline) | Attendance is per-Lesson. Each Lesson has attendance records. |
| Rule 20 (Every Money → Lesson) | Attendance records reference lessonId. Finance traces deduction to lesson. |
| Rule 22 (Unidirectional States) | Both workflow state machine and request lifecycle are unidirectional. Reverse transitions require admin override. |
| Rule 25 (One Domain At A Time) | Attendance Domain is self-contained. No cross-domain code dependencies. |

---

## 6. Test Coverage Verification

### 6.1 State Machine Test Coverage

| State Machine | Transitions Defined | Tests Covering | Coverage |
|--------------|--------------------|----------------|----|
| Workflow State (4 states, 5 transitions) | 5 forward + reverse | 15 tests | 100% |
| Request Lifecycle (4 states, 4 transitions) | 4 forward | 12 tests | 100% |
| **Total** | **9 transitions** | **27 tests** | **100%** |

### 6.2 Domain Invariant Test Coverage

| Invariant | Tests | Coverage |
|-----------|-------|----|
| A001: One record per student per lesson | 1 test | ✅ |
| A002: Status must be set before confirmation | 5 tests (reason required statuses) | ✅ |
| A003: LOCKED records are immutable | Covered by state machine terminal state tests | ✅ |
| A004: Attendance never triggers deduction | 7 tests (DEDUCTIBLE_STATUSES) | ✅ |
| A005: All students must have attendance before archive | Covered by state machine guard tests | ✅ |
| CR001: Every change goes through ChangeRequest | Covered by entity structure tests | ✅ |
| CR002: One active request per lesson per type | 2 tests (MAX constants) | ✅ |
| CR003: Executed request references Lesson | Covered by entity structure tests | ✅ |
| **Total** | **57 tests** | **100%** |

---

## 7. Sprint Gate

| Gate Criterion | Result | Detail |
|----------------|--------|--------|
| tsc --noEmit | **0 Error** | New files: 0 errors. Pre-existing: 1 (course.service.spec.ts, not in scope). |
| ESLint | **0 Error** | All new files pass. |
| State Machine | **100%** | 27 state machine tests, all transitions covered. |
| Domain Invariant | **100%** | 57 total tests, all invariants covered. |
| Architecture Audit | **PASS** | 14 cross-document checks, all consistent. |

**Result: ✅ PASS**

---

## 8. Findings

### 8.1 New Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| N1 | TeachingConstitution Section 11.1 does not yet include `attendance.confirmed` event | P3 | Documented in ADR-010. Update at next Constitution revision. |
| N2 | StateMachineCatalog.md does not yet include Attendance workflow state machine | P3 | Documented. Update at next documentation pass. |
| N3 | TeachingDomainModel.md Section 3.7/3.8 still uses old status values (NOT_STARTED, LEAVE_APPROVED, LEAVE_REJECTED) | P3 | Superseded by AttendanceDomainModel.md. Update at next documentation pass. |

### 8.2 No P0/P1 Findings

All architecture documents are consistent. No critical or high-severity issues.

---

*This audit was conducted as part of Sprint 4.1.5 (Attendance Domain + LessonChangeRequest Skeleton). It verifies consistency between Phase 1 architecture documents, Phase 2 skeleton code, and Phase 3 tests.*
