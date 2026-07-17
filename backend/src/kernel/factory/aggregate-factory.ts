/**
 * IAggregateFactory — Interface for creating aggregates.
 *
 * Framework-independent. Zero NestJS imports.
 * Factories encapsulate complex aggregate creation logic.
 */

import { AggregateRoot } from '../../shared/entity/aggregate-root';

export interface IAggregateFactory<T extends AggregateRoot> {
  /**
   * Create a new aggregate instance.
   */
  create(...args: any[]): T;

  /**
   * Reconstitute an aggregate from persistence.
   */
  reconstitute(data: Record<string, any>): T;
}
