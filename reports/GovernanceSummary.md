# Governance Summary

> **Auto-generated** by `scripts/governance/platform/tasks/governance-summary.ts`
> **Generated**: 2026-07-15T08:37:59.474Z

---

## Overview

This report consolidates all governance validation results into a single summary.

---

## Reports Generated

| Report | Status |
|--------|--------|
| ADRIndex.json | Generated |
| ADRIndex.md | Generated |
| BaselineReport.json | Generated |
| EventValidation.json | Generated |
| EventValidation.md | Generated |
| FreezeAudit.json | Generated |
| FreezeAudit.md | Generated |
| governance-performance.json | Generated |
| GovernanceReport.json | Generated |
| GovernanceReport.md | Generated |
| GovernanceSummary.md | Generated |
| HandbookValidation.json | Generated |
| HandbookValidation.md | Generated |
| HealthReport.json | Generated |
| HealthReport.md | Generated |
| StateMachineDiagrams.md | Generated |
| StateMachineValidation.json | Generated |
| StateMachineValidation.md | Generated |

---

## Validation Categories

### 1. Freeze Audit
Validates governance document consistency (unique checks).

### 2. Event Validation
Validates event catalog, schema, and code consistency.

### 3. State Machine Validation
Validates code state machines against catalog.

### 4. Handbook Validation
Validates ArchitectureHandbook cross-references.

### 5. ADR Index
Validates ADR metadata and generates index.

### 6. Traceability Validation
Validates traceability between governance assets.

### 7. Drift Detection
Detects stale governance artifacts.

### 8. Architecture Consistency
Verifies consistency across governance assets.

### 9. Friction Enforcement
Verifies automation tasks reference governance frictions.

---

## Usage

```bash
# Run all governance checks
npm run governance:platform:check

# Run specific task
npm run governance:platform:task freeze-audit

# Generate dependency graph
npm run governance:platform:graph
```

---

*This summary is auto-generated. Do not edit manually.*
