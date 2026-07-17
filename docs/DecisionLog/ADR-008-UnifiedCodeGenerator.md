# ADR-008: Unified Code Generator

> **Status**: PROPOSED
> **Date**: 2026-07-14
> **Deciders**: CTO (approval required)
> **Related**: TeachingConsistencyAudit.md, TeachingRules.md Section 3

---

## Context

EduOS uses business codes for cross-module references. Each entity type has a unique prefix and format:

| Entity | Prefix | Format | Example |
|--------|--------|--------|---------|
| Student | `ST` | `STYYYYMMNNNN` | `ST2026070001` |
| Course | `CS` | `CSYYYYMMNNNN` | `CS2026070001` |
| Class | `CL` | `CLYYYYMMNNNN` | `CL2026070001` |
| Contract | `CT` | `CTYYYYMMNNNN` | `CT2026070001` |

Currently, each entity has its own `*CodeGeneratorService` class. All four implementations follow the **identical algorithm**:

```typescript
async generateCode(): Promise<string> {
  1. Get current year/month → prefix = `{PREFIX}{YYYY}{MM}`
  2. Query: SELECT * FROM {table} WHERE {code_col} LIKE '{prefix}%' ORDER BY {code_col} DESC LIMIT 1
  3. Extract last 4 digits from latest code → sequence = last + 1
  4. Return `{prefix}{sequence padded to 4 digits}`
}
```

### Existing Implementations (4 files, ~35 lines each)

| File | Table | Column | Extra Filter |
|------|-------|--------|--------------|
| `student/services/student-code-generator.service.ts` | `student` | `student_code` | None |
| `teaching/course/course-code-generator.service.ts` | `course` | `course_code` | `deleted = false` |
| `teaching/class/class-code-generator.service.ts` | `class` | `class_code` | `deleted = false` |
| `teaching/contract/contract-code-generator.service.ts` | `contract` | `contract_code` | None |

### The Problem

1. **Code duplication**: 4 copies of the same algorithm with only 3 parameters different (prefix, table, column)
2. **Maintenance burden**: If the algorithm changes (e.g., adding collision detection, 5-digit sequences), all 4 files must be updated
3. **Inconsistency**: Course and Class filter `deleted = false`; Student and Contract do not
4. **No collision protection**: If a code is deleted and recycled, the generator could produce duplicates
5. **Cross-domain**: Student code generator lives in the Student Domain. Teaching Domain modules cannot easily import it. When new domains (Finance, Points) need code generation, the pattern must be duplicated again.

---

## Decision

**Create a single `UnifiedCodeGeneratorService` in `src/common/` that serves all code generation needs.**

### Design

```typescript
// backend/src/common/services/unified-code-generator.service.ts

export interface CodeGenerationConfig {
  prefix: string;           // e.g., 'ST', 'CS', 'CL', 'CT'
  tableName: string;        // e.g., 'student', 'course'
  columnName: string;       // e.g., 'student_code', 'course_code'
  softDeleteColumn?: string; // e.g., 'deleted' (optional, for soft-delete tables)
}

@Injectable()
export class UnifiedCodeGeneratorService {
  constructor(
    @InjectRepository(DynamicEntity) // or use DataSource/QueryBuilder directly
    private readonly dataSource: DataSource,
  ) {}

  async generate(config: CodeGenerationConfig): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${config.prefix}${year}${month}`;

    let query = `SELECT ${config.columnName} FROM ${config.tableName}`;
    query += ` WHERE ${config.columnName} LIKE :prefix`;
    if (config.softDeleteColumn) {
      query += ` AND ${config.softDeleteColumn} = :notDeleted`;
    }
    query += ` ORDER BY ${config.columnName} DESC LIMIT 1`;

    const result = await this.dataSource.query(query, {
      prefix: `${prefix}%`,
      notDeleted: 0,
    });

    let sequence = 1;
    if (result.length > 0) {
      const lastCode = result[0][config.columnName] as string;
      const lastSeq = parseInt(lastCode.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
}
```

### Usage Pattern

Each domain module injects the unified generator with its own config:

```typescript
// In CourseService
private readonly COURSE_CODE_CONFIG: CodeGenerationConfig = {
  prefix: 'CS',
  tableName: 'course',
  columnName: 'course_code',
  softDeleteColumn: 'deleted',
};

async create(dto: CreateCourseDto): Promise<CourseEntity> {
  const courseCode = await this.codeGenerator.generate(this.COURSE_CODE_CONFIG);
  // ...
}
```

### Registration

The `UnifiedCodeGeneratorService` is registered in `CommonModule` and imported by all domain modules that need code generation:

```typescript
// backend/src/common/common.module.ts
@Module({
  providers: [UnifiedCodeGeneratorService],
  exports: [UnifiedCodeGeneratorService],
})
export class CommonModule {}
```

---

## Migration Path

### Phase 1: Create Unified Service (Non-breaking)

1. Create `backend/src/common/services/unified-code-generator.service.ts`
2. Create `backend/src/common/common.module.ts` (if not exists) exporting the service
3. Add unit tests for the unified service
4. All existing generators continue to work unchanged

### Phase 2: Migrate Domain Modules (One at a time)

For each domain module:
1. Import `CommonModule`
2. Inject `UnifiedCodeGeneratorService`
3. Replace the domain-specific generator call with `codeGenerator.generate(CONFIG)`
4. Delete the old `*CodeGeneratorService` file
5. Run tests

**Migration order** (follows Constitution Rule 15 dependency order):
1. Student → `StudentCodeGeneratorService` → `UnifiedCodeGeneratorService`
2. Course → `CourseCodeGeneratorService` → `UnifiedCodeGeneratorService`
3. Class → `ClassCodeGeneratorService` → `UnifiedCodeGeneratorService`
4. Contract → `ContractCodeGeneratorService` → `UnifiedCodeGeneratorService`

### Phase 3: Clean Up

1. Remove all 4 old generator files
2. Remove their module registrations
3. Verify all tests pass

---

## Config Registry (Future)

As more entities need code generation (Finance, Points, etc.), a centralized config registry can be introduced:

```typescript
// backend/src/common/config/code-generation.config.ts

export const CODE_CONFIGS: Record<string, CodeGenerationConfig> = {
  STUDENT:  { prefix: 'ST', tableName: 'student',    columnName: 'student_code' },
  COURSE:   { prefix: 'CS', tableName: 'course',     columnName: 'course_code', softDeleteColumn: 'deleted' },
  CLASS:    { prefix: 'CL', tableName: 'class',      columnName: 'class_code',  softDeleteColumn: 'deleted' },
  CONTRACT: { prefix: 'CT', tableName: 'contract',   columnName: 'contract_code' },
  // Future:
  // INVOICE:  { prefix: 'INV', tableName: 'invoice',   columnName: 'invoice_code' },
  // PAYMENT:  { prefix: 'PAY', tableName: 'payment',   columnName: 'payment_code' },
};
```

---

## Code Generation Rules (from TeachingRules.md)

All code generation must遵守 these rules, now centralized in one place:

| Rule | Description |
|------|-------------|
| Immutable after creation | Codes cannot be changed once assigned |
| Never recycled | Even after soft delete, the code is never reused |
| Globally unique | Across the entire system (not just within a domain) |
| Format: `{PREFIX}{YYYY}{MM}{NNNN}` | Prefix (2 letters) + Year (4) + Month (2) + Sequence (4, zero-padded) |
| Sequence resets monthly | A new month starts at 0001 |
| Server-side only | Code generation never happens on the client |

---

## Alternatives Considered

### Alternative A: Keep Separate Generators (Status Quo)

**Rejected.** Four copies of identical logic is unmaintainable. Every algorithm change requires four file edits.

### Alternative B: Generic Base Class

Create an abstract `BaseCodeGeneratorService` that each domain extends.

**Rejected.** Inheritance adds unnecessary complexity. The config-based approach is simpler and more composable. A service with a `generate(config)` method is more flexible than a class hierarchy.

### Alternative C: UUID-Based Codes

Replace sequential codes with UUIDs.

**Rejected.** Business codes must be human-readable and sortable (`ST2026070001` is meaningful; `550e8400-e29b-41d4-a716-446655440000` is not). Parents, teachers, and admins read and communicate these codes.

---

## Consequences

### Positive

- **Single implementation** — one file to maintain, one algorithm to test
- **Cross-domain access** — any module can generate codes by importing CommonModule
- **Configuration-driven** — adding a new entity requires only a config entry, not a new service class
- **Consistent behavior** — all generators share the same soft-delete handling, sequence logic, and error handling
- **Foundation for collision detection** — easy to add retry logic or unique-check in the unified service

### Negative

- **Migration effort** — 4 existing generators need to be replaced (non-trivial but straightforward)
- **Raw SQL** — the unified service uses `DataSource.query()` instead of TypeORM's query builder, since it needs to work across different entity types. This trades type safety for generality.
- **Module coupling** — all code-generating modules now depend on CommonModule (acceptable trade-off)

---

## Approval

| Role | Status | Date |
|------|--------|------|
| CTO | ⬜ Pending | — |

---

*This ADR proposes a unified code generation architecture to replace the current 4 duplicated generator services. Implementation requires CTO approval and a migration task across all 4 existing generators.*
