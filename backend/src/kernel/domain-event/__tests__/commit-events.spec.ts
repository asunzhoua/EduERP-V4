import { DomainEvent } from '../../../shared/domain-event/domain-event';
import { IDomainEventPublisher } from '../domain-event-publisher';
import { CommitEvents } from '../commit-events';

class TestEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventType = 'test.event';

  constructor(eventId: string) {
    this.eventId = eventId;
    this.occurredOn = new Date();
  }
}

describe('CommitEvents', () => {
  let publishedEvents: DomainEvent[];
  let mockPublisher: IDomainEventPublisher;
  let commitEvents: CommitEvents;

  beforeEach(() => {
    publishedEvents = [];
    mockPublisher = {
      publish: async (event: DomainEvent) => {
        publishedEvents.push(event);
      },
      publishAll: async (events: DomainEvent[]) => {
        publishedEvents.push(...events);
      },
    };
    commitEvents = new CommitEvents(mockPublisher);
  });

  describe('commit()', () => {
    it('should publish all events to publisher', async () => {
      const e1 = new TestEvent('evt-1');
      const e2 = new TestEvent('evt-2');

      await commitEvents.commit([e1, e2]);

      expect(publishedEvents).toHaveLength(2);
      expect(publishedEvents[0]).toBe(e1);
      expect(publishedEvents[1]).toBe(e2);
    });

    it('should do nothing when events array is empty', async () => {
      await commitEvents.commit([]);

      expect(publishedEvents).toHaveLength(0);
    });

    it('should publish single event', async () => {
      const e1 = new TestEvent('evt-1');

      await commitEvents.commit([e1]);

      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0]).toBe(e1);
    });

    it('should publish via publishAll on the publisher', async () => {
      const publishAllSpy = jest.spyOn(mockPublisher, 'publishAll');
      const events = [new TestEvent('evt-1'), new TestEvent('evt-2')];

      await commitEvents.commit(events);

      expect(publishAllSpy).toHaveBeenCalledWith(events);
    });
  });
});
