import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { LessonRepository } from './lesson.repository';
import { LessonEntity } from './lesson.entity';
import { LessonEventSubscriber } from './lesson-event.subscriber';
import { EventBusModule } from '@events/event-bus.module';
import { ClassModule } from '../class/class.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { LessonAttendanceModule } from '../lesson-attendance/lesson-attendance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LessonEntity]),
    EventBusModule,
    ClassModule,
    EnrollmentModule,
    LessonAttendanceModule,
  ],
  controllers: [LessonController],
  providers: [LessonService, LessonRepository, LessonEventSubscriber],
  exports: [LessonService, LessonRepository],
})
export class LessonModule {}
