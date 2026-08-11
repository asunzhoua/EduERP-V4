/**
 * FakeRepository — In-memory repository for testing.
 *
 * Framework-independent. Zero NestJS imports.
 * Stores aggregates in a Map for fast lookups.
 */

import { AggregateRoot } from '../shared/entity/aggregate-root';

export class FakeRepository<TAggregate extends AggregateRoot> {
  private _store = new Map<number, TAggregate>();

  findById(id: number): Promise<TAggregate | null> {
    return Promise.resolve(this._store.get(id) ?? null);
  }

  findAll(): Promise<TAggregate[]> {
    return Promise.resolve(Array.from(this._store.values()));
  }

  save(aggregate: TAggregate): Promise<void> {
    this._store.set(aggregate.id, aggregate);
    return Promise.resolve();
  }

  delete(id: number): Promise<void> {
    this._store.delete(id);
    return Promise.resolve();
  }

  exists(id: number): Promise<boolean> {
    return Promise.resolve(this._store.has(id));
  }

  count(): Promise<number> {
    return Promise.resolve(this._store.size);
  }

  /**
   * Clear all data. Use in beforeEach.
   */
  clear(): void {
    this._store.clear();
  }

  /**
   * Get all stored aggregates. For test assertions.
   */
  get all(): TAggregate[] {
    return Array.from(this._store.values());
  }
}
