# GovernanceDashboard

> **Generated**: 2026-07-15T08:37:59.576Z

## Summary

| Severity | Count |
|----------|------:|
| PASS     | 22 |
| FAIL     | 0 |
| WARNING  | 3 |

**Result: PASS (with warnings)**

---

## Details

### ✅ FreezeAudit/WP1.1: [FreezeAudit] All EventCatalog events have EventSchema entries

- **Severity**: PASS
- **Details**: All 24 events have schema entries

### ✅ FreezeAudit/WP1.2: [FreezeAudit] Owner/domain matches between Catalog and Schema

- **Severity**: PASS
- **Details**: All owners match

### ✅ FreezeAudit/WP1.3: [FreezeAudit] StateMachineCatalog contains exactly 9 state machines

- **Severity**: PASS
- **Details**: Found 9 state machines

### ✅ FreezeAudit/WP1.4: [FreezeAudit] All governance documents have version headers

- **Severity**: PASS
- **Details**: All 4 documents have version headers

### ✅ FreezeAudit/WP1.5: [FreezeAudit] ArchitectureHandbook cross-references resolve to existing files

- **Severity**: PASS
- **Details**: All 22 references resolve

### ✅ FreezeAudit/WP1.6: [FreezeAudit] ADR/DEC files have required metadata (Status, Date)

- **Severity**: PASS
- **Details**: All 5 ADR files have required metadata

### ✅ FreezeAudit/WP1.7: [FreezeAudit] CURRENT events have corresponding event classes in code

- **Severity**: PASS
- **Details**: All 2 CURRENT events have code classes

### ✅ FreezeAudit/WP1.8: [FreezeAudit] All event names follow lowercase dot notation convention

- **Severity**: PASS
- **Details**: All 24 event names are valid

### ✅ EventValidation/WP2.1: [EventValidation] Every EventCatalog event has EventSchema entry

- **Severity**: PASS
- **Details**: All 24 catalog events have schema entries

### ✅ EventValidation/WP2.2: [EventValidation] CURRENT/DESIGNED events have event class in code

- **Severity**: PASS
- **Details**: All 11 CURRENT/DESIGNED events have code classes

### ⚠️ EventValidation/WP2.3: [EventValidation] Event class fields match Schema payload fields

- **Severity**: WARNING
- **Details**: lesson.completed: in schema but not class: attendance; lesson.finished: in schema but not class: attendance

### ✅ EventValidation/WP2.4: [EventValidation] Every publish() call has event registered in EventCatalog

- **Severity**: PASS
- **Details**: All 2 publish() calls are registered

### ✅ EventValidation/WP2.5: [EventValidation] Publish payload fields match Schema defined fields

- **Severity**: PASS
- **Details**: All 2 publish payloads match schemas

### ✅ EventValidation/WP2.6: [EventValidation] No orphan event classes (code classes not in Catalog)

- **Severity**: PASS
- **Details**: All 11 event classes are cataloged

### ✅ EventValidation/WP2.7: [EventValidation] CURRENT status accuracy (only events with publish() calls)

- **Severity**: PASS
- **Details**: All 2 CURRENT events have publish() calls

### ✅ StateMachineValidation/WP3.1: [StateMachineValidation] Each code state machine has matching Catalog section

- **Severity**: PASS
- **Details**: All 6 code machines have catalog entries

### ⚠️ StateMachineValidation/WP3.2-3.6: [StateMachineValidation] Transition cross-reference (catalog vs code)

- **Severity**: WARNING
- **Details**: contract.service.ts: catalog transition ACTIVE -> EXHAUSTED missing in code; contract.service.ts: catalog transition ACTIVE -> EXPIRED missing in code; contract.service.ts: catalog terminal state EXHAUSTED has code transitions; contract.service.ts: catalog terminal state EXPIRED has code transitions; lesson.service.ts: catalog terminal state DRAFT has code transitions; lesson.service.ts: catalog terminal state SCHEDULED has code transitions; lesson.service.ts: catalog terminal state TEACHING has code transitions; lesson.service.ts: catalog terminal state CANCELLED has code transitions; lesson-attendance.service.ts: code transition CHECKED_IN -> // reverse (admin override) not in catalog; lesson-attendance.service.ts: code transition CONFIRMED -> // reverse (admin override) not in catalog

### ✅ StateMachineValidation/WP3.7: [StateMachineValidation] Mermaid stateDiagram-v2 generated for each machine

- **Severity**: PASS
- **Details**: Generated 6 diagrams

### ✅ HandbookValidation/WP4.1: [HandbookValidation] All Handbook cross-references resolve to existing files

- **Severity**: PASS
- **Details**: All 22 references resolve

### ✅ HandbookValidation/WP4.2: [HandbookValidation] Appendix A listed documents exist on disk

- **Severity**: PASS
- **Details**: All 33 Appendix A documents exist

### ⚠️ HandbookValidation/WP4.3: [HandbookValidation] Referenced documents have version headers

- **Severity**: WARNING
- **Details**: Missing version header: ../00-Constitution/Constitution-v4.0.md, ../02-SAD/SAD-v4.0.md, ../05-EventBus/EventBusSpecification.md, ../DecisionLog/ADR-010-Attendance-Event-Ownership.md, ../04-API/API-Specification.md, ../03-Database/ER.md, ../03-Database/TableDictionary.md, ../10-Deploy/DeployGuide.md, ../06-Permission/PermissionDesign.md, ../09-Test/TestPlan.md

### ✅ HandbookValidation/WP4.4: [HandbookValidation] Unreferenced docs in docs/ (informational)

- **Severity**: PASS
- **Details**: 73 docs not referenced by Handbook (105 total)

### ✅ ADRIndex/WP5.1: [ADRIndex] All ADR/DEC files have required metadata (Status, Date)

- **Severity**: PASS
- **Details**: All 5 files have required metadata

### ✅ ADRIndex/WP5.2: [ADRIndex] No duplicate ADR/DEC IDs

- **Severity**: PASS
- **Details**: All 5 IDs are unique

### ✅ ADRIndex/WP5.3: [ADRIndex] Status value is valid (PROPOSED, ACCEPTED, DEPRECATED, SUPERSEDED)

- **Severity**: PASS
- **Details**: All 5 statuses are valid
