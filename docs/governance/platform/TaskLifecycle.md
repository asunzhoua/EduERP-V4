# Task Lifecycle

> **Version**: 1.0.0
> **Last Updated**: 2026-07-15

## Overview

Every governance task follows a defined lifecycle from creation to execution. This document describes the stages and transitions.

## Lifecycle Stages

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Register   │────▶│  Configure  │────▶│  Execute    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Enable/    │     │  Collect    │
                    │  Disable    │     │  Results    │
                    └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │  Report     │
                                       └─────────────┘
```

## Stage 1: Registration

Tasks are registered with the `GovernanceRegistry`:

```typescript
registry.register(new FreezeAuditTask(), { order: 1 });
```

### Registration Properties

| Property | Description |
|----------|-------------|
| `id` | Unique identifier (e.g., `freeze-audit`) |
| `name` | Human-readable name |
| `description` | What the task does |
| `dependencies` | List of task IDs that must run first |
| `enabled` | Whether task is enabled by default |

### Validation

During registration, the registry validates:

- **Unique IDs**: No duplicate task IDs
- **Dependency Existence**: All dependencies reference registered tasks
- **No Cycles**: Dependency graph has no circular references

## Stage 2: Configuration

Tasks can be configured via:

1. **Default Configuration**: Built into the task class
2. **File Configuration**: `governance.config.json`
3. **Programmatic Configuration**: `createConfig()` function

### Configuration Options

```typescript
interface GovernanceConfig {
  enabledTasks: string[];      // Tasks to enable (empty = all)
  disabledTasks: string[];     // Tasks to disable
  taskOrder: Record<string, number>;  // Custom execution order
  failOnWarning: boolean;      // Exit code behavior
  verbosity: 0 | 1 | 2;       // Output detail level
  reportDir: string;           // Output directory
}
```

## Stage 3: Execution

### Pre-Execution

Before executing, the registry:

1. **Topological Sort**: Determines execution order
2. **Dependency Check**: Ensures all dependencies are satisfied
3. **Cycle Detection**: Prevents infinite loops

### Execution

The `GovernanceTaskBase.execute()` method:

1. **Records Start Time**: `const startTime = Date.now()`
2. **Calls executeTask()**: Runs the task-specific logic
3. **Records End Time**: `const finishedAt = new Date()`
4. **Calculates Duration**: `durationMs = Date.now() - startTime`
5. **Handles Errors**: Catches exceptions and returns FAIL status

```typescript
async execute(): Promise<GovernanceResult> {
  const startTime = Date.now();
  
  try {
    const { issues, statistics, metadata } = await this.executeTask();
    
    const errors = issues.filter(i => i.severity === 'FAIL');
    const warnings = issues.filter(i => i.severity === 'WARNING');
    const status = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARNING' : 'PASS';
    
    return {
      taskId: this.id,
      taskName: this.name,
      status,
      startedAt: new Date(startTime),
      finishedAt: new Date(),
      durationMs: Date.now() - startTime,
      errors,
      warnings,
      statistics,
      metadata,
    };
  } catch (err) {
    return {
      taskId: this.id,
      taskName: this.name,
      status: 'FAIL',
      startedAt: new Date(startTime),
      finishedAt: new Date(),
      durationMs: Date.now() - startTime,
      errors: [{ id: `${this.id}-ERROR`, description: String(err), severity: 'FAIL' }],
      warnings: [],
      statistics: {},
    };
  }
}
```

### Post-Execution

After execution, the result is:

1. **Added to Results Array**: Collected with other task results
2. **Printed to Console**: If verbose mode is enabled
3. **Written to Report**: If report generation is enabled

## Stage 4: Result Collection

Results are collected in execution order:

```typescript
interface GovernanceResult {
  taskId: string;
  taskName: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  errors: GovernanceIssue[];
  warnings: GovernanceIssue[];
  statistics: Record<string, number>;
  metadata?: Record<string, unknown>;
}
```

### Status Determination

- **PASS**: No errors, no warnings
- **WARNING**: Has warnings but no errors
- **FAIL**: Has at least one error

## Stage 5: Reporting

Results are aggregated into reports:

1. **JSON Report**: Machine-readable format
2. **Markdown Report**: Human-readable format
3. **Performance Report**: Timing and statistics

## Example: Freeze Audit Task

```typescript
class FreezeAuditTask extends GovernanceTaskBase {
  readonly id = 'freeze-audit';
  readonly name = 'Freeze Audit';
  readonly dependencies = [];

  protected async executeTask() {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    // WP1.1: EventCatalog events exist in EventSchema
    const catalog = parseEventCatalog(EVENT_CATALOG);
    const schema = parseEventSchema(EVENT_SCHEMA);
    const schemaNames = new Set(schema.map(s => s.name));

    for (const event of catalog) {
      checksPerformed++;
      if (!schemaNames.has(event.name)) {
        issues.push({
          id: 'FREEZE-001',
          description: `Event "${event.name}" has no EventSchema entry`,
          severity: 'FAIL',
        });
      }
    }

    return {
      issues,
      statistics: { checksPerformed },
    };
  }
}
```

## Error Handling

### Task-Level Errors

Caught by `execute()` method:

```typescript
try {
  const result = await this.executeTask();
  // ...
} catch (err) {
  return {
    status: 'FAIL',
    errors: [{ id: `${this.id}-ERROR`, description: String(err) }],
  };
}
```

### Issue-Level Errors

Reported as issues with severity:

```typescript
issues.push({
  id: 'FREEZE-001',
  description: 'Event missing from schema',
  severity: 'FAIL',  // or 'WARNING'
});
```
