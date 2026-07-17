/**
 * AggregateRuntime — Manages aggregate lifecycle.
 *
 * Framework-independent. Zero NestJS imports.
 * Handles loading, saving, versioning, event collection, and invariant validation.
 */

import { AggregateRoot } from '../../shared/entity/aggregate-root';
import { DomainEvent } from '../../shared/domain-event/domain-event';
import { EventCollection } from './event-collection';
import { OptimisticLock, OptimisticLockException } from './optimistic-lock';
import { InvariantValidator } from './invariant-validator';
import { IEventDispatcher } from '../infrastructure/event-dispatcher';

/**
 * Interface for loading and saving aggregates.
 */
export interface IAggregateRepository<T extends AggregateRoot> {
  findById(id: number): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  nextId(): number;
}

/**
 * AggregateRuntime — Orchestrates aggregate operations.
 */
export class AggregateRuntime {
  private _eventDispatcher: IEventDispatcher | null = null;

  constructor(eventDispatcher?: IEventDispatcher) {
    this._eventDispatcher = eventDispatcher ?? null;
  }

  /**
   * Load an aggregate by id.
   */
  async load<T extends AggregateRoot>(
    repository: IAggregateRepository<T>,
    id: number,
  ): Promise<T | null> {
    return repository.findById(id);
  }

  /**
   * Save an aggregate with:
   * 1. Invariant validation
   * 2. Optimistic lock check
   * 3. Event collection
   * 4. Persistence
   * 5. Event dispatch
   */
  async save<T extends AggregateRoot>(
    repository: IAggregateRepository<T>,
    aggregate: T,
  ): Promise<void> {
    // 1. Validate invariants
    InvariantValidator.validateOrThrow(aggregate);

    // 2. Save to repository (handles version check)
    await repository.save(aggregate);

    // 3. Collect and dispatch events
    const events = this.collectEvents(aggregate);
    if (events.length > 0 && this._eventDispatcher) {
      await this._eventDispatcher.dispatchAll(events);
    }
  }

  /**
   * Create a new aggregate with a generated id.
   */
  create<T extends AggregateRoot>(
    factory: (id: number) => T,
    repository: IAggregateRepository<T>,
  ): T {
    const id = repository.nextId();
    return factory(id);
  }

  /**
   * Collect events from aggregate and clear them.
   */
  private collectEvents(aggregate: AggregateRoot): DomainEvent[] {
    const events = [...aggregate.domainEvents];
    aggregate.clearEvents();
    return events;
  }
}
