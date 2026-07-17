import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherAssignmentController } from './teacher-assignment.controller';
import { TeacherAssignmentService } from './teacher-assignment.service';
import { TeacherAssignmentRepository } from './teacher-assignment.repository';
import { TeacherAssignmentEntity } from './teacher-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherAssignmentEntity])],
  controllers: [TeacherAssignmentController],
  providers: [TeacherAssignmentService, TeacherAssignmentRepository],
  exports: [TeacherAssignmentService, TeacherAssignmentRepository],
})
export class TeacherAssignmentModule {}
