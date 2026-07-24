import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from '@events/event-bus.service';

interface LessonCompletedPayload {
  lessonId: number;
  classCode: string;
  teacherId: number;
  durationMinutes: number;
}

interface LessonFinishedPayload {
  lessonId: number;
  classCode: string;
  confirmedBy: number;
}

interface LessonCancelledPayload {
  lessonId: number;
  classCode: string;
  teacherId: number;
  cancelledBy: number;
  cancelledReason: string;
}

/**
 * Subscribes to lesson lifecycle events and logs them.
 * Future subscribers (Finance, Dashboard) follow the same pattern
 * but live in their own domain modules.
 */
@Injectable()
export class LessonEventSubscriber {
  private readonly logger = new Logger(LessonEventSubscriber.name);

  constructor(private readonly eventBus: EventBusService) {
    this.eventBus.subscribe(
      'lesson.completed',
      (payload: LessonCompletedPayload) => {
        this.logger.log(
          `[lesson.completed] Lesson ${payload.lessonId} completed. ` +
            `class=${payload.classCode}, teacher=${payload.teacherId}, ` +
            `duration=${payload.durationMinutes}min`,
        );
      },
    );

    this.eventBus.subscribe(
      'lesson.finished',
      (payload: LessonFinishedPayload) => {
        this.logger.log(
          `[lesson.finished] Lesson ${payload.lessonId} finished. ` +
            `class=${payload.classCode}, confirmedBy=${payload.confirmedBy}`,
        );
      },
    );

    this.eventBus.subscribe(
      'lesson.cancelled',
      (payload: LessonCancelledPayload) => {
        this.logger.log(
          `[lesson.cancelled] Lesson ${payload.lessonId} cancelled. ` +
            `class=${payload.classCode}, teacher=${payload.teacherId}, ` +
            `reason=${payload.cancelledReason}, cancelledBy=${payload.cancelledBy}`,
        );
      },
    );
  }
}
