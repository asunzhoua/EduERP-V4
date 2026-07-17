/**
 * IMapper — Interface for entity ↔ domain object mapping.
 *
 * Framework-independent. Zero NestJS imports.
 * Maps between persistence entities and domain objects.
 */

export interface IMapper<TDomain, TPersistence> {
  /**
   * Convert a persistence entity to a domain object.
   */
  toDomain(entity: TPersistence): TDomain;

  /**
   * Convert a domain object to a persistence entity.
   */
  toPersistence(domain: TDomain): TPersistence;
}
