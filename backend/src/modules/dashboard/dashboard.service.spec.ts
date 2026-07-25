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
import { LessonStatus } from '@modules/teaching/lesson/enums/lesson-status.enum';
import { StudentStatus } from '@modules/student/enums/student-status.enum';
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

// ─── Test suite ──────────────────────────────────────────────────────

describe('DashboardService', () => {
  let service: DashboardService;
  let lessonRepo: MockRepo;
  let studentRepo: MockRepo;
  let contractRepo: MockRepo;
  let exceptionRepo: MockRepo;
  let salaryRepo: MockRepo;
  let userRepo: MockRepo;

  beforeEach(async () => {
    lessonRepo = mockRepository();
    studentRepo = mockRepository();
    contractRepo = mockRepository();
    exceptionRepo = mockRepository();
    salaryRepo = mockRepository();
    userRepo = mockRepository();

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
      lessonRepo.count.mockResolvedValue(5);          // todayLessons
      exceptionRepo.count.mockResolvedValue(2);        // leaveCount
      studentRepo.count.mockResolvedValue(50);         // totalStudents
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
      expect(result.today.completedLessons).toBe(5);  // same mock
      expect(result.today.leaveCount).toBe(2);

      // students
      expect(result.students.total).toBe(50);
      expect(result.students.remainingLessons).toBe(70);

      // finance
      expect(result.finance.consumedValue).toBe(30 * 150); // 4500
      expect(result.finance.todayIncome).toBe(0);          // placeholder
    });

    it('should handle empty data gracefully', async () => {
      const result = await service.getOverview();
      expect(result.today.totalLessons).toBe(0);
      expect(result.students.total).toBe(0);
      expect(result.finance.consumedValue).toBe(0);
    });

    it('should calculate consumedLessons correctly', async () => {
      contractRepo.find.mockResolvedValue([
        { totalLessons: 80, remainingLessons: 50, unitPrice: 100, status: ContractStatus.ACTIVE },
        { totalLessons: 40, remainingLessons: 10, unitPrice: 200, status: ContractStatus.ACTIVE },
      ]);

      const result = await service.getOverview();
      expect(result.today.consumedLessons).toBe(60);        // (80-50) + (40-10) = 60
      expect(result.finance.consumedValue).toBe(30*100 + 30*200); // 3000 + 6000 = 9000
    });
  });

  // ─── getLessons ────────────────────────────────────────────────────

  describe('getLessons', () => {
    it('should return lesson statistics', async () => {
      lessonRepo.count
        .mockResolvedValueOnce(200)   // total
        .mockResolvedValueOnce(150)   // finished
        .mockResolvedValueOnce(20)    // cancelled
        .mockResolvedValueOnce(10);   // suspended

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
        .mockResolvedValueOnce(300)   // total (deleted=false)
        .mockResolvedValueOnce(250)   // active
        .mockResolvedValueOnce(5);    // new this month

      contractRepo.find.mockResolvedValue([
        { remainingLessons: 100, totalLessons: 200, status: ContractStatus.ACTIVE },
        { remainingLessons: 50,  totalLessons: 100, status: ContractStatus.ACTIVE },
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
        .mockResolvedValueOnce(20)    // total teachers
        .mockResolvedValueOnce(15);   // active teachers

      lessonRepo.count.mockResolvedValue(80);   // lessons this month
      salaryRepo.find.mockResolvedValue([
        { amount: 5000 },
        { amount: 4500 },
      ]);

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
        { totalLessons: 100, remainingLessons: 40, unitPrice: 120, status: ContractStatus.ACTIVE },
        { totalLessons: 60,  remainingLessons: 20, unitPrice: 150, status: ContractStatus.ACTIVE },
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
});
