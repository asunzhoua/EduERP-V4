/**
 * ApplicationService — Base class for application services.
 *
 * Framework-independent. Zero NestJS imports.
 * Provides common functionality: UnitOfWork integration, transaction management.
 */

import { Result } from '../../shared/result/result';
import { IUnitOfWork } from './unit-of-work';

export abstract class ApplicationService {
  constructor(protected readonly unitOfWork: IUnitOfWork) {}

  /**
   * Execute an operation within a transaction.
   */
  protected async executeInTransaction<T>(
    operation: () => Promise<T>,
  ): Promise<Result<T>> {
    const tx = await this.unitOfWork.begin();
    try {
      const result = await operation();
      await tx.commit();
      return Result.ok(result);
    } catch (error) {
      await tx.rollback();
      return Result.fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
