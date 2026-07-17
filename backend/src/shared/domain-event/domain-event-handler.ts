/**
 * DomainEventHandler — Handles domain events.
 *
 * Framework-independent. Zero NestJS imports.
 * Each handler processes one specific event type.
 */

import { DomainEvent } from './domain-event';

export interface DomainEventHandler<TEvent extends DomainEvent = DomainEvent> {
  /**
   * Handle the event.
   */
  handle(event: TEvent): Promise<void>;
}
