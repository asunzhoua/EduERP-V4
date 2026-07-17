/**
 * FakeClock — Controllable clock for deterministic testing.
 *
 * Framework-independent. Zero NestJS imports.
 * Use `set()` to control time in tests.
 */

import { IClock } from '../shared/clock/clock';

export class FakeClock implements IClock {
  private _now: Date;

  constructor(initialTime?: Date) {
    this._now = initialTime ?? new Date('2026-01-01T00:00:00Z');
  }

  now(): Date {
    return new Date(this._now.getTime());
  }

  /**
   * Set the clock to a specific time.
   */
  set(time: Date): void {
    this._now = new Date(time.getTime());
  }

  /**
   * Advance the clock by milliseconds.
   */
  advance(ms: number): void {
    this._now = new Date(this._now.getTime() + ms);
  }

  /**
   * Advance the clock by seconds.
   */
  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  /**
   * Advance the clock by minutes.
   */
  advanceMinutes(minutes: number): void {
    this.advanceSeconds(minutes * 60);
  }

  /**
   * Advance the clock by hours.
   */
  advanceHours(hours: number): void {
    this.advanceMinutes(hours * 60);
  }

  /**
   * Advance the clock by days.
   */
  advanceDays(days: number): void {
    this.advanceHours(days * 24);
  }
}
