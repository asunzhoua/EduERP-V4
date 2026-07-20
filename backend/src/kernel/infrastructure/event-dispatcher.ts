/**
 * IEventDispatcher — Interface for dispatching domain events.
 *
 * Framework-independent. Zero NestJS imports.
 * Implementations can use NestJS EventBus, RabbitMQ, Kafka, etc.
 */

import { DomainEvent } from '../../shared/domain-event/domain-event';

export interface IEventDispatcher {
  /**
   * Dispatch a single event.
   */
  dispatch(event: DomainEvent): Promise<void>;

  /**
   * Dispatch multiple events.
   */
  dispatchAll(events: DomainEvent[]): Promise<void>;
}
