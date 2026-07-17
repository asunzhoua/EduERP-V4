# Shared Kernel

Framework-independent building blocks. Zero NestJS imports.

## Directory Structure

```
src/shared/
├── entity/
│   ├── entity.base.ts           # BaseEntity with audit fields
│   ├── aggregate-root.ts        # AggregateRoot extends BaseEntity
│   ├── value-object.ts          # ValueObject abstract class
│   └── identifier.ts            # NumberId, StringId typed identifiers
├── domain-event/
│   ├── domain-event.ts          # DomainEvent interface + DomainEventBase
│   └── domain-event-handler.ts  # IDomainEventHandler interface
├── specification/
│   ├── specification.ts         # ISpecification<T> interface
│   └── composite-specification.ts  # And, Or, Not composites
├── exception/
│   ├── domain.exception.ts      # DomainException base
│   ├── invariant-violation.ts   # InvariantViolationException
│   └── business-rule-violation.ts  # BusinessRuleViolationException
├── result/
│   └── result.ts                # Result<T> monad
├── guard/
│   └── guard.ts                 # Precondition checks
├── clock/
│   ├── clock.ts                 # IClock interface
│   └── system-clock.ts          # SystemClock implementation
└── identifier/
    ├── unique-id.ts             # UniqueId<T> value object
    ├── uuid.ts                  # IUuid interface
    └── system-uuid.ts           # SystemUuid implementation
```

## Key Classes

### BaseEntity
Base class for all entities with audit fields:
- `id: number` — Entity identifier
- `createdAt: Date` — Creation timestamp
- `createdBy: number` — Creator user ID
- `updatedAt: Date | null` — Last update timestamp
- `updatedBy: number | null` — Last updater user ID
- `version: number` — Optimistic lock version
- `deleted: boolean` — Soft delete flag

### AggregateRoot
Extends BaseEntity with domain event collection:
- `addEvent(event)` — Collect events during mutations
- `clearEvents()` — Clear collected events
- `validateInvariants()` — Override in subclasses to validate business rules
- `invariant(condition, id, message)` — Assert invariants

### ValueObject<T>
Immutable value object with structural equality:
- `value: T` — The wrapped value (frozen)
- `equals(other)` — Structural equality via JSON comparison

### Result<T>
Monadic error handling:
- `Result.ok(value)` — Success
- `Result.fail(error)` — Failure
- `Result.combine(results[])` — Combine multiple results
- `result.map(fn)` / `result.flatMap(fn)` — Transform

### ISpecification<T>
Composable business rule predicates:
- `isSatisfiedBy(candidate)` — Check if candidate satisfies
- `.and(other)` / `.or(other)` / `.not()` — Composite operations

## Rules

1. Zero NestJS imports in `src/shared/`
2. Zero framework-specific code
3. All classes must be testable in isolation
