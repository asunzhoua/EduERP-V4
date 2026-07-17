/**
 * ValueObject — Immutable object defined by its attributes, not identity.
 *
 * Framework-independent. Zero NestJS imports.
 * Two ValueObjects with the same attributes are equal.
 */

export abstract class ValueObject<T> {
  protected readonly _value: T;

  protected constructor(value: T) {
    this._value = Object.freeze(value);
  }

  get value(): T {
    return this._value;
  }

  /**
   * Structural equality. Two ValueObjects are equal if their values are equal.
   */
  equals(other: ValueObject<T> | null | undefined): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return JSON.stringify(this._value) === JSON.stringify(other._value);
  }

  /**
   * String representation for debugging.
   */
  toString(): string {
    return JSON.stringify(this._value);
  }
}
