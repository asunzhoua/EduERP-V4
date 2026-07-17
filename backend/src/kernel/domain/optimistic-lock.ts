/**
 * OptimisticLock — Version-based concurrency control.
 *
 * Framework-independent. Zero NestJS imports.
 * Prevents lost updates by checking version on save.
 */

import { DomainException } from '../../shared/exception/domain.exception';

export class OptimisticLockException extends DomainException {
  constructor(entityType: string, entityId: number | string, expectedVersion: number, actualVersion: number) {
    super(
      `${entityType} ${entityId} has been modified by another user. Expected version ${expectedVersion}, found ${actualVersion}.`,
      'OPTIMISTIC_LOCK',
      { entityType, entityId, expectedVersion, actualVersion },
    );
  }
}

export class OptimisticLock {
  /**
   * Check that version matches before save.
   * Throws OptimisticLockException if version doesn't match.
   */
  static check(
    entityType: string,
    entityId: number | string,
    expectedVersion: number,
    actualVersion: number,
  ): void {
    if (expectedVersion !== actualVersion) {
      throw new OptimisticLockException(entityType, entityId, expectedVersion, actualVersion);
    }
  }
}
