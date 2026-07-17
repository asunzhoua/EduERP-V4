# Governance Consistency Report

> Sprint 4.4 — Phase 3: Governance Consistency
> Generated: 2026-07-15

---

## Summary

Governance validation re-executed after Phase 1 enum consolidation.

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total checks | 25 | 25 | 0 |
| PASS | 20 | 20 | 0 |
| FAIL | 1 | 1 | 0 |
| WARN | 4 | 4 | 0 |

**结论**: Phase 1 枚举合并不影响治理验证结果。所有 FAIL/WARN 均为预存问题。

---

## Pre-Existing Findings (Not Caused by Phase 1)

### FAIL: ADR Status Standards (WP5.3)

| File | Status Found | Expected |
|------|-------------|----------|
| ADR-009 | "DECIDED (CTO Formal Ruling)" | PROPOSED/ACCEPTED/DEPRECATED/SUPERSEDED |
| DEC-005 | "APPROVED" | PROPOSED/ACCEPTED/DEPRECATED/SUPERSEDED |

**Action**: Record for CTO decision. These are documentation metadata issues, not code issues.

### WARN: DESIGNED Events Without Code Classes (WP2.2)

5 events catalogued as DESIGNED but have no event class:
- attendance.confirmed
- contract.exhausted
- contract.expired
- contract.refunded
- student.deactivated

**Action**: Record for Sprint 5.x when these domains are built.

### WARN: Schema vs Event Class Field Mismatch (WP2.3)

lesson.completed and lesson.finished: Schema defines `attendance` field not present in event class.

**Action**: Record for Sprint 4.5 event utilisation work.

### WARN: State Machine Catalog vs Code Divergence (WP3.2-3.6)

Multiple transition differences between catalog and code:
- Contract: catalog has ACTIVE→EXHAUSTED, ACTIVE→EXPIRED; code has REFUNDED transitions not in catalog
- Lesson: code has DRAFT→CANCELLED not in catalog
- Lesson-attendance: code has reverse transitions (admin override) not in catalog

**Action**: Update StateMachineCatalog to match code (or update code to match catalog). Record for CTO decision.

### WARN: Missing Version Headers (WP4.3)

10 documents referenced in ArchitectureHandbook lack version headers.

**Action**: Add version headers. Low priority.

---

## Governance Automation Health

| Script | Tests | Status |
|--------|-------|--------|
| freeze-audit.ts | 10 | All passing |
| validate-events.ts | 8 | All passing |
| validate-state-machine.ts | 4 | All passing |
| build-handbook.ts | 5 | All passing |
| build-adr-index.ts | 4 | All passing |
| governance-dashboard.ts | 4 | All passing |
| **Total** | **74** | **All passing** |
