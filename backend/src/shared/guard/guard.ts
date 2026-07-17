/**
 * Guard — Precondition checks for method arguments.
 *
 * Framework-independent. Zero NestJS imports.
 * Throws DomainException on violation.
 */

import { DomainException } from '../exception/domain.exception';

export class Guard {
  /**
   * Check that value is not null or undefined.
   */
  static againstNull(value: unknown, fieldName: string): void {
    if (value === null || value === undefined) {
      throw new DomainException(
        `${fieldName} must not be null or undefined`,
        'GUARD_NULL',
        { fieldName },
      );
    }
  }

  /**
   * Check that string is not empty.
   */
  static againstEmpty(value: string, fieldName: string): void {
    if (!value || value.trim().length === 0) {
      throw new DomainException(
        `${fieldName} must not be empty`,
        'GUARD_EMPTY',
        { fieldName },
      );
    }
  }

  /**
   * Check that number is within range.
   */
  static againstRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
  ): void {
    if (value < min || value > max) {
      throw new DomainException(
        `${fieldName} must be between ${min} and ${max}`,
        'GUARD_RANGE',
        { fieldName, value, min, max },
      );
    }
  }

  /**
   * Check that value is one of allowed values.
   */
  static againstOneOf<T>(value: T, allowed: T[], fieldName: string): void {
    if (!allowed.includes(value)) {
      throw new DomainException(
        `${fieldName} must be one of: ${allowed.join(', ')}`,
        'GUARD_ONE_OF',
        { fieldName, value, allowed },
      );
    }
  }

  /**
   * Check that two values are equal.
   */
  static againstNotEqual(
    value: unknown,
    other: unknown,
    fieldName: string,
  ): void {
    if (value === other) {
      throw new DomainException(
        `${fieldName} must not equal the other value`,
        'GUARD_NOT_EQUAL',
        { fieldName },
      );
    }
  }

  /**
   * Check that array is not empty.
   */
  static againstEmptyArray<T>(value: T[], fieldName: string): void {
    if (!Array.isArray(value) || value.length === 0) {
      throw new DomainException(
        `${fieldName} must not be empty`,
        'GUARD_EMPTY_ARRAY',
        { fieldName },
      );
    }
  }
}
