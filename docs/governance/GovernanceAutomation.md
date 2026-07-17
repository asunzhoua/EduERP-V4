# Governance Automation

> **Version**: v1.0.0
> **Last Updated**: 2026-07-14
> **Sprint**: 4.2 (Governance Automation)
> **Purpose**: Documents the automated governance validation system that replaces manual freeze audits and cross-reference checks.

---

## Overview

Governance Automation converts the manual Sprint4.x-FreezeAudit process into automated CLI scripts. Each script validates consistency between governance documents and code, producing JSON and Markdown reports.

**Principle**: Minimum Viable Governance Automation. CLI scripts first, unified command second, CI third, reports fourth.

**No new business code. No new domains. No new events.**

---

## Architecture

```
scripts/governance/
  shared/
    paths.ts              Centralised project path constants
    report.ts             CheckResult types + JSON/MD writers
    markdown-parser.ts    Parse EventCatalog, EventSchema, SM Catalog, Handbook, ADRs
    code-parser.ts        Parse VALID_TRANSITIONS, enums, event classes, publish() calls
  freeze-audit.ts         WP1 (P0) — Document consistency audit
  validate-events.ts      WP2 (P0) — Three-way event cross-reference
  validate-state-machine.ts  WP3 (P1) — State machine validation + Mermaid generation
  build-handbook.ts       WP4 (P1) — Handbook cross-reference verification
  build-adr-index.ts      WP5 (P2) — ADR metadata extraction and validation
  governance-dashboard.ts WP6 (P2) — Unified runner, aggregates all validators
```

---

## npm Scripts

Run from `backend/` directory:

| Command | Description |
|---------|-------------|
| `npm run governance:check` | Run all validators, produce unified report |
| `npm run governance:freeze-audit` | Run freeze audit only |
| `npm run governance:validate-events` | Run event validation only |
| `npm run governance:validate-state-machine` | Run state machine validation only |
| `npm run governance:build-handbook` | Run handbook validation only |
| `npm run governance:build-adr-index` | Run ADR index builder only |
| `npm run governance:test` | Run governance test suite |

---

## Validators

### WP1: Freeze Audit (`freeze-audit.ts`)

Automates the manual `Sprint4.x-FreezeAudit.md` process.

| Check | Description |
|-------|-------------|
| WP1.1 | EventCatalog events exist in EventSchema |
| WP1.2 | Owner/domain matches between Catalog and Schema |
| WP1.3 | State machines in catalog have correct count (9) |
| WP1.4 | Document version headers present |
| WP1.5 | ArchitectureHandbook cross-references resolve |
| WP1.6 | ADR files have required metadata |
| WP1.7 | CURRENT events have code classes |
| WP1.8 | Event naming convention valid |

### WP2: Event Validation (`validate-events.ts`)

Three-way cross-reference: EventCatalog to EventSchema to Code. Addresses GF-001, GF-003, GF-006.

| Check | Description |
|-------|-------------|
| WP2.1 | Every EventCatalog event has EventSchema entry |
| WP2.2 | CURRENT/DESIGNED events have event class in code |
| WP2.3 | Event class fields match Schema payload fields |
| WP2.4 | Every publish() call registers event in EventCatalog |
| WP2.5 | Publish payload fields match Schema defined fields |
| WP2.6 | No orphan event classes |
| WP2.7 | CURRENT status accuracy |

### WP3: State Machine Validation (`validate-state-machine.ts`)

Validates 6 code state machines against StateMachineCatalog.

| Check | Description |
|-------|-------------|
| WP3.1 | Each code machine has matching Catalog section |
| WP3.2-3.6 | Transition cross-reference (catalog vs code) |
| WP3.7 | Mermaid stateDiagram-v2 generated |

### WP4: Handbook Validation (`build-handbook.ts`)

Verifies ArchitectureHandbook cross-references.

| Check | Description |
|-------|-------------|
| WP4.1 | All Handbook links resolve to existing files |
| WP4.2 | Appendix A documents exist on disk |
| WP4.3 | Referenced documents have version headers |
| WP4.4 | Unreferenced docs (informational) |

### WP5: ADR Index (`build-adr-index.ts`)

Validates ADR/DEC metadata.

| Check | Description |
|-------|-------------|
| WP5.1 | ADR files have required metadata |
| WP5.2 | No duplicate ADR IDs |
| WP5.3 | Status values are valid |

---

## Reports

All reports are generated in `reports/`:

| File | Generator |
|------|-----------|
| `FreezeAudit.json` / `.md` | freeze-audit.ts |
| `EventValidation.json` / `.md` | validate-events.ts |
| `StateMachineValidation.json` / `.md` | validate-state-machine.ts |
| `StateMachineDiagrams.md` | validate-state-machine.ts |
| `HandbookValidation.json` / `.md` | build-handbook.ts |
| `ADRIndex.json` / `.md` | build-adr-index.ts |
| `GovernanceReport.json` / `.md` | governance-dashboard.ts |

---

## Running Tests

```bash
# All governance tests
npm run governance:test

# TypeScript compilation check
npx tsc --project ../tsconfig.governance.json --noEmit
```

---

## Friction Points Addressed

| GF | Priority | Addressed By |
|----|----------|-------------|
| GF-001 (Typed publish) | P1 | WP2 — validates publish() event names and payload fields |
| GF-003 (Class vs Schema mismatch) | P1 | WP2 — compares event class fields against Schema |
| GF-006 (Catalog vs code consistency) | P1 | WP1 + WP2 — full cross-referencing |
| GF-002 (Event class dead code) | P2 | WP2 (WP2.6) — detects orphan event classes |
| GF-007 (Module import check) | P2 | Deferred to Sprint 4.3 |
| GF-004 (uuid mock boilerplate) | P2 | Out of scope (test infra) |
| GF-005 (ESLint mock patterns) | P3 | Deferred |

---

## Known Findings

These are real governance findings detected by the validators, not bugs in the scripts:

1. **WP2.2 WARNING**: 5 DESIGNED events lack code classes (not yet implemented)
2. **WP2.3 WARNING**: Schema specifies `attendance` array not yet in event class constructors
3. **WP3.2-3.6 WARNING**: Some catalog/code transition differences (contract service, attendance reverse transitions)
4. **WP4.3 WARNING**: 10 referenced documents lack version headers
5. **WP5.3 FAIL**: DEC-005 uses `APPROVED`, ADR-009 uses `DECIDED` (non-standard statuses)
