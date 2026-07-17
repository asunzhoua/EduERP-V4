/**
 * RollbackEvents — Handles event rollback on failure.
 *
 * Framework-independent. Zero NestJS imports.
 * Discards pending events when aggregate save fails.
 */

import { PendingEvents } from './pending-events';

export class RollbackEvents {
  /**
   * Rollback pending events.
   */
  rollback(pendingEvents: PendingEvents): void {
    pendingEvents.rollback();
  }
}
