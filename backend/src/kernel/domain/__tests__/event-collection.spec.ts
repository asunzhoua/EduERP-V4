import { EventCollection } from '../event-collection';
import { DomainEventBase } from '../../../shared/domain-event/domain-event';

class TestEvent extends DomainEventBase {
  public readonly eventType = 'test.event';
  constructor(eventId: string) {
    super(eventId);
  }
}

describe('EventCollection', () => {
  let collection: EventCollection;

  beforeEach(() => {
    collection = new EventCollection();
  });

  describe('add()', () => {
    it('should add event to collection', () => {
      const event = new TestEvent('evt-1');

      collection.add(event);

      expect(collection.count).toBe(1);
      expect(collection.events[0]).toBe(event);
    });

    it('should add multiple events', () => {
      const e1 = new TestEvent('evt-1');
      const e2 = new TestEvent('evt-2');

      collection.add(e1);
      collection.add(e2);

      expect(collection.count).toBe(2);
    });
  });

  describe('events getter', () => {
    it('should return a copy', () => {
      collection.add(new TestEvent('evt-1'));

      const events1 = collection.events;
      const events2 = collection.events;

      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2);
    });
  });

  describe('hasEvents', () => {
    it('should return false when empty', () => {
      expect(collection.hasEvents).toBe(false);
    });

    it('should return true when has events', () => {
      collection.add(new TestEvent('evt-1'));

      expect(collection.hasEvents).toBe(true);
    });
  });

  describe('clear()', () => {
    it('should clear all events', () => {
      collection.add(new TestEvent('evt-1'));
      collection.add(new TestEvent('evt-2'));

      collection.clear();

      expect(collection.count).toBe(0);
      expect(collection.hasEvents).toBe(false);
    });
  });

  describe('drain()', () => {
    it('should return all events and clear', () => {
      const e1 = new TestEvent('evt-1');
      const e2 = new TestEvent('evt-2');
      collection.add(e1);
      collection.add(e2);

      const drained = collection.drain();

      expect(drained).toHaveLength(2);
      expect(drained[0]).toBe(e1);
      expect(drained[1]).toBe(e2);
      expect(collection.count).toBe(0);
    });
  });
});
