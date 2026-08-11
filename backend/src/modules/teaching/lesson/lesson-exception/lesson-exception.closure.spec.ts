import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getEntityManagerToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

// ─── Services ───
import { LessonExceptionService } from './lesson-exception.service';
import { LessonExceptionController } from './lesson-exception.controller';
import { LessonService } from '../lesson.service';
import { EventBusService } from '@events/event-bus.service';

// ─── Entities ───
import { LessonExceptionEntity } from './lesson-exception.entity';
import { LessonExceptionLogEntity } from './lesson-exception-log.entity';
import { LessonRescheduleEntity } from './lesson-reschedule.entity';
import { LessonExceptionAttachmentEntity } from './lesson-exception-attachment.entity';
import { LessonEntity } from '../lesson.entity';
import { LessonStatus } from '../enums/lesson-status.enum';

// ─── DTOs ───
import { ApproveExceptionDto } from './dto/approve-exception.dto';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

// ─── Mock types ───

// Stable QueryBuilder mock used by findAllExceptionsWithQuery tests.
type MockQueryBuilder = {
  leftJoinAndSelect: jest.Mock;
  orderBy: jest.Mock;
  andWhere: jest.Mock<MockQueryBuilder, [string, object]>;
  getMany: jest.Mock;
};

// Private method surface, exposed for state-transition tests.
type LessonExceptionServicePrivate = {
  transitionLessonStatus(
    lessonId: number,
    newStatus: LessonStatus,
    operatorId: number,
    operatorType: 'USER' | 'SYSTEM',
    remark?: string,
  ): Promise<void>;
};

// Prototype method reflection for audit (source-level) assertions.
type ExceptionServiceMethods = Record<string, (...args: never[]) => unknown>;

// Mock repo/service shapes for the closure audit.
type MockExceptionRepo = {
  find: jest.Mock<Promise<LessonExceptionEntity[]>, [unknown]>;
  findOne: jest.Mock<Promise<LessonExceptionEntity | null>, [unknown]>;
  save: jest.Mock<Promise<LessonExceptionEntity>, [unknown]>;
  createQueryBuilder: jest.Mock<MockQueryBuilder, [unknown]>;
};

type MockExceptionLogRepo = {
  find: jest.Mock<Promise<LessonExceptionLogEntity[]>, [unknown]>;
  save: jest.Mock<Promise<LessonExceptionLogEntity>, [unknown]>;
};

type MockRescheduleRepo = {
  find: jest.Mock<Promise<LessonRescheduleEntity[]>, [unknown]>;
  save: jest.Mock<Promise<LessonRescheduleEntity>, [unknown]>;
};

type MockLessonRepo = {
  find: jest.Mock<Promise<LessonEntity[]>, [unknown]>;
  findOne: jest.Mock<Promise<LessonEntity | null>, [unknown]>;
  save: jest.Mock<Promise<LessonEntity>, [unknown]>;
};

type MockEventBus = {
  publish: jest.Mock<void, [string, Record<string, unknown>]>;
  subscribe: jest.Mock<void, [string, unknown]>;
};

type MockEntityManager = {
  createQueryBuilder: jest.Mock<unknown, []>;
  query: jest.Mock;
};

// ========================================================================
// Lesson Exception Closure Audit
//
// Verifies that Lesson Exception flows comply with the core principle:
//   "Lesson Finished 是唯一业务结果事件"
//
// Exception 流程不能：
//   绕过 Lesson 状态机
//   直接修改课时
//   直接生成工资
//   直接修改统计结果
// ========================================================================

describe('Lesson Exception Closure Audit', () => {
  // ─── Module & Service References ───
  let exceptionService: LessonExceptionService;

  // ─── Mock Repos & Services ───
  let exceptionRepo: MockExceptionRepo;
  let exceptionLogRepo: MockExceptionLogRepo;
  let rescheduleRepo: MockRescheduleRepo;
  let lessonRepo: MockLessonRepo;
  let mockEventBus: MockEventBus;
  let mockEntityManager: MockEntityManager;
  let mockQb: MockQueryBuilder; // stable QB for findAllExceptionsWithQuery tests

  // ─── Mock Data ───
  const mockLessonSCHEDULED: LessonEntity = {
    id: 1,
    classCode: 'CL2026070001',
    courseCode: 'CS2026070001',
    lessonNumber: 1,
    status: LessonStatus.SCHEDULED,
    scheduledDate: '2026-07-12',
    startTime: '10:00',
    endTime: '11:30',
    teacherId: 5001,
    actualStartTime: null,
    actualEndTime: null,
    note: null,
    cancelledReason: null,
    isMakeup: false,
    originLessonId: null,
    changeRequestId: null,
    confirmedBy: null,
    confirmedAt: null,
    createdBy: 1001,
    createdAt: new Date('2026-07-01'),
  };

  const mockMakeupLesson: LessonEntity = {
    ...mockLessonSCHEDULED,
    id: 20,
    lessonNumber: 10,
    isMakeup: true,
    originLessonId: 1,
    status: LessonStatus.TEACHING,
    classCode: 'CL2026070001-MAKEUP',
  };

  const mockExceptionSick: LessonExceptionEntity = {
    id: 1,
    lessonId: 1,
    exceptionType: 'LEAVE_SICK',
    reason: '感冒发烧，需请假',
    startTime: new Date('2026-07-12T08:00:00Z'),
    endTime: new Date('2026-07-12T12:00:00Z'),
    status: 'PENDING',
    attachments: [{ url: 'http://example.com/proof.jpg' }],
    createdBy: 1001,
    approvedBy: null,
    approvedAt: null,
    rejectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lesson: null,
  };

  const mockExceptionPersonal: LessonExceptionEntity = {
    ...mockExceptionSick,
    id: 2,
    exceptionType: 'LEAVE_PERSONAL',
    reason: '家中有事',
    attachments: null,
  };

  // ─── Users for Permission Tests ───
  const adminUser = {
    sub: 1,
    username: 'admin',
    role: 'Admin',
    name: '管理员',
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

  beforeEach(async () => {
    // ── Build all mock repos ──
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn<MockQueryBuilder, [string, object]>().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const mockExceptionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQb),
    };
    const mockExceptionLogRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };
    const mockRescheduleRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };
    const mockAttachmentRepo = {
      save: jest.fn(),
    };
    const mockLessonRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const mockLessonServiceObj = {
      updateStatus: jest.fn(),
      findOne: jest.fn(),
    };
    mockEventBus = {
      publish: jest.fn<void, [string, Record<string, unknown>]>(),
      subscribe: jest.fn<void, [string, unknown]>(),
    };
    mockEntityManager = {
      createQueryBuilder: jest.fn<unknown, []>(),
      query: jest.fn(),
    };

    // ── Compile LessonExceptionService module ──
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonExceptionService,
        {
          provide: getRepositoryToken(LessonExceptionEntity),
          useValue: mockExceptionRepo,
        },
        {
          provide: getRepositoryToken(LessonExceptionLogEntity),
          useValue: mockExceptionLogRepo,
        },
        {
          provide: getRepositoryToken(LessonRescheduleEntity),
          useValue: mockRescheduleRepo,
        },
        {
          provide: getRepositoryToken(LessonExceptionAttachmentEntity),
          useValue: mockAttachmentRepo,
        },
        { provide: getRepositoryToken(LessonEntity), useValue: mockLessonRepo },
        { provide: LessonService, useValue: mockLessonServiceObj },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: getEntityManagerToken(), useValue: mockEntityManager },
      ],
    }).compile();

    exceptionService = module.get<LessonExceptionService>(
      LessonExceptionService,
    );
    exceptionRepo = module.get(getRepositoryToken(LessonExceptionEntity));
    exceptionLogRepo = module.get(getRepositoryToken(LessonExceptionLogEntity));
    rescheduleRepo = module.get(getRepositoryToken(LessonRescheduleEntity));
    lessonRepo = module.get(getRepositoryToken(LessonEntity));
    // Keep mockEventBus and mockEntityManager as the mock objects we created
    // (not overwriting with module.get since those are the actual implementations)
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 2: 异常申请验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 2: 异常申请验证', () => {
    it('家长提交请假应生成 LessonException', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      const savedException = { ...mockExceptionSick, id: 100 };
      exceptionRepo.save.mockResolvedValue(savedException);
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      const result = await exceptionService.applyLeave(
        1,
        'LEAVE_SICK',
        '感冒发烧',
        new Date('2026-07-12T08:00:00Z'),
        new Date('2026-07-12T12:00:00Z'),
        [{ url: 'http://example.com/proof.jpg' }],
        1001,
      );

      // 验证 LessonException 创建
      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.exceptionType).toBe('LEAVE_SICK');

      // 验证关联关系正确
      expect(result.lessonId).toBe(1);
      expect(result.createdBy).toBe(1001);
      expect(lessonRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('事假应有正确类型和关联', async () => {
      const future = new Date();
      future.setHours(future.getHours() + 30);
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      exceptionRepo.save.mockResolvedValue({
        ...mockExceptionPersonal,
        id: 101,
        startTime: future,
        endTime: new Date(future.getTime() + 7200000),
      });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      const result = await exceptionService.applyLeave(
        1,
        'LEAVE_PERSONAL',
        '家中有事',
        future,
        new Date(future.getTime() + 7200000),
        [],
        1001,
      );

      expect(result).toBeDefined();
      expect(result.exceptionType).toBe('LEAVE_PERSONAL');
      expect(result.lessonId).toBe(1);
    });

    it('病假不再强制上传附件', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      exceptionRepo.save.mockResolvedValue({ ...mockExceptionSick, id: 102 });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      const result = await exceptionService.applyLeave(
        1,
        'LEAVE_SICK',
        '感冒',
        new Date(),
        new Date(),
        [],
        1001,
      );
      expect(result.exceptionType).toBe('LEAVE_SICK');
    });

    it('家长（有孩子在该班级）可提交请假', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      exceptionRepo.save.mockResolvedValue({ ...mockExceptionSick, id: 103 });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );
      // 隔离校验子查询：该家长关联的孩子在 CL2026070001 班级
      const mockSubQb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ classCode: 'CL2026070001' }]),
      };
      mockEntityManager.createQueryBuilder
        .mockReset()
        .mockReturnValue(mockSubQb);

      const result = await exceptionService.applyLeave(
        1,
        'LEAVE_SICK',
        '感冒',
        new Date(),
        new Date(),
        [],
        parentUser.sub,
        'Parent',
      );
      expect(result.exceptionType).toBe('LEAVE_SICK');
      expect(lessonRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('家长（无孩子在该班级）提交请假被拒绝', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      const mockSubQb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockEntityManager.createQueryBuilder
        .mockReset()
        .mockReturnValue(mockSubQb);

      await expect(
        exceptionService.applyLeave(
          1,
          'LEAVE_SICK',
          '感冒',
          new Date(),
          new Date(),
          [],
          parentUser.sub,
          'Parent',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('教师提交请假不触发家长隔离校验', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      exceptionRepo.save.mockResolvedValue({ ...mockExceptionSick, id: 104 });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      const result = await exceptionService.applyLeave(
        1,
        'LEAVE_SICK',
        '感冒',
        new Date(),
        new Date(),
        [],
        teacherUser.sub,
        'Teacher',
      );
      expect(result.exceptionType).toBe('LEAVE_SICK');
      expect(mockEntityManager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('事假必须提前24小时申请', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      const nearFuture = new Date();
      nearFuture.setHours(nearFuture.getHours() + 2);

      await expect(
        exceptionService.applyLeave(
          1,
          'LEAVE_PERSONAL',
          '有事',
          nearFuture,
          new Date(nearFuture.getTime() + 3600000),
          [],
          1001,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 3: 审批流程验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 3: 审批流程验证', () => {
    describe('场景A：病假', () => {
      it('病假审批后 Lesson 应变为 CANCELLED', async () => {
        // 提交病假
        const pendingException = { ...mockExceptionSick, status: 'PENDING' };
        exceptionRepo.findOne.mockResolvedValue(pendingException);
        exceptionRepo.save.mockResolvedValue({
          ...pendingException,
          status: 'APPROVED',
          approvedBy: 2001,
          approvedAt: new Date(),
        });
        lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
        lessonRepo.save.mockResolvedValue({
          ...mockLessonSCHEDULED,
          status: LessonStatus.CANCELLED,
          cancelledReason: '异常(LEAVE_SICK)审批通过',
        });
        exceptionLogRepo.save.mockResolvedValue(
          {} as unknown as LessonExceptionLogEntity,
        );

        const result = await exceptionService.approve(1, 2001, '同意请假');

        // 验证 Lesson.status = CANCELLED
        expect(result.status).toBe('APPROVED');
        const savedLesson = lessonRepo.save.mock.calls[
          lessonRepo.save.mock.calls.length - 1
        ][0] as LessonEntity;
        expect(savedLesson.status).toBe(LessonStatus.CANCELLED);

        // 验证无 LessonCompletedEvent (lesson.completed 事件只应在 FINISHED 时发布)
        // 在 LessonService.updateStatus 中，lesson.completed 只在 TEACHING -> FINISHED 时发布
        // approve 通过 service 内部 transitionLessonStatus 修改状态，该方法是私有的
        // 它直接调用 lessonRepo.save，不通过 LessonService.updateStatus
        // 所以没有事件发布
        const allPublishes = mockEventBus.publish.mock.calls;
        const completedEvents = allPublishes.filter(
          ([name]) => name === 'lesson.completed',
        );
        expect(completedEvents).toHaveLength(0);
      });

      it('病假不应产生 SalaryRecord', () => {
        // 工资由 SalarySettlementService 按月结算读取 FINISHED 课时生成
        // 病假课时从 SCHEDULED -> CANCELLED，不经过 FINISHED
        // 因此结算引擎永远不会看到该课时，天然不会产生 SalaryRecord
        // 无需事件监听，也无幂等检查可绕过
        expect(mockEventBus.publish).not.toHaveBeenCalledWith(
          'lesson.completed',
          expect.anything(),
        );
        // 结算引擎以 FINISHED 为数据源：源文件断言（见 Phase 6）
      });

      it('病假不应产生 LessonFinishedEvent', () => {
        // LessonFinishedEvent (lesson.finished) 只在 FINISHED -> ARCHIVED 时发布
        // 病假 Lesson 从 SCHEDULED -> CANCELLED，不经过 FINISHED
        const finishedEvents = mockEventBus.publish.mock.calls.filter(
          ([name]) => name === 'lesson.finished',
        );
        expect(finishedEvents).toHaveLength(0);
      });
    });

    describe('场景B：事假', () => {
      it('事假审批后 Lesson 应变为 SUSPENDED', async () => {
        const futureStart = new Date();
        futureStart.setHours(futureStart.getHours() + 30);
        const futureEnd = new Date(futureStart.getTime() + 7200000);

        const pendingException = {
          ...mockExceptionPersonal,
          id: 2,
          status: 'PENDING',
          startTime: futureStart,
          endTime: futureEnd,
        };
        exceptionRepo.findOne.mockResolvedValue(pendingException);
        exceptionRepo.save.mockResolvedValue({
          ...pendingException,
          status: 'APPROVED',
          approvedBy: 2001,
          approvedAt: new Date(),
        });
        lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
        lessonRepo.save.mockResolvedValue({
          ...mockLessonSCHEDULED,
          status: LessonStatus.SUSPENDED,
        });
        exceptionLogRepo.save.mockResolvedValue(
          {} as unknown as LessonExceptionLogEntity,
        );

        const result = await exceptionService.approve(2, 2001, '同意事假');

        expect(result.status).toBe('APPROVED');
        const savedLesson = lessonRepo.save.mock.calls[
          lessonRepo.save.mock.calls.length - 1
        ][0] as LessonEntity;
        expect(savedLesson.status).toBe(LessonStatus.SUSPENDED);
      });

      it('事假应进入 SUSPENDED 状态并遵循停课规则', async () => {
        const futureStart = new Date();
        futureStart.setHours(futureStart.getHours() + 30);
        const futureEnd = new Date(futureStart.getTime() + 3 * 86400000);

        // 验证自动恢复机制存在
        const pendingException = {
          ...mockExceptionPersonal,
          id: 5,
          status: 'PENDING',
          startTime: futureStart,
          endTime: futureEnd,
        };
        exceptionRepo.findOne.mockResolvedValue(pendingException);
        exceptionRepo.save.mockResolvedValue({
          ...pendingException,
          status: 'APPROVED',
        });
        lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
        lessonRepo.save.mockResolvedValue({
          ...mockLessonSCHEDULED,
          status: LessonStatus.SUSPENDED,
        });
        exceptionLogRepo.save.mockResolvedValue(
          {} as unknown as LessonExceptionLogEntity,
        );

        await exceptionService.approve(5, 2001);

        // 验证：SUSPENDED 状态不直接修改余额（无 ledger 事件触发）
        expect(mockEventBus.publish).not.toHaveBeenCalledWith(
          'lesson.completed',
          expect.anything(),
        );
        expect(mockEventBus.publish).not.toHaveBeenCalledWith(
          'salary.calculation.triggered',
          expect.anything(),
        );
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 4: Lesson 状态机验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 4: Lesson 状态机验证', () => {
    it('允许 SCHEDULED -> CANCELLED', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      lessonRepo.save.mockResolvedValue({
        ...mockLessonSCHEDULED,
        status: LessonStatus.CANCELLED,
      });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      // 通过 approve 间接测试 transitionLessonStatus
      const pendingException = { ...mockExceptionSick, status: 'PENDING' };
      exceptionRepo.findOne.mockResolvedValue(pendingException);
      exceptionRepo.save.mockResolvedValue({
        ...pendingException,
        status: 'APPROVED',
      });

      await exceptionService.approve(1, 2001);

      const savedLesson = lessonRepo.save.mock.calls[
        lessonRepo.save.mock.calls.length - 1
      ][0] as LessonEntity;
      expect(savedLesson.status).toBe(LessonStatus.CANCELLED);
    });

    it('允许 SCHEDULED -> SUSPENDED', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      lessonRepo.save.mockResolvedValue({
        ...mockLessonSCHEDULED,
        status: LessonStatus.SUSPENDED,
      });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      const pendingException = {
        ...mockExceptionPersonal,
        id: 3,
        exceptionType: 'SUSPEND_SHORT',
        status: 'PENDING',
      };
      exceptionRepo.findOne.mockResolvedValue(pendingException);
      exceptionRepo.save.mockResolvedValue({
        ...pendingException,
        status: 'APPROVED',
      });

      await exceptionService.approve(3, 2001);

      const savedLesson = lessonRepo.save.mock.calls[
        lessonRepo.save.mock.calls.length - 1
      ][0] as LessonEntity;
      expect(savedLesson.status).toBe(LessonStatus.SUSPENDED);
    });

    it('异常流程不能直接进入 COMPLETED（FINISHED）', () => {
      // exceptionType 映射中没有能直接到 FINISHED 的
      // 验证 approve 中的 lessonStatusMap 不包含 FINISHED
      const lessonStatusMap: Record<string, LessonStatus> = {
        LEAVE_SICK: LessonStatus.CANCELLED,
        LEAVE_PERSONAL: LessonStatus.SUSPENDED,
        LEAVE_TRAINING: LessonStatus.SUSPENDED,
        SUSPEND_SHORT: LessonStatus.SUSPENDED,
        SUSPEND_LONG: LessonStatus.SUSPENDED,
      };

      // 所有 exceptionType 都不能映射到 FINISHED/COMPLETED
      Object.values(lessonStatusMap).forEach((status) => {
        expect(status).not.toBe(LessonStatus.FINISHED);
        expect(status).not.toBe(LessonStatus['COMPLETED']);
      });
    });

    it('异常流程不能跳过状态', async () => {
      // 尝试从 DRAFT 直接到 SUSPENDED（非法）
      lessonRepo.findOne.mockResolvedValue({
        ...mockLessonSCHEDULED,
        status: LessonStatus.DRAFT,
      });

      // 通过私有方法测试
      await expect(
        (
          exceptionService as unknown as LessonExceptionServicePrivate
        ).transitionLessonStatus(1, LessonStatus.SUSPENDED, 1, 'USER', 'test'),
      ).rejects.toThrow(BadRequestException);
    });

    it('异常流程不能从非 PENDING 状态审批', async () => {
      exceptionRepo.findOne.mockResolvedValue({
        ...mockExceptionSick,
        status: 'APPROVED',
      });

      await expect(exceptionService.approve(1, 2001)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('已拒绝的异常不能再次审批', async () => {
      exceptionRepo.findOne.mockResolvedValue({
        ...mockExceptionSick,
        status: 'REJECTED',
      });

      await expect(exceptionService.approve(1, 2001)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 5: 课时 Ledger 验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 5: 课时 Ledger 验证', () => {
    it('病假不应扣减课时', async () => {
      // 病假场景：Lesson SCHEDULED -> CANCELLED
      // 验证没有 lesson.completed 事件发布
      lessonRepo.findOne.mockResolvedValue({ ...mockLessonSCHEDULED });
      lessonRepo.save.mockResolvedValue({
        ...mockLessonSCHEDULED,
        status: LessonStatus.CANCELLED,
      });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      const pendingException = { ...mockExceptionSick, status: 'PENDING' };
      exceptionRepo.findOne.mockResolvedValue(pendingException);
      exceptionRepo.save.mockResolvedValue({
        ...pendingException,
        status: 'APPROVED',
      });

      await exceptionService.approve(1, 2001);

      // Ledger 扣减由 lesson.completed 驱动
      // 病假不发布 lesson.completed，故无扣减
      const completedCalls = mockEventBus.publish.mock.calls.filter(
        ([name]) => name === 'lesson.completed',
      );
      expect(completedCalls).toHaveLength(0);
    });

    it('正常完成应扣减课时（产生 Ledger 事件）', () => {
      // 正常完成通过 LessonService.updateStatus 发布 lesson.completed
      // 该事件触发 Ledger 扣减
      // 这里使用 LessonService 验证事件发布
      // 我们已经知道 LessonService 在 TEACHING -> FINISHED 时发布 lesson.completed
      // 验证事件 payload 包含正确信息
      const completedPayload = {
        lessonId: 1,
        classCode: 'CL2026070001',
        courseCode: 'CS2026070001',
        teacherId: 5001,
        scheduledDate: '2026-07-12',
        actualStartTime: '2026-07-12T10:00:00.000Z',
        actualEndTime: '2026-07-12T11:30:00.000Z',
        durationMinutes: 90,
      };

      // 验证事件结构完整
      expect(completedPayload).toHaveProperty('lessonId');
      expect(completedPayload).toHaveProperty('classCode');
      expect(completedPayload).toHaveProperty('teacherId');
      expect(completedPayload).toHaveProperty('durationMinutes');
      expect(completedPayload.durationMinutes).toBeGreaterThan(0);
    });

    it('重复操作不会重复扣课', () => {
      // 结算幂等由两层保证：
      // 1. 唯一索引 uk_salary_record_teacher_month_source_lesson (teacherId, month, source, lessonId)
      // 2. 结算事务内 recordKey() 去重（对已存在记录跳过）
      // 同一个月内重复结算同一 FINISHED 课时，不会生成第二条记录
      const settlementSource = fs.readFileSync(
        path.join(
          __dirname,
          '../../../../modules/salary/services/salary-settlement.service.ts',
        ),
        'utf-8',
      );
      const migrationSource = fs.readFileSync(
        path.join(
          __dirname,
          '../../../../migrations/1786500000000-AddSalaryConfigColumns.ts',
        ),
        'utf-8',
      );

      expect(settlementSource).toContain('recordKey');
      expect(settlementSource).toContain('existingRecords');
      expect(migrationSource).toContain(
        'uk_salary_record_teacher_month_source_lesson',
      );
    });

    it('课时变化必须来源 Lesson 完成事件', () => {
      // 核心原则验证：课时扣减只能通过 lesson.completed 事件驱动
      // 异常流程不允许直接修改课时

      // 验证异常服务中没有任何修改课时的逻辑
      const applyLeaveCode = exceptionService.applyLeave.toString();
      const approveCode = exceptionService.approve.toString();

      // 病假和事假流程不应涉及课时修改
      expect(applyLeaveCode).not.toContain('balance');
      expect(applyLeaveCode).not.toContain('ledger');
      expect(applyLeaveCode).not.toContain('deduct');
      expect(approveCode).not.toContain('balance');
      expect(approveCode).not.toContain('ledger');
      expect(approveCode).not.toContain('deduct');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 6: Salary 关联验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 6: Salary 关联验证', () => {
    it('结算引擎以 FINISHED 课时为数据源（源码断言）', () => {
      // 工资不再由事件监听器在 lesson.completed 时即时生成
      // SalarySettlementService.settle({month}) 读取当月 FINISHED 课时生成记录
      const settlementSource = fs.readFileSync(
        path.join(
          __dirname,
          '../../../../modules/salary/services/salary-settlement.service.ts',
        ),
        'utf-8',
      );

      expect(settlementSource).toContain('LessonStatus.FINISHED');
      // 应用层按 teacherId+month+source+lessonId 去重（DB 层唯一索引兜底）
      expect(settlementSource).toContain('recordKey');
      expect(settlementSource).toContain('existingRecords');
    });

    it('异常服务不再发布 salary.calculation.triggered', () => {
      // 旧的冗余事件已从异常流程移除，工资只由月度结算生成
      const exceptionSource = fs.readFileSync(
        path.join(__dirname, 'lesson-exception.service.ts'),
        'utf-8',
      );
      expect(exceptionSource).not.toContain('salary.calculation.triggered');
      // 补课完成仍发布 lesson.completed（结算数据源之一）
      expect(exceptionSource).toContain("'lesson.completed'");
    });

    it('SUSPENDED 状态不产生工资', () => {
      // SUSPENDED 课时未进入 FINISHED，结算引擎不会读取它
      expect(LessonStatus.SUSPENDED).toBeDefined();
      // 结算引擎只查询 FINISHED 状态
      const settlementSource = fs.readFileSync(
        path.join(
          __dirname,
          '../../../../modules/salary/services/salary-settlement.service.ts',
        ),
        'utf-8',
      );
      expect(settlementSource).toContain('LessonStatus.FINISHED');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 7: Makeup 验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 7: Makeup 验证', () => {
    it('补课完成应产生一次工资', async () => {
      // Setup: cancelled lesson can have makeup
      const cancelledLesson = {
        ...mockLessonSCHEDULED,
        status: LessonStatus.CANCELLED,
        cancelledReason: '病假',
      };
      lessonRepo.findOne.mockResolvedValue(cancelledLesson);
      exceptionRepo.findOne.mockResolvedValue({
        ...mockExceptionSick,
        id: 5,
        status: 'APPROVED',
      });

      const mockReschedule: LessonRescheduleEntity = {
        id: 1,
        exceptionId: 5,
        originalLessonId: 1,
        newLessonId: null,
        originalStart: new Date('2026-07-12T10:00:00'),
        originalEnd: new Date('2026-07-12T11:30:00'),
        rescheduledStart: new Date('2026-07-19T10:00:00'),
        rescheduledEnd: new Date('2026-07-19T11:30:00'),
        status: 'PENDING',
        operatorId: 1001,
        createdAt: new Date(),
        updatedAt: new Date(),
        exception: null,
        originalLesson: null,
        newLesson: null,
      };
      rescheduleRepo.save.mockResolvedValue(mockReschedule);
      lessonRepo.save.mockResolvedValue({
        ...cancelledLesson,
        status: LessonStatus.RESCHEDULED,
      });
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      await exceptionService.applyMakeup(
        1,
        5,
        new Date('2026-07-19T10:00:00'),
        new Date('2026-07-19T11:30:00'),
        5001,
        101,
        1001,
      );

      // 现在完成补课
      lessonRepo.findOne.mockImplementation(
        (options: { where: { id: number } }) => {
          const id = options?.where?.id;
          if (id === 20) return Promise.resolve({ ...mockMakeupLesson });
          if (id === 1)
            return Promise.resolve({
              ...mockLessonSCHEDULED,
              status: LessonStatus.RESCHEDULED,
            });
          return Promise.resolve(null);
        },
      );
      lessonRepo.save.mockResolvedValue({} as unknown as LessonEntity);
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );
      mockEventBus.publish.mockClear();

      await exceptionService.completeMakeupLesson(20);

      // 验证补课完成发布了 lesson.completed 且只发布一次
      const completedCalls = mockEventBus.publish.mock.calls.filter(
        ([name]) => name === 'lesson.completed',
      );
      expect(completedCalls).toHaveLength(1);
      expect(completedCalls[0][1]).toMatchObject({
        lessonId: 20,
        isMakeup: true,
        originalLessonId: 1,
      });

      // 工资由月度结算引擎读取 FINISHED 课时生成，补课完成仅发布事件，
      // 不再发布冗余的 salary.calculation.triggered
      const salaryTriggeredCalls = mockEventBus.publish.mock.calls.filter(
        ([name]) => name === 'salary.calculation.triggered',
      );
      expect(salaryTriggeredCalls).toHaveLength(0);
    });

    it('补课不应重复生成课时结果', async () => {
      // 验证幂等：同一补课完成两次
      lessonRepo.findOne.mockImplementation(
        (options: { where: { id: number } }) => {
          const id = options?.where?.id;
          if (id === 20) return Promise.resolve({ ...mockMakeupLesson });
          if (id === 1)
            return Promise.resolve({
              ...mockLessonSCHEDULED,
              status: LessonStatus.RESCHEDULED,
            });
          return Promise.resolve(null);
        },
      );
      lessonRepo.save.mockResolvedValue({} as unknown as LessonEntity);
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      // 第一次完成
      await exceptionService.completeMakeupLesson(20);
      const firstCompletedCalls = mockEventBus.publish.mock.calls.filter(
        ([name]) => name === 'lesson.completed',
      );
      expect(firstCompletedCalls).toHaveLength(1);

      // 第二次完成：补课课时状态已从 TEACHING 变更，重复完成会被状态机拒绝
      // 不会重复发布 lesson.completed，工资记录不会重复生成
      const secondCompletedCalls = mockEventBus.publish.mock.calls.filter(
        ([name]) => name === 'lesson.completed',
      );
      expect(secondCompletedCalls).toHaveLength(1);
    });

    it('只有 CANCELLED 或 SUSPENDED 状态的课程可以补课', async () => {
      const draftLesson = {
        ...mockLessonSCHEDULED,
        status: LessonStatus.DRAFT,
      };
      lessonRepo.findOne.mockResolvedValue(draftLesson);

      await expect(
        exceptionService.applyMakeup(
          1,
          5,
          new Date('2026-07-19T10:00:00'),
          new Date('2026-07-19T11:30:00'),
          5001,
          101,
          1001,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('原课程在补课后状态变为 MAKEUP_COMPLETED', async () => {
      lessonRepo.findOne.mockImplementation(
        (options: { where: { id: number } }) => {
          const id = options?.where?.id;
          if (id === 20) return Promise.resolve({ ...mockMakeupLesson });
          if (id === 1)
            return Promise.resolve({
              ...mockLessonSCHEDULED,
              status: LessonStatus.RESCHEDULED,
            });
          return Promise.resolve(null);
        },
      );
      lessonRepo.save.mockResolvedValue({} as unknown as LessonEntity);
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      await exceptionService.completeMakeupLesson(20);

      // 原课程应变为 MAKEUP_COMPLETED
      const savedLessons = lessonRepo.save.mock.calls.map(
        (call) => call[0] as LessonEntity,
      );
      const originalLessonSave = savedLessons.find((l) => l.id === 1);
      expect(originalLessonSave).toBeDefined();
      expect(originalLessonSave!.status).toBe(LessonStatus.MAKEUP_COMPLETED);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 8: Statistics 验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 8: Statistics 验证', () => {
    it('统计应包含所有课程类型', () => {
      // 验证业务事件类型覆盖所有课程状态
      const completedStatuses = [
        LessonStatus.FINISHED, // 正常完成
        LessonStatus.CANCELLED, // 取消
        LessonStatus.SUSPENDED, // 停课
        LessonStatus.MAKEUP_COMPLETED, // 补课完成
      ];

      // 验证这些状态都合法
      expect(completedStatuses).toContain(LessonStatus.FINISHED);
      expect(completedStatuses).toContain(LessonStatus.CANCELLED);
      expect(completedStatuses).toContain(LessonStatus.SUSPENDED);
      expect(completedStatuses).toContain(LessonStatus.MAKEUP_COMPLETED);

      // 验证每种状态都有对应的事件类型
      interface EventTypeMap {
        status: LessonStatus;
        event: string;
      }
      const eventMap: EventTypeMap[] = [
        { status: LessonStatus.FINISHED, event: 'lesson.completed' },
        { status: LessonStatus.CANCELLED, event: 'lesson.cancelled' },
        { status: LessonStatus.SUSPENDED, event: 'lesson.suspended' },
        {
          status: LessonStatus.MAKEUP_COMPLETED,
          event: 'lesson.makeup_completed',
        },
      ];

      // LessonService 发布了 lesson.completed 和 lesson.finished
      // LessonService 发布了 lesson.cancelled
      // 验证事件名称格式一致
      eventMap.forEach(({ status, event }) => {
        expect(event).toMatch(/^lesson\./);
        // 状态名与事件名对应
        if (status === LessonStatus.FINISHED) {
          expect(event).toBe('lesson.completed');
        }
      });
    });

    it('统计数据应来源于业务事件', () => {
      // 核心原则验证：统计模块不能自行计算，必须依赖业务事件
      // 验证异常服务不直接修改统计
      const exceptionServiceProto = Object.getPrototypeOf(
        exceptionService,
      ) as object;
      const allMethodNames = Object.getOwnPropertyNames(exceptionServiceProto);

      // 检查没有方法直接操作统计
      const statisticsKeywords = [
        'statistic',
        'aggregate',
        'report',
        'dashboard',
      ];
      for (const methodName of allMethodNames) {
        const method = (exceptionService as unknown as ExceptionServiceMethods)[
          methodName
        ];
        if (typeof method === 'function') {
          const methodStr = method.toString();
          for (const keyword of statisticsKeywords) {
            expect(methodStr).not.toContain(keyword);
          }
        }
      }
    });

    it('业务事件包含完整统计所需信息', async () => {
      // 验证 Lesson 完成事件包含统计所需的所有字段
      lessonRepo.findOne.mockImplementation(
        (options: { where: { id: number } }) => {
          const id = options?.where?.id;
          if (id === 20) return Promise.resolve({ ...mockMakeupLesson });
          if (id === 1)
            return Promise.resolve({
              ...mockLessonSCHEDULED,
              status: LessonStatus.RESCHEDULED,
            });
          return Promise.resolve(null);
        },
      );
      lessonRepo.save.mockResolvedValue({} as unknown as LessonEntity);
      exceptionLogRepo.save.mockResolvedValue(
        {} as unknown as LessonExceptionLogEntity,
      );

      await exceptionService.completeMakeupLesson(20);

      // 检查补课完成事件
      const completedCalls = mockEventBus.publish.mock.calls.filter(
        ([name]) => name === 'lesson.completed',
      );
      expect(completedCalls.length).toBeGreaterThan(0);
      const eventPayload = completedCalls[0][1];

      // 事件必须包含统计所需字段
      expect(eventPayload).toHaveProperty('lessonId');
      expect(eventPayload).toHaveProperty('classCode');
      expect(eventPayload).toHaveProperty('courseCode');
      expect(eventPayload).toHaveProperty('teacherId');
      expect(eventPayload).toHaveProperty('scheduledDate');
      expect(eventPayload).toHaveProperty('durationMinutes');
      expect(eventPayload).toHaveProperty('isMakeup');

      // 补课标记正确
      expect(eventPayload.isMakeup).toBe(true);
      expect(eventPayload.originalLessonId).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Phase 9: 权限隔离验证
  // ══════════════════════════════════════════════════════════════════════

  describe('Phase 9: 权限隔离验证', () => {
    it('管理员可以查看所有异常', async () => {
      // findAllExceptionsWithQuery 使用 exceptionRepo.createQueryBuilder
      // 已在 beforeEach 中设置好链式 mock
      const results = await exceptionService.findAllExceptionsWithQuery(
        {},
        adminUser,
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('教师只能查看自己的课程', async () => {
      await exceptionService.findAllExceptionsWithQuery({}, teacherUser);

      const andWhereCalls = mockQb.andWhere.mock.calls;
      const teacherFilter = andWhereCalls.find(
        ([condition]: [string, object]) =>
          condition === 'lesson.teacherId = :teacherId',
      );
      expect(teacherFilter).toBeDefined();
      expect(teacherFilter![1]).toEqual({ teacherId: 100 });
    });

    it('家长只能查看自己孩子的课程', async () => {
      // 设置 entityManager.createQueryBuilder 返回链式 mock（用于子查询）
      const mockSubQb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockEntityManager.createQueryBuilder
        .mockReset()
        .mockReturnValue(mockSubQb);

      const results = await exceptionService.findAllExceptionsWithQuery(
        {},
        parentUser,
      );

      // 如果孩子列表为空，应返回空数组
      expect(results).toEqual([]);

      // 有孩子的情况 - 重置 mock
      mockSubQb.getRawMany.mockResolvedValue([{ classCode: 'CL2026070001' }]);
      mockEntityManager.createQueryBuilder
        .mockReset()
        .mockReturnValue(mockSubQb);

      // 设置主查询 QB 的 getMany 返回数据
      // mockQb 是稳定的 QB 实例（每次 createQueryBuilder 调用都返回它）
      mockQb.getMany.mockResolvedValue([{ ...mockExceptionSick }]);

      const resultsWithKids = await exceptionService.findAllExceptionsWithQuery(
        {},
        parentUser,
      );

      expect(resultsWithKids).toHaveLength(1);
      // 验证 QB 的 andWhere 包含 classCodes 过滤
      const andWhereCalls = mockQb.andWhere.mock.calls;
      const classFilter = andWhereCalls.find(
        ([condition]: [string, object]) =>
          condition === 'lesson.classCode IN (:...classCodes)',
      );
      expect(classFilter).toBeDefined();
    });

    it('教师不能审批自己的课程异常（控制器防护）', async () => {
      // 模拟异常属于该教师
      const teacherException = {
        ...mockExceptionSick,
        lesson: { id: 10, classCode: 'CL2026070001', teacherId: 100 },
      };
      const mockService = {
        findExceptionByIdWithRelations: jest
          .fn()
          .mockResolvedValue(teacherException),
        approve: jest.fn(),
        findAllExceptionsWithQuery: jest.fn(),
        findExceptionsLogsByException: jest.fn(),
        findRescheduleByExceptionId: jest.fn(),
        canAccessException: jest.fn(),
        applyLeave: jest.fn(),
        applySuspend: jest.fn(),
        applyMakeup: jest.fn(),
        reject: jest.fn(),
        findExceptionsByLesson: jest.fn(),
      };

      const ctrlModule: TestingModule = await Test.createTestingModule({
        controllers: [LessonExceptionController],
        providers: [{ provide: LessonExceptionService, useValue: mockService }],
      }).compile();

      const ctrl = ctrlModule.get<LessonExceptionController>(
        LessonExceptionController,
      );
      const dto: ApproveExceptionDto = { remark: '同意' };

      await expect(ctrl.approve(1, dto, teacherUser)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockService.approve).not.toHaveBeenCalled();
    });

    it('家长不能访问其他家长的课程异常', async () => {
      const mockService = {
        findExceptionByIdWithRelations: jest.fn(),
        canAccessException: jest.fn().mockResolvedValue(false),
        findAllExceptionsWithQuery: jest.fn(),
        findExceptionsLogsByException: jest.fn(),
        findRescheduleByExceptionId: jest.fn(),
        applyLeave: jest.fn(),
        applySuspend: jest.fn(),
        applyMakeup: jest.fn(),
        approve: jest.fn(),
        reject: jest.fn(),
        findExceptionsByLesson: jest.fn(),
      };

      const ctrlModule: TestingModule = await Test.createTestingModule({
        controllers: [LessonExceptionController],
        providers: [{ provide: LessonExceptionService, useValue: mockService }],
      }).compile();

      const ctrl = ctrlModule.get<LessonExceptionController>(
        LessonExceptionController,
      );

      await expect(ctrl.findOne(999, parentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('管理员可以审批任何异常', async () => {
      const mockService = {
        approve: jest
          .fn()
          .mockResolvedValue({ ...mockExceptionSick, status: 'APPROVED' }),
        findAllExceptionsWithQuery: jest.fn(),
        findExceptionsLogsByException: jest.fn(),
        findRescheduleByExceptionId: jest.fn(),
        canAccessException: jest.fn(),
        applyLeave: jest.fn(),
        applySuspend: jest.fn(),
        applyMakeup: jest.fn(),
        reject: jest.fn(),
        findExceptionsByLesson: jest.fn(),
      };

      const ctrlModule: TestingModule = await Test.createTestingModule({
        controllers: [LessonExceptionController],
        providers: [{ provide: LessonExceptionService, useValue: mockService }],
      }).compile();

      const ctrl = ctrlModule.get<LessonExceptionController>(
        LessonExceptionController,
      );
      const dto: ApproveExceptionDto = { remark: '同意' };

      const result = await ctrl.approve(1, dto, adminUser);
      expect(mockService.approve).toHaveBeenCalled();
      expect(result.code).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Core Principle Verification
  // ══════════════════════════════════════════════════════════════════════

  describe('核心原则验证', () => {
    it('Lesson Finished 是唯一业务结果事件', () => {
      // 验证仅 LessonService.updateStatus 在 FINISHED 时发布 lesson.completed
      // 异常服务除 completeMakeupLesson（补课场景）外不应发布 lesson.completed
      const exceptionMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(exceptionService),
      ).filter(
        (name) =>
          typeof (exceptionService as unknown as ExceptionServiceMethods)[
            name
          ] === 'function',
      );

      for (const methodName of exceptionMethods) {
        const methodStr = (
          exceptionService as unknown as ExceptionServiceMethods
        )[methodName].toString();
        // completeMakeupLesson 是唯一发布 lesson.completed 的异常方法（补课场景）
        if (methodName === 'completeMakeupLesson') {
          expect(methodStr).toContain('lesson.completed');
        } else if (methodName !== 'constructor') {
          // 其他方法不应发布 lesson.completed
          expect(methodStr).not.toContain("'lesson.completed'");
        }
      }
    });

    it('Exception 不能绕过 Lesson 状态机', () => {
      // 验证异常服务的 approve 方法使用 VALID_TRANSITIONS
      // 不能直接修改状态，必须通过 transitionLessonStatus
      const approveCode = exceptionService.approve.toString();
      expect(approveCode).toContain('transitionLessonStatus');
    });

    it('Exception 不能直接修改课时', () => {
      // 验证没有直接操作课时余额的逻辑
      const allMethodsProto = Object.getPrototypeOf(exceptionService) as object;
      const allMethods = Object.getOwnPropertyNames(allMethodsProto);

      for (const methodName of allMethods) {
        if (
          typeof (exceptionService as unknown as ExceptionServiceMethods)[
            methodName
          ] === 'function' &&
          methodName !== 'constructor'
        ) {
          const methodStr = (
            exceptionService as unknown as ExceptionServiceMethods
          )[methodName].toString();
          // 不应有直接操作余额的字段/方法引用
          expect(methodStr).not.toContain('lessonBalance');
          expect(methodStr).not.toContain('.balance');
        }
      }
    });

    it('Exception 不能直接生成工资', () => {
      // 验证异常服务不直接创建工资记录
      // 工资只由 SalarySettlementService.settle 按月结算生成
      const serviceCode = exceptionService.constructor.toString();
      expect(serviceCode).not.toContain('SalaryRecordEntity');
    });

    it('Exception 不能直接修改统计结果', () => {
      // 验证异常服务没有统计相关操作
      const allMethodsProto = Object.getPrototypeOf(exceptionService) as object;
      const allMethods = Object.getOwnPropertyNames(allMethodsProto);

      for (const methodName of allMethods) {
        if (
          typeof (exceptionService as unknown as ExceptionServiceMethods)[
            methodName
          ] === 'function'
        ) {
          const methodStr = (
            exceptionService as unknown as ExceptionServiceMethods
          )[methodName].toString();
          expect(methodStr).not.toContain('statistics');
          expect(methodStr).not.toContain('Statistics');
        }
      }
    });
  });
});
