/**
 * Shared Kernel — Framework-independent building blocks.
 *
 * Zero NestJS imports. All domain code depends on this.
 */

// Entity
export { BaseEntity, AggregateRoot, ValueObject, UniqueId, NumberId, StringId } from './entity';

// Domain Event
export { DomainEvent, DomainEventBase, DomainEventHandler } from './domain-event';

// Specification
export { ISpecification, CompositeSpecification, AndSpecification, OrSpecification, NotSpecification } from './specification';

// Exception
export { DomainException, InvariantViolationException, BusinessRuleViolationException } from './exception';

// Result
export { Result } from './result';

// Guard
export { Guard } from './guard';

// Clock
export { IClock, SystemClock } from './clock';

// Identifier
export { IUuid, SystemUuid } from './identifier';
