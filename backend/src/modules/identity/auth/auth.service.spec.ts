import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
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
      update: jest.fn(),
    };

    const mockLoginLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: getRepositoryToken(LoginLog), useValue: mockLoginLogRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(UserRepository);
    loginLogRepo = module.get(getRepositoryToken(LoginLog));
    jwtService = module.get(JwtService);
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
      userRepo.findByUsernameWithPassword.mockResolvedValue({ ...mockUser, status: 0 } as User);

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

      await expect(service.validateUser('admin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser('admin', 'wrong-password')).rejects.toThrow(
        '密码错误',
      );
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
      userRepo.update.mockResolvedValue(undefined as any);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      const result = await service.login('admin', 'correct-password', 'Chrome', '127.0.0.1');

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
      userRepo.update.mockResolvedValue(undefined as any);
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
      userRepo.update.mockResolvedValue(undefined as any);
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
  });

  // ─── refresh ───

  describe('refresh', () => {
    it('should return new tokens on successful refresh', async () => {
      userRepo.findByRefreshToken.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(undefined as any);
      loginLogRepo.create.mockReturnValue({} as LoginLog);
      loginLogRepo.save.mockResolvedValue({} as LoginLog);

      const result = await service.refresh('valid-refresh-token', '127.0.0.1', 'Chrome');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw when refresh token is invalid', async () => {
      userRepo.findByRefreshToken.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh('invalid-token')).rejects.toThrow('Refresh Token 无效');
    });

    it('should throw when refresh token is expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // yesterday

      userRepo.findByRefreshToken.mockResolvedValue({
        ...mockUser,
        refreshTokenExpiresAt: expiredDate,
      } as User);

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh('expired-token')).rejects.toThrow(
        'Refresh Token 已过期，请重新登录',
      );
    });

    it('should update user with new refresh token', async () => {
      userRepo.findByRefreshToken.mockResolvedValue(mockUser);
      userRepo.update.mockResolvedValue(undefined as any);
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
      userRepo.update.mockResolvedValue(undefined as any);
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
      userRepo.update.mockResolvedValue(undefined as any);
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

      await expect(service.getCurrentUser(999)).rejects.toThrow(UnauthorizedException);
      await expect(service.getCurrentUser(999)).rejects.toThrow('用户不存在');
    });
  });
});
