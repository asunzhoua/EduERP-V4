import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventBusModule } from '@events/event-bus.module';
import { CourseModule } from './course/course.module';
import { ClassModule } from './class/class.module';
import { ContractModule } from './contract/contract.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { LessonModule } from './lesson/lesson.module';
import { TeacherAssignmentModule } from './teacher-assignment/teacher-assignment.module';
import { LessonAttendanceModule } from './lesson-attendance/lesson-attendance.module';
import { LessonChangeRequestModule } from './lesson-change-request/lesson-change-request.module';
import { LeaveRequestModule } from './leave-request/leave-request.module';
import { SuspendRequestModule } from './suspend-request/suspend-request.module';
import { TeacherModule } from './teacher/teacher.module';
import { LessonExceptionService } from './lesson/lesson-exception/lesson-exception.service';
import { LessonExceptionController } from './lesson/lesson-exception/lesson-exception.controller';
import { ClassEntity } from './class/class.entity';
import { LessonEntity } from './lesson/lesson.entity';
import { LessonAttendanceEntity } from './lesson-attendance/lesson-attendance.entity';
import { TeacherAssignmentEntity } from './teacher-assignment/teacher-assignment.entity';
import { LessonExceptionEntity } from './lesson/lesson-exception/lesson-exception.entity';
import { LessonExceptionLogEntity } from './lesson/lesson-exception/lesson-exception-log.entity';
import { LessonRescheduleEntity } from './lesson/lesson-exception/lesson-reschedule.entity';
import { LessonExceptionAttachmentEntity } from './lesson/lesson-exception/lesson-exception-attachment.entity';
import { TeacherDashboardController } from './teacher-dashboard/teacher-dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassEntity,
      LessonEntity,
      LessonAttendanceEntity,
      TeacherAssignmentEntity,
      LessonExceptionEntity,
      LessonExceptionLogEntity,
      LessonRescheduleEntity,
      LessonExceptionAttachmentEntity,
    ]),
    EventBusModule,
    CourseModule,
    ClassModule,
    ContractModule,
    EnrollmentModule,
    LessonModule,
    TeacherAssignmentModule,
    LessonAttendanceModule,
    LessonChangeRequestModule,
    LeaveRequestModule,
    SuspendRequestModule,
    TeacherModule,
  ],
  controllers: [TeacherDashboardController, LessonExceptionController],
  providers: [LessonExceptionService],
  exports: [
    CourseModule,
    ClassModule,
    ContractModule,
    EnrollmentModule,
    LessonModule,
    TeacherAssignmentModule,
    LessonAttendanceModule,
    LessonChangeRequestModule,
    LeaveRequestModule,
    SuspendRequestModule,
    LessonExceptionService,
  ],
})
export class TeachingModule {}
