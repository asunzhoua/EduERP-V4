/**
 * UniqueId — Typed identifier value object.
 *
 * Framework-independent. Zero NestJS imports.
 * Every aggregate root has a UniqueId that is type-safe.
 */

import { ValueObject } from './value-object';

export abstract class UniqueId<T> extends ValueObject<{ value: T }> {
  protected constructor(value: T) {
    super({ value });
  }

  // @ts-ignore: intentional override - UniqueId unwraps value from ValueObject<{value: T}>
  get value(): T {
    return this._value.value;
  }
}

/**
 * NumberId — For entities with numeric primary keys (TypeORM bigint).
 */
export class NumberId extends UniqueId<number> {
  constructor(value: number) {
    super(value);
  }

  static create(value: number): NumberId {
    return new NumberId(value);
  }
}

/**
 * StringId — For entities with string business keys (codes).
 */
export class StringId extends UniqueId<string> {
  constructor(value: string) {
    super(value);
  }

  static create(value: string): StringId {
    return new StringId(value);
  }
}
