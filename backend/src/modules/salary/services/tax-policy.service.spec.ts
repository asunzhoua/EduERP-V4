import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaxPolicyService, DEFAULT_TAX_BRACKETS } from './tax-policy.service';
import {
  InsurancePolicyService,
  nextMonthFirstDay,
} from './insurance-policy.service';
import { SalaryPayrollService } from './salary-payroll.service';
import { SalaryTaxPolicyEntity } from '../entities/salary-tax-policy.entity';
import { SalaryInsurancePolicyEntity } from '../entities/salary-insurance-policy.entity';
import {
  SalaryPayrollEntity,
  PayrollStatus,
} from '../entities/salary-payroll.entity';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { User } from '@modules/identity/entities/user.entity';
import { ExcelWriter } from '@modules/export/utils/excel-writer.util';

describe('TaxPolicyService', () => {
  let service: TaxPolicyService;
  let qb: Record<string, jest.Mock>;

  const taxRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxPolicyService,
        {
          provide: getRepositoryToken(SalaryTaxPolicyEntity),
          useValue: taxRepo,
        },
      ],
    }).compile();
    service = module.get(TaxPolicyService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    taxRepo.createQueryBuilder.mockReturnValue(qb);
  });

  it('create：未传 brackets 时落默认 7 档税率表', async () => {
    const entity = { name: '2026 个税', effectiveFrom: '2026-01-01' };
    taxRepo.create.mockReturnValue(entity);
    taxRepo.save.mockResolvedValue(entity);

    await service.create({ name: '2026 个税', effectiveFrom: '2026-01-01' }, 1);
    expect(taxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ brackets: DEFAULT_TAX_BRACKETS }),
    );
  });

  it('findActiveForMonth：按 effectiveFrom 倒序取当月生效一条', async () => {
    qb.getMany.mockResolvedValue([{ id: 2 }, { id: 1 }]);
    const res = await service.findActiveForMonth('2026-08');
    expect(res?.id).toBe(2);
    // monthStart 条件
    const whereCall = qb.where.mock.calls[0] as [
      string,
      { monthStart: string },
    ];
    expect(whereCall[1]).toEqual({ monthStart: '2026-08-01' });
  });

  it('findActiveForMonth：无生效版本返回 null', async () => {
    qb.getMany.mockResolvedValue([]);
    expect(await service.findActiveForMonth('2026-08')).toBeNull();
  });
});

describe('InsurancePolicyService', () => {
  let service: InsurancePolicyService;
  let qb: Record<string, jest.Mock>;

  const insRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsurancePolicyService,
        {
          provide: getRepositoryToken(SalaryInsurancePolicyEntity),
          useValue: insRepo,
        },
      ],
    }).compile();
    service = module.get(InsurancePolicyService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getManyAndCount: jest.fn(),
    };
    insRepo.createQueryBuilder.mockReturnValue(qb);
  });

  it('importFromSeed：宁波 有内置数据', async () => {
    const entity = { id: 1 };
    insRepo.create.mockReturnValue(entity);
    insRepo.save.mockResolvedValue(entity);

    const res = await service.importFromSeed(
      { city: '宁波', effectiveFrom: '2026-09-01' },
      1,
    );
    expect(insRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        city: '宁波',
        effectiveFrom: '2026-09-01',
        socialBase: 8000,
      }),
    );
    expect(res.id).toBe(1);
  });

  it('importFromSeed：未识别的城市抛错', async () => {
    await expect(service.importFromSeed({ city: '拉萨' }, 1)).rejects.toThrow(
      '内置种子库无「拉萨」数据',
    );
  });

  it('importFromSeed：缺省生效日为次月 1 日', async () => {
    insRepo.create.mockReturnValue({});
    insRepo.save.mockResolvedValue({});
    await service.importFromSeed({ city: '北京' }, 1);
    expect(insRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveFrom: nextMonthFirstDay(),
      }),
    );
  });

  it('findActiveForCity：城市命中当期政策', async () => {
    qb.getMany.mockResolvedValueOnce([{ id: 5, city: '宁波' }]);
    const res = await service.findActiveForCity('宁波', '2026-08');
    expect(res?.id).toBe(5);
    expect(qb.andWhere).toHaveBeenCalledWith('p.city = :city', {
      city: '宁波',
    });
  });

  it('findActiveForCity：城市无当期 → 兜底全库当期首条', async () => {
    qb.getMany.mockResolvedValueOnce([]);
    qb.getMany.mockResolvedValueOnce([{ id: 9, city: '北京' }]);
    const res = await service.findActiveForCity('拉萨', '2026-08');
    expect(res?.id).toBe(9);
  });
});

describe('SalaryPayrollService', () => {
  let service: SalaryPayrollService;

  const payrollRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const slipRepo = { find: jest.fn() };
  const userRepo = { find: jest.fn() };
  const excelWriter = {
    generate: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryPayrollService,
        {
          provide: getRepositoryToken(SalaryPayrollEntity),
          useValue: payrollRepo,
        },
        { provide: getRepositoryToken(SalarySlipEntity), useValue: slipRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ExcelWriter, useValue: excelWriter },
      ],
    }).compile();
    service = module.get(SalaryPayrollService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create：缺省收该月待发放工资条并汇总总额', async () => {
    slipRepo.find.mockResolvedValue([
      { id: 1, teacherId: 1, netAmount: 5000 },
      { id: 2, teacherId: 1, netAmount: 6000 },
      { id: 3, teacherId: 2, netAmount: 7000 },
    ]);
    const entity = {};
    payrollRepo.create.mockReturnValue(entity);
    payrollRepo.save.mockResolvedValue(entity);

    await service.create({ month: '2026-08' }, 1);
    const createdArg = payrollRepo.create.mock.calls[0] as [
      {
        month: string;
        totalAmount: number;
        detail: { slipIds: number[]; slipCount: number; teacherCount: number };
        batchNo: string;
        status: PayrollStatus;
      },
    ];
    const dto = createdArg[0];
    expect(dto.totalAmount).toBe(18000);
    expect(dto.detail).toEqual({
      slipIds: [1, 2, 3],
      slipCount: 3,
      teacherCount: 2,
    });
    expect(dto.batchNo).toMatch(/^PA202608-/);
    expect(dto.status).toBe(PayrollStatus.DRAFT);
  });

  it('exportExcel：批次导出生成 xlsx', async () => {
    payrollRepo.findOne.mockResolvedValue({
      id: 1,
      month: '2026-08',
      batchNo: 'PA202608-ABCD',
      detail: { slipIds: [1] },
    });
    slipRepo.find.mockResolvedValue([
      {
        id: 1,
        teacherId: 1,
        netAmount: 5000,
        grossAmount: 8300,
        socialAmount: 1400,
        taxAmount: 57,
        status: 'PENDING',
        notes: null,
      },
    ]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);

    const buf = await service.exportExcel(1);
    expect(Buffer.isBuffer(buf)).toBe(true);
    const [, sheetName, , headers] = excelWriter.generate.mock.calls[0] as [
      unknown,
      string,
      unknown,
      string[],
    ];
    expect(sheetName).toBe('发放批次');
    expect(headers).toContain('实发');
  });

  it('create：指定 slipIds 不全或跨月 → 抛错', async () => {
    slipRepo.find.mockResolvedValue([{ id: 1 }]);
    await expect(
      service.create({ month: '2026-08', slipIds: [1, 2] }, 1),
    ).rejects.toThrow('存在无效的工资条 ID 或不属于该月');
  });

  it('create：该月无待发放工资条 → 抛错', async () => {
    slipRepo.find.mockResolvedValue([]);
    await expect(service.create({ month: '2026-08' }, 1)).rejects.toThrow(
      '无待发放工资条',
    );
  });

  it('updateStatus：状态机 DRAFT→CONFIRMED→PAID→CLOSED', async () => {
    payrollRepo.findOne.mockResolvedValue({
      id: 1,
      status: PayrollStatus.DRAFT,
    });
    payrollRepo.save.mockResolvedValue({
      id: 1,
      status: PayrollStatus.CONFIRMED,
    });
    const res = await service.updateStatus(1, 'CONFIRMED', 9);
    expect(res.status).toBe('CONFIRMED');
  });

  it('updateStatus：非法流转抛错', async () => {
    payrollRepo.findOne.mockResolvedValue({
      id: 1,
      status: PayrollStatus.DRAFT,
    });
    await expect(service.updateStatus(1, 'CLOSED', 9)).rejects.toThrow(
      'Invalid payroll status transition',
    );
  });
});
