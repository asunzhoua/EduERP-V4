jest.mock('uuid', () => ({ v4: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
      revokeUserSessions: jest.fn(),
      register: jest.fn(),
      adminCreateParent: jest.fn(),
      listParents: jest.fn(),
      changePassword: jest.fn(),
      adminResetPassword: jest.fn(),
      updateParentStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('POST /auth/login', () => {
    it('should return tokens and user info', async () => {
      const loginResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 1, username: 'admin', name: '管理员', role: 'admin' },
      };
      authService.login.mockResolvedValue(loginResult);

      const body = { username: 'admin', password: '123456' };
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } };

      const result = await controller.login(body, req);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(loginResult);
      expect(authService.login).toHaveBeenCalledWith(
        'admin',
        '123456',
        'test-agent',
        '127.0.0.1',
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens', async () => {
      const refreshResult = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      };
      authService.refresh.mockResolvedValue(refreshResult);

      const body = { refreshToken: 'old-refresh-token' };
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } };

      const result = await controller.refresh(body, req);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(refreshResult);
      expect(authService.refresh).toHaveBeenCalledWith(
        'old-refresh-token',
        '127.0.0.1',
        'test-agent',
      );
    });
  });

  describe('POST /auth/logout', () => {
    it('should return success message', async () => {
      authService.logout.mockResolvedValue(undefined);

      const req = {
        user: { sub: 1 },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      };

      const result = await controller.logout(req);

      expect(result.code).toBe(0);
      expect(result.message).toBe('退出成功');
      expect(authService.logout).toHaveBeenCalledWith(
        1,
        '127.0.0.1',
        'test-agent',
      );
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile', async () => {
      const user = {
        id: 1,
        username: 'admin',
        name: '管理员',
        role: 'admin',
        status: 1,
      };
      authService.getCurrentUser.mockResolvedValue(user);

      const req = { user: { sub: 1 } };

      const result = await controller.getProfile(req);

      expect(result.code).toBe(0);
      expect(result.data).toEqual(user);
      expect(authService.getCurrentUser).toHaveBeenCalledWith(1);
    });
  });

  describe('POST /auth/admin/users/:id/revoke-session', () => {
    it('should call revokeUserSessions with operator and target id', async () => {
      authService.revokeUserSessions.mockResolvedValue(undefined);
      const req = { user: { sub: 1 } };
      const result = await controller.revokeSession(5, req);
      expect(authService.revokeUserSessions).toHaveBeenCalledWith(1, 5);
      expect(result.code).toBe(0);
    });
  });

  describe('POST /auth/register', () => {
    it('should call register with dto and return created user', async () => {
      const created = { id: 10, username: 'parent1', role: 'Parent' };
      authService.register.mockResolvedValue(created);

      const body = {
        username: 'parent1',
        password: 'pass123',
        name: '测试家长',
        mobile: '13800000001',
      };
      const result = await controller.register(body);

      expect(result.code).toBe(0);
      expect(result.message).toBe('注册成功');
      expect(result.data).toEqual(created);
      expect(authService.register).toHaveBeenCalledWith(body);
    });
  });

  describe('POST /auth/admin/parents', () => {
    it('should call adminCreateParent with dto and operator sub', async () => {
      const created = { id: 20, username: 'parent9', role: 'Parent' };
      authService.adminCreateParent.mockResolvedValue(created);

      const body = {
        username: 'parent9',
        password: 'pass123',
        name: '开户家长',
        mobile: '13800000009',
        studentId: 5,
      };
      const req = { user: { sub: 1 } };
      const result = await controller.adminCreateParent(body, req);

      expect(result.code).toBe(0);
      expect(result.message).toBe('家长开户成功');
      expect(result.data).toEqual(created);
      expect(authService.adminCreateParent).toHaveBeenCalledWith(body, 1);
    });
  });

  describe('GET /auth/admin/parents', () => {
    it('should call listParents with page and pageSize', async () => {
      const pageData = { items: [], total: 0 };
      authService.listParents.mockResolvedValue(pageData);

      const result = await controller.listParents({ page: 1, pageSize: 20 });

      expect(result.code).toBe(0);
      expect(result.data).toEqual(pageData);
      expect(authService.listParents).toHaveBeenCalledWith(
        1,
        20,
        undefined,
        undefined,
      );
    });

    it('should pass keyword and status filters', async () => {
      const pageData = { items: [], total: 0 };
      authService.listParents.mockResolvedValue(pageData);

      await controller.listParents({
        page: 2,
        pageSize: 10,
        keyword: '张',
        status: '0',
      });

      expect(authService.listParents).toHaveBeenCalledWith(2, 10, '张', 0);
    });
  });

  describe('PATCH /auth/admin/parents/:id/status', () => {
    it('should call updateParentStatus with id and numeric status', async () => {
      const updated = { id: 5, username: 'parent1', role: 'Parent', status: 0 };
      authService.updateParentStatus.mockResolvedValue(updated);

      const result = await controller.updateParentStatus(5, {
        status: '0',
      });

      expect(result.code).toBe(0);
      expect(result.message).toBe('状态已更新');
      expect(result.data).toEqual(updated);
      expect(authService.updateParentStatus).toHaveBeenCalledWith(5, 0);
    });
  });

  describe('POST /auth/change-password', () => {
    it('should call changePassword with user sub and dto fields', async () => {
      authService.changePassword.mockResolvedValue(undefined);

      const body = { oldPassword: 'OldPass1', newPassword: 'NewPass123' };
      const req = {
        user: { sub: 1 },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      };

      const result = await controller.changePassword(body, req);

      expect(result.code).toBe(0);
      expect(result.message).toBe('密码修改成功，请重新登录');
      expect(authService.changePassword).toHaveBeenCalledWith(
        1,
        'OldPass1',
        'NewPass123',
        '127.0.0.1',
        'test-agent',
      );
    });
  });

  describe('POST /auth/admin/users/:id/reset-password', () => {
    it('should call adminResetPassword with operator sub, dto and context', async () => {
      authService.adminResetPassword.mockResolvedValue(undefined);

      const body = {
        newPassword: 'NewPass456',
        operatorPassword: 'admin-pass',
        reason: '家长要求',
      };
      const req = { user: { sub: 1 }, ip: '127.0.0.1' };

      const result = await controller.resetPassword(5, body, req);

      expect(result.code).toBe(0);
      expect(result.message).toBe('密码重置成功');
      expect(authService.adminResetPassword).toHaveBeenCalledWith(
        1,
        'admin-pass',
        5,
        'NewPass456',
        { operatorIp: '127.0.0.1', reason: '家长要求' },
      );
    });
  });
});
