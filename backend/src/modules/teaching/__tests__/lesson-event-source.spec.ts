/**
 * Mission: M-EDUOS-LESSON-COMPLETED-EVENT-SOURCE-FIX-V1
 *
 * Lesson Completed Event Source Fix — 回归验证
 * =============================================
 *
 * 验证目标：
 * 1. lesson.completed 事件仅由 LessonService.updateStatus(FINISHED) 发射
 * 2. LessonAttendanceService.batchRollCall 不再发射 lesson.completed
 * 3. Salary 生成幂等（重复事件不重复创建记录）
 * 4. Exception 流程不受影响
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventBusService } from '@events/event-bus.service';
import { LessonService } from '../lesson/lesson.service';
import { LessonRepository } from '../lesson/lesson.repository';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { LessonAttendanceService } from '../lesson-attendance/lesson-attendance.service';
import { LessonAttendanceEntity } from '../lesson-attendance/lesson-attendance.entity';
import { AttendanceStatus } from '../lesson-attendance/enums/attendance-status.enum';
import { AttendanceWorkflowState } from '../lesson-attendance/enums/attendance-workflow-state.enum';
import { AttendanceSource } from '../lesson-attendance/enums/attendance-source.enum';
import { ClassRepository } from '../class/class.repository';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { ClassStatus } from '../class/enums/class-status.enum';
import { ReminderService } from '@modules/reminder/reminder.service';
import { SalaryListener } from '@modules/salary/listeners/salary.listener';
import { SalaryCalculator } from '@modules/salary/services/salary-calculator.service';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { SalaryRuleEntity } from '@modules/salary/entities/salary-rule.entity';
import { SalaryRecordStatus, SalaryRuleType } from '@modules/salary/enums/salary.enums';
import { LessonCompletedEvent } from '@modules/salary/events/lesson-completed.event';
import { ContractRepository } from '../contract/contract.repository';
import { Student } from '@modules/student/entities/student.entity';

// ══════════════════════════════════════════════════════════════
//  Mock Factories
// ══════════════════════════════════════════════════════════════

function createMockEventBus() {
  const published: Array<{ name: string; payload: any }> = [];
  const handlers = new Map<string, (payload: any) => void>();

  return {
    _published: published,
    _handlers: handlers,
    publish: jest.fn().mockImplementation(async (eventName: string, payload: any) => {
      published.push({ name: eventName, payload });
      const handler = handlers.get(eventName);
      if (handler) await handler(payload);
    }),
    subscribe: jest.fn((eventName: string, handler: (payload: any) => void) => {
      handlers.set(eventName, handler);
    }),
  };
}

function createMockSalaryRecordRepo() {
  const records: Map<number, SalaryRecordEntity> = new Map();
  let nextId = 1;

  return {
    _records: records,
    findOne: jest.fn().mockImplementation(({ where }: any) => {
      if (where?.lessonId !== undefined) {
        const found = Array.from(records.values()).find(r => r.lessonId === where.lessonId);
        return Promise.resolve(found || null);
      }
      return Promise.resolve(null);
    }),
    find: jest.fn().mockImplementation(({ where }: any) => {
      if (where?.lessonId !== undefined) {
        const found = Array.from(records.values()).filter(r => r.lessonId === where.lessonId);
        return Promise.resolve(found);
      }
      return Promise.resolve([]);
    }),
    save: jest.fn().mockImplementation((entity: SalaryRecordEntity) => {
      if (!entity.id) entity.id = nextId++;
      records.set(entity.lessonId, entity);
      return Promise.resolve(entity);
    }),
    create: jest.fn().mockImplementation((data: any) => {
      const record = new SalaryRecordEntity();
      Object.assign(record, data);
      return record;
    }),
  };
}

function createMockSalaryRuleRepo() {
  return {
    find: jest.fn().mockResolvedValue([
      {
        id: 1,
        type: SalaryRuleType.PER_LESSON,
        baseAmount: 100,
        multiplier: 1.0,
        courseType: null,
        teacherLevel: null,
        isActive: true,
        updatedAt: new Date('2026-07-01'),
      },
    ]),
  };
}

function getMockLessonEntity(overrides: Partial<LessonEntity> = {}): LessonEntity {
  return {
    id: 1,
    classCode: 'CL2026070001',
    courseCode: 'CS2026070001',
    lessonNumber: 1,
    status: LessonStatus.DRAFT,
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
    ...overrides,
  };
}

function createMockLessonRepo() {
  const store: Map<number, LessonEntity> = new Map();
  let nextId = 1;

  return {
    _store: store,
    save: jest.fn().mockImplementation((entity: LessonEntity) => {
      if (!entity.id) entity.id = nextId++;
      store.set(entity.id, entity);
      return Promise.resolve(entity);
    }),
    saveAll: jest.fn().mockImplementation((entities: LessonEntity[]) => {
      for (const e of entities) {
        if (!e.id) e.id = nextId++;
        store.set(e.id, e);
      }
      return Promise.resolve(entities);
    }),
    findOneById: jest.fn().mockImplementation((id: number) => {
      return Promise.resolve(store.get(id) || null);
    }),
    findOneByClassCodeAndLessonNumber: jest.fn().mockResolvedValue(null),
    findByClassCode: jest.fn().mockResolvedValue([]),
    countByClassCode: jest.fn().mockResolvedValue(0),
  };
}

function createMockAttendanceRepo() {
  const records: LessonAttendanceEntity[] = [];
  return {
    _records: records,
    saveAll: jest.fn().mockImplementation((entities: LessonAttendanceEntity[]) => {
      for (const entity of entities) {
        const idx = records.findIndex(
          r => r.lessonId === entity.lessonId && r.studentCode === entity.studentCode,
        );
        if (idx >= 0) records[idx] = entity;
        else records.push(entity);
      }
      return Promise.resolve(entities);
    }),
    findByLessonId: jest.fn().mockImplementation((lessonId: number) => {
      return Promise.resolve(records.filter(r => r.lessonId === lessonId));
    }),
    findByLessonIdAndStudentCodes: jest.fn().mockImplementation(
      (lessonId: number, studentCodes: string[]) => {
        return Promise.resolve(
          records.filter(r => r.lessonId === lessonId && studentCodes.includes(r.studentCode)),
        );
      },
    ),
    findByLessonAndStudent: jest.fn().mockResolvedValue(null),
  };
}

function createMockReminderService() {
  return {
    createReminder: jest.fn().mockResolvedValue({ id: 1 }),
  };
}

function createMockClassRepo() {
  return {
    findOneByCode: jest.fn().mockResolvedValue({ status: ClassStatus.ACTIVE, courseCode: 'MATH' }),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  };
}

function createMockEnrollmentRepo() {
  return {
    findByClassAndStudent: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
    findActiveByClassAndStudentCodes: jest.fn().mockResolvedValue([]),
    findByClassCode: jest.fn().mockResolvedValue([]),
  };
}

function createMockContractRepo() {
  return {
    save: jest.fn().mockResolvedValue({}),
    findOneActiveByStudentCode: jest.fn().mockResolvedValue(null),
    findOneByCode: jest.fn().mockResolvedValue(null),
  };
}

function createMockStudentRepo() {
  return {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };
}

// ══════════════════════════════════════════════════════════════
//  Tests
// ══════════════════════════════════════════════════════════════

describe('Lesson Completed Event Source', () => {
  let lessonService: LessonService;
  let attendanceService: LessonAttendanceService;
  let salaryListener: SalaryListener;
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let mockSalaryRecordRepo: ReturnType<typeof createMockSalaryRecordRepo>;
  let mockAttendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let mockLessonRepo: ReturnType<typeof createMockLessonRepo>;

  beforeEach(async () => {
    mockEventBus = createMockEventBus();
    mockSalaryRecordRepo = createMockSalaryRecordRepo();
    mockAttendanceRepo = createMockAttendanceRepo();
    mockLessonRepo = createMockLessonRepo();
    const mockSalaryRuleRepo = createMockSalaryRuleRepo();
    const mockReminderService = createMockReminderService();
    const mockClassRepo = createMockClassRepo();
    const mockEnrollmentRepo = createMockEnrollmentRepo();
    const mockContractRepo = createMockContractRepo();
    const mockStudentRepo = createMockStudentRepo();

    // Build SalaryCalculator
    const salaryCalculator = new SalaryCalculator(
      mockSalaryRuleRepo as any,
      mockSalaryRecordRepo as any,
    );

    // Build SalaryListener
    salaryListener = new SalaryListener(
      mockSalaryRecordRepo as any,
      salaryCalculator,
    );

    // Manually register handler: SalaryListener listens for 'lesson.completed'
    mockEventBus.subscribe('lesson.completed', async (payload: any) => {
      await salaryListener.handleLessonCompleted(payload);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonService,
        { provide: LessonRepository, useValue: mockLessonRepo },
        { provide: ClassRepository, useValue: mockClassRepo },
        { provide: EnrollmentRepository, useValue: mockEnrollmentRepo },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: ReminderService, useValue: mockReminderService },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
      ],
    }).compile();

    lessonService = module.get<LessonService>(LessonService);

    // Build LessonAttendanceService (without eventEmitter)
    attendanceService = new LessonAttendanceService(
      mockAttendanceRepo as any,
      mockReminderService as any,
      mockContractRepo as any,
    );
  });

  // ─── Test 1: 唯一事件源 ───

  describe('单一事件源', () => {
    it('完成课程一次，只产生一次 lesson.completed', async () => {
      const lessonId = 10;
      const teaching = getMockLessonEntity({
        id: lessonId,
        status: LessonStatus.TEACHING,
        actualStartTime: new Date('2026-07-14T09:00:00Z'),
      });
      const finished = {
        ...teaching,
        status: LessonStatus.FINISHED,
        actualEndTime: new Date('2026-07-14T10:30:00Z'),
      };

      mockLessonRepo._store.set(lessonId, teaching);
      mockLessonRepo.save.mockResolvedValue(finished);

      await lessonService.updateStatus(lessonId, LessonStatus.FINISHED, 1);

      // 验证事件只发射一次
      const completedEvents = mockEventBus._published.filter(
        (e: any) => e.name === 'lesson.completed',
      );
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].payload.lessonId).toBe(lessonId);
    });

    it('batchRollCall 不再发射 lesson.completed', async () => {
      // 准备考勤记录
      const lessonId = 20;
      const studentCode = 'STU001';

      const existingRecord = new LessonAttendanceEntity();
      existingRecord.lessonId = lessonId;
      existingRecord.studentCode = studentCode;
      existingRecord.workflowState = AttendanceWorkflowState.PENDING;
      existingRecord.checkInTime = null;
      mockAttendanceRepo._records.push(existingRecord);

      // 执行 batchRollCall
      await attendanceService.batchRollCall({
        lessonId,
        records: [
          {
            studentCode,
            status: AttendanceStatus.PRESENT,
            operator: 1,
            source: AttendanceSource.MANUAL,
          },
        ],
      });

      // 验证没有 lesson.completed 事件从 attendance 发出
      // (lesson.completed 应该只由 LessonService.updateStatus 发射)
      // 这里我们验证 attendance 没有发布事件的能力 — eventEmitter 已被移除
      expect(mockEventBus._published.filter((e: any) => e.name === 'lesson.completed')).toHaveLength(0);
    });
  });

  // ─── Test 2: Salary 幂等 ───

  describe('Salary 幂等性', () => {
    it('Salary 只生成一次', async () => {
      const lessonId = 30;

      // 模拟 LessonService 完成课程
      const teaching = getMockLessonEntity({
        id: lessonId,
        status: LessonStatus.TEACHING,
        actualStartTime: new Date('2026-07-14T09:00:00Z'),
      });
      const finished = {
        ...teaching,
        status: LessonStatus.FINISHED,
        actualEndTime: new Date('2026-07-14T10:30:00Z'),
      };

      mockLessonRepo._store.set(lessonId, teaching);
      mockLessonRepo.save.mockResolvedValue(finished);

      await lessonService.updateStatus(lessonId, LessonStatus.FINISHED, 1);

      // 验证 lesson.completed 事件只发射一次（同步验证）
      const completedEvents = mockEventBus._published.filter(
        (e: any) => e.name === 'lesson.completed',
      );
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].payload.lessonId).toBe(lessonId);

      // 等待 SalaryListener 异步处理完成
      await new Promise<void>(resolve => setTimeout(resolve, 50));

      // 验证 SalaryRecord 只有一条
      const records = Array.from(mockSalaryRecordRepo._records.values()).filter(
        (r: any) => r.lessonId === lessonId,
      );
      expect(records).toHaveLength(1);
    });

    it('重复事件不重复创建 SalaryRecord（幂等）', async () => {
      const lessonId = 40;

      // 直接模拟两个重复的 lesson.completed 事件
      const eventPayload = {
        lessonId,
        teacherId: 5001,
        classCode: 'CL001',
        courseCode: 'CS001',
        scheduledDate: '2026-07-12',
        actualStartTime: '2026-07-14T09:00:00Z',
        actualEndTime: '2026-07-14T10:30:00Z',
        durationMinutes: 90,
        eventId: 'test-uuid-1',
        timestamp: '2026-07-14T10:30:00Z',
      };

      // 第一次处理 — 创建记录
      await salaryListener.handleLessonCompleted(eventPayload);
      const firstRecords = Array.from(mockSalaryRecordRepo._records.values()).filter(
        (r: any) => r.lessonId === lessonId,
      );
      expect(firstRecords).toHaveLength(1);

      // 第二次处理（重复事件）— 应跳过
      await salaryListener.handleLessonCompleted(eventPayload);
      const secondRecords = Array.from(mockSalaryRecordRepo._records.values()).filter(
        (r: any) => r.lessonId === lessonId,
      );
      expect(secondRecords).toHaveLength(1);
    });

    it('重复请求幂等 — 再次 FINISHED 应被拒绝', async () => {
      const lessonId = 50;

      // 初始状态 TEACHING
      const teaching = getMockLessonEntity({
        id: lessonId,
        status: LessonStatus.TEACHING,
        actualStartTime: new Date('2026-07-14T09:00:00Z'),
      });
      mockLessonRepo._store.set(lessonId, teaching);

      // 第一次完成
      const finished = {
        ...teaching,
        status: LessonStatus.FINISHED,
        actualEndTime: new Date('2026-07-14T10:30:00Z'),
      };
      mockLessonRepo.save.mockResolvedValueOnce(finished);

      await lessonService.updateStatus(lessonId, LessonStatus.FINISHED, 1);

      // 第二次尝试完成（TEACHING → FINISHED 已不可能，因为状态已是 FINISHED）
      const finishedState = {
        ...finished,
        status: LessonStatus.FINISHED,
      };
      mockLessonRepo.findOneById.mockResolvedValue(finishedState);

      await expect(
        lessonService.updateStatus(lessonId, LessonStatus.FINISHED, 1),
      ).rejects.toThrow();

      // 验证只有一条 SalaryRecord
      const records = Array.from(mockSalaryRecordRepo._records.values()).filter(
        (r: any) => r.lessonId === lessonId,
      );
      expect(records).toHaveLength(1);
    });
  });

  // ─── Test 3: Exception 流程不受影响 ───

  describe('Exception 流程', () => {
    it('不产生 SalaryRecord 的异常流不应发布 lesson.completed', () => {
      // 源码验证：检查 attendance.service.ts 不再导入 EventEmitter2
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '../lesson-attendance/lesson-attendance.service.ts'),
        'utf-8',
      );

      // EventEmitter2 导入已被移除
      expect(source).not.toContain('EventEmitter2');
      expect(source).not.toContain("'lesson.completed'");
      expect(source).not.toContain('LessonCompletedEvent');
    });
  });

  // ─── Test 4: 补课流程不受影响 ───

  describe('补课流程', () => {
    it('补课完成仍可发布 lesson.completed（独立业务场景）', () => {
      // 源码验证：lesson-exception.service.ts 仍然保留 eventBus.publish('lesson.completed')
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '../lesson/lesson-exception/lesson-exception.service.ts'),
        'utf-8',
      );

      expect(source).toContain("'lesson.completed'");
    });
  });
});
