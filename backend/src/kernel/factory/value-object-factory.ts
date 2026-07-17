/**
 * IValueObjectFactory — Interface for creating value objects.
 *
 * Framework-independent. Zero NestJS imports.
 * Factories encapsulate value object creation with validation.
 */

import { ValueObject } from '../../shared/entity/value-object';

export interface IValueObjectFactory<T extends ValueObject<any>> {
  /**
   * Create a value object from raw values.
   */
  create(...args: any[]): T;

  /**
   * Try to create a value object, returning null if invalid.
   */
  tryCreate(...args: any[]): T | null;
}
