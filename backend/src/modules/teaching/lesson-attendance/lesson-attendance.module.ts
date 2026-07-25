import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonAttendanceController } from './lesson-attendance.controller';
import { LessonAttendanceService } from './lesson-attendance.service';
import { LessonAttendanceRepository } from './lesson-attendance.repository';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { ReminderModule } from '@modules/reminder/reminder.module';
import { ContractModule } from '@modules/teaching/contract/contract.module';
import { LessonModule } from '@modules/teaching/lesson/lesson.module';
import { EnrollmentModule } from '@modules/teaching/enrollment/enrollment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LessonAttendanceEntity]),
    ReminderModule,
    ContractModule,
    LessonModule,
    EnrollmentModule,
  ],
  controllers: [LessonAttendanceController],
  providers: [LessonAttendanceService, LessonAttendanceRepository],
  exports: [LessonAttendanceService, LessonAttendanceRepository],
})
export class LessonAttendanceModule {}
