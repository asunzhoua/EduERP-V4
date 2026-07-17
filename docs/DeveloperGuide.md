# Developer Guide

> EduOS Developer Platform — How to Use the Platform
> Version: Sprint 4.6 | Date: 2026-07-15

## Prerequisites

- Node.js 18+
- npm (comes with Node.js)
- Git

## Getting Started

All commands run from the `backend/` directory:

```bash
cd backend
```

## Daily Development Workflow

### 1. Start Development Server

```bash
npm run start:dev
```

### 2. Check Health Before Committing

```bash
npm run dx                    # Quick health score (89/100)
```

### 3. Run Tests

```bash
npm run test                  # Run all tests
npm run test:watch            # Watch mode
```

### 4. Validate Governance

```bash
npm run eos:validate          # Full validation (all checks)
npx ts-node --project ../tsconfig.cli.json ../tools/eos-cli/index.ts validate --filter tests,typescript  # Specific checks
```

### 5. Check Architecture

```bash
npm run eos:doctor            # Architecture compliance
```

## Code Generation

### Generate a New Aggregate

```bash
npm run eos:generate -- aggregate Invoice --module finance
```

This creates:
- `src/modules/finance/invoice.entity.ts`
- `src/modules/finance/enums/invoice-status.enum.ts`
- `src/modules/finance/invoice.repository.ts`
- `src/modules/finance/invoice.service.ts`
- `src/modules/finance/invoice.controller.ts`
- `src/modules/finance/invoice.module.ts`
- `src/modules/finance/dto/create-invoice.dto.ts`
- `src/modules/finance/dto/update-invoice.dto.ts`
- `src/modules/finance/dto/query-invoice.dto.ts`

### Generate Individual Components

```bash
# Entity + Enum
npm run eos:generate -- entity Attendance --module lesson-attendance

# Repository only
npm run eos:generate -- repository Course --module course

# Event class
npm run eos:generate -- event ContractExpired --module finance

# Test skeleton
npm run eos:generate -- test CourseService --module course --kind service

# ADR
npm run eos:generate -- adr "Event Sourcing for Audit Trail"
```

### Available Types

| Type | Description |
|------|-------------|
| `aggregate` | Full aggregate (entity + repo + service + controller + module + DTOs) |
| `entity` | Entity + enum |
| `repository` | Repository wrapper |
| `service` | Application service with state machine |
| `controller` | REST controller with Swagger |
| `module` | NestJS module |
| `event` | Event class |
| `subscriber` | Event subscriber |
| `dto` | Create/update/query DTOs |
| `test` | Service/controller test skeleton |
| `adr` | Architecture Decision Record |

## Knowledge System

### View Knowledge Status

```bash
npm run eos:knowledge
```

### Rebuild Knowledge Artifacts

```bash
npm run eos:knowledge -- --full           # Full rebuild
npm run eos:knowledge -- --full --dry-run # Preview without writing
npm run eos:knowledge -- --since HEAD~5   # Incremental update
```

### Knowledge Artifacts

| File | Content |
|------|---------|
| `01-repository-index.md` | File counts and metrics |
| `02-module-graph.md` | Module dependency tree |
| `03-event-graph.md` | Event catalog summary |
| `10-knowledge-graph.md` | Unified knowledge view |

## Mission Runtime

### List Missions

```bash
npm run eos:mission -- list
```

### Run a Mission

```bash
npm run eos:mission -- run governance-full
```

### Mission with Checkpoint

```bash
npm run eos:mission -- checkpoint governance-full  # Save state
npm run eos:mission -- resume governance-full       # Resume later
npm run eos:mission -- retry governance-full        # Retry failed
```

### View Progress

```bash
npm run eos:mission -- ledger
```

## Troubleshooting

### TypeScript Errors

```bash
npx tsc --noEmit              # Check for errors
```

### Test Failures

```bash
npm run test                  # Run tests
npm run test:watch            # Watch for fixes
```

### Governance Failures

```bash
npm run eos:validate -- --filter freeze-audit,validate-events  # Run specific checks
```

### Architecture Violations

```bash
npm run eos:doctor            # See all violations
```

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run eos` | Show CLI help |
| `npm run eos:doctor` | Architecture analysis |
| `npm run eos:health` | Health check |
| `npm run eos:validate` | Governance validation |
| `npm run eos:freeze` | Freeze audit |
| `npm run eos:knowledge` | Knowledge status |
| `npm run eos:repo` | Repository stats |
| `npm run eos:generate` | Code generation |
| `npm run eos:mission` | Mission runtime |
| `npm run dx` | Quick health score |
| `npm run dx:full` | Full validation (validate + doctor + health) |
