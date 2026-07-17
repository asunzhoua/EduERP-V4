import { DomainEventBase } from '../domain-event/domain-event';

class TestEvent extends DomainEventBase {
  public readonly eventType = 'test.event';
  public readonly aggregateId: number;

  constructor(eventId: string, aggregateId: number, occurredOn?: Date) {
    super(eventId, occurredOn);
    this.aggregateId = aggregateId;
  }
}

describe('DomainEventBase', () => {
  it('should create event with required fields', () => {
    const event = new TestEvent('evt-1', 123);

    expect(event.eventId).toBe('evt-1');
    expect(event.occurredOn).toBeInstanceOf(Date);
    expect(event.eventType).toBe('test.event');
    expect(event.aggregateId).toBe(123);
  });

  it('should use provided occurredOn', () => {
    const date = new Date('2026-01-01');
    const event = new TestEvent('evt-1', 123, date);

    expect(event.occurredOn).toBe(date);
  });
});
