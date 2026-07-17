# Configuration

> **Version**: 1.0.0
> **Last Updated**: 2026-07-15

## Overview

The Governance Platform supports multiple configuration methods. Configuration affects task execution, output, and behavior.

## Configuration Methods

### 1. File Configuration

Create `governance.config.json` in the project root:

```json
{
  "enabledTasks": ["freeze-audit", "event-validation"],
  "disabledTasks": [],
  "taskOrder": {
    "freeze-audit": 1,
    "event-validation": 2
  },
  "failOnWarning": false,
  "verbosity": 1,
  "reportDir": "reports"
}
```

### 2. Programmatic Configuration

```typescript
import { createConfig } from './platform/config';

const config = createConfig({
  failOnWarning: true,
  verbosity: 2,
});
```

### 3. Configuration Presets

```typescript
import { createCIConfig, createLocalConfig, createMinimalConfig } from './platform/config';

// CI: Strict, verbose, fail on warnings
const ciConfig = createCIConfig();

// Local: Lenient, quiet
const localConfig = createLocalConfig();

// Minimal: Only essential tasks
const minimalConfig = createMinimalConfig();
```

## Configuration Options

### enabledTasks

List of task IDs to enable. If empty, all tasks are enabled.

```typescript
enabledTasks: ['freeze-audit', 'event-validation']
```

### disabledTasks

List of task IDs to disable. Takes precedence over `enabledTasks`.

```typescript
disabledTasks: ['adr-index']
```

### taskOrder

Custom execution order for tasks. Values are numeric priorities.

```typescript
taskOrder: {
  'freeze-audit': 1,
  'event-validation': 2,
  'baseline': 10
}
```

### failOnWarning

If `true`, CLI returns non-zero exit code when any task has warnings.

```typescript
failOnWarning: true  // CI mode
failOnWarning: false // Local mode
```

### verbosity

Output detail level:

| Value | Description |
|-------|-------------|
| `0` | Quiet - only errors |
| `1` | Normal - status and summary |
| `2` | Verbose - full details |

### reportDir

Directory for generated reports.

```typescript
reportDir: '/path/to/reports'
```

## Configuration Loading

Configuration is loaded in this order:

1. **Default Configuration**: Built-in defaults
2. **File Configuration**: `governance.config.json` (if exists)
3. **Programmatic Configuration**: Overrides from code

```typescript
// Default
const config = loadConfig();

// Custom path
const config = loadConfig('/path/to/config.json');
```

## Configuration Validation

Validate configuration before use:

```typescript
import { validateConfig } from './platform/config';

const config = createConfig({});
const errors = validateConfig(config);

if (errors.length > 0) {
  console.error('Configuration errors:', errors);
}
```

### Validation Rules

- `reportDir` must be non-empty
- `verbosity` must be 0, 1, or 2
- Tasks cannot be both enabled and disabled

## Preset Configurations

### CI Configuration

```typescript
const ciConfig = createCIConfig();
// {
//   failOnWarning: true,
//   verbosity: 2,
//   ...defaults
// }
```

### Local Configuration

```typescript
const localConfig = createLocalConfig();
// {
//   failOnWarning: false,
//   verbosity: 1,
//   ...defaults
// }
```

### Minimal Configuration

```typescript
const minimalConfig = createMinimalConfig();
// {
//   enabledTasks: ['freeze-audit', 'event-validation'],
//   verbosity: 0,
//   ...defaults
// }
```

## Environment-Specific Configuration

### Development

```json
{
  "failOnWarning": false,
  "verbosity": 1,
  "disabledTasks": ["adr-index"]
}
```

### CI/CD

```json
{
  "failOnWarning": true,
  "verbosity": 2,
  "enabledTasks": []
}
```

### Production

```json
{
  "failOnWarning": true,
  "verbosity": 0,
  "enabledTasks": ["freeze-audit", "event-validation", "baseline"]
}
```

## Configuration Examples

### Example 1: Run Only Specific Tasks

```typescript
const config = createConfig({
  enabledTasks: ['freeze-audit', 'event-validation'],
});
```

### Example 2: Strict CI Mode

```typescript
const config = createCIConfig();
// failOnWarning: true
// verbosity: 2
```

### Example 3: Custom Task Order

```typescript
const config = createConfig({
  taskOrder: {
    'baseline': 1,  // Run baseline first
    'freeze-audit': 2,
  },
});
```

## Saving Configuration

```typescript
import { saveConfig } from './platform/config';

const config = createConfig({ failOnWarning: true });
saveConfig(config);  // Writes to governance.config.json
saveConfig(config, '/custom/path.json');  // Custom path
```
