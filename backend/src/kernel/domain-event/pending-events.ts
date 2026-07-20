/**
 * PendingEvents — Collects events during aggregate lifecycle.
 *
 * Framework-independent. Zero NestJS imports.
 * Events are collected during aggregate mutations, then committed or rolled back.
 */

import { DomainEvent } from '../../shared/domain-event/domain-event';

export class PendingEvents {
  private _events: DomainEvent[] = [];
  private _committed = false;

  /**
   * Add an event to the pending collection.
   */
  add(event: DomainEvent): void {
    if (this._committed) {
      throw new Error('Cannot add events after commit');
    }
    this._events.push(event);
  }

  /**
   * Get all pending events.
   */
  get events(): readonly DomainEvent[] {
    return [...this._events];
  }

  /**
   * Check if there are pending events.
   */
  get hasEvents(): boolean {
    return this._events.length > 0;
  }

  /**
   * Mark as committed. Prevents further additions.
   */
  commit(): void {
    this._committed = true;
  }

  /**
   * Rollback. Clears events and allows new additions.
   */
  rollback(): void {
    this._events = [];
    this._committed = false;
  }

  /**
   * Get all events and mark as committed.
   */
  drain(): DomainEvent[] {
    const events = [...this._events];
    this._events = [];
    this._committed = true;
    return events;
  }

  /**
   * Check if already committed.
   */
  get isCommitted(): boolean {
    return this._committed;
  }
}
