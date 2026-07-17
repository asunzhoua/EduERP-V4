/**
 * FakeUuid — Deterministic UUID generator for testing.
 *
 * Framework-independent. Zero NestJS imports.
 * Returns sequential UUIDs for predictable test assertions.
 */

import { IUuid } from '../shared/identifier/uuid';

export class FakeUuid implements IUuid {
  private _counter = 0;
  private _prefix: string;

  constructor(prefix: string = '00000000-0000-0000-0000') {
    this._prefix = prefix;
  }

  generate(): string {
    this._counter++;
    const hex = this._counter.toString(16).padStart(12, '0');
    return `${this._prefix}-${hex}`;
  }

  /**
   * Reset counter for deterministic tests.
   */
  reset(): void {
    this._counter = 0;
  }
}
