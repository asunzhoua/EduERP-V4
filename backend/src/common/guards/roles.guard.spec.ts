import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: jest.Mocked<Reflector>;

  const mockContext = (user?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(mockReflector);
  });

  // =========================================
  // Scenario 4 (Phase 6): SuperAdmin/Admin can access all admin endpoints
  // =========================================
  describe('Scenario 4: Admin managing all data', () => {
    it.each([
      { role: 'SuperAdmin', required: ['SuperAdmin', 'Admin'], expected: true },
      { role: 'Admin', required: ['SuperAdmin', 'Admin'], expected: true },
      { role: 'Teacher', required: ['SuperAdmin', 'Admin'], expected: false },
      { role: 'Student', required: ['SuperAdmin', 'Admin'], expected: false },
      { role: 'Parent', required: ['SuperAdmin', 'Admin'], expected: false },
    ])(
      'role=$role on Admin endpoint => $expected',
      ({ role, required, expected }) => {
        mockReflector.getAllAndOverride.mockReturnValue(required);
        expect(guard.canActivate(mockContext({ role }))).toBe(expected);
      },
    );
  });

  // =========================================
  // Scenario 1 (Phase 6): Teacher-accessible student endpoints
  // =========================================
  describe('Scenario 1: Teacher accessing student data', () => {
    it.each([
      {
        role: 'SuperAdmin',
        required: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        role: 'Admin',
        required: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        role: 'Teacher',
        required: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        role: 'Student',
        required: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: false,
      },
      {
        role: 'Parent',
        required: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: false,
      },
    ])(
      'role=$role on Teacher-accessible endpoint => $expected',
      ({ role, required, expected }) => {
        mockReflector.getAllAndOverride.mockReturnValue(required);
        expect(guard.canActivate(mockContext({ role }))).toBe(expected);
      },
    );
  });

  // =========================================
  // Scenario 2 (Phase 6): Student/Parent self-service endpoints
  // =========================================
  describe('Scenario 2: Parent accessing own endpoints', () => {
    it.each([
      { role: 'Student', required: ['Student', 'Parent'], expected: true },
      { role: 'Parent', required: ['Student', 'Parent'], expected: true },
      { role: 'Teacher', required: ['Student', 'Parent'], expected: false },
      { role: 'Admin', required: ['Student', 'Parent'], expected: false },
      { role: 'SuperAdmin', required: ['Student', 'Parent'], expected: false },
    ])(
      'role=$role on self-service endpoint => $expected',
      ({ role, required, expected }) => {
        mockReflector.getAllAndOverride.mockReturnValue(required);
        expect(guard.canActivate(mockContext({ role }))).toBe(expected);
      },
    );
  });

  // =========================================
  // Scenario 3 (Phase 6): SuperAdmin-only endpoints
  // =========================================
  describe('Scenario 3: Teacher cannot access SuperAdmin-only endpoints', () => {
    it.each([
      { role: 'SuperAdmin', required: ['SuperAdmin'], expected: true },
      { role: 'Admin', required: ['SuperAdmin'], expected: false },
      { role: 'Teacher', required: ['SuperAdmin'], expected: false },
      { role: 'Student', required: ['SuperAdmin'], expected: false },
      { role: 'Parent', required: ['SuperAdmin'], expected: false },
    ])(
      'role=$role on SuperAdmin-only endpoint => $expected',
      ({ role, required, expected }) => {
        mockReflector.getAllAndOverride.mockReturnValue(required);
        expect(guard.canActivate(mockContext({ role }))).toBe(expected);
      },
    );
  });

  // =========================================
  // Edge cases
  // =========================================
  describe('Edge cases', () => {
    it('allows any role when no @Roles() metadata is set (public)', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      expect(guard.canActivate(mockContext({ role: 'Student' }))).toBe(true);
      expect(guard.canActivate(mockContext({ role: 'Teacher' }))).toBe(true);
      expect(guard.canActivate(mockContext({ role: 'Admin' }))).toBe(true);
      expect(guard.canActivate(mockContext({ role: 'SuperAdmin' }))).toBe(true);
      expect(guard.canActivate(mockContext({ role: 'Parent' }))).toBe(true);
    });

    it('denies all roles when @Roles() has empty array (no role can match)', () => {
      // Behavior: empty array means "no roles allowed" — includes() returns false for all
      mockReflector.getAllAndOverride.mockReturnValue([]);
      expect(guard.canActivate(mockContext({ role: 'SuperAdmin' }))).toBe(
        false,
      );
      expect(guard.canActivate(mockContext({ role: 'Admin' }))).toBe(false);
      expect(guard.canActivate(mockContext({ role: 'Teacher' }))).toBe(false);
      expect(guard.canActivate(mockContext({ role: 'Student' }))).toBe(false);
      expect(guard.canActivate(mockContext({ role: 'Parent' }))).toBe(false);
    });

    it('denies access when user is not present in request', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin']);
      expect(guard.canActivate(mockContext(undefined))).toBe(false);
    });

    it('denies access when user has no role property', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin']);
      expect(guard.canActivate(mockContext({}))).toBe(false);
    });

    it('denies access when user role is unknown', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['Admin', 'Teacher']);
      expect(guard.canActivate(mockContext({ role: 'Visitor' }))).toBe(false);
    });
  });
});
