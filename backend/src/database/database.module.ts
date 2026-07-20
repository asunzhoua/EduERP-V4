import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seeds/seed.service';
import { User } from '../modules/identity/entities/user.entity';
import { Role } from '../modules/identity/entities/role.entity';
import { Permission } from '../modules/identity/entities/permission.entity';
import { UserRole } from '../modules/identity/entities/user-role.entity';
import { RolePermission } from '../modules/identity/entities/role-permission.entity';
import { LoginLog } from '../modules/identity/entities/login-log.entity';
import { ClassEntity } from '../modules/teaching/class/class.entity';
import { Student } from '../modules/student/entities/student.entity';
import { ContractEntity } from '../modules/teaching/contract/contract.entity';
import { EnrollmentEntity } from '../modules/teaching/enrollment/enrollment.entity';
import { TeacherAssignmentEntity } from '../modules/teaching/teacher-assignment/teacher-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, Role, Permission, UserRole, RolePermission, LoginLog,
      ClassEntity, Student, ContractEntity, EnrollmentEntity, TeacherAssignmentEntity,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class DatabaseModule {}
