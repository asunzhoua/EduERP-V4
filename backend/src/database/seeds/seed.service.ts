import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../modules/identity/entities/user.entity';
import { Role } from '../../modules/identity/entities/role.entity';
import { Permission } from '../../modules/identity/entities/permission.entity';
import { UserRole } from '../../modules/identity/entities/user-role.entity';
import { RolePermission } from '../../modules/identity/entities/role-permission.entity';
import { AppLogger } from '@utils/logger';

@Injectable()
export class SeedService {
  private logger = new AppLogger();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async seed() {
    await this.seedRoles();
    await this.seedPermissions();
    await this.seedAdminUser();
    this.logger.log('Seed data initialization complete', 'Seed');
  }

  private async seedRoles() {
    const roles = ['SuperAdmin', 'Admin', 'Teacher', 'Parent'];
    for (const name of roles) {
      const exists = await this.roleRepository.findOne({ where: { name } });
      if (!exists) {
        await this.roleRepository.save({ name, description: `${name} role` });
        this.logger.log(`Role created: ${name}`, 'Seed');
      }
    }
  }

  private async seedPermissions() {
    const permissions = [
      { code: 'user:read', name: '查看用户', module: 'user', action: 'read' },
      { code: 'user:create', name: '创建用户', module: 'user', action: 'create' },
      { code: 'user:update', name: '修改用户', module: 'user', action: 'update' },
      { code: 'student:read', name: '查看学生', module: 'student', action: 'read' },
      { code: 'student:create', name: '创建学生', module: 'student', action: 'create' },
      { code: 'student:update', name: '修改学生', module: 'student', action: 'update' },
      { code: 'lesson:read', name: '查看课程', module: 'lesson', action: 'read' },
      { code: 'lesson:checkin', name: '签到', module: 'lesson', action: 'checkin' },
      { code: 'salary:read', name: '查看工资', module: 'salary', action: 'read' },
      { code: 'finance:read', name: '查看财务', module: 'finance', action: 'read' },
      { code: 'dashboard:read', name: '查看仪表盘', module: 'dashboard', action: 'read' },
      { code: 'system:config', name: '系统配置', module: 'system', action: 'config' },
    ];

    for (const perm of permissions) {
      const exists = await this.permissionRepository.findOne({ where: { code: perm.code } });
      if (!exists) {
        await this.permissionRepository.save(perm);
        this.logger.log(`Permission created: ${perm.code}`, 'Seed');
      }
    }
  }

  private async seedAdminUser() {
    const adminUsername = 'admin';
    const exists = await this.userRepository.findOne({ where: { username: adminUsername } });
    if (exists) {
      this.logger.log('Admin user already exists, skipping', 'Seed');
      return;
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = this.userRepository.create({
      username: adminUsername,
      password: hashedPassword,
      name: '系统管理员',
      mobile: '13800000000',
      role: 'SuperAdmin',
      status: 1,
      campusId: 1,
    });
    const savedAdmin = await this.userRepository.save(admin);

    const superAdminRole = await this.roleRepository.findOne({ where: { name: 'SuperAdmin' } });
    if (superAdminRole) {
      await this.userRoleRepository.save({
        userId: savedAdmin.id,
        roleId: superAdminRole.id,
      });
    }

    this.logger.log('Admin user created (username: admin, password: admin123)', 'Seed');
  }
}
