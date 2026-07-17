/**
 * EventCollection — Collects domain events during aggregate mutations.
 *
 * Framework-independent. Zero NestJS imports.
 * Events are collected during aggregate lifecycle, then committed on save.
 */

import { DomainEvent } from '../../shared/domain-event/domain-event';

export class EventCollection {
  private _events: DomainEvent[] = [];

  /**
   * Add an event to the collection.
   */
  add(event: DomainEvent): void {
    this._events.push(event);
  }

  /**
   * Get all collected events.
   */
  get events(): readonly DomainEvent[] {
    return [...this._events];
  }

  /**
   * Get the number of collected events.
   */
  get count(): number {
    return this._events.length;
  }

  /**
   * Check if there are any events.
   */
  get hasEvents(): boolean {
    return this._events.length > 0;
  }

  /**
   * Clear all events (called after commit).
   */
  clear(): void {
    this._events = [];
  }

  /**
   * Get all events and clear the collection.
   */
  drain(): DomainEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }
}
