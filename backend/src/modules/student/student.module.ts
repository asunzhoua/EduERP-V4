import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { StudentController } from './student.controller';
import { StudentService } from './services/student.service';
import { StudentCodeGeneratorService } from './services/student-code-generator.service';
import { StudentRepository } from './student.repository';
import { Student } from './entities/student.entity';
import { StudentParent } from './entities/student-parent.entity';
import { StudentAuditLog } from './entities/student-audit-log.entity';
import { ImportHistory } from './entities/import-history.entity';
import { ImportService } from '@utils/services/import.service';
import { ContractModule } from '../teaching/contract/contract.module';
import { LessonAttendanceModule } from '../teaching/lesson-attendance/lesson-attendance.module';
import { LessonEntity } from '../teaching/lesson/lesson.entity';
import { User } from '../identity/entities/user.entity';
import { EnrollmentEntity } from '../teaching/enrollment/enrollment.entity';
import { TeacherAssignmentEntity } from '../teaching/teacher-assignment/teacher-assignment.entity';
import { ClassEntity } from '../teaching/class/class.entity';
import { CourseEntity } from '../teaching/course/course.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, StudentParent, StudentAuditLog, ImportHistory, LessonEntity, User, EnrollmentEntity, TeacherAssignmentEntity, ClassEntity, CourseEntity]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    ContractModule,
    LessonAttendanceModule,
  ],
  controllers: [StudentController],
  providers: [
    StudentService,
    StudentCodeGeneratorService,
    StudentRepository,
    ImportService,
  ],
  exports: [StudentService, StudentRepository],
})
export class StudentModule {}
