import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  LessonLifecyclePayload,
  WechatNotificationService,
} from './wechat-notification.service';
import { AppLogger } from '@utils/logger';

/**
 * 薄订阅器：只做事件校验 + 调投递服务。所有回调 try/catch 不抛出，
 * 避免影响业务主流程（镜像 salary.listener）。
 */
@Injectable()
export class WechatNotificationSubscriber {
  private logger = new AppLogger();

  constructor(
    private readonly notificationService: WechatNotificationService,
  ) {}

  @OnEvent('lesson.completed')
  async handleLessonCompleted(
    payload: LessonLifecyclePayload & { actualStartTime: string | null },
  ): Promise<void> {
    if (!this.isValid(payload)) {
      return;
    }
    try {
      await this.notificationService.dispatchLessonCompleted(payload);
    } catch (error) {
      this.logger.error(
        `[WechatNotify] lesson.completed failed: ${this.errorMessage(error)}`,
      );
    }
  }

  @OnEvent('lesson.finished')
  async handleLessonFinished(
    payload: LessonLifecyclePayload & { confirmedAt: string },
  ): Promise<void> {
    if (!this.isValid(payload)) {
      return;
    }
    try {
      await this.notificationService.dispatchLessonFinished(payload);
    } catch (error) {
      this.logger.error(
        `[WechatNotify] lesson.finished failed: ${this.errorMessage(error)}`,
      );
    }
  }

  @OnEvent('lesson.cancelled')
  async handleLessonCancelled(
    payload: LessonLifecyclePayload & {
      cancelledReason: string | null;
      cancelledAt: string;
    },
  ): Promise<void> {
    if (!this.isValid(payload)) {
      return;
    }
    try {
      await this.notificationService.dispatchLessonCancelled(payload);
    } catch (error) {
      this.logger.error(
        `[WechatNotify] lesson.cancelled failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private isValid(
    payload: Partial<LessonLifecyclePayload> | null | undefined,
  ): boolean {
    return !!payload && typeof payload.lessonId === 'number';
  }
}
