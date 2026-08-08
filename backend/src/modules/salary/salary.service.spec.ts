import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalaryService } from './salary.service';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';

describe('SalaryService.getStatistics', () => {
  let service: SalaryService;
  let qb: any;

  const ruleRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    const totals = {
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalRecords: '10',
        totalAmount: '2000',
        totalMinutes: '600',
        teacherCount: '3',
      }),
    };
    const statusRows = {
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: 'PENDING', amount: '800' },
        { status: 'APPROVED', amount: '700' },
        { status: 'PAID', amount: '500' },
      ]),
    };
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValueOnce(totals).mockReturnValueOnce(statusRows),
    };
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryService,
        { provide: getRepositoryToken(SalaryRuleEntity), useValue: ruleRepo },
        {
          provide: getRepositoryToken(SalaryRecordEntity),
          useValue: { createQueryBuilder: jest.fn().mockImplementation(() => qb) },
        },
      ],
    }).compile();
    service = module.get(SalaryService);
  });

  it('默认取当前年月，前端可不传参数', async () => {
    const now = new Date();
    const res = await service.getStatistics({});
    expect(res.year).toBe(now.getFullYear());
    expect(res.monthNum).toBe(now.getMonth() + 1);
    expect(res.month).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    );
  });

  it('返回 paid/pending 拆分、recordCount 与 teacherCount', async () => {
    const res = await service.getStatistics({ year: 2026, month: 8 });
    expect(res.totalAmount).toBe(2000);
    expect(res.recordCount).toBe(10);
    expect(res.teacherCount).toBe(3);
    expect(res.paidAmount).toBe(500);
    expect(res.pendingAmount).toBe(1500); // PENDING 800 + APPROVED 700
    expect(res.month).toBe('2026-08');
  });
});
