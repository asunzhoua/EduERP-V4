/**
 * IPersistenceAdapter — Interface for persistence adapters.
 *
 * Framework-independent. Zero NestJS imports.
 * Abstracts data access operations for repositories.
 */

export interface IPersistenceAdapter<TDomain, TPersistence, TId> {
  /**
   * Find an entity by ID.
   */
  findById(id: TId): Promise<TPersistence | null>;

  /**
   * Find all entities matching a filter.
   */
  findAll(filter?: Record<string, any>): Promise<TPersistence[]>;

  /**
   * Save an entity (create or update).
   */
  save(entity: TPersistence): Promise<TPersistence>;

  /**
   * Delete an entity by ID.
   */
  delete(id: TId): Promise<void>;

  /**
   * Check if an entity exists by ID.
   */
  exists(id: TId): Promise<boolean>;

  /**
   * Count entities matching a filter.
   */
  count(filter?: Record<string, any>): Promise<number>;
}
