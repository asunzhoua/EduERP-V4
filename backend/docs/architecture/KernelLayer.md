# Kernel Layer

The Kernel provides the runtime infrastructure for DDD. Framework-independent. Zero NestJS imports.

## Directory Structure

```
src/kernel/
├── domain/                    # Domain Runtime
│   ├── aggregate-runtime.ts   # Load, save, version, events
│   ├── event-collection.ts    # Collect events during mutations
│   ├── optimistic-lock.ts     # Version-based concurrency
│   ├── invariant-validator.ts # Validate invariants on save
│   └── identity-generator.ts  # Generate business identifiers
│
├── application/               # Application Runtime
│   ├── command/               # ICommand, ICommandHandler
│   ├── query/                 # IQuery, IQueryHandler
│   ├── use-case.ts            # IUseCase<TCommand, TResult>
│   ├── application-service.ts # Base class with UnitOfWork
│   ├── pipeline/              # IMiddleware, Pipeline
│   ├── unit-of-work.ts        # IUnitOfWork interface
│   └── transaction.ts         # ITransaction, IsolationLevel
│
├── infrastructure/            # Infrastructure Runtime
│   ├── repository-base.ts     # RepositoryBase<TDomain, TPersistence, TId>
│   ├── mapper-base.ts         # IMapper<TDomain, TPersistence>
│   ├── persistence-adapter.ts # IPersistenceAdapter interface
│   ├── clock-adapter.ts       # ClockAdapter wraps IClock
│   ├── uuid-adapter.ts        # UuidAdapter wraps IUuid
│   └── event-dispatcher.ts    # IEventDispatcher interface
│
├── domain-event/              # Domain Event Runtime
│   ├── pending-events.ts      # Collect events during aggregate lifecycle
│   ├── commit-events.ts       # Commit events to publisher
│   ├── rollback-events.ts     # Rollback on failure
│   └── domain-event-publisher.ts  # IDomainEventPublisher interface
│
├── specification/             # Specification Runtime
│   └── specification-runtime.ts  # Batch evaluation, named specs
│
├── policy/                    # Policy Runtime
│   ├── policy.ts              # IPolicy<T> interface
│   ├── composite-policy.ts    # All, Any, None composition
│   └── policy-context.ts      # Typed context bag
│
└── factory/                   # Factory Runtime
    ├── aggregate-factory.ts   # IAggregateFactory<T>
    └── value-object-factory.ts  # IValueObjectFactory<T>
```

## Usage Pattern

### Domain Layer (Aggregate)
```typescript
import { AggregateRoot } from '../../shared/entity/aggregate-root';
import { Guard } from '../../shared/guard/guard';

class StudentAggregate extends AggregateRoot {
  deactivate(reason: string): void {
    Guard.againstEmpty(reason);
    this.status = 'inactive';
    this.addEvent(new StudentDeactivatedEvent(this.id, reason));
  }

  validateInvariants(): void {
    this.invariant(this.name.length > 0, 'STUDENT-001', 'Name required');
  }
}
```

### Application Layer (Command Handler)
```typescript
import { ICommandHandler } from '../../kernel/application/command/command-handler';
import { Result } from '../../shared/result/result';

class DeactivateStudentHandler implements ICommandHandler<DeactivateStudentCommand, void> {
  async execute(command: DeactivateStudentCommand): Promise<Result<void>> {
    const student = await this.repository.findById(command.studentId);
    if (!student) return Result.fail(new Error('Student not found'));

    student.deactivate(command.reason);
    await this.repository.save(student);
    return Result.ok(undefined);
  }
}
```

### Infrastructure Layer (Repository)
```typescript
import { RepositoryBase } from '../../kernel/infrastructure/repository-base';

class StudentRepository extends RepositoryBase<StudentAggregate, StudentEntity, number> {
  constructor(adapter: IPersistenceAdapter, mapper: IMapper) {
    super(adapter, mapper);
  }
}
```

## Layer Dependency Rules

| Layer | Can Import From | Cannot Import From |
|-------|----------------|-------------------|
| shared/ | Nothing external (except uuid) | kernel/, modules/, @nestjs/* |
| kernel/domain/ | shared/ | infrastructure/, modules/, @nestjs/* |
| kernel/application/ | shared/, kernel/domain/ | infrastructure/, modules/, @nestjs/* |
| kernel/infrastructure/ | shared/, kernel/domain/, kernel/application/ | modules/, @nestjs/* (except TypeORM) |
| modules/ | shared/, kernel/ (public API only) | kernel/ internals |

## Test Commands

```bash
npx jest "src/shared/__tests__"           # Shared kernel tests
npx jest "src/kernel/domain/__tests__"    # Domain runtime tests
npx jest "src/kernel/application/__tests__"  # Application runtime tests
npx jest "src/kernel/infrastructure/__tests__"  # Infrastructure tests
npx jest "src/kernel/domain-event/__tests__"  # Event runtime tests
npx jest "src/kernel/specification/__tests__"  # Specification runtime tests
npx jest "src/kernel/policy/__tests__"    # Policy runtime tests
npx jest "src/kernel/factory/__tests__"   # Factory runtime tests
npx jest "src/architecture"               # Architecture enforcement
```
