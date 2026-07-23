/**
 * Shared Kernel — Framework-independent building blocks.
 *
 * Zero NestJS imports. All domain code depends on this.
 */

// Entity
export { BaseEntity, AggregateRoot, ValueObject, UniqueId, NumberId, StringId } from './entity';

// Domain Event
export type { DomainEvent, DomainEventBase, DomainEventHandler } from './domain-event';

// Specification
export type { ISpecification } from './specification';
export { CompositeSpecification, AndSpecification, OrSpecification, NotSpecification } from './specification';

// Exception
export { DomainException, InvariantViolationException, BusinessRuleViolationException } from './exception';

// Result
export { Result } from './result';

// Guard
export { Guard } from './guard';

// Clock
export type { IClock } from './clock';
export { SystemClock } from './clock';

// Identifier
export type { IUuid } from './identifier';
export { SystemUuid } from './identifier';
