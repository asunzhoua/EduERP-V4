/**
 * IUuid — Interface for UUID generation.
 *
 * Framework-independent. Zero NestJS imports.
 * Enables deterministic testing with FakeUuid.
 */

export interface IUuid {
  /**
   * Generate a new UUID v4.
   */
  generate(): string;
}
