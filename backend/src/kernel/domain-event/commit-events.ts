/**
 * CommitEvents — Commits pending events to the dispatcher.
 *
 * Framework-independent. Zero NestJS imports.
 * Used by AggregateRuntime to dispatch events after save.
 */

import { DomainEvent } from '../../shared/domain-event/domain-event';
import { IDomainEventPublisher } from './domain-event-publisher';

export class CommitEvents {
  constructor(private readonly publisher: IDomainEventPublisher) {}

  /**
   * Commit all events to the publisher.
   */
  async commit(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.publisher.publishAll(events);
  }
}
