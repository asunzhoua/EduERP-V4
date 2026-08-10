import { Test, TestingModule } from '@nestjs/testing';
import { LessonExceptionService } from './lesson-exception.service';
import { LessonExceptionEntity } from './lesson-exception.entity';
import { LessonExceptionLogEntity } from './lesson-exception-log.entity';
import { LessonRescheduleEntity } from './lesson-reschedule.entity';
import { LessonExceptionAttachmentEntity } from './lesson-exception-attachment.entity';
import { LessonEntity } from '../lesson.entity';
import { LessonStatus } from '../enums/lesson-status.enum';
import { LessonService } from '../lesson.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventBusService } from '@events/event-bus.service';
import { getRepositoryToken, getEntityManagerToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

describe('LessonExceptionService', () => {
  let service: LessonExceptionService;
  let exceptionRepo: jest.Mocked<Repository<LessonExceptionEntity>>;
  let exceptionLogRepo: jest.Mocked<Repository<LessonExceptionLogEntity>>;
  let rescheduleRepo: jest.Mocked<Repository<LessonRescheduleEntity>>;
  let attachmentRepo: jest.Mocked<Repository<LessonExceptionAttachmentEntity>>;
  let lessonRepo: jest.Mocked<Repository<LessonEntity>>;
  let lessonService: jest.Mocked<LessonService>;
  let eventBus: jest.Mocked<EventBusService>;

  // ─── Mock Data ───

  const mockLesson: LessonEntity = {
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
    createdBy: 0,
    createdAt: new Date(),
  };

  const mockMakeupLesson: LessonEntity = {
    ...mockLesson,
    id: 2,
    lessonNumber: 10,
    isMakeup: true,
    originLessonId: 1,
    status: LessonStatus.TEACHING,
  };

  const mockException: LessonExceptionEntity = {
    id: 1,
    lessonId: 1,
    exceptionType: 'LEAVE_SICK',
    reason: '感冒发烧，需请假',
    startTime: new Date('2026-07-12T08:00:00Z'),
    endTime: new Date('2026-07-12T12:00:00Z'),
    status: 'PENDING',
    attachments: null,
    createdBy: 1001,
    approvedBy: null,
    approvedAt: null,
    rejectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lesson: null,
  };

  beforeEach(async () => {
    // Create mock repositories
    const mockExceptionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
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

    const mockLessonService = {
      updateStatus: jest.fn(),
      findOne: jest.fn(),
    };

    const mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    const mockEntityManager = {
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
    };

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
        {
          provide: getRepositoryToken(LessonEntity),
          useValue: mockLessonRepo,
        },
        { provide: LessonService, useValue: mockLessonService },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: getEntityManagerToken(), useValue: mockEntityManager },
      ],
    }).compile();

    service = module.get<LessonExceptionService>(LessonExceptionService);
    exceptionRepo = module.get(getRepositoryToken(LessonExceptionEntity));
    exceptionLogRepo = module.get(getRepositoryToken(LessonExceptionLogEntity));
    rescheduleRepo = module.get(getRepositoryToken(LessonRescheduleEntity));
    attachmentRepo = module.get(
      getRepositoryToken(LessonExceptionAttachmentEntity),
    );
    lessonRepo = module.get(getRepositoryToken(LessonEntity));
    lessonService = module.get(LessonService);
    eventBus = module.get(EventBusService);
  });

  // ═══════════════════════════════════════════════════
  // Scenario 1: 学生请病假 → 审批通过 → Lesson 状态变为 CANCELLED
  // ═══════════════════════════════════════════════════

  describe('Scenario 1: Leave Sick → Approved → CANCELLED', () => {
    it('should create a sick leave exception with attachments', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      exceptionRepo.save.mockResolvedValue({
        ...mockException,
        id: 1,
        exceptionType: 'LEAVE_SICK',
        attachments: [{ url: 'http://example.com/proof.jpg' }],
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.applyLeave(
        1,
        'LEAVE_SICK',
        '感冒发烧，需请假',
        new Date('2026-07-12T08:00:00Z'),
        new Date('2026-07-12T12:00:00Z'),
        [{ url: 'http://example.com/proof.jpg' }],
        1001,
      );

      expect(result.status).toBe('PENDING');
      expect(result.exceptionType).toBe('LEAVE_SICK');
      expect(result.lessonId).toBe(1);
    });

    it('should allow sick leave without attachments', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      exceptionRepo.save.mockResolvedValue({
        ...mockException,
        id: 1,
        exceptionType: 'LEAVE_SICK',
        attachments: null,
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.applyLeave(
        1,
        'LEAVE_SICK',
        '感冒发烧',
        new Date('2026-07-12T08:00:00Z'),
        new Date('2026-07-12T12:00:00Z'),
        [],
        1001,
      );

      expect(result.status).toBe('PENDING');
      expect(result.exceptionType).toBe('LEAVE_SICK');
      expect(result.lessonId).toBe(1);
    });

    it('should approve sick leave and change lesson to CANCELLED', async () => {
      const pendingException = {
        ...mockException,
        id: 1,
        exceptionType: 'LEAVE_SICK',
        status: 'PENDING',
      };
      exceptionRepo.findOne.mockResolvedValue({ ...pendingException });
      exceptionRepo.save.mockResolvedValue({
        ...pendingException,
        status: 'APPROVED',
        approvedBy: 2001,
        approvedAt: new Date(),
      });
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      lessonRepo.save.mockResolvedValue({
        ...mockLesson,
        status: LessonStatus.CANCELLED,
        cancelledReason: '异常(LEAVE_SICK)审批通过',
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.approve(1, 2001, '同意请假');

      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBe(2001);

      // Verify lesson was changed to CANCELLED
      const savedCalls = lessonRepo.save.mock.calls;
      const savedLesson = savedCalls[savedCalls.length - 1][0] as LessonEntity;
      expect(savedLesson.status).toBe(LessonStatus.CANCELLED);
    });
  });

  // ═══════════════════════════════════════════════════
  // Scenario 2: 教师请事假 → 审批通过 → Lesson 状态变为 SUSPENDED
  // ═══════════════════════════════════════════════════

  describe('Scenario 2: Leave Personal → Approved → SUSPENDED', () => {
    it('should create a personal leave exception with 24h advance notice', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });

      // Set startTime to 30 hours from now to pass the 24h check
      const futureStart = new Date();
      futureStart.setHours(futureStart.getHours() + 30);
      const futureEnd = new Date();
      futureEnd.setHours(futureEnd.getHours() + 32);

      exceptionRepo.save.mockResolvedValue({
        ...mockException,
        id: 2,
        exceptionType: 'LEAVE_PERSONAL',
        startTime: futureStart,
        endTime: futureEnd,
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.applyLeave(
        1,
        'LEAVE_PERSONAL',
        '家中有事',
        futureStart,
        futureEnd,
        [],
        1001,
      );

      expect(result.status).toBe('PENDING');
      expect(result.exceptionType).toBe('LEAVE_PERSONAL');
    });

    it('should reject personal leave without 24h advance notice', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });

      // Set startTime to 2 hours from now (less than 24h)
      const nearStart = new Date();
      nearStart.setHours(nearStart.getHours() + 2);

      await expect(
        service.applyLeave(
          1,
          'LEAVE_PERSONAL',
          '家中有事',
          nearStart,
          new Date(nearStart.getTime() + 7200000),
          [],
          1001,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve personal leave and change lesson to SUSPENDED', async () => {
      const pendingException = {
        ...mockException,
        id: 2,
        exceptionType: 'LEAVE_PERSONAL',
        status: 'PENDING',
      };
      exceptionRepo.findOne.mockResolvedValue({ ...pendingException });
      exceptionRepo.save.mockResolvedValue({
        ...pendingException,
        status: 'APPROVED',
        approvedBy: 2001,
        approvedAt: new Date(),
      });
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      lessonRepo.save.mockResolvedValue({
        ...mockLesson,
        status: LessonStatus.SUSPENDED,
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.approve(2, 2001, '同意事假');

      expect(result.status).toBe('APPROVED');

      const savedCalls = lessonRepo.save.mock.calls;
      const savedLesson = savedCalls[savedCalls.length - 1][0] as LessonEntity;
      expect(savedLesson.status).toBe(LessonStatus.SUSPENDED);
    });
  });

  // ═══════════════════════════════════════════════════
  // Scenario 3: 短期停课 → 审批通过 → Lesson 状态变为 SUSPENDED
  // ═══════════════════════════════════════════════════

  describe('Scenario 3: Suspend Short → Approved → SUSPENDED', () => {
    it('should create a short suspend exception for 1-7 days', async () => {
      lessonRepo.find.mockResolvedValue([{ ...mockLesson }]);
      exceptionRepo.save.mockResolvedValue({
        ...mockException,
        id: 3,
        exceptionType: 'SUSPEND_SHORT',
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const now = new Date();
      const startTime = new Date(now.getTime() + 86400000); // tomorrow
      const endTime = new Date(startTime.getTime() + 3 * 86400000); // +3 days

      const result = await service.applySuspend(
        [1],
        'SUSPEND_SHORT',
        '教室装修',
        startTime,
        endTime,
        true,
        1001,
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
      expect(result[0].exceptionType).toBe('SUSPEND_SHORT');
    });

    it('should reject short suspend for more than 7 days', async () => {
      const now = new Date();
      const startTime = new Date(now.getTime() + 86400000);
      const endTime = new Date(startTime.getTime() + 10 * 86400000); // +10 days

      await expect(
        service.applySuspend(
          [1],
          'SUSPEND_SHORT',
          '教室装修',
          startTime,
          endTime,
          true,
          1001,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve short suspend and change lesson to SUSPENDED', async () => {
      const pendingException = {
        ...mockException,
        id: 3,
        exceptionType: 'SUSPEND_SHORT',
        status: 'PENDING',
      };
      exceptionRepo.findOne.mockResolvedValue({ ...pendingException });
      exceptionRepo.save.mockResolvedValue({
        ...pendingException,
        status: 'APPROVED',
      });
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      lessonRepo.save.mockResolvedValue({
        ...mockLesson,
        status: LessonStatus.SUSPENDED,
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.approve(3, 2001);

      expect(result.status).toBe('APPROVED');

      const savedCalls = lessonRepo.save.mock.calls;
      const savedLesson = savedCalls[savedCalls.length - 1][0] as LessonEntity;
      expect(savedLesson.status).toBe(LessonStatus.SUSPENDED);
    });
  });

  // ═══════════════════════════════════════════════════
  // Scenario 4: 自动恢复 → Lesson 状态变为 SCHEDULED
  // ═══════════════════════════════════════════════════

  describe('Scenario 4: Auto Restore → SCHEDULED', () => {
    it('should restore suspended lessons when exception has expired', async () => {
      const pastEnd = new Date();
      pastEnd.setHours(pastEnd.getHours() - 1); // ended 1 hour ago

      const expiredExceptions = [
        {
          ...mockException,
          id: 10,
          exceptionType: 'SUSPEND_SHORT',
          endTime: pastEnd,
          status: 'APPROVED',
        },
      ];

      const suspendedLesson: LessonEntity = {
        ...mockLesson,
        status: LessonStatus.SUSPENDED,
      };

      exceptionRepo.find.mockResolvedValue(expiredExceptions);
      lessonRepo.findOne.mockResolvedValue(suspendedLesson);
      lessonRepo.save.mockResolvedValue({
        ...suspendedLesson,
        status: LessonStatus.SCHEDULED,
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      await service.autoRestore();

      // Verify lesson was restored
      const savedCalls = lessonRepo.save.mock.calls;
      expect(savedCalls.length).toBeGreaterThanOrEqual(1);
      // The last save should have SCHEDULED status
      const lastSaved = savedCalls[savedCalls.length - 1][0] as LessonEntity;
      expect(lastSaved.status).toBe(LessonStatus.SCHEDULED);
    });

    it('should skip non-suspended lessons during auto restore', async () => {
      const pastEnd = new Date();
      pastEnd.setHours(pastEnd.getHours() - 1);

      const expiredExceptions = [
        {
          ...mockException,
          id: 10,
          exceptionType: 'SUSPEND_SHORT',
          endTime: pastEnd,
          status: 'APPROVED',
        },
      ];

      const scheduledLesson: LessonEntity = {
        ...mockLesson,
        status: LessonStatus.SCHEDULED, // not suspended
      };

      exceptionRepo.find.mockResolvedValue(expiredExceptions);
      lessonRepo.findOne.mockResolvedValue(scheduledLesson);

      await service.autoRestore();

      // Should NOT have saved (no transition)
      expect(lessonRepo.save).not.toHaveBeenCalled();
    });

    it('should do nothing when no expired exceptions exist', async () => {
      exceptionRepo.find.mockResolvedValue([]);

      await service.autoRestore();

      expect(lessonRepo.save).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════
  // Scenario 5: 补课申请 → 创建补课排期 → 原 Lesson 状态变为 RESCHEDULED
  // ═══════════════════════════════════════════════════

  describe('Scenario 5: Makeup Application → RESCHEDULED', () => {
    it('should create reschedule record and change original lesson to RESCHEDULED', async () => {
      // Setup: cancelled lesson can have makeup
      const cancelledLesson: LessonEntity = {
        ...mockLesson,
        status: LessonStatus.CANCELLED,
        cancelledReason: '老师生病',
      };

      lessonRepo.findOne.mockResolvedValue(cancelledLesson);
      exceptionRepo.findOne.mockResolvedValue({
        ...mockException,
        id: 5,
        exceptionType: 'LEAVE_SICK',
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
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.applyMakeup(
        1,
        5,
        new Date('2026-07-19T10:00:00'),
        new Date('2026-07-19T11:30:00'),
        5001, // teacherId
        101, // roomId
        1001, // operatorId
      );

      expect(result.originalLessonId).toBe(1);
      expect(result.status).toBe('PENDING');

      // Original lesson should be RESCHEDULED
      const savedCalls = lessonRepo.save.mock.calls;
      const savedLesson = savedCalls[savedCalls.length - 1][0] as LessonEntity;
      expect(savedLesson.status).toBe(LessonStatus.RESCHEDULED);
    });

    it('should reject makeup for non-cancelled/suspended lessons', async () => {
      const draftLesson: LessonEntity = {
        ...mockLesson,
        status: LessonStatus.DRAFT,
      };
      lessonRepo.findOne.mockResolvedValue(draftLesson);

      await expect(
        service.applyMakeup(
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
  });

  // ═══════════════════════════════════════════════════
  // Scenario 6: 补课完成 → 补课 Lesson FINISHED → 原 Lesson MAKEUP_COMPLETED
  // ═══════════════════════════════════════════════════

  describe('Scenario 6: Complete Makeup → MAKEUP_COMPLETED', () => {
    it('should complete makeup lesson and update original lesson', async () => {
      lessonRepo.findOne.mockImplementation((options: any) => {
        const id = options?.where?.id;
        if (id === 2) {
          return Promise.resolve({ ...mockMakeupLesson });
        }
        if (id === 1) {
          return Promise.resolve({
            ...mockLesson,
            status: LessonStatus.RESCHEDULED,
            id: 1,
          });
        }
        return Promise.resolve(null);
      });

      lessonRepo.save.mockResolvedValue({} as any);
      exceptionLogRepo.save.mockResolvedValue({} as any);

      await service.completeMakeupLesson(2);

      // Verify that the original lesson was marked as MAKEUP_COMPLETED
      const saveCalls = lessonRepo.save.mock.calls;
      // The last save should be the original lesson with MAKEUP_COMPLETED
      const lastSaved = saveCalls[saveCalls.length - 1][0] as LessonEntity;
      expect(lastSaved.status).toBe(LessonStatus.MAKEUP_COMPLETED);

      // Verify events were published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'lesson.completed',
        expect.objectContaining({
          lessonId: 2,
          isMakeup: true,
          originalLessonId: 1,
        }),
      );

      // 工资由月度结算引擎读取 FINISHED 课时生成，不再发布冗余的 salary.calculation.triggered
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        'salary.calculation.triggered',
        expect.anything(),
      );
    });

    it('should reject completing a non-makeup lesson', async () => {
      lessonRepo.findOne.mockResolvedValue({
        ...mockLesson,
        isMakeup: false,
      });

      await expect(service.completeMakeupLesson(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ═══════════════════════════════════════════════════
  // Reject Flow
  // ═══════════════════════════════════════════════════

  describe('Reject Exception', () => {
    it('should reject a PENDING exception', async () => {
      exceptionRepo.findOne.mockResolvedValue({
        ...mockException,
        id: 1,
        status: 'PENDING',
      });
      exceptionRepo.save.mockResolvedValue({
        ...mockException,
        id: 1,
        status: 'REJECTED',
        rejectReason: '证明材料不足',
        approvedBy: 2001,
        approvedAt: new Date(),
      });
      exceptionLogRepo.save.mockResolvedValue({} as any);

      const result = await service.reject(1, 2001, '证明材料不足');

      expect(result.status).toBe('REJECTED');
      expect(result.rejectReason).toBe('证明材料不足');
    });

    it('should reject exception not in PENDING status', async () => {
      exceptionRepo.findOne.mockResolvedValue({
        ...mockException,
        id: 1,
        status: 'APPROVED',
      });

      await expect(service.reject(1, 2001, '理由')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ═══════════════════════════════════════════════════
  // Validation: status transitions
  // ═══════════════════════════════════════════════════

  describe('Status Transition Validation', () => {
    it('should allow SCHEDULED -> SUSPENDED', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      lessonRepo.save.mockResolvedValue({} as any);
      exceptionLogRepo.save.mockResolvedValue({} as any);

      // This is called internally by the service's transitionLessonStatus
      // which is private. We test it indirectly via approve.
      // Direct access: we test through a public method that triggers the transition.
      // The approve method will call transitionLessonStatus.
      const pendingException = {
        ...mockException,
        id: 10,
        exceptionType: 'SUSPEND_SHORT',
        status: 'PENDING',
      };
      exceptionRepo.findOne.mockResolvedValue(pendingException);
      exceptionRepo.save.mockResolvedValue({
        ...pendingException,
        status: 'APPROVED',
      });
      // For the lesson lookup inside approve -> transitionLessonStatus
      lessonRepo.findOne.mockResolvedValue({
        ...mockLesson,
        status: LessonStatus.SCHEDULED, // initially SCHEDULED, valid -> SUSPENDED
      });

      const result = await service.approve(10, 2001);
      expect(result.status).toBe('APPROVED');
    });

    it('should block invalid transitions', async () => {
      // Trying to transition DRAFT -> SUSPENDED (not in VALID_TRANSITIONS)
      lessonRepo.findOne.mockResolvedValue({
        ...mockLesson,
        status: LessonStatus.DRAFT,
      });

      // Directly call private method via any cast for testing
      await expect(
        (service as any).transitionLessonStatus(
          1,
          LessonStatus.SUSPENDED,
          1,
          'USER',
          'test',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════
  // Query Methods
  // ═══════════════════════════════════════════════════

  describe('Query Methods', () => {
    it('should find exceptions by lesson', async () => {
      exceptionRepo.find.mockResolvedValue([
        { ...mockException, id: 1 },
        { ...mockException, id: 2 },
      ]);

      const result = await service.findExceptionsByLesson(1);
      expect(result).toHaveLength(2);
    });

    it('should find all exceptions', async () => {
      exceptionRepo.find.mockResolvedValue([
        { ...mockException, id: 1 },
        { ...mockException, id: 2 },
        { ...mockException, id: 3 },
      ]);

      const result = await service.findAllExceptions();
      expect(result).toHaveLength(3);
    });

    it('should find exception by id', async () => {
      exceptionRepo.findOne.mockResolvedValue({ ...mockException });

      const result = await service.findExceptionById(1);
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException when exception not found', async () => {
      exceptionRepo.findOne.mockResolvedValue(null);

      await expect(service.findExceptionById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
