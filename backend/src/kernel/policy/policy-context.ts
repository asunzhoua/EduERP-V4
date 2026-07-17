/**
 * PolicyContext — Context passed to policy evaluation.
 *
 * Framework-independent. Zero NestJS imports.
 * Provides a typed context bag for policy evaluation.
 */

export class PolicyContext<TData = Record<string, unknown>> {
  private readonly _data: TData;

  constructor(data: TData) {
    this._data = Object.freeze({ ...data });
  }

  get data(): TData {
    return this._data;
  }

  /**
   * Get a value from the context by key.
   */
  get<K extends keyof TData>(key: K): TData[K] {
    return this._data[key];
  }

  /**
   * Check if a key exists in the context.
   */
  has<K extends keyof TData>(key: K): boolean {
    return key in this._data;
  }
}
