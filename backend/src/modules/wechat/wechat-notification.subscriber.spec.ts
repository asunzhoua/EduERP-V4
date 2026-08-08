import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { WechatNotificationSubscriber } from './wechat-notification.subscriber';
import { WechatNotificationService } from './wechat-notification.service';

describe('WechatNotificationSubscriber', () => {
  let emitter: EventEmitter2;
  let notificationService: jest.Mocked<
    Pick<
      WechatNotificationService,
      | 'dispatchLessonCompleted'
      | 'dispatchLessonFinished'
      | 'dispatchLessonCancelled'
    >
  >;

  beforeEach(async () => {
    notificationService = {
      dispatchLessonCompleted: jest.fn().mockResolvedValue(undefined),
      dispatchLessonFinished: jest.fn().mockResolvedValue(undefined),
      dispatchLessonCancelled: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        WechatNotificationSubscriber,
        { provide: WechatNotificationService, useValue: notificationService },
      ],
    }).compile();

    emitter = module.get<EventEmitter2>(EventEmitter2);
    await module.init();
  });

  it('should dispatch on lesson.completed', async () => {
    const payload = { lessonId: 10, classCode: 'C001', courseCode: 'MATH01' };

    await emitter.emitAsync('lesson.completed', payload);

    expect(notificationService.dispatchLessonCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 10 }),
    );
    expect(notificationService.dispatchLessonFinished).not.toHaveBeenCalled();
  });

  it('should dispatch on lesson.finished', async () => {
    const payload = { lessonId: 11, classCode: 'C001', courseCode: 'MATH01' };

    await emitter.emitAsync('lesson.finished', payload);

    expect(notificationService.dispatchLessonFinished).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 11 }),
    );
  });

  it('should dispatch on lesson.cancelled', async () => {
    const payload = { lessonId: 12, classCode: 'C001', courseCode: 'MATH01' };

    await emitter.emitAsync('lesson.cancelled', payload);

    expect(notificationService.dispatchLessonCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 12 }),
    );
  });

  it('should swallow dispatch errors and not throw to event bus', async () => {
    notificationService.dispatchLessonCompleted.mockRejectedValue(
      new Error('db down'),
    );

    const payload = { lessonId: 10, classCode: 'C001' };

    await expect(
      emitter.emitAsync('lesson.completed', payload),
    ).resolves.toBeDefined();
  });

  it('should ignore payload without lessonId', async () => {
    await emitter.emitAsync('lesson.completed', {});

    expect(notificationService.dispatchLessonCompleted).not.toHaveBeenCalled();
  });
});
