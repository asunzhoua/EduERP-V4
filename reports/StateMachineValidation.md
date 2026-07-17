# StateMachineValidation

> **Generated**: 2026-07-15T08:38:00.007Z

## Summary

| Severity | Count |
|----------|------:|
| PASS     | 2 |
| FAIL     | 0 |
| WARNING  | 1 |

**Result: PASS (with warnings)**

---

## Details

### ✅ WP3.1: Each code state machine has matching Catalog section

- **Severity**: PASS
- **Details**: All 6 code machines have catalog entries

### ⚠️ WP3.2-3.6: Transition cross-reference (catalog vs code)

- **Severity**: WARNING
- **Details**: contract.service.ts: catalog transition ACTIVE -> EXHAUSTED missing in code; contract.service.ts: catalog transition ACTIVE -> EXPIRED missing in code; contract.service.ts: catalog terminal state EXHAUSTED has code transitions; contract.service.ts: catalog terminal state EXPIRED has code transitions; lesson.service.ts: catalog terminal state DRAFT has code transitions; lesson.service.ts: catalog terminal state SCHEDULED has code transitions; lesson.service.ts: catalog terminal state TEACHING has code transitions; lesson.service.ts: catalog terminal state CANCELLED has code transitions; lesson-attendance.service.ts: code transition CHECKED_IN -> // reverse (admin override) not in catalog; lesson-attendance.service.ts: code transition CONFIRMED -> // reverse (admin override) not in catalog

### ✅ WP3.7: Mermaid stateDiagram-v2 generated for each machine

- **Severity**: PASS
- **Details**: Generated 6 diagrams
