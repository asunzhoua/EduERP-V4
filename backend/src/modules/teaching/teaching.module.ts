import { Module } from '@nestjs/common';
import { CourseModule } from './course/course.module';
import { ClassModule } from './class/class.module';
import { ContractModule } from './contract/contract.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { LessonModule } from './lesson/lesson.module';
import { TeacherAssignmentModule } from './teacher-assignment/teacher-assignment.module';
import { LessonAttendanceModule } from './lesson-attendance/lesson-attendance.module';
import { LessonChangeRequestModule } from './lesson-change-request/lesson-change-request.module';

@Module({
  imports: [
    CourseModule,
    ClassModule,
    ContractModule,
    EnrollmentModule,
    LessonModule,
    TeacherAssignmentModule,
    LessonAttendanceModule,
    LessonChangeRequestModule,
  ],
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
