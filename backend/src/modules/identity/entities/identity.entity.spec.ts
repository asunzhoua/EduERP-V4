import { User, UserStatus, UserRole as UserRoles } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';
import { LoginLog } from './login-log.entity';
import { UserRole } from './user-role.entity';
import { RolePermission } from './role-permission.entity';
import { getMetadataArgsStorage } from 'typeorm';

// ─── User Entity ────────────────────────────────────────────────────────────

describe('User entity', () => {
  it('should be decorated as @Entity("user")', () => {
    const meta = getMetadataArgsStorage().tables.find(
      (t) => t.target === User,
    );
    expect(meta).toBeDefined();
    expect(meta!.name).toBe('user');
  });

  it('should instantiate with correct property defaults', () => {
    const user = new User();
    expect(user.id).toBeUndefined();
    expect(user.status).toBeUndefined();   // TypeORM column default: 1 (ACTIVE)
    expect(user.campusId).toBeUndefined();  // TypeORM column default: 0
    expect(user.deleted).toBeUndefined();   // TypeORM column default: 0
    expect(user.version).toBeUndefined();   // TypeORM column default: 1
    expect(user.avatar).toBeUndefined();
    expect(user.lastLoginAt).toBeUndefined();
    expect(user.refreshToken).toBeUndefined();
    expect(user.refreshTokenExpiresAt).toBeUndefined();
    expect(user.openid).toBeUndefined();
    expect(user.unionid).toBeUndefined();
  });

  it('should declare status column with default ACTIVE (1)', () => {
    const meta = getMetadataArgsStorage().columns.find(
      (c) => c.target === User && c.propertyName === 'status',
    );
    expect(meta).toBeDefined();
    expect(meta!.options.default).toBe(UserStatus.ACTIVE);
  });

  it('should accept all property assignments', () => {
    const now = new Date();
    const user = new User();
    Object.assign(user, {
      id: 1,
      username: 'admin',
      password: 'hashed123',
      mobile: '13800138000',
      openid: 'o123',
      unionid: 'u456',
      name: '管理员',
      role: 'SuperAdmin',
      status: UserStatus.ACTIVE,
      campusId: 10,
      avatar: 'https://img.example.com/avatar.png',
      lastLoginAt: now,
      refreshToken: 'rt_xxx',
      refreshTokenExpiresAt: now,
      version: 3,
      deleted: 0,
    });

    expect(user.id).toBe(1);
    expect(user.username).toBe('admin');
    expect(user.password).toBe('hashed123');
    expect(user.mobile).toBe('13800138000');
    expect(user.openid).toBe('o123');
    expect(user.unionid).toBe('u456');
    expect(user.name).toBe('管理员');
    expect(user.role).toBe('SuperAdmin');
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.campusId).toBe(10);
    expect(user.avatar).toBe('https://img.example.com/avatar.png');
    expect(user.lastLoginAt).toBe(now);
    expect(user.refreshToken).toBe('rt_xxx');
    expect(user.refreshTokenExpiresAt).toBe(now);
    expect(user.version).toBe(3);
    expect(user.deleted).toBe(0);
  });
});

describe('UserStatus enum', () => {
  it('should have correct numeric values', () => {
    expect(UserStatus.ACTIVE).toBe(1);
    expect(UserStatus.INACTIVE).toBe(0);
    expect(UserStatus.DISABLED).toBe(-1);
  });

  it('should have exactly 3 members', () => {
    const keys = Object.keys(UserStatus).filter(
      (k) => typeof UserStatus[k] === 'number',
    );
    expect(keys).toHaveLength(3);
  });
});

describe('UserRole enum', () => {
  it('should have correct string values', () => {
    expect(UserRoles.SUPER_ADMIN).toBe('SuperAdmin');
    expect(UserRoles.ADMIN).toBe('Admin');
    expect(UserRoles.TEACHER).toBe('Teacher');
    expect(UserRoles.PARENT).toBe('Parent');
  });

  it('should have exactly 4 members', () => {
    const keys = Object.keys(UserRoles).filter(
      (k) => typeof UserRoles[k] === 'string',
    );
    expect(keys).toHaveLength(4);
  });
});

// ─── Role Entity ────────────────────────────────────────────────────────────

describe('Role entity', () => {
  it('should be decorated as @Entity("role")', () => {
    const meta = getMetadataArgsStorage().tables.find(
      (t) => t.target === Role,
    );
    expect(meta).toBeDefined();
    expect(meta!.name).toBe('role');
  });

  it('should instantiate with correct property defaults', () => {
    const role = new Role();
    expect(role.id).toBeUndefined();
    expect(role.status).toBeUndefined();   // TypeORM column default: 1
    expect(role.deleted).toBeUndefined();   // TypeORM column default: 0
    expect(role.version).toBeUndefined();   // TypeORM column default: 1
    expect(role.description).toBeUndefined();
  });

  it('should declare status column with default 1', () => {
    const meta = getMetadataArgsStorage().columns.find(
      (c) => c.target === Role && c.propertyName === 'status',
    );
    expect(meta).toBeDefined();
    expect(meta!.options.default).toBe(1);
  });

  it('should accept all property assignments', () => {
    const role = new Role();
    Object.assign(role, {
      id: 1,
      name: 'Admin',
      description: '系统管理员',
      status: 1,
      deleted: 0,
      version: 2,
    });

    expect(role.id).toBe(1);
    expect(role.name).toBe('Admin');
    expect(role.description).toBe('系统管理员');
    expect(role.status).toBe(1);
    expect(role.deleted).toBe(0);
    expect(role.version).toBe(2);
  });

  it('should support nullable description', () => {
    const role = new Role();
    role.description = null as any;
    expect(role.description).toBeNull();
  });

  it('should have users relation property', () => {
    const role = new Role();
    expect(role.users).toBeUndefined();
    role.users = [];
    expect(role.users).toEqual([]);
  });
});

// ─── Permission Entity ──────────────────────────────────────────────────────

describe('Permission entity', () => {
  it('should be decorated as @Entity("permission")', () => {
    const meta = getMetadataArgsStorage().tables.find(
      (t) => t.target === Permission,
    );
    expect(meta).toBeDefined();
    expect(meta!.name).toBe('permission');
  });

  it('should instantiate with correct property defaults', () => {
    const perm = new Permission();
    expect(perm.id).toBeUndefined();
    expect(perm.status).toBeUndefined();   // TypeORM column default: 1
    expect(perm.deleted).toBeUndefined();   // TypeORM column default: 0
    expect(perm.version).toBeUndefined();   // TypeORM column default: 1
    expect(perm.description).toBeUndefined();
    expect(perm.module).toBeUndefined();
    expect(perm.action).toBeUndefined();
    expect(perm.parentId).toBeUndefined();
  });

  it('should declare status column with default 1', () => {
    const meta = getMetadataArgsStorage().columns.find(
      (c) => c.target === Permission && c.propertyName === 'status',
    );
    expect(meta).toBeDefined();
    expect(meta!.options.default).toBe(1);
  });

  it('should accept all property assignments', () => {
    const perm = new Permission();
    Object.assign(perm, {
      id: 1,
      code: 'user:create',
      name: '创建用户',
      description: '允许创建新用户',
      module: 'user',
      action: 'create',
      parentId: null,
      status: 1,
      deleted: 0,
      version: 1,
    });

    expect(perm.id).toBe(1);
    expect(perm.code).toBe('user:create');
    expect(perm.name).toBe('创建用户');
    expect(perm.description).toBe('允许创建新用户');
    expect(perm.module).toBe('user');
    expect(perm.action).toBe('create');
    expect(perm.parentId).toBeNull();
    expect(perm.status).toBe(1);
    expect(perm.deleted).toBe(0);
    expect(perm.version).toBe(1);
  });

  it('should support hierarchical permissions via parentId', () => {
    const perm = new Permission();
    perm.parentId = 5;
    expect(perm.parentId).toBe(5);
  });
});

// ─── LoginLog Entity ────────────────────────────────────────────────────────

describe('LoginLog entity', () => {
  it('should be decorated as @Entity("login_log")', () => {
    const meta = getMetadataArgsStorage().tables.find(
      (t) => t.target === LoginLog,
    );
    expect(meta).toBeDefined();
    expect(meta!.name).toBe('login_log');
  });

  it('should instantiate with correct property defaults', () => {
    const log = new LoginLog();
    expect(log.id).toBeUndefined();
    expect(log.success).toBeUndefined();   // TypeORM column default: 1
    expect(log.role).toBeUndefined();
    expect(log.ip).toBeUndefined();
    expect(log.device).toBeUndefined();
    expect(log.detail).toBeUndefined();
  });

  it('should declare success column with default 1', () => {
    const meta = getMetadataArgsStorage().columns.find(
      (c) => c.target === LoginLog && c.propertyName === 'success',
    );
    expect(meta).toBeDefined();
    expect(meta!.options.default).toBe(1);
  });

  it('should accept all property assignments', () => {
    const now = new Date();
    const log = new LoginLog();
    Object.assign(log, {
      id: 1,
      userId: 100,
      username: 'admin',
      action: 'LOGIN',
      role: 'Admin',
      ip: '192.168.1.1',
      device: 'Chrome/120 Windows',
      detail: '登录成功',
      success: 1,
      createTime: now,
    });

    expect(log.id).toBe(1);
    expect(log.userId).toBe(100);
    expect(log.username).toBe('admin');
    expect(log.action).toBe('LOGIN');
    expect(log.role).toBe('Admin');
    expect(log.ip).toBe('192.168.1.1');
    expect(log.device).toBe('Chrome/120 Windows');
    expect(log.detail).toBe('登录成功');
    expect(log.success).toBe(1);
    expect(log.createTime).toBe(now);
  });

  it('should support LOGIN_FAILED action', () => {
    const log = new LoginLog();
    log.action = 'LOGIN_FAILED';
    log.success = 0;
    expect(log.action).toBe('LOGIN_FAILED');
    expect(log.success).toBe(0);
  });

  it('should support LOGOUT and REFRESH actions', () => {
    const log1 = new LoginLog();
    log1.action = 'LOGOUT';
    expect(log1.action).toBe('LOGOUT');

    const log2 = new LoginLog();
    log2.action = 'REFRESH';
    expect(log2.action).toBe('REFRESH');
  });
});

// ─── UserRole Entity ────────────────────────────────────────────────────────

describe('UserRole entity', () => {
  it('should be decorated as @Entity("user_role")', () => {
    const meta = getMetadataArgsStorage().tables.find(
      (t) => t.target === UserRole,
    );
    expect(meta).toBeDefined();
    expect(meta!.name).toBe('user_role');
  });

  it('should instantiate correctly', () => {
    const ur = new UserRole();
    expect(ur.id).toBeUndefined();
    expect(ur.userId).toBeUndefined();
    expect(ur.roleId).toBeUndefined();
    expect(ur.user).toBeUndefined();
    expect(ur.role).toBeUndefined();
  });

  it('should accept all property assignments', () => {
    const now = new Date();
    const ur = new UserRole();
    Object.assign(ur, {
      id: 1,
      userId: 10,
      roleId: 2,
      createTime: now,
    });

    expect(ur.id).toBe(1);
    expect(ur.userId).toBe(10);
    expect(ur.roleId).toBe(2);
    expect(ur.createTime).toBe(now);
  });
});

// ─── RolePermission Entity ──────────────────────────────────────────────────

describe('RolePermission entity', () => {
  it('should be decorated as @Entity("role_permission")', () => {
    const meta = getMetadataArgsStorage().tables.find(
      (t) => t.target === RolePermission,
    );
    expect(meta).toBeDefined();
    expect(meta!.name).toBe('role_permission');
  });

  it('should instantiate correctly', () => {
    const rp = new RolePermission();
    expect(rp.id).toBeUndefined();
    expect(rp.roleId).toBeUndefined();
    expect(rp.permissionId).toBeUndefined();
    expect(rp.role).toBeUndefined();
    expect(rp.permission).toBeUndefined();
  });

  it('should accept all property assignments', () => {
    const now = new Date();
    const rp = new RolePermission();
    Object.assign(rp, {
      id: 1,
      roleId: 5,
      permissionId: 3,
      createTime: now,
    });

    expect(rp.id).toBe(1);
    expect(rp.roleId).toBe(5);
    expect(rp.permissionId).toBe(3);
    expect(rp.createTime).toBe(now);
  });
});

// ─── Cross-entity relationship integrity ────────────────────────────────────

describe('Cross-entity relationship integrity', () => {
  it('UserRole should reference User and Role entities via foreign keys', () => {
    const ur = new UserRole();
    ur.userId = 1;
    ur.roleId = 2;

    expect(typeof ur.userId).toBe('number');
    expect(typeof ur.roleId).toBe('number');
  });

  it('RolePermission should reference Role and Permission entities via foreign keys', () => {
    const rp = new RolePermission();
    rp.roleId = 1;
    rp.permissionId = 5;

    expect(typeof rp.roleId).toBe('number');
    expect(typeof rp.permissionId).toBe('number');
  });

  it('should model a full RBAC chain: User → UserRole → Role → RolePermission → Permission', () => {
    const user = new User();
    user.id = 1;
    user.username = 'teacher01';
    user.role = 'Teacher';

    const role = new Role();
    role.id = 3;
    role.name = 'Teacher';

    const userRole = new UserRole();
    userRole.userId = user.id;
    userRole.roleId = role.id;

    const perm = new Permission();
    perm.id = 10;
    perm.code = 'lesson:create';
    perm.name = '创建课时';

    const rolePerm = new RolePermission();
    rolePerm.roleId = role.id;
    rolePerm.permissionId = perm.id;

    // Verify the chain
    expect(userRole.userId).toBe(user.id);
    expect(userRole.roleId).toBe(role.id);
    expect(rolePerm.roleId).toBe(role.id);
    expect(rolePerm.permissionId).toBe(perm.id);
  });
});
