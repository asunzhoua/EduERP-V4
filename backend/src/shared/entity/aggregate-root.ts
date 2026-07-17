/**
 * AggregateRoot — Base class for all aggregate roots.
 *
 * Framework-independent. Zero NestJS imports.
 * Collects domain events during mutations, validates invariants.
 */

import { BaseEntity } from './entity.base';
import { DomainEvent } from '../domain-event/domain-event';
import { InvariantViolationException } from '../exception/domain.exception';

export abstract class AggregateRoot extends BaseEntity {
  private _domainEvents: DomainEvent[] = [];

  constructor(
    id: number,
    createdBy: number,
    createdAt?: Date,
  ) {
    super(id, createdBy, createdAt);
  }

  /**
   * Get uncommitted domain events.
   */
  get domainEvents(): readonly DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Add a domain event to be dispatched on save.
   */
  protected addEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Clear all domain events (called after dispatch).
   */
  clearEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Validate all invariants. Override in subclasses.
   * Throw InvariantViolationException on failure.
   */
  validateInvariants(): void {
    // Default: no invariants. Subclasses override.
  }

  /**
   * Check invariant and throw if violated.
   */
  protected invariant(
    condition: boolean,
    invariantId: string,
    message: string,
  ): void {
    if (!condition) {
      throw new InvariantViolationException(message, invariantId);
    }
  }
}
