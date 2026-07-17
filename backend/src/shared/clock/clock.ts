/**
 * IClock — Interface for time.
 *
 * Framework-independent. Zero NestJS imports.
 * Enables deterministic testing with FakeClock.
 */

export interface IClock {
  /**
   * Get current time.
   */
  now(): Date;
}
