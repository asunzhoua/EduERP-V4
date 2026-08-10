import { Test, TestingModule } from '@nestjs/testing';
import { LessonExceptionController } from './lesson-exception.controller';
import { LessonExceptionService } from './lesson-exception.service';
import { QueryExceptionDto } from './dto/query-exception.dto';
import { ApproveExceptionDto } from './dto/approve-exception.dto';
import { ForbiddenException } from '@nestjs/common';

describe('LessonExceptionController', () => {
  let controller: LessonExceptionController;
  let service: jest.Mocked<LessonExceptionService>;

  // ─── Mock Users ───

  const adminUser = {
    sub: 1,
    username: 'admin',
    role: 'Admin',
    name: '管理员',
  };
  const superAdminUser = {
    sub: 2,
    username: 'superadmin',
    role: 'SuperAdmin',
    name: '超级管理员',
  };
  const teacherUser = {
    sub: 100,
    username: 'teacher1',
    role: 'Teacher',
    name: '张老师',
  };
  const parentUser = {
    sub: 200,
    username: 'parent1',
    role: 'Parent',
    name: '李家长',
  };

  // ─── Mock Exception ───

  const mockException = {
    id: 1,
    lessonId: 10,
    exceptionType: 'LEAVE_SICK',
    reason: '感冒发烧',
    startTime: new Date(),
    endTime: new Date(),
    status: 'PENDING',
    createdBy: 100,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lesson: {
      id: 10,
      classCode: 'CL2026070001',
      courseCode: 'CS2026070001',
      teacherId: 100,
      status: 'SCHEDULED',
      scheduledDate: '2026-07-12',
      startTime: '10:00',
      endTime: '11:30',
    },
  };

  const mockReschedule = {
    id: 1,
    exceptionId: 1,
    originalLessonId: 10,
    originalStart: new Date(),
    originalEnd: new Date(),
    rescheduledStart: new Date(),
    rescheduledEnd: new Date(),
    status: 'PENDING',
    operatorId: 1,
    originalLesson: { id: 10, classCode: 'CL2026070001', teacherId: 100 },
    newLesson: null,
  };

  beforeEach(async () => {
    const mockService = {
      findAllExceptionsWithQuery: jest.fn(),
      findExceptionByIdWithRelations: jest.fn(),
      canAccessException: jest.fn(),
      findExceptionsLogsByException: jest.fn(),
      findRescheduleByExceptionId: jest.fn(),
      applyLeave: jest.fn(),
      applySuspend: jest.fn(),
      applyMakeup: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      findExceptionsByLesson: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonExceptionController],
      providers: [{ provide: LessonExceptionService, useValue: mockService }],
    }).compile();

    controller = module.get<LessonExceptionController>(
      LessonExceptionController,
    );
    service = module.get(LessonExceptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════
  // 权限控制测试
  // ═══════════════════════════════════════════════════

  describe('权限控制 - findAll', () => {
    it('管理员可以查看全部异常', async () => {
      service.findAllExceptionsWithQuery.mockResolvedValue([
        mockException as any,
      ]);

      const query: QueryExceptionDto = {};
      const result = await controller.findAll(query, adminUser);

      expect(service.findAllExceptionsWithQuery).toHaveBeenCalledWith(
        query,
        adminUser,
      );
      expect(result).toBeDefined();
      expect(result.code).toBe(0); // ApiResponse.success() uses code=0
    });

    it('教师查询时传入教师身份', async () => {
      service.findAllExceptionsWithQuery.mockResolvedValue([
        mockException as any,
      ]);

      const query: QueryExceptionDto = {};
      const result = await controller.findAll(query, teacherUser);

      expect(service.findAllExceptionsWithQuery).toHaveBeenCalledWith(
        query,
        teacherUser,
      );
      expect(result).toBeDefined();
    });

    it('家长查询时传入家长身份', async () => {
      service.findAllExceptionsWithQuery.mockResolvedValue([]);

      const query: QueryExceptionDto = {};
      const result = await controller.findAll(query, parentUser);

      expect(service.findAllExceptionsWithQuery).toHaveBeenCalledWith(
        query,
        parentUser,
      );
      expect(result).toBeDefined();
    });

    it('支持按 status 过滤', async () => {
      service.findAllExceptionsWithQuery.mockResolvedValue([
        mockException as any,
      ]);

      const query: QueryExceptionDto = { status: 'PENDING' };
      await controller.findAll(query, adminUser);

      expect(service.findAllExceptionsWithQuery).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
        adminUser,
      );
    });

    it('支持按 exceptionType 过滤', async () => {
      service.findAllExceptionsWithQuery.mockResolvedValue([
        mockException as any,
      ]);

      const query: QueryExceptionDto = { exceptionType: 'LEAVE_SICK' };
      await controller.findAll(query, adminUser);

      expect(service.findAllExceptionsWithQuery).toHaveBeenCalledWith(
        expect.objectContaining({ exceptionType: 'LEAVE_SICK' }),
        adminUser,
      );
    });
  });

  describe('权限控制 - findOne', () => {
    it('管理员可以查看任意异常详情', async () => {
      service.canAccessException.mockResolvedValue(true);
      service.findExceptionByIdWithRelations.mockResolvedValue(
        mockException as any,
      );
      service.findExceptionsLogsByException.mockResolvedValue([]);
      service.findRescheduleByExceptionId.mockResolvedValue(null);

      const result = await controller.findOne(1, adminUser);

      expect(service.canAccessException).toHaveBeenCalledWith(1, adminUser);
      expect(result).toBeDefined();
      expect(result.code).toBe(0);
    });

    it('无权访问时返回 403', async () => {
      service.canAccessException.mockResolvedValue(false);

      await expect(controller.findOne(999, teacherUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.canAccessException).toHaveBeenCalledWith(999, teacherUser);
    });

    it('返回结果包含 logs 和 reschedule 信息', async () => {
      service.canAccessException.mockResolvedValue(true);
      service.findExceptionByIdWithRelations.mockResolvedValue(
        mockException as any,
      );
      service.findExceptionsLogsByException.mockResolvedValue([
        { id: 1, fromStatus: 'PENDING', toStatus: 'APPROVED' } as any,
      ]);
      service.findRescheduleByExceptionId.mockResolvedValue(
        mockReschedule as any,
      );

      const result = await controller.findOne(1, adminUser);

      expect(result.data).toBeDefined();
      expect(result.data.logs).toHaveLength(1);
      expect(result.data.reschedule).toBeDefined();
    });
  });

  describe('权限控制 - approve', () => {
    it('管理员可以审批异常', async () => {
      service.approve.mockResolvedValue({
        ...mockException,
        status: 'APPROVED',
      } as any);

      const dto: ApproveExceptionDto = { remark: '同意请假' };
      const result = await controller.approve(1, dto, adminUser);

      expect(service.approve).toHaveBeenCalledWith(1, 1, '同意请假');
      expect(result).toBeDefined();
      expect(result.code).toBe(0);
    });

    it('教师不能审批自己的课程异常', async () => {
      // Mock that the exception belongs to this teacher
      const teacherException = {
        ...mockException,
        lesson: { ...mockException.lesson, teacherId: 100 }, // teacherUser.sub === 100
      };
      service.findExceptionByIdWithRelations.mockResolvedValue(
        teacherException as any,
      );

      const dto: ApproveExceptionDto = { remark: '同意' };

      await expect(controller.approve(1, dto, teacherUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.approve).not.toHaveBeenCalled();
    });

    it('教师在 RolesGuard 层被禁止审批（控制器只防自审）', async () => {
      // The @Roles('SuperAdmin', 'Admin') decorator blocks all Teachers at the guard level.
      // The controller body only prevents teachers from approving their OWN exceptions
      // as an additional safety net. This test verifies the controller body allows
      // a Teacher to proceed for another teacher's exception (the guard would block
      // before reaching this point in production).
      const otherTeacherException = {
        ...mockException,
        lesson: { ...mockException.lesson, teacherId: 999 },
      };
      service.findExceptionByIdWithRelations.mockResolvedValue(
        otherTeacherException as any,
      );
      service.approve.mockResolvedValue({
        ...otherTeacherException,
        status: 'APPROVED',
      } as any);

      const dto: ApproveExceptionDto = { remark: '同意' };

      // Controller body does NOT block teacher approving another teacher's exception
      const result = await controller.approve(1, dto, teacherUser);
      expect(result.code).toBe(0);
      expect(service.approve).toHaveBeenCalled();
    });
  });

  describe('权限控制 - findReschedule', () => {
    it('管理员可以查看补课安排', async () => {
      service.canAccessException.mockResolvedValue(true);
      service.findRescheduleByExceptionId.mockResolvedValue(
        mockReschedule as any,
      );

      const result = await controller.findReschedule(1, adminUser);

      expect(service.canAccessException).toHaveBeenCalledWith(1, adminUser);
      expect(result.code).toBe(0);
    });

    it('无权访问时返回 403', async () => {
      service.canAccessException.mockResolvedValue(false);

      await expect(controller.findReschedule(1, parentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ═══════════════════════════════════════════════════
  // 数据隔离测试
  // ═══════════════════════════════════════════════════

  describe('数据隔离', () => {
    it('Service 层根据教师 role 调用带 teacherId 过滤的查询', async () => {
      service.findAllExceptionsWithQuery.mockResolvedValue([]);

      const query: QueryExceptionDto = {};
      await controller.findAll(query, { sub: 100, role: 'Teacher' });

      // Verify the user object is passed through
      expect(service.findAllExceptionsWithQuery).toHaveBeenCalledWith(
        query,
        expect.objectContaining({ sub: 100, role: 'Teacher' }),
      );
    });

    it('Service 层根据家长 role 调用带 parentId 过滤的查询', async () => {
      service.findAllExceptionsWithQuery.mockResolvedValue([]);

      const query: QueryExceptionDto = {};
      await controller.findAll(query, { sub: 200, role: 'Parent' });

      expect(service.findAllExceptionsWithQuery).toHaveBeenCalledWith(
        query,
        expect.objectContaining({ sub: 200, role: 'Parent' }),
      );
    });
  });
});
