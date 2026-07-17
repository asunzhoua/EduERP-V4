/**
 * Result<T> — Monadic error handling.
 *
 * Framework-independent. Zero NestJS imports.
 * Returns Result.ok(value) on success, Result.fail(error) on failure.
 * No exceptions thrown in business logic.
 */

export class Result<T> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  public readonly _value: T | null;
  public readonly _error: Error | null;

  private constructor(isSuccess: boolean, value: T | null, error: Error | null) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._value = value;
    this._error = error;
  }

  /**
   * Get the value. Throws if result is a failure.
   */
  get value(): T {
    if (this.isFailure) {
      throw new Error('Cannot get value from a failed result');
    }
    return this._value as T;
  }

  /**
   * Get the error. Throws if result is a success.
   */
  get error(): Error {
    if (this.isSuccess) {
      throw new Error('Cannot get error from a successful result');
    }
    return this._error as Error;
  }

  /**
   * Create a successful result.
   */
  static ok<U>(value: U): Result<U> {
    return new Result<U>(true, value, null);
  }

  /**
   * Create a failed result.
   */
  static fail<U>(error: Error): Result<U> {
    return new Result<U>(false, null, error);
  }

  /**
   * Combine multiple results. Returns first failure or all successes.
   */
  static combine(results: Result<unknown>[]): Result<void> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail(result.error);
      }
    }
    return Result.ok(undefined);
  }

  /**
   * Map the value if success.
   */
  map<U>(fn: (value: T) => U): Result<U> {
    if (this.isSuccess) {
      return Result.ok(fn(this.value));
    }
    return Result.fail(this.error);
  }

  /**
   * FlatMap (chain) if success.
   */
  flatMap<U>(fn: (value: T) => Result<U>): Result<U> {
    if (this.isSuccess) {
      return fn(this.value);
    }
    return Result.fail(this.error);
  }
}
