import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonAttendanceController } from './lesson-attendance.controller';
import { LessonAttendanceService } from './lesson-attendance.service';
import { LessonAttendanceRepository } from './lesson-attendance.repository';
import { LessonAttendanceEntity } from './lesson-attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LessonAttendanceEntity])],
  controllers: [LessonAttendanceController],
  providers: [LessonAttendanceService, LessonAttendanceRepository],
  exports: [LessonAttendanceService, LessonAttendanceRepository],
})
export class LessonAttendanceModule {}
