# Platform Manifest

> EduOS Developer Platform — Capabilities and Components
> Version: Sprint 4.6 | Date: 2026-07-15

## Platform Overview

EduOS Developer Platform is a self-contained development platform built on top of the EduERP-V4 codebase. It provides automated governance, architecture validation, code generation, and knowledge management capabilities.

## CLI Commands

| Command | Status | Description |
|---------|--------|-------------|
| `eos doctor` | ✅ Active | Architecture analysis — 7 DDD compliance checks |
| `eos health` | ✅ Active | Repository health scoring — 5 categories, weighted 0-100 |
| `eos validate` | ✅ Active | Unified governance — 8 checks, --filter, --format, --fix |
| `eos freeze` | ✅ Active | Document freeze audit |
| `eos knowledge` | ✅ Active | Incremental knowledge engine — git diff based updates |
| `eos repo` | ✅ Active | Repository statistics and file counts |
| `eos generate` | ✅ Active | Project scaffolding — 11 artifact types, DDD-compliant templates |
| `eos mission` | ✅ Active | Mission runtime — queue, checkpoint, retry, progress ledger |

## Code Generation Templates

| Template | Output | Location |
|----------|--------|----------|
| `aggregate` | entity + repo + service + controller + module + DTOs | modules/\<name\>/ |
| `entity` | entity + enum | modules/\<name\>/ |
| `repository` | repository wrapper | modules/\<name\>/ |
| `service` | application service with state machine | modules/\<name\>/ |
| `controller` | REST controller with Swagger | modules/\<name\>/ |
| `module` | NestJS module | modules/\<name\>/ |
| `event` | event class | events/\<domain\>/ |
| `subscriber` | event subscriber | modules/\<name\>/ |
| `dto` | create/update/query DTOs | modules/\<name\>/dto/ |
| `test` | service/controller test skeleton | modules/\<name\>/ |
| `adr` | Architecture Decision Record | DecisionLog/ |

## Governance Automation

| Script | Purpose |
|--------|---------|
| `governance:freeze-audit` | Document freeze compliance |
| `governance:validate-events` | Event catalog vs code cross-reference |
| `governance:validate-state-machine` | State machine catalog vs code |
| `governance:build-handbook` | Handbook reference resolution |
| `governance:build-adr-index` | ADR metadata extraction |
| `governance:check` | Unified governance dashboard |
| `governance:test` | Governance test suite |

## Architecture Checks (Doctor)

| ID | Check | Severity |
|----|-------|----------|
| DOC.1 | Module structure compliance | FAIL/WARN |
| DOC.2 | Import direction (controller -> service -> repo -> entity) | FAIL |
| DOC.3 | Aggregate boundary violations | WARN |
| DOC.4 | Event pattern compliance | PASS/WARN |
| DOC.5 | Repository pattern (raw getter, @Injectable) | FAIL/WARN |
| DOC.6 | File naming conventions (kebab-case) | WARN |
| DOC.7 | Dead code indicators | INFO |

## Health Scoring Categories

| Category | Weight | Checks |
|----------|--------|--------|
| TypeScript | 20% | Compilation, tsconfig |
| Tests | 20% | Suite count, test count, pass rate, file coverage |
| Governance | 20% | Report existence, no failures, gov docs, ADRs |
| Architecture | 20% | DDD compliance, module count, repository layer |
| Documentation | 20% | Knowledge files, freshness, README, docs |

## Mission Runtime

| Mission ID | Steps | Description |
|------------|-------|-------------|
| governance-full | 8 | Full governance validation pipeline |
| health-telemetry | 2 | Health check + report generation |
| knowledge-sync | 2 | Knowledge artifact rebuild |

## Exit Codes

| Code | Name | Description |
|------|------|-------------|
| 0 | SUCCESS | Command completed successfully |
| 1 | GENERAL_ERROR | General error |
| 2 | VALIDATION_FAILURE | Validation check failed |
| 3 | ARCHITECTURE_VIOLATION | Architecture violation detected |
| 4 | GOVERNANCE_FAILURE | Governance check failed |
| 5 | MISSION_FAILURE | Mission execution failed |

## Quick Start

```bash
# From backend/ directory
npm run eos                    # Show all commands
npm run eos:health             # Quick health check
npm run eos:validate           # Full governance validation
npm run eos:doctor             # Architecture analysis
npm run eos:generate           # Code scaffolding
npm run dx                     # Quick health score
```

## File Structure

```
tools/eos-cli/
  index.ts                     # CLI entry point
  shared/
    codes.ts                   # Exit code enum
    output.ts                  # Unified output formatting
    paths.ts                   # Path constants
  commands/
    doctor.ts                  # Architecture Doctor
    health.ts                  # Health Telemetry
    validate.ts                # Governance Runtime
    freeze.ts                  # Freeze Audit
    knowledge.ts               # Knowledge Engine
    repo.ts                    # Repository Stats
    generate.ts                # Project Generator
    mission.ts                 # Mission Runtime
  generators/
    template-engine.ts         # Template variable system
    templates/                 # 12 code generation templates
```
