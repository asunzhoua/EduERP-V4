import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginLog } from '@modules/identity/entities/login-log.entity';
import { Student } from '@modules/student/entities/student.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { TeacherAssignmentEntity } from '@modules/teaching/teacher-assignment/teacher-assignment.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoginLog,
      Student,
      EnrollmentEntity,
      LessonEntity,
      LessonAttendanceEntity,
      TeacherAssignmentEntity,
      CourseEntity,
      ClassEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
