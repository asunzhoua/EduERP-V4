import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const mockReflector = (roles: string[] | null | undefined) => {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
};

const mockContext = (user?: any): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
};

describe('RolesGuard', () => {
  it('allows access when user role matches required roles', () => {
    const guard = new RolesGuard(mockReflector(['admin', 'teacher']));
    const ctx = mockContext({ role: 'admin' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies access when user role does not match required roles', () => {
    const guard = new RolesGuard(mockReflector(['admin']));
    const ctx = mockContext({ role: 'student' });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('allows access when no roles metadata is set (no decorator)', () => {
    const guard = new RolesGuard(mockReflector(undefined));
    const ctx = mockContext({ role: 'student' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies access when user is not present', () => {
    const guard = new RolesGuard(mockReflector(['admin']));
    const ctx = mockContext(undefined);

    expect(guard.canActivate(ctx)).toBe(false);
  });
});
