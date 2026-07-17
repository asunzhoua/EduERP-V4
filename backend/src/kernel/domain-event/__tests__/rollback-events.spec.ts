import { DomainEventBase } from '../../../shared/domain-event/domain-event';
import { PendingEvents } from '../pending-events';
import { RollbackEvents } from '../rollback-events';

class TestEvent extends DomainEventBase {
  public readonly eventType = 'test.event';
  constructor(eventId: string) {
    super(eventId);
  }
}

describe('RollbackEvents', () => {
  let rollback: RollbackEvents;

  beforeEach(() => {
    rollback = new RollbackEvents();
  });

  describe('rollback()', () => {
    it('should clear all pending events', () => {
      const pending = new PendingEvents();
      pending.add(new TestEvent('evt-1'));
      pending.add(new TestEvent('evt-2'));

      rollback.rollback(pending);

      expect(pending.hasEvents).toBe(false);
      expect(pending.events).toHaveLength(0);
    });

    it('should reset committed state', () => {
      const pending = new PendingEvents();
      pending.add(new TestEvent('evt-1'));
      pending.commit();

      rollback.rollback(pending);

      expect(pending.isCommitted).toBe(false);
    });

    it('should allow adding events after rollback', () => {
      const pending = new PendingEvents();
      pending.add(new TestEvent('evt-1'));
      pending.commit();

      rollback.rollback(pending);

      expect(() => pending.add(new TestEvent('evt-2'))).not.toThrow();
      expect(pending.hasEvents).toBe(true);
    });

    it('should handle rollback on empty pending events', () => {
      const pending = new PendingEvents();

      expect(() => rollback.rollback(pending)).not.toThrow();
      expect(pending.hasEvents).toBe(false);
    });

    it('should handle rollback on already committed events', () => {
      const pending = new PendingEvents();
      pending.add(new TestEvent('evt-1'));
      pending.commit();

      rollback.rollback(pending);

      expect(pending.hasEvents).toBe(false);
      expect(pending.isCommitted).toBe(false);
      expect(() => pending.add(new TestEvent('evt-3'))).not.toThrow();
    });
  });
});
