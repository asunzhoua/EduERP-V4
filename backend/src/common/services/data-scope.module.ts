import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataScopeService } from './data-scope.service';
import { TeacherAssignmentEntity } from '@modules/teaching/teacher-assignment/teacher-assignment.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Student } from '@modules/student/entities/student.entity';
import { StudentParent } from '@modules/student/entities/student-parent.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherAssignmentEntity,
      ClassEntity,
      CourseEntity,
      Student,
      StudentParent,
      EnrollmentEntity,
    ]),
  ],
  providers: [DataScopeService],
  exports: [DataScopeService],
})
export class DataScopeModule {}
