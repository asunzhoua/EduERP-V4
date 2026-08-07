import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getOverview: jest.fn().mockResolvedValue({
              today: {
                totalLessons: 10,
                completedLessons: 8,
                leaveCount: 2,
                consumedLessons: 15,
              },
              students: { total: 100, newToday: 3, remainingLessons: 500 },
              teachers: { teachingCount: 5, monthlySalary: 50000 },
              finance: { todayIncome: 10000, consumedValue: 15000 },
            }),
            getLessons: jest.fn().mockResolvedValue({
              totalLessons: 100,
              completedLessons: 80,
              cancelledLessons: 10,
              suspendedLessons: 10,
            }),
            getStudents: jest.fn().mockResolvedValue({
              totalStudents: 100,
              activeStudents: 90,
              newStudentsThisMonth: 5,
              totalRemainingLessons: 500,
            }),
            getTeachers: jest.fn().mockResolvedValue({
              totalTeachers: 10,
              activeTeachers: 8,
              totalLessonsThisMonth: 200,
              totalSalaryThisMonth: 50000,
            }),
            getFinance: jest.fn().mockResolvedValue({
              totalIncome: 100000,
              todayIncome: 10000,
              monthIncome: 50000,
              consumedValue: 15000,
            }),
            getSummary: jest.fn().mockResolvedValue({
              totalClasses: 8,
              totalStudents: 100,
              totalTeachers: 10,
              totalContractHours: 2000,
              consumedContractHours: 800,
              remainingContractHours: 1200,
              attendance: { today: 5, week: 30, month: 120, year: 800 },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return overview', async () => {
    const result = await controller.getOverview();
    expect(result).toBeDefined();
    expect(result.today.totalLessons).toBe(10);
    expect(result.students.total).toBe(100);
    expect(result.teachers.teachingCount).toBe(5);
    expect(result.finance.todayIncome).toBe(10000);
  });

  it('should return lessons', async () => {
    const result = await controller.getLessons();
    expect(result).toBeDefined();
    expect(result.totalLessons).toBe(100);
    expect(result.completedLessons).toBe(80);
    expect(result.cancelledLessons).toBe(10);
    expect(result.suspendedLessons).toBe(10);
  });

  it('should return students', async () => {
    const result = await controller.getStudents();
    expect(result).toBeDefined();
    expect(result.totalStudents).toBe(100);
    expect(result.activeStudents).toBe(90);
    expect(result.newStudentsThisMonth).toBe(5);
    expect(result.totalRemainingLessons).toBe(500);
  });

  it('should return teachers', async () => {
    const result = await controller.getTeachers();
    expect(result).toBeDefined();
    expect(result.totalTeachers).toBe(10);
    expect(result.activeTeachers).toBe(8);
    expect(result.totalLessonsThisMonth).toBe(200);
    expect(result.totalSalaryThisMonth).toBe(50000);
  });

  it('should return finance', async () => {
    const result = await controller.getFinance();
    expect(result).toBeDefined();
    expect(result.totalIncome).toBe(100000);
    expect(result.todayIncome).toBe(10000);
    expect(result.monthIncome).toBe(50000);
    expect(result.consumedValue).toBe(15000);
  });

  it('should return summary', async () => {
    const result = await controller.getSummary();
    expect(result).toBeDefined();
    expect(result.totalClasses).toBe(8);
    expect(result.totalStudents).toBe(100);
    expect(result.totalTeachers).toBe(10);
    expect(result.totalContractHours).toBe(2000);
    expect(result.consumedContractHours).toBe(800);
    expect(result.remainingContractHours).toBe(1200);
    expect(result.attendance).toEqual({ today: 5, week: 30, month: 120, year: 800 });
  });
});
