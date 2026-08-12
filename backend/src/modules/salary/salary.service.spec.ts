import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalaryService } from './salary.service';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';
import { TeacherSalaryProfileEntity } from './entities/teacher-salary-profile.entity';
import { OutingRecordEntity } from './entities/outing-record.entity';
import { User } from '@modules/identity/entities/user.entity';

describe('SalaryService.getStatistics', () => {
  let service: SalaryService;
  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    clone: jest.Mock;
  };

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
    const bySource = {
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { source: 'BASE', count: '1', amount: '8000' },
        { source: 'DAY', count: '6', amount: '1800' },
        { source: 'ALLOWANCE', count: '1', amount: '1000' },
        { source: 'BONUS', count: '1', amount: '500' },
        { source: 'DEDUCTION', count: '1', amount: '-200' },
      ]),
    };
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      clone: jest
        .fn()
        .mockReturnValueOnce(totals)
        .mockReturnValueOnce(statusRows)
        .mockReturnValueOnce(bySource),
    };
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryService,
        { provide: getRepositoryToken(SalaryRuleEntity), useValue: ruleRepo },
        {
          provide: getRepositoryToken(SalaryRecordEntity),
          useValue: {
            createQueryBuilder: jest.fn().mockImplementation(() => qb),
          },
        },
        {
          provide: getRepositoryToken(TeacherSalaryProfileEntity),
          useValue: {},
        },
        { provide: getRepositoryToken(OutingRecordEntity), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
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

  it('未传月份时不做月份过滤（统计全量，与记录列表默认视图一致）', async () => {
    qb.where.mockClear();
    await service.getStatistics({});
    expect(qb.where).not.toHaveBeenCalled();
  });

  it('传月份时按月份过滤', async () => {
    qb.where.mockClear();
    await service.getStatistics({ year: 2026, month: 7 });
    expect(qb.where).toHaveBeenCalledWith('record.month = :month', {
      month: '2026-07',
    });
  });

  it('返回按来源聚合的 breakdown（数值化、金额降序、扣款保留负号）', async () => {
    const res = await service.getStatistics({ year: 2026, month: 7 });
    expect(res.breakdown).toEqual([
      { source: 'BASE', count: 1, amount: 8000 },
      { source: 'DAY', count: 6, amount: 1800 },
      { source: 'ALLOWANCE', count: 1, amount: 1000 },
      { source: 'BONUS', count: 1, amount: 500 },
      { source: 'DEDUCTION', count: 1, amount: -200 },
    ]);
  });
});

describe('SalaryService.getRecords', () => {
  let service: SalaryService;
  const recordRepo = { createQueryBuilder: jest.fn() };
  const userRepo = { find: jest.fn() };

  const makeQb = (records: unknown[], total: number) => ({
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([records, total]),
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryService,
        { provide: getRepositoryToken(SalaryRuleEntity), useValue: {} },
        {
          provide: getRepositoryToken(SalaryRecordEntity),
          useValue: recordRepo,
        },
        {
          provide: getRepositoryToken(TeacherSalaryProfileEntity),
          useValue: {},
        },
        { provide: getRepositoryToken(OutingRecordEntity), useValue: {} },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    service = module.get(SalaryService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('附加教师姓名 teacherName（批量取 User.name）', async () => {
    const qb = makeQb([{ id: 1, teacherId: 2, source: 'LESSON_FEE' }], 1);
    recordRepo.createQueryBuilder.mockReturnValue(qb);
    userRepo.find.mockResolvedValue([{ id: 2, name: '张老师' }]);

    const res = await service.getRecords({ page: 1, pageSize: 10 });

    expect(res.records[0]).toMatchObject({ teacherId: 2, teacherName: '张老师' });
    expect(userRepo.find).toHaveBeenCalledTimes(1);
  });

  it('教师不存在时 teacherName 为 null（不丢 teacherId）', async () => {
    const qb = makeQb([{ id: 3, teacherId: 99, source: 'BASE' }], 1);
    recordRepo.createQueryBuilder.mockReturnValue(qb);
    userRepo.find.mockResolvedValue([]);

    const res = await service.getRecords({ page: 1, pageSize: 10 });

    expect(res.records[0]).toMatchObject({ teacherId: 99, teacherName: null });
  });

  it('教师姓名模糊筛选：innerJoin User + name LIKE', async () => {
    const qb = makeQb([], 0);
    recordRepo.createQueryBuilder.mockReturnValue(qb);
    userRepo.find.mockResolvedValue([]);

    await service.getRecords({ teacherName: '张' });

    expect(qb.innerJoin).toHaveBeenCalledWith(
      User,
      'u',
      'u.id = record.teacherId',
    );
    expect(qb.andWhere).toHaveBeenCalledWith('u.name LIKE :teacherName', {
      teacherName: '%张%',
    });
  });

  it('teacherId 数字筛选仍生效（双兼容）', async () => {
    const qb = makeQb([], 0);
    recordRepo.createQueryBuilder.mockReturnValue(qb);
    userRepo.find.mockResolvedValue([]);

    await service.getRecords({ teacherId: 2 });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'record.teacherId = :teacherId',
      { teacherId: 2 },
    );
  });
});
