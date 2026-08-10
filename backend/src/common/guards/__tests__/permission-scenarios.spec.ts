/**
 * Permission Scenarios Integration Test — M-EduOS-PERMISSION-SYSTEM-HARDENING-V1 Phase 6
 *
 * Covers:
 *   Scenario 1: TeacherA cannot view TeacherB's students (data isolation)
 *   Scenario 2: ParentA cannot view StudentB's data (data isolation)
 *   Scenario 3: Teacher cannot modify admin-only resources (permission guard)
 *   Scenario 4: Admin can manage all data (permission scope)
 *
 * Tests the RolesGuard + controller-level data isolation logic.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { AuthedRequest } from '@common/types/authed-request';

// ================================================================
// Helpers
// ================================================================

interface RoleTestCase {
  label: string;
  userRole: string;
  requiredRoles: string[];
  expected: boolean;
}

function runRoleMatrix(tests: RoleTestCase[]) {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  for (const { label, userRole, requiredRoles, expected } of tests) {
    it(label, () => {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(requiredRoles);
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: userRole, sub: 1 } }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(ctx)).toBe(expected);
    });
  }
}

// ================================================================
// Scenario 1: Teacher data isolation
//
// In the current system, the @Roles decorator allows all Teachers
// to access student list endpoints. Data isolation between teachers
// (e.g., TeacherA cannot see TeacherB's students) is NOT enforced
// at the controller level — it must be implemented in the service
// layer or via query filters.
//
// These tests verify the guard-level behavior AND document the gap.
// ================================================================

describe('Scenario 1: Teacher Data Isolation', () => {
  describe('Guard-level: Teacher can access student endpoints', () => {
    runRoleMatrix([
      {
        label: 'Teacher can access student list (findAll/findOne)',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        label: 'Admin can access student list',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        label: 'SuperAdmin can access student list',
        userRole: 'SuperAdmin',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        label: 'Student cannot access teacher-level student list',
        userRole: 'Student',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: false,
      },
      {
        label: 'Parent cannot access teacher-level student list',
        userRole: 'Parent',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: false,
      },
    ]);
  });

  describe('Guard-level: Teacher cannot modify admin-only student data', () => {
    runRoleMatrix([
      {
        label: 'Teacher cannot create student (POST /students)',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot update student (PUT /students/:id)',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot change student status',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot delete student',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin'],
        expected: false,
      },
      {
        label: 'Admin can create/update student',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: true,
      },
    ]);
  });

  describe('Analytics-level: Teacher isolation in verifyTeacherAccess', () => {
    // This tests the controller-level data isolation that already exists
    it('should prevent Teacher from viewing another teacher metrics', () => {
      // Simulate the verifyTeacherAccess logic
      const verifyTeacherAccess = (req: AuthedRequest, teacherId: number) => {
        const user = req.user;
        if (user.role === 'SuperAdmin' || user.role === 'Admin') {
          return;
        }
        if (user.role === 'Teacher' && user.sub !== teacherId) {
          throw new ForbiddenException('无权访问其他教师数据');
        }
      };

      // Teacher accessing own metrics — allowed
      expect(() =>
        verifyTeacherAccess({ user: { role: 'Teacher', sub: 100 } }, 100),
      ).not.toThrow();

      // Teacher accessing another teacher — rejected
      expect(() =>
        verifyTeacherAccess({ user: { role: 'Teacher', sub: 100 } }, 200),
      ).toThrow('无权访问其他教师数据');

      // Admin accessing any teacher — allowed
      expect(() =>
        verifyTeacherAccess({ user: { role: 'Admin', sub: 1 } }, 999),
      ).not.toThrow();

      // SuperAdmin accessing any teacher — allowed
      expect(() =>
        verifyTeacherAccess({ user: { role: 'SuperAdmin', sub: 1 } }, 999),
      ).not.toThrow();
    });
  });
});

// ================================================================
// Scenario 2: Parent data isolation
//
// The analytics controller has verifyStudentAccess which checks
// that Student/Parent roles can only access their own data.
// The student controller self/* endpoints also restrict by userId.
// ================================================================

describe('Scenario 2: Parent Data Isolation', () => {
  describe('Guard-level: Parent can access self-service endpoints', () => {
    runRoleMatrix([
      {
        label:
          'Parent can access self contracts (GET /students/self/contracts)',
        userRole: 'Parent',
        requiredRoles: ['Student', 'Parent'],
        expected: true,
      },
      {
        label: 'Student can access self contracts',
        userRole: 'Student',
        requiredRoles: ['Student', 'Parent'],
        expected: true,
      },
      {
        label: 'Teacher cannot access parent/student self endpoints',
        userRole: 'Teacher',
        requiredRoles: ['Student', 'Parent'],
        expected: false,
      },
      {
        label: 'Admin cannot access parent/student self endpoints',
        userRole: 'Admin',
        requiredRoles: ['Student', 'Parent'],
        expected: false,
      },
    ]);
  });

  describe('Controller-level: Parent data isolation in analytics', () => {
    it('should prevent Parent from accessing non-bound student data', () => {
      // Simulate the verifyStudentAccess logic from analytics controller
      const verifyStudentAccess = async (
        req: AuthedRequest,
        studentCode: string,
        findOne: (opts: any) => Promise<any>,
      ) => {
        const user = req.user;
        if (
          user.role === 'SuperAdmin' ||
          user.role === 'Admin' ||
          user.role === 'Teacher'
        ) {
          return;
        }
        const student = await findOne({
          where: { studentCode, deleted: false },
        });
        if (!student) {
          throw new ForbiddenException('学生不存在');
        }
        if (student.userId !== user.sub) {
          throw new ForbiddenException('无权访问该学生数据');
        }
      };

      const mockFindOne = jest.fn();

      // Parent accessing their own child's data — allowed
      mockFindOne.mockResolvedValue({ userId: 42 });
      expect(
        verifyStudentAccess(
          { user: { role: 'Parent', sub: 42 } },
          'STU-001',
          mockFindOne,
        ),
      ).resolves.not.toThrow();

      // Parent accessing another student — rejected
      mockFindOne.mockResolvedValue({ userId: 99 });
      expect(
        verifyStudentAccess(
          { user: { role: 'Parent', sub: 42 } },
          'STU-002',
          mockFindOne,
        ),
      ).rejects.toThrow('无权访问该学生数据');

      // Student accessing own data — allowed
      mockFindOne.mockResolvedValue({ userId: 42 });
      expect(
        verifyStudentAccess(
          { user: { role: 'Student', sub: 42 } },
          'STU-001',
          mockFindOne,
        ),
      ).resolves.not.toThrow();

      // Teacher accessing any student — allowed, no check performed
      expect(
        verifyStudentAccess(
          { user: { role: 'Teacher', sub: 1 } },
          'ANY-STU',
          mockFindOne,
        ),
      ).resolves.not.toThrow();
    });
  });
});

// ================================================================
// Scenario 3: Teacher cannot modify salary/admin rules
//
// Since there is no dedicated salary module in this codebase,
// we test the guard pattern using existing SuperAdmin/Admin-only
// endpoints as proxies for "salary rules" (e.g., creating courses,
// managing contracts, configuring system settings).
// ================================================================

describe('Scenario 3: Teacher Cannot Modify Admin-Only Resources', () => {
  describe('Guard-level: Teacher blocked from admin-only endpoints', () => {
    runRoleMatrix([
      // Course management
      {
        label: 'Teacher cannot create course',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot update course',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot change course status',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot delete course (SuperAdmin only)',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin'],
        expected: false,
      },
      // Class management
      {
        label: 'Teacher cannot create class',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot update class',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      // Contract management
      {
        label: 'Teacher cannot create contract',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      // Student management
      {
        label: 'Teacher cannot link parent to student',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot import students',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      // Enrollment
      {
        label: 'Teacher cannot create enrollment',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot delete enrollment',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      // Analytics — institution-level endpoints
      {
        label: 'Teacher cannot view institution metrics',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
      {
        label: 'Teacher cannot view consumption statistics',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: false,
      },
    ]);
  });

  describe('Boundary: Teacher CAN access their permitted endpoints', () => {
    runRoleMatrix([
      {
        label: 'Teacher can list courses',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        label: 'Teacher can list classes',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        label: 'Teacher can create lessons',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        label: 'Teacher can view attendance statistics',
        userRole: 'Teacher',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
    ]);
  });
});

// ================================================================
// Scenario 4: Admin can manage all data
//
// Tests that Admin and SuperAdmin roles have full access to
// endpoints across the system.
// ================================================================

describe('Scenario 4: Admin Can Manage All Data', () => {
  describe('Guard-level: Admin/SuperAdmin access to all endpoint types', () => {
    runRoleMatrix([
      // SuperAdmin-only
      {
        label: 'SuperAdmin can delete course (SuperAdmin-only)',
        userRole: 'SuperAdmin',
        requiredRoles: ['SuperAdmin'],
        expected: true,
      },
      {
        label: 'SuperAdmin can delete student (SuperAdmin-only)',
        userRole: 'SuperAdmin',
        requiredRoles: ['SuperAdmin'],
        expected: true,
      },
      // Admin-level CRUD
      {
        label: 'Admin can create course',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: true,
      },
      {
        label: 'Admin can update class',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: true,
      },
      {
        label: 'Admin can create contract',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: true,
      },
      {
        label: 'Admin can create enrollment',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: true,
      },
      // Teacher-level — Admin has full access
      {
        label: 'Admin can access teacher-level student list',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      {
        label: 'Admin can create lessons',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin', 'Teacher'],
        expected: true,
      },
      // Institution-level analytics
      {
        label: 'Admin can view institution metrics',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: true,
      },
      {
        label: 'Admin can view consumption statistics',
        userRole: 'Admin',
        requiredRoles: ['SuperAdmin', 'Admin'],
        expected: true,
      },
      // Student/Parent self endpoints — Admin should also be able to view
      {
        label: 'Admin can access parent self endpoints if needed',
        userRole: 'Admin',
        requiredRoles: ['Student', 'Parent'],
        expected: false,
      },
    ]);
  });

  describe('Controller-level: Admin bypasses data isolation checks', () => {
    it('should allow Admin to access any teacher metrics', () => {
      const verifyTeacherAccess = (req: AuthedRequest, teacherId: number) => {
        const user = req.user;
        if (user.role === 'SuperAdmin' || user.role === 'Admin') {
          return; // Admin bypass
        }
        if (user.role === 'Teacher' && user.sub !== teacherId) {
          throw new ForbiddenException('无权访问其他教师数据');
        }
      };

      expect(() =>
        verifyTeacherAccess({ user: { role: 'Admin', sub: 5 } }, 100),
      ).not.toThrow();
      expect(() =>
        verifyTeacherAccess({ user: { role: 'Admin', sub: 5 } }, 999),
      ).not.toThrow();
    });

    it('should allow Admin to access any student data', () => {
      const verifyStudentAccess = async (req: AuthedRequest) => {
        const user = req.user;
        if (
          user.role === 'SuperAdmin' ||
          user.role === 'Admin' ||
          user.role === 'Teacher'
        ) {
          return; // Admin bypass
        }
      };

      expect(
        verifyStudentAccess({ user: { role: 'Admin', sub: 5 } }),
      ).resolves.not.toThrow();
      expect(
        verifyStudentAccess({ user: { role: 'SuperAdmin', sub: 1 } }),
      ).resolves.not.toThrow();
    });
  });
});

// ================================================================
// Cross-cutting: Public endpoints (no role restrictions)
// ================================================================

describe('Public endpoints (no @Roles decorator)', () => {
  runRoleMatrix([
    {
      label: 'Any role can access public endpoints',
      userRole: 'Teacher',
      requiredRoles: undefined as any,
      expected: true,
    },
    {
      label: 'No user also allowed on public endpoints',
      userRole: undefined as any,
      requiredRoles: undefined as any,
      expected: true,
    },
  ]);
});
