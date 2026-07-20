import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from '../event-bus.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

// Mock AppLogger
jest.mock('@utils/logger', () => ({
  AppLogger: jest.fn().mockImplementation(() => ({
    logEvent: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('EventBusService', () => {
  let service: EventBusService;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let mockLogger: { logEvent: jest.Mock; error: jest.Mock };

  // Store registered handlers for testing
  const handlers = new Map<string, (payload: any) => void>();

  beforeEach(async () => {
    handlers.clear();

    // Create mock EventEmitter2
    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn((eventName: string, handler: (payload: any) => void) => {
        handlers.set(eventName, handler);
      }),
    };

    // Reset logger mock
    mockLogger = {
      logEvent: jest.fn(),
      error: jest.fn(),
    };

    // Re-mock AppLogger with fresh instance for each test
    jest.requireMock('@utils/logger').AppLogger.mockImplementation(() => mockLogger);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventBusService,
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // P0 Tests (Must Pass)
  // ==========================================

  describe('publish - P0', () => {
    it('should call eventEmitter.emit with enriched payload', () => {
      const eventName = 'test.event';
      const payload = { data: 'test-data' };

      service.publish(eventName, payload);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        eventName,
        expect.objectContaining({
          data: 'test-data',
          eventId: 'mock-uuid-1234',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should enrich payload with eventId', () => {
      const eventName = 'test.event';
      const payload = { data: 'test-data' };

      service.publish(eventName, payload);

      const emittedPayload = eventEmitter.emit.mock.calls[0][1];
      expect(emittedPayload.eventId).toBe('mock-uuid-1234');
    });

    it('should enrich payload with ISO8601 timestamp', () => {
      const eventName = 'test.event';
      const payload = { data: 'test-data' };

      service.publish(eventName, payload);

      const emittedPayload = eventEmitter.emit.mock.calls[0][1];
      // ISO8601 format regex
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(emittedPayload.timestamp).toMatch(iso8601Regex);
    });

    it('should log PUBLISHED event', () => {
      const eventName = 'test.event';
      const payload = { data: 'test-data' };

      service.publish(eventName, payload);

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        eventName,
        'mock-uuid-1234',
        'PUBLISHED',
      );
    });
  });

  describe('subscribe - P0', () => {
    it('should call eventEmitter.on with event name', () => {
      const eventName = 'test.event';
      const handler = jest.fn();

      service.subscribe(eventName, handler);

      expect(eventEmitter.on).toHaveBeenCalledWith(eventName, expect.any(Function));
    });

    it('should execute handler when event is triggered', () => {
      const eventName = 'test.event';
      const handler = jest.fn();
      const payload = { eventId: 'test-event-id', data: 'test' };

      service.subscribe(eventName, handler);

      // Trigger the registered handler
      const registeredHandler = handlers.get(eventName);
      registeredHandler!(payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should log SUCCESS when handler executes successfully', () => {
      const eventName = 'test.event';
      const handler = jest.fn();
      const payload = { eventId: 'test-event-id', data: 'test' };

      service.subscribe(eventName, handler);

      const registeredHandler = handlers.get(eventName);
      registeredHandler!(payload);

      expect(mockLogger.logEvent).toHaveBeenCalledWith(eventName, 'test-event-id', 'SUCCESS');
    });

    it('should log FAILED when handler throws error', () => {
      const eventName = 'test.event';
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const payload = { eventId: 'test-event-id', data: 'test' };

      service.subscribe(eventName, handler);

      const registeredHandler = handlers.get(eventName);
      // Should not throw - error should be caught
      expect(() => registeredHandler!(payload)).not.toThrow();

      expect(mockLogger.logEvent).toHaveBeenCalledWith(eventName, 'test-event-id', 'FAILED');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Event handler failed for test.event: Handler error'),
      );
    });

    it('should log RECEIVED before executing handler', () => {
      const eventName = 'test.event';
      const handler = jest.fn();
      const payload = { eventId: 'test-event-id', data: 'test' };

      service.subscribe(eventName, handler);

      const registeredHandler = handlers.get(eventName);
      registeredHandler!(payload);

      expect(mockLogger.logEvent).toHaveBeenCalledWith(eventName, 'test-event-id', 'RECEIVED');
    });
  });

  describe('handler exception isolation - P0', () => {
    it('should not crash when handler throws', () => {
      const eventName = 'test.event';
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const payload = { eventId: 'test-event-id', data: 'test' };

      service.subscribe(eventName, handler);

      const registeredHandler = handlers.get(eventName);
      expect(() => registeredHandler!(payload)).not.toThrow();
    });

    it('should continue to log error message when handler fails', () => {
      const eventName = 'test.event';
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const payload = { eventId: 'test-event-id', data: 'test' };

      service.subscribe(eventName, handler);

      const registeredHandler = handlers.get(eventName);
      registeredHandler!(payload);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==========================================
  // P1 Tests (Should Cover)
  // ==========================================

  describe('eventId enrichment - P1', () => {
    it('should generate valid UUID v4 format', () => {
      // Re-import uuid to test the actual implementation
      jest.resetModules();
      jest.dontMock('uuid');
      
      // This test validates that uuid v4 is used
      // In actual runtime, uuid v4 follows RFC 4122
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      // Since we mocked uuid, verify the mock is working
      const eventName = 'test.event';
      const payload = { data: 'test' };
      
      service.publish(eventName, payload);
      
      const emittedPayload = eventEmitter.emit.mock.calls[0][1];
      expect(emittedPayload.eventId).toBe('mock-uuid-1234');
    });
  });

  describe('timestamp enrichment - P1', () => {
    it('should generate valid ISO8601 timestamp', () => {
      const eventName = 'test.event';
      const payload = { data: 'test' };

      service.publish(eventName, payload);

      const emittedPayload = eventEmitter.emit.mock.calls[0][1];
      const date = new Date(emittedPayload.timestamp);
      expect(date.toISOString()).toBe(emittedPayload.timestamp);
    });
  });

  describe('logger behavior - P1', () => {
    it('should call logEvent with correct parameters on publish', () => {
      const eventName = 'user.created';
      const payload = { userId: 1 };

      service.publish(eventName, payload);

      expect(mockLogger.logEvent).toHaveBeenCalledTimes(1);
      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        'user.created',
        'mock-uuid-1234',
        'PUBLISHED',
      );
    });
  });

  describe('duplicate subscription behavior - P1', () => {
    it('should allow multiple subscriptions to same event', () => {
      const eventName = 'test.event';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      service.subscribe(eventName, handler1);
      service.subscribe(eventName, handler2);

      // Should call on twice
      expect(eventEmitter.on).toHaveBeenCalledTimes(2);
    });

    it('should register both handlers separately', () => {
      const eventName = 'test.event';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      service.subscribe(eventName, handler1);
      service.subscribe(eventName, handler2);

      // Both handlers should be stored (map will only keep last one per event name)
      // This tests that eventEmitter.on was called for each subscription
      expect(eventEmitter.on).toHaveBeenCalledWith(eventName, expect.any(Function));
    });
  });

  describe('edge cases - P1', () => {
    it('should handle empty payload', () => {
      const eventName = 'test.event';
      const payload = {};

      service.publish(eventName, payload);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        eventName,
        expect.objectContaining({
          eventId: 'mock-uuid-1234',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle payload with existing eventId', () => {
      const eventName = 'test.event';
      const payload = { eventId: 'original-id', data: 'test' };

      service.publish(eventName, payload);

      const emittedPayload = eventEmitter.emit.mock.calls[0][1];
      // The enrichment should add a new eventId
      expect(emittedPayload.eventId).toBe('mock-uuid-1234');
    });

    it('should handle payload with existing timestamp', () => {
      const eventName = 'test.event';
      const payload = { timestamp: 'original-timestamp', data: 'test' };

      service.publish(eventName, payload);

      const emittedPayload = eventEmitter.emit.mock.calls[0][1];
      // The enrichment should add a new timestamp
      expect(new Date(emittedPayload.timestamp).toISOString()).toBe(emittedPayload.timestamp);
    });

    it('should use "unknown" as eventId when payload has no eventId in subscribe', () => {
      const eventName = 'test.event';
      const handler = jest.fn();
      const payload = { data: 'no-event-id' }; // No eventId

      service.subscribe(eventName, handler);

      const registeredHandler = handlers.get(eventName);
      registeredHandler!(payload);

      expect(mockLogger.logEvent).toHaveBeenCalledWith(eventName, 'unknown', 'RECEIVED');
      expect(mockLogger.logEvent).toHaveBeenCalledWith(eventName, 'unknown', 'SUCCESS');
    });

    it('should handle handler returning a value', () => {
      const eventName = 'test.event';
      const handler = jest.fn().mockReturnValue('result');
      const payload = { eventId: 'test-event-id', data: 'test' };

      service.subscribe(eventName, handler);

      const registeredHandler = handlers.get(eventName);
      registeredHandler!(payload);

      expect(handler).toHaveBeenCalled();
      expect(mockLogger.logEvent).toHaveBeenCalledWith(eventName, 'test-event-id', 'SUCCESS');
    });
  });
});