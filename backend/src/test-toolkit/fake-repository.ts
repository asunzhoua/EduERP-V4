/**
 * FakeRepository — In-memory repository for testing.
 *
 * Framework-independent. Zero NestJS imports.
 * Stores aggregates in a Map for fast lookups.
 */

import { AggregateRoot } from '../shared/entity/aggregate-root';

export class FakeRepository<TAggregate extends AggregateRoot> {
  private _store = new Map<number, TAggregate>();

  async findById(id: number): Promise<TAggregate | null> {
    return this._store.get(id) ?? null;
  }

  async findAll(): Promise<TAggregate[]> {
    return Array.from(this._store.values());
  }

  async save(aggregate: TAggregate): Promise<void> {
    this._store.set(aggregate.id, aggregate);
  }

  async delete(id: number): Promise<void> {
    this._store.delete(id);
  }

  async exists(id: number): Promise<boolean> {
    return this._store.has(id);
  }

  async count(): Promise<number> {
    return this._store.size;
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
