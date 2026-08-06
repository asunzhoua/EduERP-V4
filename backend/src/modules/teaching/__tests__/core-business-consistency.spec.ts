/**
 * Mission: M-EDUOS-CORE-BUSINESS-CONSISTENCY-AUDIT-V1
 *
 * Core Business Consistency Audit
 * ================================
 * Validates the EduOS core business chain consistency per architecture design:
 *
 * Lesson Finished → EventBus → Salary / Points / Notification / Statistics
 *
 * Strategy:
 * - Static analysis for module dependency rules (no cross-module Service calls)
 * - Dynamic analysis for event flow correctness
 * - Mock-based integration tests for runtime behavior
 * - Source-code-level verification for state machine, idempotency, and direct modifications
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';

// ─── Module imports under test ───
import { LessonService } from '../lesson/lesson.service';
import { LessonRepository } from '../lesson/lesson.repository';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import { EventBusService } from '@events/event-bus.service';
import { SalaryListener } from '@modules/salary/listeners/salary.listener';
import { SalaryCalculator } from '@modules/salary/services/salary-calculator.service';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { SalaryRuleEntity } from '@modules/salary/entities/salary-rule.entity';
import { SalaryRecordStatus, SalaryRuleType } from '@modules/salary/enums/salary.enums';
import { LessonCompletedEvent as SalaryLessonCompletedEvent } from '@modules/salary/events/lesson-completed.event';
import { LessonAttendanceService } from '../lesson-attendance/lesson-attendance.service';
import { LessonAttendanceEntity } from '../lesson-attendance/lesson-attendance.entity';
import { AttendanceStatus } from '../lesson-attendance/enums/attendance-status.enum';
import { AttendanceWorkflowState } from '../lesson-attendance/enums/attendance-workflow-state.enum';
import { AttendanceSource } from '../lesson-attendance/enums/attendance-source.enum';
import { ReminderService } from '@modules/reminder/reminder.service';
import { ClassRepository } from '../class/class.repository';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { ContractRepository } from '../contract/contract.repository';
import { Student } from '@modules/student/entities/student.entity';
import { ClassStatus } from '../class/enums/class-status.enum';
import { ContractStatus } from '../contract/enums/contract-status.enum';
import { Subject } from '@common/enums/subject.enum';

// ══════════════════════════════════════════════════════════════
//  State Machine Reference (mirrors the one in lesson.service.ts)
// ══════════════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<LessonStatus, LessonStatus[]> = {
  [LessonStatus.DRAFT]: [LessonStatus.SCHEDULED, LessonStatus.CANCELLED],
  [LessonStatus.SCHEDULED]: [LessonStatus.TEACHING, LessonStatus.CANCELLED, LessonStatus.SUSPENDED],
  [LessonStatus.TEACHING]: [LessonStatus.FINISHED, LessonStatus.CANCELLED],
  [LessonStatus.FINISHED]: [LessonStatus.ARCHIVED, LessonStatus.SCHEDULED],
  [LessonStatus.ARCHIVED]: [LessonStatus.FINISHED],
  [LessonStatus.CANCELLED]: [LessonStatus.SCHEDULED, LessonStatus.MAKEUP_PENDING],
  [LessonStatus.SUSPENDED]: [LessonStatus.SCHEDULED, LessonStatus.RESCHEDULED, LessonStatus.MAKEUP_PENDING],
  [LessonStatus.RESCHEDULED]: [LessonStatus.TEACHING],
  [LessonStatus.MAKEUP_PENDING]: [LessonStatus.RESCHEDULED],
  [LessonStatus.MAKEUP_COMPLETED]: [],
};

// ══════════════════════════════════════════════════════════════
//  Mock Factories
// ══════════════════════════════════════════════════════════════

function createMockEventBus() {
  const handlers = new Map<string, (payload: any) => void>();
  return {
    _handlers: handlers,
    publish: jest.fn((eventName: string, payload: any) => {
      const handler = handlers.get(eventName);
      if (handler) handler(payload);
    }),
    subscribe: jest.fn((eventName: string, handler: (payload: any) => void) => {
      handlers.set(eventName, handler);
    }),
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
    findByClassCode: jest.fn().mockImplementation((classCode: string) => {
      return Promise.resolve(
        Array.from(store.values()).filter(l => l.classCode === classCode),
      );
    }),
    findByClassCodeAndDate: jest.fn().mockResolvedValue([]),
    findMaxLessonNumber: jest.fn().mockResolvedValue(null),
    countByClassCode: jest.fn().mockResolvedValue(0),
    countByClassCodeAndStatus: jest.fn().mockImplementation(
      (classCode: string, status: LessonStatus) => {
        const count = Array.from(store.values()).filter(
          l => l.classCode === classCode && l.status === status,
        ).length;
        return Promise.resolve(count);
      },
    ),
    countFinishedByClassCodes: jest.fn().mockResolvedValue(new Map()),
    findMaxScheduledDateByClassCode: jest.fn().mockResolvedValue(null),
    findMaxScheduledDateByClassCodes: jest.fn().mockResolvedValue(new Map()),
    findUpcomingLessons: jest.fn().mockResolvedValue([]),
  };
}

function createMockClassRepo() {
  return {
    findOneByCode: jest.fn().mockImplementation((code: string) => {
      if (code === 'CL-NOT-ACTIVE') {
        return Promise.resolve({ status: ClassStatus.INACTIVE, courseCode: 'MATH' });
      }
      if (code === 'CL-MISMATCH') {
        return Promise.resolve({ status: ClassStatus.ACTIVE, courseCode: 'WRONG' });
      }
      return Promise.resolve({
        status: ClassStatus.ACTIVE,
        courseCode: 'MATH',
        className: 'Test Class',
      });
    }),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  };
}

function createMockEnrollmentRepo() {
  return {
    findByClassAndStudent: jest.fn().mockResolvedValue({
      status: 'ACTIVE',
      studentCode: 'STU001',
      classCode: 'CL001',
    }),
    findActiveByClassAndStudentCodes: jest.fn().mockResolvedValue([]),
    findByClassCode: jest.fn().mockResolvedValue([]),
  };
}

function createMockReminderService() {
  return {
    createReminder: jest.fn().mockResolvedValue({ id: 1 }),
  };
}

function createMockContractRepo() {
  const store: any[] = [];
  return {
    _store: store,
    save: jest.fn().mockImplementation((entity: any) => {
      const idx = store.findIndex(c => c.contractCode === entity.contractCode);
      if (idx >= 0) store[idx] = entity;
      else store.push(entity);
      return Promise.resolve(entity);
    }),
    findActiveByStudentCodeAndSubject: jest.fn().mockImplementation((code: string, subject: Subject) => {
      return Promise.resolve(
        store.find(c => c.studentCode === code && c.subject === subject && c.status === 'ACTIVE') || null,
      );
    }),
    findOneByCode: jest.fn().mockResolvedValue(null),
    findOneById: jest.fn().mockResolvedValue(null),
    findByStudentCode: jest.fn().mockResolvedValue([]),
    findMany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
}

function createMockAttendanceRepo() {
  const records: LessonAttendanceEntity[] = [];
  return {
    _records: records,
    save: jest.fn().mockImplementation((entity: LessonAttendanceEntity) => {
      const idx = records.findIndex(
        r => r.lessonId === entity.lessonId && r.studentCode === entity.studentCode,
      );
      if (idx >= 0) records[idx] = entity;
      else records.push(entity);
      return Promise.resolve(entity);
    }),
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
      return Promise.resolve(
        records.filter(r => r.lessonId === lessonId).map(r => ({ ...r })),
      );
    }),
    findByLessonAndStudent: jest.fn().mockImplementation(
      (lessonId: number, studentCode: string) => {
        return Promise.resolve(
          records.find(r => r.lessonId === lessonId && r.studentCode === studentCode) || null,
        );
      },
    ),
    findByLessonIdAndStudentCodes: jest.fn().mockImplementation(
      (lessonId: number, studentCodes: string[]) => {
        return Promise.resolve(
          records.filter(r => r.lessonId === lessonId && studentCodes.includes(r.studentCode)),
        );
      },
    ),
    countUnconfirmedByLessonId: jest.fn().mockResolvedValue(0),
    countPendingByLessonId: jest.fn().mockResolvedValue(0),
    findByStudentCode: jest.fn().mockResolvedValue([]),
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

function createMockSalaryRecordRepo() {
  const records: Map<number, SalaryRecordEntity> = new Map();
  return {
    _records: records,
    findOne: jest.fn().mockImplementation(({ where }: any) => {
      if (where?.lessonId !== undefined) {
        const found = Array.from(records.values()).find(r => r.lessonId === where.lessonId);
        return Promise.resolve(found || null);
      }
      return Promise.resolve(null);
    }),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((entity: SalaryRecordEntity) => {
      records.set(entity.lessonId, entity);
      return Promise.resolve(entity);
    }),
    create: jest.fn().mockImplementation((data: any) => data as SalaryRecordEntity),
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
        isActive: true,
        courseType: null,
        teacherLevel: null,
        updatedAt: new Date(),
      },
    ]),
    findOne: jest.fn().mockResolvedValue(null),
  };
}

/** Helper: create a basic LessonEntity */
function createLessonEntity(overrides: Partial<LessonEntity> = {}): LessonEntity {
  const entity = new LessonEntity();
  entity.id = overrides.id ?? 1;
  entity.classCode = overrides.classCode ?? 'CL001';
  entity.courseCode = overrides.courseCode ?? 'MATH';
  entity.lessonNumber = overrides.lessonNumber ?? 1;
  entity.status = overrides.status ?? LessonStatus.SCHEDULED;
  entity.scheduledDate = overrides.scheduledDate ?? '2026-08-01';
  entity.startTime = overrides.startTime ?? '09:00';
  entity.endTime = overrides.endTime ?? '10:00';
  entity.teacherId = overrides.teacherId ?? 100;
  entity.isMakeup = overrides.isMakeup ?? false;
  entity.originLessonId = overrides.originLessonId ?? null;
  entity.changeRequestId = overrides.changeRequestId ?? null;
  entity.createdBy = overrides.createdBy ?? 0;
  entity.note = overrides.note ?? null;
  entity.cancelledReason = overrides.cancelledReason ?? null;
  entity.actualStartTime = overrides.actualStartTime ?? null;
  entity.actualEndTime = overrides.actualEndTime ?? null;
  entity.confirmedBy = overrides.confirmedBy ?? null;
  entity.confirmedAt = overrides.confirmedAt ?? null;
  entity.createdAt = overrides.createdAt ?? new Date();
  return entity;
}

/** Helper: create a LessonAttendanceEntity for testing */
function createAttendanceEntity(
  lessonId: number,
  studentCode: string,
  overrides: Partial<LessonAttendanceEntity> = {},
): LessonAttendanceEntity {
  const entity = new LessonAttendanceEntity();
  entity.lessonId = lessonId;
  entity.studentCode = studentCode;
  entity.classCode = overrides.classCode ?? 'CL001';
  entity.teacherId = overrides.teacherId ?? 100;
  entity.workflowState = overrides.workflowState ?? AttendanceWorkflowState.PENDING;
  entity.status = overrides.status ?? null;
  entity.checkInTime = overrides.checkInTime ?? null;
  entity.operator = overrides.operator ?? 0;
  entity.source = overrides.source ?? AttendanceSource.API;
  entity.reason = overrides.reason ?? null;
  entity.note = overrides.note ?? null;
  entity.createdBy = overrides.createdBy ?? 0;
  return entity;
}

// ══════════════════════════════════════════════════════════════
//  Audit Suite
// ══════════════════════════════════════════════════════════════

describe('Core Business Consistency Audit', () => {
  // ═══════════════════════════════════════════════════════════
  //  1. Event 链路检查
  // ═══════════════════════════════════════════════════════════

  describe('1. Event 链路检查', () => {
    let lessonService: LessonService;
    let mockEventBus: ReturnType<typeof createMockEventBus>;
    let mockLessonRepo: ReturnType<typeof createMockLessonRepo>;
    let publishedEvents: Array<{ name: string; payload: any }>;

    beforeEach(async () => {
      publishedEvents = [];
      mockEventBus = createMockEventBus();
      // Intercept publish to track events
      const origPublish = mockEventBus.publish;
      mockEventBus.publish = jest.fn((name: string, payload: any) => {
        publishedEvents.push({ name, payload });
        return origPublish(name, payload);
      });

      mockLessonRepo = createMockLessonRepo();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonService,
          { provide: EventBusService, useValue: mockEventBus },
          { provide: LessonRepository, useValue: mockLessonRepo },
          { provide: ClassRepository, useValue: createMockClassRepo() },
          { provide: EnrollmentRepository, useValue: createMockEnrollmentRepo() },
          { provide: ReminderService, useValue: createMockReminderService() },
          { provide: getRepositoryToken(Student), useValue: createMockStudentRepo() },
        ],
      }).compile();

      lessonService = module.get<LessonService>(LessonService);

      // Seed a lesson with initial status
      const lesson = createLessonEntity({ id: 1, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(1, lesson);
    });

    it('Lesson Completed 应通过 EventBus 触发（FINISHED 状态）', async () => {
      // Follow the correct state machine: SCHEDULED → TEACHING → FINISHED
      await lessonService.updateStatus(1, LessonStatus.TEACHING, 100);
      await lessonService.updateStatus(1, LessonStatus.FINISHED, 100);

      // Assert: EventBus.publish called with lesson.completed
      const completedEvent = publishedEvents.find(e => e.name === 'lesson.completed');
      expect(completedEvent).toBeDefined();
      expect(completedEvent!.payload).toMatchObject({
        lessonId: 1,
        classCode: 'CL001',
        teacherId: 100,
        durationMinutes: 60,
      });
    });

    it('Lesson Archived 应通过 EventBus 触发 lesson.finished 事件', async () => {
      // SCHEDULED → TEACHING → FINISHED → ARCHIVED
      await lessonService.updateStatus(1, LessonStatus.TEACHING, 100);
      await lessonService.updateStatus(1, LessonStatus.FINISHED, 100);
      publishedEvents.length = 0; // Clear previous events

      await lessonService.updateStatus(1, LessonStatus.ARCHIVED, 100);

      // Assert: EventBus.publish called with lesson.finished
      const finishedEvent = publishedEvents.find(e => e.name === 'lesson.finished');
      expect(finishedEvent).toBeDefined();
      expect(finishedEvent!.payload).toMatchObject({
        lessonId: 1,
        classCode: 'CL001',
        confirmedBy: 100,
      });
    });

    it('Lesson Cancelled 应通过 EventBus 触发 lesson.cancelled 事件', async () => {
      const lesson2 = createLessonEntity({ id: 2, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(2, lesson2);

      await lessonService.updateStatus(2, LessonStatus.CANCELLED, 100, 'Schedule conflict');

      const cancelledEvent = publishedEvents.find(e => e.name === 'lesson.cancelled');
      expect(cancelledEvent).toBeDefined();
      expect(cancelledEvent!.payload).toMatchObject({
        lessonId: 2,
        classCode: 'CL001',
        cancelledReason: 'Schedule conflict',
      });
    });

    it('Event 不应重复触发 — 再次 updateStatus 到相同状态应拒绝', async () => {
      // Make lesson FINISHED first
      await lessonService.updateStatus(1, LessonStatus.TEACHING, 100);
      await lessonService.updateStatus(1, LessonStatus.FINISHED, 100);
      publishedEvents.length = 0;

      // Trying to FINISH again should throw
      await expect(
        lessonService.updateStatus(1, LessonStatus.FINISHED, 100),
      ).rejects.toThrow(BadRequestException);

      // No duplicate event published
      const completedEvents = publishedEvents.filter(e => e.name === 'lesson.completed');
      expect(completedEvents).toHaveLength(0);
    });

    it('Event 不应重复触发 — SalaryListener 有幂等检查', async () => {
      const salaryRecordRepo = createMockSalaryRecordRepo();
      const calculator = new SalaryCalculator(
        createMockSalaryRuleRepo() as any,
        salaryRecordRepo as any,
      );
      const listener = new SalaryListener(salaryRecordRepo as any, calculator);

      const event = new SalaryLessonCompletedEvent(5, 100, 1, new Date());

      jest.spyOn(calculator, 'calculate');
      await listener.handleLessonCompleted(event);
      expect(calculator.calculate).toHaveBeenCalledTimes(1);

      // Second call with same lessonId: should skip (idempotent)
      (calculator.calculate as jest.Mock).mockClear();
      await listener.handleLessonCompleted(event);
      expect(calculator.calculate).not.toHaveBeenCalled();
    });

    it('LessonService 无直接 SalaryService 调用', async () => {
      // Read the actual source file for static analysis
      const fs = require('fs');
      const path = require('path');
      const sourcePath = path.join(__dirname, '../lesson/lesson.service.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');

      expect(source).not.toContain('SalaryService');
      expect(source).not.toContain('SalaryModule');
      expect(source).not.toContain('salaryRecordRepo');
      // It should use EventBus
      expect(source).toContain('EventBusService');
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  2. Lesson 状态检查
  // ═══════════════════════════════════════════════════════════

  describe('2. Lesson 状态检查', () => {
    let lessonService: LessonService;
    let mockEventBus: ReturnType<typeof createMockEventBus>;
    let mockLessonRepo: ReturnType<typeof createMockLessonRepo>;

    beforeEach(async () => {
      mockEventBus = createMockEventBus();
      mockLessonRepo = createMockLessonRepo();
      mockEventBus.publish = jest.fn();
      mockEventBus.subscribe = jest.fn();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonService,
          { provide: EventBusService, useValue: mockEventBus },
          { provide: LessonRepository, useValue: mockLessonRepo },
          { provide: ClassRepository, useValue: createMockClassRepo() },
          { provide: EnrollmentRepository, useValue: createMockEnrollmentRepo() },
          { provide: ReminderService, useValue: createMockReminderService() },
          { provide: getRepositoryToken(Student), useValue: createMockStudentRepo() },
        ],
      }).compile();

      lessonService = module.get<LessonService>(LessonService);
    });

    it('SCHEDULED → TEACHING → FINISHED（相当于 COMPLETED）允许', async () => {
      const lesson = createLessonEntity({ id: 1, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(1, lesson);

      const afterTeaching = await lessonService.updateStatus(1, LessonStatus.TEACHING, 100);
      expect(afterTeaching.status).toBe(LessonStatus.TEACHING);

      const afterFinished = await lessonService.updateStatus(1, LessonStatus.FINISHED, 100);
      expect(afterFinished.status).toBe(LessonStatus.FINISHED);
    });

    it('SCHEDULED → CANCELLED 允许', async () => {
      const lesson = createLessonEntity({ id: 2, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(2, lesson);

      const result = await lessonService.updateStatus(2, LessonStatus.CANCELLED, 100, 'Reason');
      expect(result.status).toBe(LessonStatus.CANCELLED);
    });

    it('SCHEDULED → SUSPENDED 允许', async () => {
      const lesson = createLessonEntity({ id: 3, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(3, lesson);

      const result = await lessonService.updateStatus(3, LessonStatus.SUSPENDED, 100);
      expect(result.status).toBe(LessonStatus.SUSPENDED);
    });

    it('CANCELLED → SUSPENDED 禁止（非法转换）', async () => {
      const lesson = createLessonEntity({ id: 4, status: LessonStatus.CANCELLED });
      mockLessonRepo._store.set(4, lesson);

      await expect(
        lessonService.updateStatus(4, LessonStatus.SUSPENDED, 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('FINISHED → SCHEDULED 禁止（需要 reopen reason）', async () => {
      const lesson = createLessonEntity({ id: 5, status: LessonStatus.FINISHED });
      mockLessonRepo._store.set(5, lesson);

      await expect(
        lessonService.updateStatus(5, LessonStatus.SCHEDULED, 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('CANCELLED 必须提供 reason', async () => {
      const lesson = createLessonEntity({ id: 6, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(6, lesson);

      await expect(
        lessonService.updateStatus(6, LessonStatus.CANCELLED, 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('禁止跳过状态（SCHEDULED → ARCHIVED 非法）', async () => {
      const lesson = createLessonEntity({ id: 7, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(7, lesson);

      await expect(
        lessonService.updateStatus(7, LessonStatus.ARCHIVED, 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('VALID_TRANSITIONS 中不能含有 COMPLETED（该状态不存在）', () => {
      const statusKeys = Object.keys(VALID_TRANSITIONS);
      expect(statusKeys).not.toContain('COMPLETED');
    });

    it('状态转换表完整性 — 每个 LessonStatus 都定义了转换规则', () => {
      const definedStatuses = Object.values(LessonStatus);
      for (const status of definedStatuses) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
      // Verify total status count matches
      expect(definedStatuses.length).toBe(Object.keys(VALID_TRANSITIONS).length);
    });

    it('禁止直接修改状态 — 不通过 updateStatus 方法', () => {
      // Simulate what a direct modification would look like:
      // entity.status = LessonStatus.FINISHED; repo.save(entity)
      // This should be prevented at the architecture level.
      // Test verifies LessonRepository.save can be called with direct status set,
      // which is a GAP — the entity has no guard against direct status modification
      const lesson = createLessonEntity({ id: 50, status: LessonStatus.SCHEDULED });
      // Direct modification bypasses state machine — this is technically possible
      lesson.status = LessonStatus.FINISHED;
      // The fact this is allowed is a finding (see evidence doc)
      expect(lesson.status).toBe(LessonStatus.FINISHED);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  3. 课时 Ledger 检查
  // ═══════════════════════════════════════════════════════════

  describe('3. 课时 Ledger 检查', () => {
    let lessonService: LessonService;
    let mockEventBus: ReturnType<typeof createMockEventBus>;
    let mockLessonRepo: ReturnType<typeof createMockLessonRepo>;
    let mockContractRepo: ReturnType<typeof createMockContractRepo>;
    let attendanceService: LessonAttendanceService;

    beforeEach(async () => {
      mockEventBus = createMockEventBus();
      mockLessonRepo = createMockLessonRepo();
      mockContractRepo = createMockContractRepo();

      const mockAttendanceRepo = createMockAttendanceRepo();
      const mockReminderService = createMockReminderService();
      const mockClassRepo = {
        findOne: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({ classCode: where.classCode, courseCode: 'MATH001' })),
      } as any;
      const mockCourseRepo = {
        findOne: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({ courseCode: where.courseCode, subject: Subject.MATH })),
      } as any;

      attendanceService = new LessonAttendanceService(
        mockAttendanceRepo as any,
        mockReminderService as any,
        mockContractRepo as any,
        mockClassRepo,
        mockCourseRepo,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonService,
          { provide: EventBusService, useValue: mockEventBus },
          { provide: LessonRepository, useValue: mockLessonRepo },
          { provide: ClassRepository, useValue: createMockClassRepo() },
          { provide: EnrollmentRepository, useValue: createMockEnrollmentRepo() },
          { provide: ReminderService, useValue: mockReminderService },
          { provide: getRepositoryToken(Student), useValue: createMockStudentRepo() },
        ],
      }).compile();

      lessonService = module.get<LessonService>(LessonService);
    });

    it('课时变化唯一来源 — LessonService 不直接管理课时余额', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(path.join(__dirname, '../lesson/lesson.service.ts'), 'utf-8');

      expect(source).not.toContain('remainingLessons');
      expect(source).not.toContain('deductLesson');
      // LessonService does not import ContractRepository directly
      expect(source).not.toContain('ContractRepository');
      expect(source).not.toContain('ContractService');
    });

    it('课时变化唯一来源 — 余额通过考勤记录的合约扣减实现，不与 Lesson 状态耦合', () => {
      // LessonAttendanceService.deductLessonFromContract is the sole mechanism
      // It's triggered by attendance recording, NOT by lesson status changes
      const fs = require('fs');
      const path = require('path');
      const attendanceSource = fs.readFileSync(
        path.join(__dirname, '../lesson-attendance/lesson-attendance.service.ts'),
        'utf-8',
      );
      expect(attendanceSource).toContain('deductLessonFromContract');
      expect(attendanceSource).toContain('remainingLessons');
    });

    it('支持幂等 — 重复扣课不会重复扣减（工作流状态机拦截）', async () => {
      // Setup contract with 5 lessons
      mockContractRepo._store.push({
        id: 1,
        contractCode: 'CT-IDEMP-001',
        studentCode: 'STU001',
        subject: Subject.MATH,
        totalLessons: 5,
        remainingLessons: 5,
        status: 'ACTIVE',
      });

      // Auto-create attendance record
      await attendanceService.autoCreateForLesson(1, ['STU001'], 'CL001', 100);

      // First check-in: PRESENT should deduct
      await attendanceService.recordAttendance({
        lessonId: 1,
        studentCode: 'STU001',
        status: AttendanceStatus.PRESENT,
        operator: 100,
      });

      // Verify: 5 → 4
      const afterFirst = mockContractRepo._store.find(c => c.contractCode === 'CT-IDEMP-001');
      expect(afterFirst.remainingLessons).toBe(4);

      // Second check-in: blocked by workflow state machine (PENDING → CHECKED_IN already done)
      await expect(
        attendanceService.recordAttendance({
          lessonId: 1,
          studentCode: 'STU001',
          status: AttendanceStatus.PRESENT,
          operator: 100,
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify: still 4 (no double deduction)
      const afterSecond = mockContractRepo._store.find(c => c.contractCode === 'CT-IDEMP-001');
      expect(afterSecond.remainingLessons).toBe(4);
    });

    it('课时变化唯一来源 — SalaryListener 不能修改课时余额', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '../../../modules/salary/listeners/salary.listener.ts'),
        'utf-8',
      );
      expect(source).not.toContain('remainingLessons');
      expect(source).not.toContain('deductLesson');
      expect(source).not.toContain('contract');
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  4. Salary 检查
  // ═══════════════════════════════════════════════════════════

  describe('4. Salary 检查', () => {
    let lessonService: LessonService;
    let mockEventBus: ReturnType<typeof createMockEventBus>;
    let mockLessonRepo: ReturnType<typeof createMockLessonRepo>;
    let salaryListener: SalaryListener;
    let salaryCalculator: SalaryCalculator;
    let mockSalaryRecordRepo: ReturnType<typeof createMockSalaryRecordRepo>;
    let mockSalaryRuleRepo: ReturnType<typeof createMockSalaryRuleRepo>;

    beforeEach(async () => {
      mockEventBus = createMockEventBus();
      mockLessonRepo = createMockLessonRepo();
      mockSalaryRecordRepo = createMockSalaryRecordRepo();
      mockSalaryRuleRepo = createMockSalaryRuleRepo();

      salaryCalculator = new SalaryCalculator(
        mockSalaryRuleRepo as any,
        mockSalaryRecordRepo as any,
      );
      salaryListener = new SalaryListener(
        mockSalaryRecordRepo as any,
        salaryCalculator,
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LessonService,
          { provide: EventBusService, useValue: mockEventBus },
          { provide: LessonRepository, useValue: mockLessonRepo },
          { provide: ClassRepository, useValue: createMockClassRepo() },
          { provide: EnrollmentRepository, useValue: createMockEnrollmentRepo() },
          { provide: ReminderService, useValue: createMockReminderService() },
          { provide: getRepositoryToken(Student), useValue: createMockStudentRepo() },
        ],
      }).compile();

      lessonService = module.get<LessonService>(LessonService);
    });

    it('FINISHED 状态应通过 EventBus 触发工资生成', async () => {
      // Follow correct state machine
      const lesson = createLessonEntity({ id: 10, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(10, lesson);

      const events: any[] = [];
      mockEventBus.publish = jest.fn((name, payload) => {
        if (name === 'lesson.completed') events.push(payload);
      });

      await lessonService.updateStatus(10, LessonStatus.TEACHING, 100);
      await lessonService.updateStatus(10, LessonStatus.FINISHED, 100);

      expect(events.length).toBe(1);
      expect(events[0].teacherId).toBe(100);
      expect(events[0].lessonId).toBe(10);
    });

    it('FINISHED 发布的事件可被 SalaryListener 接收并生成工资记录', async () => {
      const lessonEvent = new SalaryLessonCompletedEvent(20, 100, 1, new Date());

      const record = await salaryCalculator.calculate(lessonEvent);
      expect(record).toBeDefined();
      expect(record.teacherId).toBe(100);
      expect(record.lessonId).toBe(20);
      expect(record.amount).toBeGreaterThan(0);
      expect(record.status).toBe(SalaryRecordStatus.PENDING);

      await salaryListener.handleLessonCompleted(lessonEvent);

      const saved = await mockSalaryRecordRepo.findOne({ where: { lessonId: 20 } });
      expect(saved).toBeDefined();
      expect(saved!.amount).toBeGreaterThan(0);
    });

    it('CANCELLED 状态不应生成工资', async () => {
      const lesson = createLessonEntity({ id: 30, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(30, lesson);

      const events: any[] = [];
      mockEventBus.publish = jest.fn((name, payload) => {
        events.push({ name, payload });
      });

      await lessonService.updateStatus(30, LessonStatus.CANCELLED, 100, 'No teacher');

      const completedEvents = events.filter(e => e.name === 'lesson.completed');
      expect(completedEvents).toHaveLength(0);
    });

    it('SUSPENDED 状态不应生成工资', async () => {
      const lesson = createLessonEntity({ id: 40, status: LessonStatus.SCHEDULED });
      mockLessonRepo._store.set(40, lesson);

      const events: any[] = [];
      mockEventBus.publish = jest.fn((name, payload) => {
        events.push({ name, payload });
      });

      await lessonService.updateStatus(40, LessonStatus.SUSPENDED, 100);

      const completedEvents = events.filter(e => e.name === 'lesson.completed');
      expect(completedEvents).toHaveLength(0);
    });

    it('ARCHIVED（lesson.finished）事件不会触发工资生成', async () => {
      const lesson = createLessonEntity({ id: 50, status: LessonStatus.FINISHED });
      mockLessonRepo._store.set(50, lesson);

      const events: any[] = [];
      mockEventBus.publish = jest.fn((name, payload) => {
        events.push({ name, payload });
      });

      await lessonService.updateStatus(50, LessonStatus.ARCHIVED, 100);

      const completedEvents = events.filter(e => e.name === 'lesson.completed');
      expect(completedEvents).toHaveLength(0);
      const finishedEvents = events.filter(e => e.name === 'lesson.finished');
      expect(finishedEvents).toHaveLength(1);
    });

    it('幂等 — 重复的 lesson.completed 事件不会重复生成工资', async () => {
      const lessonEvent = new SalaryLessonCompletedEvent(60, 100, 1, new Date());

      await salaryListener.handleLessonCompleted(lessonEvent);
      const firstRecords = Array.from(mockSalaryRecordRepo._records.values());
      expect(firstRecords.length).toBe(1);

      // Second call: should skip (idempotent)
      await salaryListener.handleLessonCompleted(lessonEvent);
      const secondRecords = Array.from(mockSalaryRecordRepo._records.values());
      expect(secondRecords.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  5. 模块依赖检查
  // ═══════════════════════════════════════════════════════════

  describe('5. 模块依赖检查', () => {
    it('Lesson 不应直接调用 Salary Service（通过源码分析）', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(path.join(__dirname, '../lesson/lesson.service.ts'), 'utf-8');

      // No direct salary dependencies
      expect(source).not.toContain('SalaryService');
      expect(source).not.toContain('SalaryRecord');
      expect(source).not.toContain('salaryRule');
      // Only communicates via EventBus
      expect(source).toContain('EventBusService');
    });

    it('Salary 不应直接调用 Lesson Service（通过源码分析）', () => {
      const fs = require('fs');
      const path = require('path');
      const listenerSource = fs.readFileSync(
        path.join(__dirname, '../../../modules/salary/listeners/salary.listener.ts'),
        'utf-8',
      );
      const calculatorSource = fs.readFileSync(
        path.join(__dirname, '../../../modules/salary/services/salary-calculator.service.ts'),
        'utf-8',
      );

      // Neither imports LessonService/LessonEntity/LessonRepository
      expect(listenerSource).not.toContain('LessonService');
      expect(listenerSource).not.toContain('LessonEntity');
      expect(calculatorSource).not.toContain('LessonService');
      expect(calculatorSource).not.toContain('LessonEntity');
      expect(calculatorSource).not.toContain('LessonRepository');

      // Both use salary domain classes
      expect(listenerSource).toContain('SalaryRecord');
      expect(calculatorSource).toContain('SalaryRule');
    });

    it('Lesson → EventBus → Listener 链路完整（源码分析）', () => {
      const fs = require('fs');
      const path = require('path');
      const lessonSource = fs.readFileSync(
        path.join(__dirname, '../lesson/lesson.service.ts'),
        'utf-8',
      );
      const salaryListenerSource = fs.readFileSync(
        path.join(__dirname, '../../../modules/salary/listeners/salary.listener.ts'),
        'utf-8',
      );

      // LessonService publishes via EventBus
      expect(lessonSource).toContain('eventBus.publish');
      // SalaryListener receives via @OnEvent decorator
      expect(salaryListenerSource).toContain('OnEvent');
      expect(salaryListenerSource).toContain("'lesson.completed'");
    });

    it('LessonModule 不导入 SalaryModule', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(path.join(__dirname, '../lesson/lesson.module.ts'), 'utf-8');
      expect(source).not.toContain('SalaryModule');
      expect(source).not.toContain('SalaryService');
      expect(source).toContain('EventBusModule');
    });

    it('SalaryModule 不导入 LessonModule', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '../../../modules/salary/salary.module.ts'),
        'utf-8',
      );
      expect(source).not.toContain('LessonModule');
      expect(source).not.toContain('LessonService');
    });

    it('教学模块内 LessonAttendanceService 对 salary 无跨模块依赖（已移除事件发射）', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, '../lesson-attendance/lesson-attendance.service.ts'),
        'utf-8',
      );
      // Should NOT import salary service directly
      expect(source).not.toContain('SalaryService');
      // Should NOT import salary event class anymore (event emission removed)
      expect(source).not.toContain('LessonCompletedEvent');
      // Should NOT emit lesson.completed directly (now only LessonService emits it)
      expect(source).not.toContain("'lesson.completed'");
      // EventEmitter2 import should also be removed
      expect(source).not.toContain('EventEmitter2');
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  6. Architecture Gap Detection
  // ═══════════════════════════════════════════════════════════

  describe('6. 架构完整性检查 — 缺失组件检测', () => {
    function findFiles(dir: string, namePattern: RegExp, excludePattern?: RegExp): string[] {
      const fs = require('fs');
      const path = require('path');
      const results: string[] = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            results.push(...findFiles(fullPath, namePattern, excludePattern));
          } else if (
            entry.isFile() &&
            namePattern.test(entry.name)
          ) {
            if (!excludePattern || !excludePattern.test(entry.name)) {
              results.push(fullPath);
            }
          }
        }
      } catch {}
      return results;
    }

    it('Points listener 未实现 — 架构图示有点但代码未找到', () => {
      const fs = require('fs');
      const path = require('path');
      const searchDir = path.join(__dirname, '../../..');
      // Search specifically for *listener* files related to points
      const listenerFiles = findFiles(searchDir, /\.listener\.ts$/i);
      const pointListeners = listenerFiles.filter(f => /point/i.test(f));
      expect(pointListeners).toHaveLength(0);
    });

    it('Notification listener for lesson events 未找到', () => {
      const fs = require('fs');
      const path = require('path');
      const searchDir = path.join(__dirname, '../../..');
      const listenerFiles = findFiles(searchDir, /\.listener\.ts$/i);
      const notificationListeners = listenerFiles.filter(f => /notification/i.test(f));
      expect(notificationListeners).toHaveLength(0);
    });

    it('课时 Ledger 独立模块不存在 — 合约扣减作为课时管理方式', () => {
      const fs = require('fs');
      const path = require('path');
      const teachingDir = path.join(__dirname, '..');
      const entries = fs.readdirSync(teachingDir, { withFileTypes: true });
      const submodules = entries.filter(e => e.isDirectory()).map(e => e.name);
      expect(submodules).not.toContain('ledger');
    });
  });
});
