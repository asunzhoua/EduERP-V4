/**
 * IUnitOfWork — Interface for unit of work pattern.
 *
 * Framework-independent. Zero NestJS imports.
 * Manages transaction boundaries and aggregate persistence.
 */

import { ITransaction } from './transaction';

export interface IUnitOfWork {
  /**
   * Begin a new transaction.
   */
  begin(): Promise<ITransaction>;

  /**
   * Check if a transaction is currently active.
   */
  get isActive(): boolean;
}
