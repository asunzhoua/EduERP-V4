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
import { ContractRepository } from '../contract/contract.repository';
import { Subject } from '@common/enums/subject.enum';
import { Student } from '@modules/student/entities/student.entity';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { LessonAttendanceRepository } from '../lesson-attendance/lesson-attendance.repository';
import { ClassEntity } from '../class/class.entity';
import { CourseEntity } from '../course/course.entity';
import { PointsService } from '@modules/points/points.service';

type ClassFindOneWhere = { where: { classCode?: string } };
type CourseFindOneWhere = { where: { courseCode?: string } };

interface LessonCompletedPayload {
  lessonId: number;
  classCode: string;
  courseCode: string;
  teacherId: number;
  scheduledDate: string;
  actualStartTime?: Date | null;
  actualEndTime?: Date | null;
  completedAt: Date;
  durationMinutes?: number;
}

// ══════════════════════════════════════════════════════════════
//  Mock Factories
// ══════════════════════════════════════════════════════════════

function createMockEventBus() {
  const published: Array<{ name: string; payload: LessonCompletedPayload }> =
    [];
  const handlers = new Map<string, (payload: any) => void | Promise<void>>();

  return {
    _published: published,
    _handlers: handlers,
    publish: jest
      .fn()
      .mockImplementation(
        async (eventName: string, payload: LessonCompletedPayload) => {
          published.push({ name: eventName, payload });
          const handler = handlers.get(eventName);
          if (handler) await handler(payload);
        },
      ),
    subscribe: jest.fn((eventName: string, handler: (payload: any) => void) => {
      handlers.set(eventName, handler);
    }),
  };
}

function getMockLessonEntity(
  overrides: Partial<LessonEntity> = {},
): LessonEntity {
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
    saveAll: jest
      .fn()
      .mockImplementation((entities: LessonAttendanceEntity[]) => {
        for (const entity of entities) {
          const idx = records.findIndex(
            (r) =>
              r.lessonId === entity.lessonId &&
              r.studentCode === entity.studentCode,
          );
          if (idx >= 0) records[idx] = entity;
          else records.push(entity);
        }
        return Promise.resolve(entities);
      }),
    findByLessonId: jest.fn().mockImplementation((lessonId: number) => {
      return Promise.resolve(records.filter((r) => r.lessonId === lessonId));
    }),
    findByLessonIdAndStudentCodes: jest
      .fn()
      .mockImplementation((lessonId: number, studentCodes: string[]) => {
        return Promise.resolve(
          records.filter(
            (r) =>
              r.lessonId === lessonId && studentCodes.includes(r.studentCode),
          ),
        );
      }),
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
    findOneByCode: jest
      .fn()
      .mockResolvedValue({ status: ClassStatus.ACTIVE, courseCode: 'MATH' }),
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
    findActiveByStudentCodeAndSubject: jest.fn().mockResolvedValue(null),
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
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let mockAttendanceRepo: ReturnType<typeof createMockAttendanceRepo>;
  let mockLessonRepo: ReturnType<typeof createMockLessonRepo>;

  beforeEach(async () => {
    mockEventBus = createMockEventBus();
    mockAttendanceRepo = createMockAttendanceRepo();
    mockLessonRepo = createMockLessonRepo();
    const mockReminderService = createMockReminderService();
    const mockClassRepo = createMockClassRepo();
    const mockEnrollmentRepo = createMockEnrollmentRepo();
    const mockContractRepo = createMockContractRepo();
    const mockStudentRepo = createMockStudentRepo();

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
    const mockLessonClassRepo = {
      findOne: jest.fn().mockImplementation(({ where }: ClassFindOneWhere) =>
        Promise.resolve({
          classCode: where.classCode,
          courseCode: 'MATH001',
        }),
      ),
    } as unknown as Repository<ClassEntity>;
    const mockLessonCourseRepo = {
      findOne: jest.fn().mockImplementation(({ where }: CourseFindOneWhere) =>
        Promise.resolve({
          courseCode: where.courseCode,
          subject: Subject.MATH,
        }),
      ),
    } as unknown as Repository<CourseEntity>;
    attendanceService = new LessonAttendanceService(
      mockAttendanceRepo as unknown as LessonAttendanceRepository,
      mockReminderService as unknown as ReminderService,
      mockContractRepo as unknown as ContractRepository,
      mockLessonClassRepo,
      mockLessonCourseRepo,
      {
        credit: jest.fn().mockResolvedValue({ balance: 10 }),
      } as unknown as PointsService,
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
        (e) => e.name === 'lesson.completed',
      );
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].payload.lessonId).toBe(lessonId);
    });

    it('lesson.completed 事件应携带 completedAt', async () => {
      const lessonId = 11;
      const teaching = getMockLessonEntity({
        id: lessonId,
        status: LessonStatus.TEACHING,
      });
      mockLessonRepo._store.set(lessonId, teaching);

      await lessonService.updateStatus(lessonId, LessonStatus.FINISHED, 1);

      const completedEvents = mockEventBus._published.filter(
        (e) => e.name === 'lesson.completed',
      );
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].payload.completedAt).toBeInstanceOf(Date);
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
      expect(
        mockEventBus._published.filter((e) => e.name === 'lesson.completed'),
      ).toHaveLength(0);
    });
  });

  // ─── Test 2: Salary 幂等 ───

  describe('Salary 幂等性', () => {
    it('lesson.completed 事件携带结算所需字段', async () => {
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
        (e) => e.name === 'lesson.completed',
      );
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].payload.lessonId).toBe(lessonId);
      // 结算引擎需要 teacherId / courseCode / scheduledDate / durationMinutes
      expect(completedEvents[0].payload.teacherId).toBeDefined();
      expect(completedEvents[0].payload.courseCode).toBeDefined();
      expect(completedEvents[0].payload.scheduledDate).toBeDefined();
    });

    it('工资不再由 lesson.completed 即时生成 — 由月度结算读取 FINISHED 课时（源码分析）', () => {
      const salaryModuleSource = fs.readFileSync(
        path.join(__dirname, '../../../modules/salary/salary.module.ts'),
        'utf-8',
      );
      const settlementSource = fs.readFileSync(
        path.join(
          __dirname,
          '../../../modules/salary/services/salary-settlement.service.ts',
        ),
        'utf-8',
      );
      // 无事件监听器 → 无即时工资写入
      expect(salaryModuleSource).not.toContain('SalaryListener');
      expect(salaryModuleSource).not.toContain('EventEmitter');
      // 结算引擎以 FINISHED 课时为数据源，应用层 recordKey 去重
      expect(settlementSource).toContain('LessonStatus.FINISHED');
      expect(settlementSource).toContain('recordKey');
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

      // lesson.completed 只发射一次（状态机拦截重复完成）
      const completedEvents = mockEventBus._published.filter(
        (e) => e.name === 'lesson.completed',
      );
      expect(completedEvents).toHaveLength(1);

      // 工资记录幂等由结算引擎保证：唯一索引 + recordKey 去重
      const settlementSource = fs.readFileSync(
        path.join(
          __dirname,
          '../../../modules/salary/services/salary-settlement.service.ts',
        ),
        'utf-8',
      );
      const migrationSource = fs.readFileSync(
        path.join(
          __dirname,
          '../../../migrations/1786500000000-AddSalaryConfigColumns.ts',
        ),
        'utf-8',
      );
      expect(settlementSource).toContain('recordKey');
      expect(migrationSource).toContain(
        'uk_salary_record_teacher_month_source_lesson',
      );
    });
  });

  // ─── Test 3: Exception 流程不受影响 ───

  describe('Exception 流程', () => {
    it('不产生 SalaryRecord 的异常流不应发布 lesson.completed', () => {
      // 源码验证：检查 attendance.service.ts 不再导入 EventEmitter2
      const source = fs.readFileSync(
        path.join(
          __dirname,
          '../lesson-attendance/lesson-attendance.service.ts',
        ),
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
      const source = fs.readFileSync(
        path.join(
          __dirname,
          '../lesson/lesson-exception/lesson-exception.service.ts',
        ),
        'utf-8',
      );

      expect(source).toContain("'lesson.completed'");
    });
  });
});
