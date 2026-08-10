import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { LoginLog } from '../entities/login-log.entity';
import { UserRepository } from '../user.repository';

// Mock uuid at module level (ESM module)
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-token'),
}));

// Mock bcrypt at module level
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let loginLogRepo: jest.Mocked<Repository<LoginLog>>;
  let jwtService: jest.Mocked<JwtService>;
  let dataSource: { transaction: jest.Mock };

  const mockUser = {
    id: 1,
    username: 'admin',
    password: 'hashed-password',
    name: 'Admin User',
    role: 'ADMIN',
    status: 1,
    campusId: 1,
    avatar: null,
    mobile: null,
    openid: null,
    unionid: null,
    refreshToken: null,
    refreshTokenExpiresAt: null,
    lastLoginAt: null,
    deleted: false,
    createTime: new Date(),
    updateTime: new Date(),
    version: 1,
  } as unknown as User;

  beforeEach(async () => {
    const mockUserRepo = {
      findByUsernameWithPassword: jest.fn(),
      findByRefreshToken: jest.fn(),
      findById: jest.fn(),
      findByIdWithPassword: jest.fn(),
      update: jest.fn(),
      findByUsername: jest.fn(),
      findByMobile: jest.fn(),
      findByOpenid: jest.fn(),
      save: jest.fn(),
      findAndCountByRole: jest.fn(),
      raw: { findOne: jest.fn(), createQueryBuilder: jest.fn() },
    };

    const mockLoginLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
      verify: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: getRepositoryToken(LoginLog), useValue: mockLoginLogRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(UserRepository);
    loginLogRepo = module.get(getRepositoryToken(LoginLog));
    jwtService = module.get(JwtService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── validateUser ───

  describe('validateUser', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(service.validateUser('admin', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser('admin', 'password')).rejects.toThrow(
        '用户不存在',
      );
    });

    it('should throw UnauthorizedException when user is disabled (status !== 1)', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue({
        ...mockUser,
        status: 0,
      });

      await expect(service.validateUser('admin', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser('admin', 'password')).rejects.toThrow(
        '用户已被禁用',
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.validateUser('admin', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser('admin', 'wrong-password'),
      ).rejects.toThrow('密码错误');
    });

    it('should return user when validation succeeds', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('admin', 'correct-password');
      expect(result).toEqual(mockUser);
      expect(userRepo.findByUsernameWithPassword).toHaveBeenCalledWith('admin');
    });
  });

  // ─── login ───

  describe('login', () => {
    it('should return accessToken and refreshToken on successful login', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      const result = await service.login(
        'admin',
        'correct-password',
        'Chrome',
        '127.0.0.1',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('refreshToken');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
        }),
        { expiresIn: '2h' },
      );
    });

    it('should update user with new refreshToken on login', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.login('admin', 'correct-password');

      expect(userRepo.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          refreshToken: expect.any(String),
          refreshTokenExpiresAt: expect.any(Date),
          lastLoginAt: expect.any(Date),
        }),
      );
    });

    it('should create a LOGIN log entry', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.login('admin', 'correct-password', 'Chrome', '127.0.0.1');

      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
          action: 'LOGIN',
          success: true,
          ip: '127.0.0.1',
          device: 'Chrome',
        }),
      );
      expect(loginLogRepo.save).toHaveBeenCalled();
    });

    it('should throw when validateUser fails (user not found)', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(service.login('nonexistent', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should truncate device to 200 chars when writing login log', async () => {
      userRepo.findByUsernameWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      const longDevice = 'A'.repeat(300);
      await service.login('admin', 'correct-password', longDevice, '127.0.0.1');

      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          device: 'A'.repeat(200),
        }),
      );
    });
  });

  // ─── refresh ───

  describe('refresh', () => {
    it('should return new tokens on successful refresh', async () => {
      userRepo.findByRefreshToken.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      const result = await service.refresh(
        'valid-refresh-token',
        '127.0.0.1',
        'Chrome',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw when refresh token is invalid', async () => {
      userRepo.findByRefreshToken.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refresh('invalid-token')).rejects.toThrow(
        'Refresh Token 无效',
      );
    });

    it('should throw when refresh token is expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // yesterday

      userRepo.findByRefreshToken.mockResolvedValue({
        ...mockUser,
        refreshTokenExpiresAt: expiredDate,
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refresh('expired-token')).rejects.toThrow(
        'Refresh Token 已过期，请重新登录',
      );
    });

    it('should update user with new refresh token', async () => {
      userRepo.findByRefreshToken.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.refresh('valid-refresh-token');

      expect(userRepo.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          refreshToken: expect.any(String),
          refreshTokenExpiresAt: expect.any(Date),
        }),
      );
    });
  });

  // ─── logout ───

  describe('logout', () => {
    it('should clear refreshToken on logout', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.logout(mockUser.id, '127.0.0.1', 'Chrome');

      expect(userRepo.update).toHaveBeenCalledWith(mockUser.id, {
        refreshToken: null,
        refreshTokenExpiresAt: null,
      });
    });

    it('should create a LOGOUT log entry', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.logout(mockUser.id, '127.0.0.1', 'Chrome');

      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          action: 'LOGOUT',
          success: true,
        }),
      );
    });

    it('should not throw when user not found', async () => {
      userRepo.findById.mockResolvedValue(null);

      // Should not throw — logout is idempotent
      await expect(service.logout(999)).resolves.toBeUndefined();
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── revokeUserSessions ───

  describe('revokeUserSessions', () => {
    it("should revoke another user's sessions (clear refresh token)", async () => {
      const admin = { ...mockUser, id: 1, role: 'SuperAdmin' };
      const target = { ...mockUser, id: 3, role: 'Teacher' };
      userRepo.findById
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(target);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.revokeUserSessions(1, 3);

      expect(userRepo.update).toHaveBeenCalledWith(3, {
        refreshToken: null,
        refreshTokenExpiresAt: null,
      });
      expect(loginLogRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when operator revokes self', async () => {
      await expect(service.revokeUserSessions(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when Admin targets Admin', async () => {
      const admin = { ...mockUser, id: 1, role: 'Admin' };
      const target = { ...mockUser, id: 2, role: 'Admin' };
      userRepo.findById
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(target);
      await expect(service.revokeUserSessions(1, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when Admin targets SuperAdmin', async () => {
      const admin = { ...mockUser, id: 1, role: 'Admin' };
      const target = { ...mockUser, id: 2, role: 'SuperAdmin' };
      userRepo.findById
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(target);
      await expect(service.revokeUserSessions(1, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when target does not exist', async () => {
      const admin = { ...mockUser, id: 1, role: 'SuperAdmin' };
      userRepo.findById
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(null);
      await expect(service.revokeUserSessions(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should record an ADMIN_REVOKE audit log entry', async () => {
      const admin = { ...mockUser, id: 1, role: 'SuperAdmin' };
      const target = { ...mockUser, id: 3, role: 'Teacher' };
      userRepo.findById
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(target);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.revokeUserSessions(1, 3);

      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          username: 'admin',
          role: 'SuperAdmin',
          action: 'ADMIN_REVOKE',
          success: true,
        }),
      );
      expect(loginLogRepo.save).toHaveBeenCalled();
    });

    it('should allow Admin to revoke a Teacher (role pass branch)', async () => {
      const admin = { ...mockUser, id: 1, role: 'Admin' };
      const target = { ...mockUser, id: 3, role: 'Teacher' };
      userRepo.findById
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(target);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.revokeUserSessions(1, 3);

      expect(userRepo.update).toHaveBeenCalledWith(3, {
        refreshToken: null,
        refreshTokenExpiresAt: null,
      });
    });

    it('should throw UnauthorizedException when operator does not exist', async () => {
      userRepo.findById.mockResolvedValueOnce(null);

      await expect(service.revokeUserSessions(1, 3)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should succeed idempotently when target has no refresh token', async () => {
      const admin = { ...mockUser, id: 1, role: 'SuperAdmin' };
      const target = {
        ...mockUser,
        id: 3,
        role: 'Teacher',
        refreshToken: null,
        refreshTokenExpiresAt: null,
      };
      userRepo.findById
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(target);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await expect(service.revokeUserSessions(1, 3)).resolves.toBeUndefined();
    });
  });

  // ─── getCurrentUser ───

  describe('getCurrentUser', () => {
    it('should return user without sensitive fields', async () => {
      userRepo.findById.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(mockUser.id);

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('refreshToken');
      expect(result).not.toHaveProperty('refreshTokenExpiresAt');
      expect(result).toHaveProperty('username', mockUser.username);
      expect(result).toHaveProperty('name', mockUser.name);
    });

    it('should throw when user not found', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.getCurrentUser(999)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getCurrentUser(999)).rejects.toThrow('用户不存在');
    });
  });

  // ─── register ───

  describe('register', () => {
    const registerDto = {
      username: 'parent1',
      password: 'pass123',
      name: '测试家长',
      mobile: '13800000001',
    };

    it('should create a Parent user with hashed password and return safe fields', async () => {
      userRepo.findByUsername.mockResolvedValue(null);
      userRepo.findByMobile.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-abc' as never);
      const created = {
        ...mockUser,
        id: 10,
        username: 'parent1',
        mobile: '13800000001',
        name: '测试家长',
        role: 'Parent',
        password: 'hashed-abc',
      };
      userRepo.save.mockResolvedValue(created);

      const result = await service.register(registerDto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('pass123', 10);
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'Parent', status: 1 }),
      );
      expect(result).toMatchObject({
        id: 10,
        username: 'parent1',
        mobile: '13800000001',
        name: '测试家长',
        role: 'Parent',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should create a Teacher user when role is Teacher', async () => {
      userRepo.findByUsername.mockResolvedValue(null);
      userRepo.findByMobile.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-abc' as never);
      const created = {
        ...mockUser,
        id: 11,
        username: 'teacher1',
        mobile: '13800000002',
        name: '测试教师',
        role: 'Teacher',
        password: 'hashed-abc',
      };
      userRepo.save.mockResolvedValue(created);

      const result = await service.register({
        username: 'teacher1',
        password: 'pass123',
        name: '测试教师',
        mobile: '13800000002',
        role: 'Teacher',
      });

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'Teacher', status: 1 }),
      );
      expect(result).toMatchObject({ role: 'Teacher' });
    });

    it('should throw ConflictException when username already exists', async () => {
      userRepo.findByUsername.mockResolvedValue({
        ...mockUser,
        username: 'parent1',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when mobile already registered', async () => {
      userRepo.findByUsername.mockResolvedValue(null);
      userRepo.findByMobile.mockResolvedValue({
        ...mockUser,
        mobile: '13800000001',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when mobile is empty', async () => {
      userRepo.findByUsername.mockResolvedValue(null);

      await expect(
        service.register({
          username: 'parent2',
          password: 'pass123',
          name: '测试家长2',
          mobile: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── adminCreateParent ───

  describe('adminCreateParent', () => {
    const createDto = {
      username: 'parent9',
      password: 'pass123',
      name: '开户家长',
      mobile: '13800000009',
      studentId: 5,
    };

    function mockTransactionManager(overrides: Record<string, jest.Mock> = {}) {
      return {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        ...overrides,
      };
    }

    function mockOperator() {
      return {
        ...mockUser,
        id: 1,
        username: 'admin',
        role: 'SuperAdmin',
      };
    }

    it('should create parent user and link to student within one transaction', async () => {
      const manager = mockTransactionManager();
      manager.findOne
        .mockResolvedValueOnce(null) // username unique check
        .mockResolvedValueOnce(null) // mobile unique check
        .mockResolvedValueOnce({ id: 5, name: '学生' } as any); // student exists
      const savedParent = {
        ...mockUser,
        id: 20,
        username: 'parent9',
        role: 'Parent',
        password: 'hashed',
      } as any;
      manager.save
        .mockResolvedValueOnce(savedParent) // parent user
        .mockResolvedValueOnce({ id: 1 } as any); // student_parent link
      manager.create.mockImplementation((_entity: any, data: any) => ({
        ...data,
      }));
      dataSource.transaction.mockImplementation((cb) => cb(manager));

      userRepo.findById.mockResolvedValue(mockOperator());
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      const result = await service.adminCreateParent(createDto, 1);

      expect(result).toMatchObject({
        id: 20,
        username: 'parent9',
        role: 'Parent',
      });
      expect(result).not.toHaveProperty('password');
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(manager.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          studentId: 5,
          parentId: 20,
          relation: 'father',
        }),
      );
    });

    it('should throw NotFoundException when student does not exist', async () => {
      const manager = mockTransactionManager();
      manager.findOne
        .mockResolvedValueOnce(null) // username unique check
        .mockResolvedValueOnce(null) // mobile unique check
        .mockResolvedValueOnce(null); // student not found
      dataSource.transaction.mockImplementation((cb) => cb(manager));

      userRepo.findById.mockResolvedValue(mockOperator());

      await expect(service.adminCreateParent(createDto, 1)).rejects.toThrow(
        NotFoundException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when username exists (inside transaction)', async () => {
      const manager = mockTransactionManager();
      manager.findOne.mockResolvedValueOnce({
        ...mockUser,
        username: 'parent9',
      } as any);
      dataSource.transaction.mockImplementation((cb) => cb(manager));

      userRepo.findById.mockResolvedValue(mockOperator());

      await expect(service.adminCreateParent(createDto, 1)).rejects.toThrow(
        ConflictException,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when operator does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.adminCreateParent(createDto, 1)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should record ADMIN_CREATE_PARENT audit log with operator', async () => {
      const manager = mockTransactionManager();
      manager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 5 } as any);
      manager.save
        .mockResolvedValueOnce({
          ...mockUser,
          id: 20,
          username: 'parent9',
          role: 'Parent',
          password: 'hashed',
        } as any)
        .mockResolvedValueOnce({ id: 1 } as any);
      manager.create.mockImplementation((_entity: any, data: any) => ({
        ...data,
      }));
      dataSource.transaction.mockImplementation((cb) => cb(manager));

      userRepo.findById.mockResolvedValue(mockOperator());
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.adminCreateParent(createDto, 1);

      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          username: 'admin',
          role: 'SuperAdmin',
          action: 'ADMIN_CREATE_PARENT',
          success: true,
        }),
      );
    });

    it('should create parent without binding when studentId omitted', async () => {
      const manager = mockTransactionManager();
      manager.findOne
        .mockResolvedValueOnce(null) // username unique check
        .mockResolvedValueOnce(null); // mobile unique check
      const savedParent = {
        ...mockUser,
        id: 21,
        username: 'parent10',
        role: 'Parent',
        password: 'hashed',
      } as any;
      manager.save.mockResolvedValueOnce(savedParent);
      manager.create.mockImplementation((_entity: any, data: any) => ({
        ...data,
      }));
      dataSource.transaction.mockImplementation((cb) => cb(manager));

      userRepo.findById.mockResolvedValue(mockOperator());

      const result = await service.adminCreateParent(
        { ...createDto, username: 'parent10', studentId: undefined },
        1,
      );

      expect(result).toMatchObject({
        id: 21,
        username: 'parent10',
        role: 'Parent',
      });
      expect(manager.findOne).toHaveBeenCalledTimes(2);
      expect(manager.save).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when mobile is empty', async () => {
      const manager = mockTransactionManager();
      manager.findOne.mockResolvedValueOnce(null); // username unique check
      dataSource.transaction.mockImplementation((cb) => cb(manager));

      userRepo.findById.mockResolvedValue(mockOperator());

      await expect(
        service.adminCreateParent(
          { ...createDto, username: 'parent11', mobile: '' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  // ─── listParents ───

  function makeQbMock(items: User[], total: number) {
    const chain = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([items, total]),
    };
    userRepo.raw.createQueryBuilder.mockReturnValue(chain);
    return chain;
  }

  describe('listParents', () => {
    it('should return paginated parent users with safe fields', async () => {
      const items = [
        {
          ...mockUser,
          id: 10,
          username: 'p1',
          role: 'Parent',
          password: 'x',
          refreshToken: 'rt',
          mobile: '13800000001',
        },
        {
          ...mockUser,
          id: 11,
          username: 'p2',
          role: 'Parent',
          password: 'x',
          refreshToken: null,
          mobile: '13800000002',
        },
      ] as unknown as User[];
      makeQbMock(items, 2);

      const result = await service.listParents(1, 20);

      expect(userRepo.raw.createQueryBuilder).toHaveBeenCalledWith('u');
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).not.toHaveProperty('password');
      expect(result.items[0]).not.toHaveProperty('refreshToken');
      expect(result.items[0]).toHaveProperty('role', 'Parent');
    });

    it('should default to page 1 pageSize 20', async () => {
      makeQbMock([], 0);

      await service.listParents();

      const qb = userRepo.raw.createQueryBuilder.mock.results[0].value;
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('should filter by keyword and status', async () => {
      makeQbMock([], 0);

      await service.listParents(1, 10, '张', 0);

      const qb = userRepo.raw.createQueryBuilder.mock.results[0].value;
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(u.username LIKE :kw OR u.name LIKE :kw OR u.mobile LIKE :kw)',
        { kw: '%张%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('u.status = :status', {
        status: 0,
      });
    });
  });

  // ─── updateParentStatus ───

  describe('updateParentStatus', () => {
    const parent = {
      ...mockUser,
      id: 20,
      username: 'parent1',
      role: 'Parent',
      password: 'x',
      refreshToken: 'rt',
    };

    it('should enable (ACTIVE) when status is 1 and strip sensitive fields', async () => {
      userRepo.raw.findOne.mockResolvedValue(parent);
      userRepo.save.mockResolvedValue({ ...parent, status: 1 });

      const result = await service.updateParentStatus(20, 1);

      expect(userRepo.raw.findOne).toHaveBeenCalledWith({
        where: { id: 20, role: 'Parent', deleted: false },
      });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 1 }),
      );
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('refreshToken');
      expect(result).toHaveProperty('status', 1);
    });

    it('should disable (INACTIVE) when status is 0', async () => {
      userRepo.raw.findOne.mockResolvedValue(parent);
      userRepo.save.mockResolvedValue({ ...parent, status: 0 });

      const result = await service.updateParentStatus(20, 0);

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 0 }),
      );
      expect(result).toHaveProperty('status', 0);
    });

    it('should throw NotFoundException when parent does not exist', async () => {
      userRepo.raw.findOne.mockResolvedValue(null);

      await expect(service.updateParentStatus(20, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── changePassword ───

  describe('changePassword', () => {
    it('should hash the new password and clear refresh token on success', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('new-hashed' as never);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.changePassword(1, 'old-pass', 'NewPass123', '127.0.0.1');

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'old-pass',
        'hashed-password',
      );
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('NewPass123', 10);
      expect(userRepo.update).toHaveBeenCalledWith(1, {
        password: 'new-hashed',
        refreshToken: null,
        refreshTokenExpiresAt: null,
      });
      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          action: 'CHANGE_PASSWORD',
          success: true,
          ip: '127.0.0.1',
        }),
      );
      expect(loginLogRepo.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(null);

      await expect(
        service.changePassword(999, 'old-pass', 'NewPass123'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword(999, 'old-pass', 'NewPass123'),
      ).rejects.toThrow('用户不存在');
    });

    it('should throw UnauthorizedException when old password is wrong', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.changePassword(1, 'wrong-old', 'NewPass123'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword(1, 'wrong-old', 'NewPass123'),
      ).rejects.toThrow('原密码错误');
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when new password equals old password', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(
        service.changePassword(1, 'SamePass1', 'SamePass1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword(1, 'SamePass1', 'SamePass1'),
      ).rejects.toThrow('新密码不能与原密码相同');
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should not change password when old password mismatch even if hashing would succeed', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);
      mockedBcrypt.hash.mockResolvedValue('never-called' as never);

      await expect(
        service.changePassword(1, 'wrong', 'NewPass123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
    });
  });

  // ─── adminResetPassword ───

  describe('adminResetPassword', () => {
    function mockSuperAdmin() {
      return {
        ...mockUser,
        id: 1,
        username: 'admin',
        role: 'SuperAdmin',
      };
    }
    function mockTeacher() {
      return {
        ...mockUser,
        id: 3,
        username: 'teacher1',
        role: 'Teacher',
      };
    }

    it('should reset target password and clear refresh token on success', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(mockSuperAdmin());
      userRepo.findById.mockResolvedValue(mockTeacher());
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('reset-hashed' as never);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.adminResetPassword(1, 'admin-pass', 3, 'NewPass456');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('NewPass456', 10);
      expect(userRepo.update).toHaveBeenCalledWith(3, {
        password: 'reset-hashed',
        refreshToken: null,
        refreshTokenExpiresAt: null,
      });
      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          username: 'admin',
          role: 'SuperAdmin',
          action: 'ADMIN_RESET_PASSWORD',
          success: true,
        }),
      );
      expect(loginLogRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when operator resets self', async () => {
      await expect(
        service.adminResetPassword(1, 'admin-pass', 1, 'NewPass456'),
      ).rejects.toThrow(BadRequestException);
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when operator does not exist', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(null);

      await expect(
        service.adminResetPassword(999, 'admin-pass', 3, 'NewPass456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when target does not exist', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(mockSuperAdmin());
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.adminResetPassword(1, 'admin-pass', 999, 'NewPass456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when operator password verification fails', async () => {
      userRepo.findByIdWithPassword.mockResolvedValue(mockSuperAdmin());
      userRepo.findById.mockResolvedValue(mockTeacher());
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.adminResetPassword(1, 'wrong-admin-pass', 3, 'NewPass456'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.adminResetPassword(1, 'wrong-admin-pass', 3, 'NewPass456'),
      ).rejects.toThrow('操作员密码验证失败');
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when Admin targets Admin', async () => {
      const admin = { ...mockUser, id: 1, role: 'Admin' };
      const targetAdmin = { ...mockUser, id: 2, role: 'Admin' };
      userRepo.findByIdWithPassword.mockResolvedValue(admin);
      userRepo.findById.mockResolvedValue(targetAdmin);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(
        service.adminResetPassword(1, 'admin-pass', 2, 'NewPass456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when Admin targets SuperAdmin', async () => {
      const admin = { ...mockUser, id: 1, role: 'Admin' };
      const targetSuper = { ...mockUser, id: 2, role: 'SuperAdmin' };
      userRepo.findByIdWithPassword.mockResolvedValue(admin);
      userRepo.findById.mockResolvedValue(targetSuper);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(
        service.adminResetPassword(1, 'admin-pass', 2, 'NewPass456'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Admin to reset a Teacher (role pass branch)', async () => {
      const admin = { ...mockUser, id: 1, role: 'Admin' };
      userRepo.findByIdWithPassword.mockResolvedValue(admin);
      userRepo.findById.mockResolvedValue(mockTeacher());
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('reset-hashed' as never);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      await service.adminResetPassword(1, 'admin-pass', 3, 'NewPass456');

      expect(userRepo.update).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ password: 'reset-hashed' }),
      );
    });
  });

  describe('bindWechat', () => {
    function mockWxSession(openid: string, unionid?: string) {
      (service as any).getWxSession = jest.fn().mockResolvedValue({
        openid,
        session_key: 'sk',
        unionid,
      });
    }

    it('should throw UnauthorizedException when user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.bindWechat(999, 'code')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.bindWechat(999, 'code')).rejects.toThrow(
        '用户不存在',
      );
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should pass through 500 when wechat config is missing', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      (service as any).getWxSession = jest
        .fn()
        .mockRejectedValue(
          new InternalServerErrorException(
            '微信登录未配置：请设置 WECHAT_APPID 和 WECHAT_SECRET',
          ),
        );

      await expect(service.bindWechat(1, 'code')).rejects.toThrow(
        '微信登录未配置：请设置 WECHAT_APPID 和 WECHAT_SECRET',
      );
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when no openid returned', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      (service as any).getWxSession = jest
        .fn()
        .mockResolvedValue({ openid: null, session_key: 'sk' });

      await expect(service.bindWechat(1, 'code')).rejects.toThrow(
        '微信登录失败：未获取到 openid',
      );
    });

    it('should bind openid and unionid on success', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.findByOpenid.mockResolvedValue(null);
      userRepo.update.mockResolvedValue(undefined);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);
      mockWxSession('oX-abc', 'u-union');

      await service.bindWechat(1, 'code');

      expect(userRepo.update).toHaveBeenCalledWith(1, {
        openid: 'oX-abc',
        unionid: 'u-union',
      });
      expect(loginLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          username: 'admin',
          action: 'WECHAT_BIND',
          success: true,
        }),
      );
      expect(loginLogRepo.save).toHaveBeenCalled();
    });

    it('should be idempotent when the same openid is already bound', async () => {
      userRepo.findById.mockResolvedValue({ ...mockUser, openid: 'oX-abc' });
      mockWxSession('oX-abc');

      await service.bindWechat(1, 'code');

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when openid is bound to another user', async () => {
      userRepo.findById.mockResolvedValue(mockUser);
      userRepo.findByOpenid.mockResolvedValue({ ...mockUser, id: 2 });
      mockWxSession('oX-abc');

      await expect(service.bindWechat(1, 'code')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.bindWechat(1, 'code')).rejects.toThrow(
        '该微信已被其他账号绑定',
      );
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('wechatLogin', () => {
    it('should throw actionable UnauthorizedException when openid is not bound', async () => {
      (service as any).getWxSession = jest
        .fn()
        .mockResolvedValue({ openid: 'oX-new', session_key: 'sk' });
      userRepo.findByOpenid.mockResolvedValue(null);

      await expect(service.wechatLogin('code')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.wechatLogin('code')).rejects.toThrow(
        '该微信尚未绑定账号，请先用账号密码登录，登录后将自动绑定',
      );
    });
  });
});
