import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seeds/seed.service';
import { PoolMonitorService } from '../modules/database/pool-monitor.service';
import { User } from '../modules/identity/entities/user.entity';
import { Role } from '../modules/identity/entities/role.entity';
import { Permission } from '../modules/identity/entities/permission.entity';
import { UserRole } from '../modules/identity/entities/user-role.entity';
import { RolePermission } from '../modules/identity/entities/role-permission.entity';
import { LoginLog } from '../modules/identity/entities/login-log.entity';
import { ClassEntity } from '../modules/teaching/class/class.entity';
import { Student } from '../modules/student/entities/student.entity';
import { StudentParent } from '../modules/student/entities/student-parent.entity';
import { ContractEntity } from '../modules/teaching/contract/contract.entity';
import { EnrollmentEntity } from '../modules/teaching/enrollment/enrollment.entity';
import { TeacherAssignmentEntity } from '../modules/teaching/teacher-assignment/teacher-assignment.entity';
import { CourseEntity } from '../modules/teaching/course/course.entity';
import { LessonEntity } from '../modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '../modules/teaching/lesson-attendance/lesson-attendance.entity';
import { LessonExceptionEntity } from '../modules/teaching/lesson/lesson-exception/lesson-exception.entity';
import { LessonExceptionLogEntity } from '../modules/teaching/lesson/lesson-exception/lesson-exception-log.entity';
import { LessonRescheduleEntity } from '../modules/teaching/lesson/lesson-exception/lesson-reschedule.entity';
import { LessonExceptionAttachmentEntity } from '../modules/teaching/lesson/lesson-exception/lesson-exception-attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, Role, Permission, UserRole, RolePermission, LoginLog,
      ClassEntity, Student, StudentParent, ContractEntity, EnrollmentEntity, TeacherAssignmentEntity,
      CourseEntity, LessonEntity, LessonAttendanceEntity,
      LessonExceptionEntity, LessonExceptionLogEntity, LessonRescheduleEntity, LessonExceptionAttachmentEntity,
    ]),
  ],
  providers: [SeedService, PoolMonitorService],
  exports: [SeedService, PoolMonitorService],
})
export class DatabaseModule {}
