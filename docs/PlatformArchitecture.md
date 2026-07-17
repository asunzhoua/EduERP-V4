# Platform Architecture

> EduOS Developer Platform — Technical Architecture
> Version: Sprint 4.6 | Date: 2026-07-15

## Architecture Overview

The EduOS Developer Platform is built as a CLI tool (`eos`) that provides automated governance, architecture validation, code generation, and knowledge management. It runs alongside the NestJS backend but operates independently on the codebase.

```
EduERP-V4/
├── backend/                    # NestJS application
│   ├── src/
│   │   ├── modules/            # DDD modules (identity, student, teaching)
│   │   ├── events/             # Event classes and EventBus
│   │   ├── common/             # Shared DTOs, decorators, guards
│   │   └── config/             # Configuration
│   └── package.json            # Scripts including eos commands
├── tools/
│   └── eos-cli/                # Developer CLI platform
│       ├── index.ts            # CLI entry point
│       ├── shared/             # Shared utilities
│       ├── commands/           # 8 command modules
│       └── generators/         # Code generation system
├── scripts/
│   └── governance/             # Governance automation scripts
├── docs/                       # Documentation and knowledge
├── reports/                    # Generated reports
├── .audit/                     # Audit state and missions
└── tsconfig.cli.json           # TypeScript config for CLI
```

## Design Principles

### 1. Independence
The CLI operates independently from the backend. It reads the codebase but does not modify runtime behavior. This allows governance checks to run without starting the server.

### 2. DDD Compliance
All generated code follows DDD patterns:
- **Entities**: TypeORM entities with audit fields
- **Repositories**: Wrapper pattern with `raw` getter
- **Services**: Application services with state machines
- **Controllers**: REST controllers with Swagger
- **Events**: Pure data classes in `events/` directory
- **Subscribers**: Event handlers in module directories

### 3. Layered Architecture
Import direction is enforced:
```
Controller -> Service -> Repository -> Entity
```
No reverse imports allowed. Cross-module imports go through module files only.

### 4. Governance as Code
All governance rules are implemented as TypeScript scripts:
- Validated against the codebase
- Output standardized reports
- Integrated into CLI commands
- Runnable in CI/CD pipelines

## Component Architecture

### CLI Entry Point (`index.ts`)
```
process.argv -> parse command -> lazy import -> execute -> exit code
```
- Lazy imports for fast startup
- Consistent exit codes (0-5)
- Args forwarding to commands

### Shared Layer (`shared/`)
| Module | Purpose |
|--------|---------|
| `codes.ts` | ExitCode enum |
| `output.ts` | Unified terminal formatting |
| `paths.ts` | Project path constants |

### Command Layer (`commands/`)
Each command is a standalone module:
```typescript
export async function runXxx(args: string[]): Promise<ExitCode> {
  // Parse flags
  // Execute checks
  // Output results
  // Return exit code
}
```

### Generator Layer (`generators/`)
```
template-engine.ts  -> TemplateVars, render(), case converters
templates/          -> 12 template files (entity, repo, service, etc.)
commands/generate.ts -> Orchestrator (type -> template -> output)
```

Template rendering uses `{{VAR}}` syntax:
```typescript
const vars = createVars('Invoice', 'finance');
const code = render(template, vars);
// {{NAME}} -> Invoice
// {{NAME_CAMEL}} -> invoice
// {{ENTITY}} -> InvoiceEntity
```

## Data Flow

### Health Check Flow
```
eos health
  -> checkTypeScript()    -> execSync('tsc --noEmit')
  -> checkTests()         -> execSync('jest --no-coverage')
  -> checkGovernance()    -> read reports/GovernanceReport.json
  -> checkArchitecture()  -> execSync('eos doctor')
  -> checkDocumentation() -> scan docs/ directory
  -> calculate score      -> weighted average
  -> output results       -> terminal/json/md
```

### Governance Validation Flow
```
eos validate
  -> for each script:
       execSync('npm run governance:xxx')
       parse output for PASS/FAIL/WARN
  -> run architecture checks
  -> run tests
  -> run TypeScript check
  -> aggregate results
  -> output to terminal/json/md
```

### Code Generation Flow
```
eos generate aggregate Invoice --module finance
  -> parse arguments (type, name, module)
  -> create TemplateVars from name/module
  -> for each artifact type:
       load template file
       render with vars
       write to output path
  -> report created files
```

## Scoring Algorithm

### Health Score (0-100)
```
TypeScript: 20% (compilation + tsconfig)
Tests:      20% (suite count + test count + pass rate + coverage)
Governance: 20% (report + no failures + docs + ADRs)
Architecture: 20% (DDD compliance + modules + repos)
Documentation: 20% (knowledge + freshness + README + docs)

Total = weighted average of category scores
```

### Category Score (0-10 each)
Each category has multiple items, each scored 0-10:
```
category_score = sum(item_scores)
category_max = count(items) * 10
category_percentage = (category_score / category_max) * 100
```

## Extension Points

### Adding a New Command
1. Create `tools/eos-cli/commands/newcmd.ts`
2. Export `async function runNewCmd(args: string[]): Promise<ExitCode>`
3. Add to `COMMANDS` record in `index.ts`
4. Add to help text

### Adding a New Template
1. Create `tools/eos-cli/generators/templates/newtype.ts`
2. Use `{{VAR}}` syntax for variables
3. Add to `generate.ts` switch statement
4. Add to type documentation

### Adding a New Check
1. Add check function in relevant command (doctor, health, validate)
2. Return `CheckResult` or `HealthCheck` object
3. Add to output formatting

## Performance Considerations

- **Lazy imports**: CLI loads only the command module needed
- **Cached scans**: `countFiles` and `findFiles` traverse once
- **Incremental knowledge**: `--since` flag skips unchanged files
- **Report reuse**: Health reads existing reports, doesn't re-run

## Security Considerations

- CLI runs with user permissions only
- No network requests (except npm/npx for scripts)
- Generated code is reviewed before use
- No credential handling in CLI
