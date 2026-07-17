import { DomainEventBase } from '../../../shared/domain-event/domain-event';
import { PendingEvents } from '../pending-events';

class TestEvent extends DomainEventBase {
  public readonly eventType = 'test.event';
  constructor(eventId: string) {
    super(eventId);
  }
}

describe('PendingEvents', () => {
  let pending: PendingEvents;

  beforeEach(() => {
    pending = new PendingEvents();
  });

  describe('add()', () => {
    it('should add event', () => {
      const event = new TestEvent('evt-1');

      pending.add(event);

      expect(pending.hasEvents).toBe(true);
      expect(pending.events).toHaveLength(1);
    });

    it('should throw after commit', () => {
      pending.commit();

      expect(() => pending.add(new TestEvent('evt-1'))).toThrow(
        'Cannot add events after commit',
      );
    });
  });

  describe('commit()', () => {
    it('should mark as committed', () => {
      pending.commit();

      expect(pending.isCommitted).toBe(true);
    });
  });

  describe('rollback()', () => {
    it('should clear events and allow new additions', () => {
      pending.add(new TestEvent('evt-1'));
      pending.commit();

      pending.rollback();

      expect(pending.hasEvents).toBe(false);
      expect(pending.isCommitted).toBe(false);
      expect(() => pending.add(new TestEvent('evt-2'))).not.toThrow();
    });
  });

  describe('drain()', () => {
    it('should return events and mark as committed', () => {
      const e1 = new TestEvent('evt-1');
      const e2 = new TestEvent('evt-2');
      pending.add(e1);
      pending.add(e2);

      const drained = pending.drain();

      expect(drained).toHaveLength(2);
      expect(drained[0]).toBe(e1);
      expect(drained[1]).toBe(e2);
      expect(pending.isCommitted).toBe(true);
      expect(pending.hasEvents).toBe(false);
    });
  });
});
