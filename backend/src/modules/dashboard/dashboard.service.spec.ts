// ---------------------------------------------------------------------------
// DashboardService — unit tests
// Phase 2 — Aggregation queries over existing business entities.
// ---------------------------------------------------------------------------

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DashboardService } from './dashboard.service';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { Student } from '@modules/student/entities/student.entity';
import { ContractEntity } from '@modules/teaching/contract/contract.entity';
import { LessonExceptionEntity } from '@modules/teaching/lesson/lesson-exception/lesson-exception.entity';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { User } from '@modules/identity/entities/user.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import { LeaveRequestEntity } from '@modules/teaching/leave-request/leave-request.entity';
import { PointsMallService } from '@modules/admin/points-mall.service';
import { ContractStatus } from '@modules/teaching/contract/enums/contract-status.enum';

// ─── Factory helpers ─────────────────────────────────────────────────

function mockRepository(): Record<string, jest.Mock> {
  return {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

type MockRepo = ReturnType<typeof mockRepository>;

// ─── Typed test helpers ────────────────────────────────────────────────
// jest asymmetric matchers return `any`; cast to the matched shape to
// satisfy strict lint (no-unsafe-assignment / no-unsafe-member-access).

function objContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

function arrContaining<T>(expected: T[]): T[] {
  return expect.arrayContaining(expected) as T[];
}

type CountCallArg = { where?: Record<string, unknown> } | undefined;

/** 取 count 首次调用参数（类型安全地跨过 jest.Mock 的 any 索引）。 */
function firstCountCallArg(repo: MockRepo): CountCallArg {
  const calls = repo.count.mock.calls as Array<Array<CountCallArg>>;
  return calls[0]?.[0];
}

// ─── Test suite ──────────────────────────────────────────────────────

describe('DashboardService', () => {
  let service: DashboardService;
  let lessonRepo: MockRepo;
  let studentRepo: MockRepo;
  let contractRepo: MockRepo;
  let exceptionRepo: MockRepo;
  let salaryRepo: MockRepo;
  let userRepo: MockRepo;
  let classRepo: MockRepo;
  let attendanceRepo: MockRepo;
  let enrollmentRepo: MockRepo;
  let leaveRequestRepo: MockRepo;

  beforeEach(async () => {
    lessonRepo = mockRepository();
    studentRepo = mockRepository();
    contractRepo = mockRepository();
    exceptionRepo = mockRepository();
    salaryRepo = mockRepository();
    userRepo = mockRepository();
    classRepo = mockRepository();
    attendanceRepo = mockRepository();
    enrollmentRepo = mockRepository();
    leaveRequestRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(LessonEntity), useValue: lessonRepo },
        { provide: getRepositoryToken(Student), useValue: studentRepo },
        { provide: getRepositoryToken(ContractEntity), useValue: contractRepo },
        {
          provide: getRepositoryToken(LessonExceptionEntity),
          useValue: exceptionRepo,
        },
        {
          provide: getRepositoryToken(SalaryRecordEntity),
          useValue: salaryRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(ClassEntity), useValue: classRepo },
        {
          provide: getRepositoryToken(LessonAttendanceEntity),
          useValue: attendanceRepo,
        },
        {
          provide: getRepositoryToken(EnrollmentEntity),
          useValue: enrollmentRepo,
        },
        {
          provide: getRepositoryToken(LeaveRequestEntity),
          useValue: leaveRequestRepo,
        },
        {
          provide: PointsMallService,
          useValue: {
            getLowStockCount: jest.fn().mockResolvedValue(0),
            findProducts: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            findExchangeRecords: jest
              .fn()
              .mockResolvedValue({ items: [], total: 0 }),
          },
        },
        // 固定时钟：getCards 窗口计算以 2026-08-09T10:00:00 为基准（契约可复现）
        {
          provide: 'DASHBOARD_NOW',
          useValue: () => new Date('2026-08-09T10:00:00'),
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  // ─── Smoke ─────────────────────────────────────────────────────────

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getOverview ───────────────────────────────────────────────────

  describe('getOverview', () => {
    beforeEach(() => {
      // Default mock return values
      lessonRepo.count.mockResolvedValue(0);
      exceptionRepo.count.mockResolvedValue(0);
      studentRepo.count.mockResolvedValue(0);
      contractRepo.find.mockResolvedValue([]);
      salaryRepo.find.mockResolvedValue([]);
    });

    it('should return a complete DashboardOverviewDto', async () => {
      lessonRepo.count.mockResolvedValue(5); // todayLessons
      exceptionRepo.count.mockResolvedValue(2); // leaveCount
      studentRepo.count.mockResolvedValue(50); // totalStudents
      contractRepo.find.mockResolvedValue([
        {
          totalLessons: 100,
          remainingLessons: 70,
          unitPrice: 150,
          status: ContractStatus.ACTIVE,
        },
      ]);

      const result = await service.getOverview();

      expect(result).toHaveProperty('today');
      expect(result).toHaveProperty('students');
      expect(result).toHaveProperty('teachers');
      expect(result).toHaveProperty('finance');

      // today
      expect(result.today.totalLessons).toBe(5);
      expect(result.today.completedLessons).toBe(5); // same mock
      expect(result.today.leaveCount).toBe(2);

      // students
      expect(result.students.total).toBe(50);
      expect(result.students.remainingLessons).toBe(70);

      // finance
      expect(result.finance.consumedValue).toBe(30 * 150); // 4500
      expect(result.finance.todayIncome).toBe(0); // placeholder
    });

    it('should handle empty data gracefully', async () => {
      const result = await service.getOverview();
      expect(result.today.totalLessons).toBe(0);
      expect(result.students.total).toBe(0);
      expect(result.finance.consumedValue).toBe(0);
    });

    it('should calculate consumedLessons correctly', async () => {
      contractRepo.find.mockResolvedValue([
        {
          totalLessons: 80,
          remainingLessons: 50,
          unitPrice: 100,
          status: ContractStatus.ACTIVE,
        },
        {
          totalLessons: 40,
          remainingLessons: 10,
          unitPrice: 200,
          status: ContractStatus.ACTIVE,
        },
      ]);

      const result = await service.getOverview();
      expect(result.today.consumedLessons).toBe(60); // (80-50) + (40-10) = 60
      expect(result.finance.consumedValue).toBe(30 * 100 + 30 * 200); // 3000 + 6000 = 9000
    });
  });

  // ─── getLessons ────────────────────────────────────────────────────

  describe('getLessons', () => {
    it('should return lesson statistics', async () => {
      lessonRepo.count
        .mockResolvedValueOnce(200) // total
        .mockResolvedValueOnce(150) // finished
        .mockResolvedValueOnce(20) // cancelled
        .mockResolvedValueOnce(10); // suspended

      const result = await service.getLessons();

      expect(result.totalLessons).toBe(200);
      expect(result.completedLessons).toBe(150);
      expect(result.cancelledLessons).toBe(20);
      expect(result.suspendedLessons).toBe(10);
    });
  });

  // ─── getStudents ───────────────────────────────────────────────────

  describe('getStudents', () => {
    it('should return student statistics', async () => {
      studentRepo.count
        .mockResolvedValueOnce(300) // total (deleted=false)
        .mockResolvedValueOnce(250) // active
        .mockResolvedValueOnce(5); // new this month

      contractRepo.find.mockResolvedValue([
        {
          remainingLessons: 100,
          totalLessons: 200,
          status: ContractStatus.ACTIVE,
        },
        {
          remainingLessons: 50,
          totalLessons: 100,
          status: ContractStatus.ACTIVE,
        },
      ]);

      const result = await service.getStudents();

      expect(result.totalStudents).toBe(300);
      expect(result.activeStudents).toBe(250);
      expect(result.newStudentsThisMonth).toBe(5);
      expect(result.totalRemainingLessons).toBe(150);
    });
  });

  // ─── getTeachers ───────────────────────────────────────────────────

  describe('getTeachers', () => {
    it('should return teacher statistics', async () => {
      userRepo.count
        .mockResolvedValueOnce(20) // total teachers
        .mockResolvedValueOnce(15); // active teachers

      lessonRepo.count.mockResolvedValue(80); // lessons this month
      salaryRepo.find.mockResolvedValue([{ amount: 5000 }, { amount: 4500 }]);

      const result = await service.getTeachers();

      expect(result.totalTeachers).toBe(20);
      expect(result.activeTeachers).toBe(15);
      expect(result.totalLessonsThisMonth).toBe(80);
      expect(result.totalSalaryThisMonth).toBe(9500);
    });
  });

  // ─── getFinance ────────────────────────────────────────────────────

  describe('getFinance', () => {
    it('should return finance statistics', async () => {
      contractRepo.find.mockResolvedValue([
        {
          totalLessons: 100,
          remainingLessons: 40,
          unitPrice: 120,
          status: ContractStatus.ACTIVE,
        },
        {
          totalLessons: 60,
          remainingLessons: 20,
          unitPrice: 150,
          status: ContractStatus.ACTIVE,
        },
      ]);

      const result = await service.getFinance();

      // income placeholders
      expect(result.totalIncome).toBe(0);
      expect(result.todayIncome).toBe(0);
      expect(result.monthIncome).toBe(0);

      // consumedValue: (100-40)*120 + (60-20)*150 = 7200 + 6000 = 13200
      expect(result.consumedValue).toBe(13200);
    });
  });

  // ─── getSummary ────────────────────────────────────────────────────

  describe('getSummary', () => {
    function mockContractAgg(raw: any) {
      contractRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(raw),
      });
    }

    beforeEach(() => {
      classRepo.count.mockResolvedValue(0);
      studentRepo.count.mockResolvedValue(0);
      userRepo.count.mockResolvedValue(0);
      mockContractAgg(null);
      attendanceRepo.count.mockResolvedValue(0);
    });

    it('should aggregate totals, contract dimension and attendance dimension', async () => {
      classRepo.count.mockResolvedValue(12);
      studentRepo.count.mockResolvedValue(150);
      userRepo.count.mockResolvedValue(8);
      mockContractAgg({ total: '200', remaining: '120', consumed: '80' });
      attendanceRepo.count
        .mockResolvedValueOnce(3) // today
        .mockResolvedValueOnce(10) // week
        .mockResolvedValueOnce(40) // month
        .mockResolvedValueOnce(120); // year

      const result = await service.getSummary();

      expect(classRepo.count).toHaveBeenCalledWith(
        objContaining({
          where: objContaining({ deleted: false }),
        }),
      );
      expect(result.totalClasses).toBe(12);
      expect(result.totalStudents).toBe(150);
      expect(result.totalTeachers).toBe(8);
      expect(result.totalContractHours).toBe(200);
      expect(result.remainingContractHours).toBe(120);
      expect(result.consumedContractHours).toBe(80);
      expect(result.attendance.today).toBe(3);
      expect(result.attendance.week).toBe(10);
      expect(result.attendance.month).toBe(40);
      expect(result.attendance.year).toBe(120);
      expect(attendanceRepo.count).toHaveBeenCalledWith(
        objContaining({
          where: objContaining({
            status: objContaining({
              _value: arrContaining(['PRESENT', 'LATE', 'ONLINE', 'OFFLINE']),
            }),
            checkInTime: objContaining({ _type: 'between' }),
          }),
        }),
      );
    });

    it('should default to zero when no data', async () => {
      const result = await service.getSummary();

      expect(result.totalClasses).toBe(0);
      expect(result.totalStudents).toBe(0);
      expect(result.totalTeachers).toBe(0);
      expect(result.totalContractHours).toBe(0);
      expect(result.remainingContractHours).toBe(0);
      expect(result.consumedContractHours).toBe(0);
      expect(result.attendance).toEqual({
        today: 0,
        week: 0,
        month: 0,
        year: 0,
      });
    });
  });

  // ─── getCards（工作台，timeType 契约）────────────────────────────────

  describe('getCards', () => {
    function mockQb(rawOne: any, rawMany: any[] = []) {
      return {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(rawOne),
        getRawMany: jest.fn().mockResolvedValue(rawMany),
      };
    }

    beforeEach(() => {
      // 存量默认 0；趋势 30 日全 0
      studentRepo.count.mockResolvedValue(0);
      classRepo.count.mockResolvedValue(0);
      userRepo.count.mockResolvedValue(0);
      contractRepo.find.mockResolvedValue([]);
      contractRepo.createQueryBuilder.mockReturnValue(mockQb({ sum: '0' }));
      enrollmentRepo.count.mockResolvedValue(0);
      salaryRepo.createQueryBuilder.mockReturnValue(mockQb({ sum: '0' }));
      attendanceRepo.count.mockResolvedValue(0);
      // 趋势查询：考勤按日分组 + 消课按日分组共用 attendanceRepo.createQueryBuilder
      attendanceRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      lessonRepo.count.mockResolvedValue(0);
      leaveRequestRepo.count.mockResolvedValue(0);
    });

    it('无 timeType 默认 month 且响应结构完整（契约用例）', async () => {
      const result = await service.getCards();
      expect(result.timeType).toBe('month');
      expect(result.groups.map((g) => g.key)).toEqual([
        'teaching',
        'recruitment',
        'finance',
        'consumption',
      ]);
      expect(result.trends.map((t) => t.name)).toEqual([
        'consumption',
        'attendance',
        'finance',
      ]);
      expect(result.trends[0].data.length).toBe(30);
      expect(result.todos.length).toBeGreaterThan(0);
    });

    it('非法 timeType 回退默认 month', async () => {
      const result = await service.getCards('bogus');
      expect(result.timeType).toBe('month');
    });

    it('day 窗口 = 今日 0 点起', async () => {
      await service.getCards('day');
      const enrolledAt = firstCountCallArg(enrollmentRepo)?.where
        ?.enrolledAt as { _type: string; _value: Date[] } | undefined;
      expect(enrolledAt?._type).toBe('between');
      const from: Date | undefined = enrolledAt?._value[0];
      expect(from?.getFullYear()).toBe(2026);
      expect(from?.getMonth()).toBe(7); // 8 月
      expect(from?.getDate()).toBe(9);
    });

    it('week 窗口 = 本周一 0 点起（2026-08-09 为周日 → 周一 08-03）', async () => {
      await service.getCards('week');
      const enrolledAt = firstCountCallArg(enrollmentRepo)?.where
        ?.enrolledAt as { _value: Date[] } | undefined;
      const from: Date | undefined = enrolledAt?._value[0];
      expect(from?.getDate()).toBe(3);
      expect(from?.getDay()).toBe(1); // Monday
    });

    it('month 窗口 = 本月 1 号起', async () => {
      await service.getCards('month');
      const enrolledAt = firstCountCallArg(enrollmentRepo)?.where
        ?.enrolledAt as { _value: Date[] } | undefined;
      const from: Date | undefined = enrolledAt?._value[0];
      expect(from?.getMonth()).toBe(7);
      expect(from?.getDate()).toBe(1);
    });

    it('year 窗口 = 本年 1 月 1 日起', async () => {
      await service.getCards('year');
      const enrolledAt = firstCountCallArg(enrollmentRepo)?.where
        ?.enrolledAt as { _value: Date[] } | undefined;
      const from: Date | undefined = enrolledAt?._value[0];
      expect(from?.getFullYear()).toBe(2026);
      expect(from?.getMonth()).toBe(0);
      expect(from?.getDate()).toBe(1);
    });

    it('all 不设时间过滤（无 enrolledAt 条件）', async () => {
      await service.getCards('all');
      const arg = firstCountCallArg(enrollmentRepo);
      expect(arg?.where).toBeUndefined();
    });

    it('聚合值与分组结构正确', async () => {
      studentRepo.count
        .mockResolvedValueOnce(120) // 学员总数
        .mockResolvedValueOnce(5); // 新增学员
      classRepo.count.mockResolvedValue(9);
      userRepo.count.mockResolvedValue(14);
      contractRepo.find.mockResolvedValue([
        {
          totalLessons: 100,
          remainingLessons: 70,
          status: ContractStatus.ACTIVE,
        },
      ]);
      contractRepo.createQueryBuilder.mockReturnValue(mockQb({ sum: '36000' }));
      enrollmentRepo.count.mockResolvedValue(8);
      salaryRepo.createQueryBuilder.mockReturnValue(mockQb({ sum: '9000' }));
      attendanceRepo.count.mockResolvedValue(210);
      lessonRepo.count.mockResolvedValue(260);
      leaveRequestRepo.count
        .mockResolvedValueOnce(6) // 请假次数（窗口）
        .mockResolvedValueOnce(2); // 待审批请假

      const result = await service.getCards('month');

      const metric = (g: string, k: string) =>
        result.groups
          .find((x) => x.key === g)!
          .metrics.find((m) => m.key === k)!;
      expect(metric('teaching', 'studentCount').value).toBe(120);
      expect(metric('teaching', 'classCount').value).toBe(9);
      expect(metric('recruitment', 'enrollmentCount').value).toBe(8);
      expect(metric('recruitment', 'contractAmount').value).toBe(36000);
      expect(metric('finance', 'income').value).toBe(36000);
      expect(metric('finance', 'expense').value).toBe(9000);
      expect(metric('finance', 'profit').value).toBe(27000);
      expect(metric('consumption', 'consumedLessons').value).toBe(210);
      expect(metric('consumption', 'scheduledLessons').value).toBe(260);
      expect(metric('consumption', 'leaveCount').value).toBe(6);
      expect(result.todos.find((t) => t.key === 'leave')!.count).toBe(2);
    });
  });
});
