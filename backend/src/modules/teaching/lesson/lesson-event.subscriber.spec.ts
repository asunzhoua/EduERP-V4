import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EventBusService } from '@events/event-bus.service';
import { LessonEventSubscriber } from './lesson-event.subscriber';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('LessonEventSubscriber', () => {
  let subscriber: LessonEventSubscriber;
  let eventBus: jest.Mocked<EventBusService>;
  let logSpy: jest.SpyInstance;

  const handlers = new Map<string, (payload: any) => void>();

  beforeEach(async () => {
    handlers.clear();

    const mockEventBus = {
      subscribe: jest.fn((eventName: string, handler: (payload: any) => void) => {
        handlers.set(eventName, handler);
      }),
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonEventSubscriber,
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    subscriber = module.get<LessonEventSubscriber>(LessonEventSubscriber);
    eventBus = module.get(EventBusService);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should subscribe to lesson.completed', () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'lesson.completed',
      expect.any(Function),
    );
  });

  it('should subscribe to lesson.finished', () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'lesson.finished',
      expect.any(Function),
    );
  });

  describe('lesson.completed handler', () => {
    it('should log completion details', () => {
      const handler = handlers.get('lesson.completed');
      expect(handler).toBeDefined();

      handler!({
        lessonId: 1,
        classCode: 'CLS-001',
        teacherId: 100,
        durationMinutes: 90,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[lesson.completed]'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lesson 1 completed'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('class=CLS-001'),
      );
    });
  });

  describe('lesson.finished handler', () => {
    it('should log finish details', () => {
      const handler = handlers.get('lesson.finished');
      expect(handler).toBeDefined();

      handler!({
        lessonId: 2,
        classCode: 'CLS-002',
        confirmedBy: 5001,
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[lesson.finished]'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lesson 2 finished'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('confirmedBy=5001'),
      );
    });
  });
});
