# Developer Guide

How to use the EduOS Runtime to build new domains.

## Prerequisites

- Node.js 18+
- TypeScript 5+
- Jest for testing

## Directory Convention

All new domains follow this structure:

```
src/modules/
├── <module>/
│   ├── domain/
│   │   ├── <aggregate>.ts       # Aggregate root
│   │   ├── <value-object>.ts    # Value objects
│   │   ├── <entity>.ts          # Child entities
│   │   ├── <event>.ts           # Domain events
│   │   └── <specification>.ts   # Business rules
│   ├── application/
│   │   ├── commands/            # Command handlers
│   │   ├── queries/             # Query handlers
│   │   └── use-cases/           # Use cases
│   ├── infrastructure/
│   │   ├── repositories/        # Repository implementations
│   │   ├── mappers/             # Entity <-> Domain mappers
│   │   └── persistence/         # TypeORM entities
│   └── <module>.module.ts       # NestJS module (last)
```

## Step-by-Step Guide

### 1. Design the Aggregate

Before writing code, define:
- What invariants must always be true?
- What state changes are valid?
- What events are emitted?

### 2. Create the Aggregate

```typescript
// src/modules/student/domain/student-aggregate.ts
import { AggregateRoot } from '../../../shared/entity/aggregate-root';
import { NumberId } from '../../../shared/entity/identifier';
import { Guard } from '../../../shared/guard/guard';

export class StudentId extends NumberId {
  static create(value: number): StudentId {
    return new StudentId({ value });
  }
}

export class StudentAggregate extends AggregateRoot {
  private _name: string;
  private _email: string;
  private _status: 'active' | 'inactive';

  constructor(id: number, name: string, email: string) {
    super(id);
    this._name = name;
    this._email = email;
    this._status = 'active';
  }

  get name(): string { return this._name; }
  get email(): string { return this._email; }
  get status(): string { return this._status; }

  deactivate(reason: string): void {
    Guard.againstEmpty(reason);
    this._status = 'inactive';
    this.addEvent(new StudentDeactivatedEvent(this.id, reason));
  }

  validateInvariants(): void {
    this.invariant(this._name.length > 0, 'STU-001', 'Name required');
    this.invariant(this._email.includes('@'), 'STU-002', 'Valid email required');
  }
}
```

### 3. Create Domain Events

```typescript
// src/modules/student/domain/student-deactivated.event.ts
import { DomainEventBase } from '../../../shared/domain-event/domain-event';

export class StudentDeactivatedEvent extends DomainEventBase {
  public readonly eventType = 'student.deactivated';

  constructor(
    eventId: string,
    public readonly reason: string,
  ) {
    super(eventId);
  }
}
```

### 4. Create Repository

```typescript
// src/modules/student/infrastructure/student.repository.ts
import { RepositoryBase } from '../../../kernel/infrastructure/repository-base';
import { StudentAggregate } from '../domain/student-aggregate';

export class StudentRepository extends RepositoryBase<StudentAggregate, any, number> {
  // Add domain-specific queries here
}
```

### 5. Create Command Handler

```typescript
// src/modules/student/application/commands/deactivate-student.handler.ts
import { ICommandHandler } from '../../../../kernel/application/command/command-handler';
import { Result } from '../../../../shared/result/result';

export class DeactivateStudentHandler implements ICommandHandler<DeactivateStudentCommand, void> {
  async execute(command: DeactivateStudentCommand): Promise<Result<void>> {
    const student = await this.repository.findById(command.studentId);
    if (!student) return Result.fail(new Error('Student not found'));

    student.deactivate(command.reason);
    await this.repository.save(student);
    return Result.ok(undefined);
  }
}
```

### 6. Write Tests

```typescript
// src/modules/student/domain/__tests__/student-aggregate.spec.ts
describe('StudentAggregate', () => {
  it('should deactivate with reason', () => {
    const student = new StudentAggregate(1, 'Alice', 'alice@test.com');
    student.deactivate('graduated');

    expect(student.status).toBe('inactive');
    expect(student.domainEvents).toHaveLength(1);
  });

  it('should validate invariants', () => {
    const student = new StudentAggregate(1, '', 'alice@test.com');
    expect(() => student.validateInvariants()).toThrow('Name required');
  });
});
```

## Key Patterns

### Result Monad
Always return `Result<T>` from handlers:
```typescript
return Result.ok(value);    // Success
return Result.fail(error);  // Failure
```

### Guard Clauses
Use `Guard` for preconditions:
```typescript
Guard.againstEmpty(name);
Guard.againstNull(email);
Guard.againstRange(age, 0, 150);
```

### Domain Events
Emit events during mutations:
```typescript
this.addEvent(new SomethingHappenedEvent(this.id, data));
```

### Invariants
Validate in `validateInvariants()`:
```typescript
this.invariant(this.name.length > 0, 'INV-001', 'Name required');
```

## Running Tests

```bash
# All tests
npx jest

# Specific module
npx jest "src/modules/student"

# Architecture enforcement
npx jest "src/architecture"

# Shared kernel only
npx jest "src/shared"
```
