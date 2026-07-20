/**
 * IDomainEventPublisher — Interface for publishing domain events.
 *
 * Framework-independent. Zero NestJS imports.
 * Implementations can use NestJS EventBus, RabbitMQ, Kafka, etc.
 */

import { DomainEvent } from '../../shared/domain-event/domain-event';

export interface IDomainEventPublisher {
  /**
   * Publish a single event.
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Publish multiple events.
   */
  publishAll(events: DomainEvent[]): Promise<void>;
}
