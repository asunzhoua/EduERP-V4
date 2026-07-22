import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseModule } from './course/course.module';
import { ClassModule } from './class/class.module';
import { ContractModule } from './contract/contract.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { LessonModule } from './lesson/lesson.module';
import { TeacherAssignmentModule } from './teacher-assignment/teacher-assignment.module';
import { LessonAttendanceModule } from './lesson-attendance/lesson-attendance.module';
import { LessonChangeRequestModule } from './lesson-change-request/lesson-change-request.module';
import { ClassEntity } from './class/class.entity';
import { LessonEntity } from './lesson/lesson.entity';
import { LessonAttendanceEntity } from './lesson-attendance/lesson-attendance.entity';
import { TeacherAssignmentEntity } from './teacher-assignment/teacher-assignment.entity';
import { TeacherDashboardController } from './teacher-dashboard/teacher-dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClassEntity, LessonEntity, LessonAttendanceEntity, TeacherAssignmentEntity]),
    CourseModule,
    ClassModule,
    ContractModule,
    EnrollmentModule,
    LessonModule,
    TeacherAssignmentModule,
    LessonAttendanceModule,
    LessonChangeRequestModule,
  ],
  controllers: [TeacherDashboardController],
  exports: [
    CourseModule,
    ClassModule,
    ContractModule,
    EnrollmentModule,
    LessonModule,
    TeacherAssignmentModule,
    LessonAttendanceModule,
    LessonChangeRequestModule,
  ],
})
export class TeachingModule {}
