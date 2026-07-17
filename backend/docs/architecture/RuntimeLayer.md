# Runtime Layer

The complete DDD runtime for EduOS. All future domains are built on this foundation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    modules/                          │
│  (Business domains: Student, Course, Teaching, ...)  │
├─────────────────────────────────────────────────────┤
│              kernel/infrastructure/                   │
│  RepositoryBase, IMapper, IPersistenceAdapter        │
├─────────────────────────────────────────────────────┤
│              kernel/application/                      │
│  ICommand/IQuery, UseCase, Pipeline, UnitOfWork      │
├─────────────────────────────────────────────────────┤
│              kernel/domain/                           │
│  AggregateRuntime, EventCollection, OptimisticLock   │
├─────────────────────────────────────────────────────┤
│              shared/                                 │
│  BaseEntity, AggregateRoot, ValueObject, Result,     │
│  Specification, Guard, Clock, UUID                   │
└─────────────────────────────────────────────────────┘
```

## Work Packages

| WP | Name | Files | Tests | Status |
|----|------|-------|-------|--------|
| WP1 | Shared Kernel | 20 | 81 | Done |
| WP2 | Domain Runtime | 5 | 19 | Done |
| WP3 | Application Runtime | 10 | 18 | Done |
| WP4 | Infrastructure Runtime | 6 | 9 | Done |
| WP5 | Domain Event Runtime | 4 | 14 | Done |
| WP6 | Specification Runtime | 1 | 18 | Done |
| WP7 | Policy Runtime | 4 | 12 | Done |
| WP8 | Factory Runtime | 3 | 6 | Done |
| WP9 | Domain Test Toolkit | 5 | 23 | Done |
| WP10 | Architecture Enforcement | 1 | 6 | Done |
| WP11 | Developer SDK | 8 | 11 | Done |
| WP12 | Documentation | 4 | - | Done |

**Total: ~65 source files, 217 new tests, 405 tests passing.**

## Quick Start: Building a New Domain

### Step 1: Generate Aggregate Skeleton
```bash
# Using the eos-cli
import { generate } from '../cli/eos';
const code = generate('aggregate', { name: 'Student', module: 'student' });
```

### Step 2: Implement Business Rules
```typescript
class StudentAggregate extends AggregateRoot {
  private _name: string;
  private _status: StudentStatus;

  deactivate(reason: string): void {
    Guard.againstEmpty(reason);
    this._status = StudentStatus.INACTIVE;
    this.addEvent(new StudentDeactivatedEvent(this.id, reason));
  }

  validateInvariants(): void {
    this.invariant(this._name.length > 0, 'STU-001', 'Name required');
    this.invariant(
      this._status !== StudentStatus.INACTIVE || this._name.length > 0,
      'STU-002',
      'Inactive students must have a name',
    );
  }
}
```

### Step 3: Generate Repository
```typescript
class StudentRepository extends RepositoryBase<StudentAggregate, StudentEntity, number> {
  constructor(adapter: IPersistenceAdapter, mapper: IMapper) {
    super(adapter, mapper);
  }
}
```

### Step 4: Generate Command Handler
```typescript
class DeactivateStudentHandler implements ICommandHandler<DeactivateStudentCommand, void> {
  async execute(command: DeactivateStudentCommand): Promise<Result<void>> {
    return this.executeInTransaction(async () => {
      const student = await this.repository.findById(command.studentId);
      if (!student) throw new Error('Student not found');
      student.deactivate(command.reason);
      await this.repository.save(student);
    });
  }
}
```

### Step 5: Write Tests
```typescript
import { FakeClock } from '../test-toolkit/fake-clock';
import { FakeUuid } from '../test-toolkit/fake-uuid';
import { FakeRepository } from '../test-toolkit/fake-repository';

describe('StudentAggregate', () => {
  it('should deactivate with reason', () => {
    const student = new StudentAggregate(1, 'Alice');
    student.deactivate('graduated');
    expect(student.status).toBe('inactive');
    expect(student.domainEvents).toHaveLength(1);
  });
});
```

## Available Generators

| Generator | Command | Output |
|-----------|---------|--------|
| Aggregate | `generate('aggregate', ...)` | AggregateRoot + ID class |
| Value Object | `generate('value-object', ...)` | ValueObject subclass |
| Entity | `generate('entity', ...)` | BaseEntity subclass |
| Repository | `generate('repository', ...)` | RepositoryBase subclass |
| Use Case | `generate('use-case', ...)` | Command + Handler |
| Event | `generate('event', ...)` | DomainEventBase subclass |
