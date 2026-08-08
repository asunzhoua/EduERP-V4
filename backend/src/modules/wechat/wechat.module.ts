import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WechatSubscribe } from './entities/wechat-subscribe.entity';
import { WechatMessageLog } from './entities/wechat-message-log.entity';
import { WechatTokenStore } from './wechat-token.store';
import { WechatService } from './wechat.service';
import { WechatSubscribeService } from './wechat-subscribe.service';
import { WechatNotificationService } from './wechat-notification.service';
import { WechatNotificationSubscriber } from './wechat-notification.subscriber';
import { WechatController } from './wechat.controller';
import { User } from '../identity/entities/user.entity';
import { Student } from '../student/entities/student.entity';
import { StudentParent } from '../student/entities/student-parent.entity';
import { LessonAttendanceEntity } from '../teaching/lesson-attendance/lesson-attendance.entity';
import { CourseEntity } from '../teaching/course/course.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WechatSubscribe,
      WechatMessageLog,
      User,
      Student,
      StudentParent,
      LessonAttendanceEntity,
      CourseEntity,
      EnrollmentEntity,
    ]),
    EventEmitterModule,
  ],
  controllers: [WechatController],
  providers: [
    WechatTokenStore,
    WechatService,
    WechatSubscribeService,
    WechatNotificationService,
    WechatNotificationSubscriber,
  ],
  exports: [WechatService, WechatSubscribeService, WechatNotificationService],
})
export class WechatModule {}
