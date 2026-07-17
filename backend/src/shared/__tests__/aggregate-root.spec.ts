import { AggregateRoot } from '../entity/aggregate-root';
import { DomainEventBase } from '../domain-event/domain-event';
import { InvariantViolationException } from '../exception/domain.exception';

class TestEvent extends DomainEventBase {
  public readonly eventType = 'test.event';
  constructor(eventId: string) {
    super(eventId);
  }
}

class TestAggregate extends AggregateRoot {
  private _status: string = 'DRAFT';

  constructor(id: number, createdBy: number) {
    super(id, createdBy);
  }

  get status(): string {
    return this._status;
  }

  activate(): void {
    this._status = 'ACTIVE';
    this.addEvent(new TestEvent('evt-1'));
  }

  validateInvariants(): void {
    this.invariant(
      this._status !== 'INVALID',
      'TEST-001',
      'Status must not be INVALID',
    );
  }
}

describe('AggregateRoot', () => {
  it('should create aggregate', () => {
    const aggregate = new TestAggregate(1, 100);

    expect(aggregate.id).toBe(1);
    expect(aggregate.status).toBe('DRAFT');
    expect(aggregate.domainEvents).toHaveLength(0);
  });

  describe('addEvent()', () => {
    it('should collect events', () => {
      const aggregate = new TestAggregate(1, 100);

      aggregate.activate();

      expect(aggregate.domainEvents).toHaveLength(1);
      expect(aggregate.domainEvents[0].eventType).toBe('test.event');
    });
  });

  describe('clearEvents()', () => {
    it('should clear all events', () => {
      const aggregate = new TestAggregate(1, 100);
      aggregate.activate();

      aggregate.clearEvents();

      expect(aggregate.domainEvents).toHaveLength(0);
    });
  });

  describe('validateInvariants()', () => {
    it('should pass for valid state', () => {
      const aggregate = new TestAggregate(1, 100);

      expect(() => aggregate.validateInvariants()).not.toThrow();
    });
  });

  describe('invariant()', () => {
    it('should throw InvariantViolationException when condition is false', () => {
      const aggregate = new TestAggregate(1, 100);

      expect(() => {
        aggregate.invariant(false, 'INV-001', 'Test invariant');
      }).toThrow(InvariantViolationException);
    });

    it('should not throw when condition is true', () => {
      const aggregate = new TestAggregate(1, 100);

      expect(() => {
        aggregate.invariant(true, 'INV-001', 'Test invariant');
      }).not.toThrow();
    });
  });

  describe('domainEvents readonly', () => {
    it('should return a copy, not the original array', () => {
      const aggregate = new TestAggregate(1, 100);
      aggregate.activate();

      const events1 = aggregate.domainEvents;
      const events2 = aggregate.domainEvents;

      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2);
    });
  });
});
