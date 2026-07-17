/**
 * ITransaction — Interface for transactions.
 *
 * Framework-independent. Zero NestJS imports.
 * Represents a unit of work transaction boundary.
 */

export interface ITransaction {
  /**
   * Commit all changes in this transaction.
   */
  commit(): Promise<void>;

  /**
   * Rollback all changes in this transaction.
   */
  rollback(): Promise<void>;

  /**
   * Check if the transaction is still active (not committed or rolled back).
   */
  get isActive(): boolean;

  /**
   * Get the transaction isolation level.
   */
  get isolationLevel(): IsolationLevel;
}

/**
 * Transaction isolation levels.
 */
export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ_UNCOMMITTED',
  READ_COMMITTED = 'READ_COMMITTED',
  REPEATABLE_READ = 'REPEATABLE_READ',
  SERIALIZABLE = 'SERIALIZABLE',
}
