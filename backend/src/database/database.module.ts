import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seeds/seed.service';
import { User } from '../modules/identity/entities/user.entity';
import { Role } from '../modules/identity/entities/role.entity';
import { Permission } from '../modules/identity/entities/permission.entity';
import { UserRole } from '../modules/identity/entities/user-role.entity';
import { RolePermission } from '../modules/identity/entities/role-permission.entity';
import { LoginLog } from '../modules/identity/entities/login-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Permission, UserRole, RolePermission, LoginLog]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class DatabaseModule {}
