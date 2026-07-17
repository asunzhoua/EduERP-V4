# Governance Platform

> **Version**: 1.0.0
> **Last Updated**: 2026-07-15

## Overview

The Governance Platform is a unified execution model for all governance validation tasks in EduERP-V4. It provides automatic task discovery, dependency management, and a unified CLI for running governance checks.

## Architecture

```
scripts/governance/
  platform/           # Core platform infrastructure
    types.ts          # Type definitions
    registry.ts       # Task registration and execution
    config.ts         # Configuration system
    task-base.ts      # Abstract base class for tasks
    cli.ts            # Unified CLI entry point
    index.ts          # Barrel exports
  tasks/              # Task implementations
    freeze-audit.ts
    event-validation.ts
    state-machine-validation.ts
    handbook-validation.ts
    adr-index.ts
    baseline.ts
  shared/             # Shared utilities
    paths.ts          # Project path constants
    markdown-parser.ts
    code-parser.ts
    report.ts
```

## Quick Start

```bash
# Run all governance checks
npm run governance:platform:check

# List registered tasks
npm run governance:platform:list

# Generate dependency graph
npm run governance:platform:graph

# Run a specific task
npm run governance:platform:task freeze-audit
```

## Key Concepts

### GovernanceTask

Every governance operation implements the `GovernanceTask` interface:

```typescript
interface GovernanceTask {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  execute(): Promise<GovernanceResult>;
}
```

### GovernanceRegistry

The registry is the single source of truth for governance tasks:

- **Automatic Discovery**: Tasks are registered programmatically
- **Dependency Management**: Topological sorting ensures correct execution order
- **Cycle Detection**: Prevents circular dependencies
- **Configuration**: Tasks can be enabled/disabled via configuration

### GovernanceTaskBase

Abstract base class providing:

- Timing measurement
- Error handling
- Consistent result format

## Adding a New Task

1. Create a new file in `scripts/governance/tasks/`
2. Extend `GovernanceTaskBase`
3. Implement `executeTask()` method
4. Register in `cli.ts` `registerAllTasks()`

```typescript
export class MyNewTask extends GovernanceTaskBase {
  readonly id = 'my-task';
  readonly name = 'My Task';
  readonly description = 'Does something useful';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask() {
    // Your validation logic here
    return {
      issues: [],
      statistics: { checksPerformed: 1 },
    };
  }
}
```

## Configuration

Configuration can be loaded from:

1. `governance.config.json` in project root
2. Programmatic configuration via `createConfig()`
3. Presets: `createCIConfig()`, `createLocalConfig()`, `createMinimalConfig()`

See [Configuration.md](./Configuration.md) for details.

## Performance

The platform is designed for speed:

- **Total execution time**: ~60ms for all 6 tasks
- **Total checks**: 200+ validations per run
- **No external dependencies**: Pure TypeScript with Node.js built-ins

## Testing

```bash
# Run all governance tests
npm run governance:test

# Run specific test suite
npx jest --config jest.governance.config.js -- registry.spec.ts
```

## Reports

Generated reports are written to `reports/` directory:

- `GovernanceReport.json` - Full JSON report
- `GovernanceReport.md` - Human-readable summary
- `governance-performance.json` - Performance metrics
- `governance-dependency-graph.mmd` - Mermaid dependency graph
