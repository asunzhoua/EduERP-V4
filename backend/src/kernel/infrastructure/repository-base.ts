/**
 * RepositoryBase — Base repository with common operations.
 *
 * Framework-independent. Zero NestJS imports.
 * Provides standard CRUD operations for aggregates.
 */

import { IPersistenceAdapter } from './persistence-adapter';
import { IMapper } from './mapper-base';

export abstract class RepositoryBase<TDomain, TPersistence, TId> {
  constructor(
    protected readonly adapter: IPersistenceAdapter<TDomain, TPersistence, TId>,
    protected readonly mapper: IMapper<TDomain, TPersistence>,
  ) {}

  /**
   * Find a domain object by ID.
   */
  async findById(id: TId): Promise<TDomain | null> {
    const entity = await this.adapter.findById(id);
    return entity ? this.mapper.toDomain(entity) : null;
  }

  /**
   * Find all domain objects matching a filter.
   */
  async findAll(filter?: Record<string, any>): Promise<TDomain[]> {
    const entities = await this.adapter.findAll(filter);
    return entities.map((e) => this.mapper.toDomain(e));
  }

  /**
   * Save a domain object (create or update).
   */
  async save(domain: TDomain): Promise<void> {
    const entity = this.mapper.toPersistence(domain);
    await this.adapter.save(entity);
  }

  /**
   * Delete a domain object by ID.
   */
  async delete(id: TId): Promise<void> {
    await this.adapter.delete(id);
  }

  /**
   * Check if a domain object exists by ID.
   */
  async exists(id: TId): Promise<boolean> {
    return this.adapter.exists(id);
  }

  /**
   * Count domain objects matching a filter.
   */
  async count(filter?: Record<string, any>): Promise<number> {
    return this.adapter.count(filter);
  }
}
