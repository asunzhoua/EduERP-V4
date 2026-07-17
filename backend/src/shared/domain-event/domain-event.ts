/**
 * DomainEvent — Something that happened in the domain.
 *
 * Framework-independent. Zero NestJS imports.
 * Events are immutable records of something that happened.
 */

export interface DomainEvent {
  /**
   * Unique event identifier.
   */
  readonly eventId: string;

  /**
   * When the event occurred.
   */
  readonly occurredOn: Date;

  /**
   * Event type name (e.g., 'lesson.completed').
   */
  readonly eventType: string;
}

/**
 * Base class for domain events with common fields.
 */
export abstract class DomainEventBase implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public abstract readonly eventType: string;

  constructor(eventId: string, occurredOn?: Date) {
    this.eventId = eventId;
    this.occurredOn = occurredOn ?? new Date();
  }
}
