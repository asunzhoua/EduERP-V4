import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonAttendanceController } from './lesson-attendance.controller';
import { LessonAttendanceService } from './lesson-attendance.service';
import { LessonAttendanceRepository } from './lesson-attendance.repository';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { ReminderModule } from '@modules/reminder/reminder.module';
import { ContractModule } from '@modules/teaching/contract/contract.module';
import { LessonModule } from '@modules/teaching/lesson/lesson.module';
import { EnrollmentModule } from '@modules/teaching/enrollment/enrollment.module';
import { PointsModule } from '@modules/points/points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LessonAttendanceEntity, ClassEntity, CourseEntity]),
    ReminderModule,
    ContractModule,
    forwardRef(() => LessonModule),
    EnrollmentModule,
    PointsModule,
  ],
  controllers: [LessonAttendanceController],
  providers: [LessonAttendanceService, LessonAttendanceRepository],
  exports: [LessonAttendanceService, LessonAttendanceRepository],
})
export class LessonAttendanceModule {}
