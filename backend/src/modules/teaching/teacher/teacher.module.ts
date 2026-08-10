import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { CourseEntity } from '../course/course.entity';
import { ClassEntity } from '../class/class.entity';
import { Student } from '@modules/student/entities/student.entity';
import { TeacherAssignmentEntity } from '../teacher-assignment/teacher-assignment.entity';
import { DataScopeModule } from '@common/services/data-scope.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseEntity,
      ClassEntity,
      Student,
      TeacherAssignmentEntity,
    ]),
    DataScopeModule,
  ],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}
