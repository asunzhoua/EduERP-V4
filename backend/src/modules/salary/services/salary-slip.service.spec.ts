import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  SalarySlipService,
  calcTax,
  calcSocial,
  mergeItems,
  type SlipPreview,
} from './salary-slip.service';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { SalaryRecordEntity } from '../entities/salary-record.entity';
import { TeacherSalaryProfileEntity } from '../entities/teacher-salary-profile.entity';
import { User } from '@modules/identity/entities/user.entity';
import { TaxPolicyService } from './tax-policy.service';
import { InsurancePolicyService } from './insurance-policy.service';
import { SalaryConfigService } from './salary-config.service';
import { SalaryRecordSource, SalaryRecordStatus } from '../enums/salary.enums';
import { DEFAULT_TAX_BRACKETS } from './tax-policy.service';
import { ExcelWriter } from '@modules/export/utils/excel-writer.util';

/** 工资条 detail 结构（测试断言用，与真实 detail 字段对应） */
interface SlipDetail {
  breakdown: { source: string; count: number; amount: number }[];
  social: {
    base: number;
    amount: number;
    source: string;
    ratios: Record<string, number> | null;
  };
  tax: {
    method: string;
    threshold: number;
    taxable: number;
    specialDeductions: unknown[];
    brackets: unknown[] | null;
  };
  policies: {
    taxPolicy: {
      id: number;
      name: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    } | null;
    insurancePolicy: {
      id: number;
      city: string;
      name: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    } | null;
  };
}

type EmMock = { save: jest.Mock; update: jest.Mock };
type SlipWithDetail = SlipPreview & { detail: SlipDetail };

const firstSlip = (res: { slips: SlipPreview[] }): SlipWithDetail =>
  res.slips[0] as SlipWithDetail;

describe('工资条纯函数', () => {
  describe('calcTax（月度超额累进，速算扣除数）', () => {
    it('taxable <= 0 → 0', () => {
      expect(calcTax(0, DEFAULT_TAX_BRACKETS)).toBe(0);
      expect(calcTax(-100, DEFAULT_TAX_BRACKETS)).toBe(0);
    });

    it('空 brackets → 0', () => {
      expect(calcTax(5000, null)).toBe(0);
      expect(calcTax(5000, [])).toBe(0);
    });

    it('第一档 3%：1900 → 57', () => {
      expect(calcTax(1900, DEFAULT_TAX_BRACKETS)).toBe(57);
    });

    it('第二档 10%：10000 → 790（速算扣除 210）', () => {
      expect(calcTax(10000, DEFAULT_TAX_BRACKETS)).toBe(790);
    });

    it('最后一档（max=null）45%：100000 → 29840', () => {
      // 100000 * 0.45 - 15160 = 29840
      expect(calcTax(100000, DEFAULT_TAX_BRACKETS)).toBe(29840);
    });

    it('自定义 brackets 生效', () => {
      const custom = [
        { min: 0, max: 1000, rate: 0.05, quickDeduction: 0 },
        { min: 1000, max: null, rate: 0.1, quickDeduction: 50 },
      ];
      expect(calcTax(500, custom)).toBe(25);
      expect(calcTax(2000, custom)).toBe(150); // 2000*0.1-50
    });
  });

  describe('calcSocial（个人五险一金合计）', () => {
    const ratios = {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.005,
      housingFund: 0.07,
    };

    it('base 8000 → 1400', () => {
      expect(calcSocial(8000, ratios)).toBe(1400);
    });

    it('base 缺失或 0 → 0', () => {
      expect(calcSocial(0, ratios)).toBe(0);
      expect(calcSocial(8000, null)).toBe(0);
    });

    it('部分比例缺省按 0 处理', () => {
      expect(calcSocial(8000, { pension: 0.08 })).toBe(640);
    });
  });

  describe('mergeItems（津贴/扣款构成子项）', () => {
    it('空或缺失 items → []', () => {
      expect(mergeItems(undefined)).toEqual([]);
      expect(mergeItems([])).toEqual([]);
    });

    it('按 name 合并求和，amount 保留原值', () => {
      expect(
        mergeItems([
          { type: 'COMMUTING', name: '交通补贴', amount: 300 },
          { type: 'HOUSING', name: '住房补贴', amount: 700 },
        ]),
      ).toEqual([
        { name: '交通补贴', amount: 300 },
        { name: '住房补贴', amount: 700 },
      ]);
    });

    it('同名子项合并为一个，金额相加（四舍五入两位）', () => {
      expect(
        mergeItems([
          { type: 'OTHER', name: '请假扣款', amount: 100 },
          { type: 'OTHER', name: '请假扣款', amount: 50.005 },
        ]),
      ).toEqual([{ name: '请假扣款', amount: 150.01 }]);
    });

    it('无 name 时回退用 type，再回退「其他」', () => {
      expect(mergeItems([{ type: 'HOUSING', amount: 500 }])).toEqual([
        { name: 'HOUSING', amount: 500 },
      ]);
    });
  });
});

describe('SalarySlipService', () => {
  let service: SalarySlipService;

  const recordRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
  const profileRepo = { find: jest.fn() };
  const userRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const slipRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const taxPolicyService = { findActiveForMonth: jest.fn() };
  const insurancePolicyService = { findActiveForCity: jest.fn() };
  const salaryConfigService = {
    get: jest.fn().mockResolvedValue({ enabled: true }),
  };
  const excelWriter = {
    generate: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
  };

  const defaultTransaction = (em: EmMock) =>
    slipRepo.manager.transaction.mockImplementation(
      (cb: (e: EmMock) => Promise<unknown>) => cb(em),
    );

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalarySlipService,
        { provide: getRepositoryToken(SalarySlipEntity), useValue: slipRepo },
        {
          provide: getRepositoryToken(SalaryRecordEntity),
          useValue: recordRepo,
        },
        {
          provide: getRepositoryToken(TeacherSalaryProfileEntity),
          useValue: profileRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: TaxPolicyService, useValue: taxPolicyService },
        { provide: InsurancePolicyService, useValue: insurancePolicyService },
        { provide: SalaryConfigService, useValue: salaryConfigService },
        { provide: ExcelWriter, useValue: excelWriter },
      ],
    }).compile();
    service = module.get(SalarySlipService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    defaultTransaction({
      save: jest.fn().mockResolvedValue([{ id: 1 }]),
      update: jest.fn().mockResolvedValue({}),
    });
  });

  const teacherRecords = (): SalaryRecordEntity[] =>
    [
      {
        teacherId: 1,
        source: SalaryRecordSource.LESSON_FEE,
        amount: 5000,
        month: '2026-08',
      },
      {
        teacherId: 1,
        source: SalaryRecordSource.BASE,
        amount: 3000,
        month: '2026-08',
      },
      {
        teacherId: 1,
        source: SalaryRecordSource.ALLOWANCE,
        amount: 500,
        month: '2026-08',
        detail: {
          items: [
            { type: 'COMMUTING', name: '交通补贴', amount: 300 },
            { type: 'HOUSING', name: '住房补贴', amount: 200 },
          ],
        },
      },
      {
        teacherId: 1,
        source: SalaryRecordSource.DEDUCTION,
        amount: -200,
        month: '2026-08',
        detail: {
          items: [{ type: 'OTHER', name: '请假扣款', amount: 200 }],
        },
      },
    ] as SalaryRecordEntity[];

  const nbePolicy = () => ({
    id: 10,
    city: '宁波',
    name: '宁波 2026',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    socialBase: 8000,
    socialBaseMin: 4500,
    socialBaseMax: 22500,
    ratios: {
      pension: 0.08,
      medical: 0.02,
      unemployment: 0.005,
      housingFund: 0.07,
    },
  });

  const taxPolicy = () => ({
    id: 1,
    name: '2026 个税',
    taxThreshold: 5000,
    brackets: DEFAULT_TAX_BRACKETS,
  });

  it('generateSlips：聚合 gross + 政策基数算社保 + 月度估算个税', async () => {
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);
    taxPolicyService.findActiveForMonth.mockResolvedValue(taxPolicy());
    insurancePolicyService.findActiveForCity.mockResolvedValue(nbePolicy());
    slipRepo.find.mockResolvedValue([]);

    const res = await service.generateSlips('2026-08', undefined, 9);

    expect(res.teachers).toBe(1);
    expect(res.generated).toBe(1);
    expect(res.skipped).toBe(0);

    const slip = firstSlip(res);
    expect(slip.grossAmount).toBe(8300); // 5000+3000+500-200
    expect(slip.socialAmount).toBe(1400); // 8000*0.175
    expect(slip.taxAmount).toBe(57); // (8300-1400-5000)*0.03
    expect(slip.netAmount).toBe(6843);
    expect(slip.needsReview).toBe(false);

    // detail 快照留痕
    expect(slip.detail.breakdown).toEqual([
      { source: 'LESSON_FEE', count: 1, amount: 5000, items: [] },
      { source: 'BASE', count: 1, amount: 3000, items: [] },
      {
        source: 'ALLOWANCE',
        count: 1,
        amount: 500,
        items: [
          { name: '交通补贴', amount: 300 },
          { name: '住房补贴', amount: 200 },
        ],
      },
      {
        source: 'DEDUCTION',
        count: 1,
        amount: -200,
        items: [{ name: '请假扣款', amount: 200 }],
      },
    ]);
    expect(slip.detail.social.base).toBe(8000);
    expect(slip.detail.tax.method).toContain('月度估算');
    expect(slip.detail.policies.taxPolicy!.name).toBe('2026 个税');
    expect(slip.detail.policies.insurancePolicy!.city).toBe('宁波');
  });

  it('总开关关闭：不计算社保/个税，实发=应发，不提示缺政策', async () => {
    salaryConfigService.get.mockResolvedValue({ enabled: false });
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);

    const res = await service.generateSlips('2026-08', undefined, 9);
    const slip = firstSlip(res);

    expect(slip.grossAmount).toBe(8300);
    expect(slip.socialAmount).toBe(0);
    expect(slip.taxAmount).toBe(0);
    expect(slip.netAmount).toBe(8300);
    expect(slip.needsReview).toBe(false);
    expect(slip.notes).toContain('社保个税功能未开启');
    expect(slip.detail.deductEnabled).toBe(false);
    expect(slip.detail.social).toBeNull();
    expect(slip.detail.tax).toBeNull();
    // 关闭时不取政策
    expect(taxPolicyService.findActiveForMonth).not.toHaveBeenCalled();
    expect(insurancePolicyService.findActiveForCity).not.toHaveBeenCalled();

    salaryConfigService.get.mockResolvedValue({ enabled: true });
  });

  it('档案覆盖：档案 socialBase/ratios 优先于城市政策', async () => {
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([
      {
        teacherId: 1,
        city: '宁波',
        socialBase: 10000,
        socialRatios: {
          pension: 0.08,
          medical: 0.02,
          unemployment: 0.005,
          housingFund: 0.12,
        },
        taxSpecialDeductions: null,
      },
    ]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);
    taxPolicyService.findActiveForMonth.mockResolvedValue(taxPolicy());
    insurancePolicyService.findActiveForCity.mockResolvedValue(nbePolicy());
    slipRepo.find.mockResolvedValue([]);

    const res = await service.generateSlips('2026-08');
    const slip = firstSlip(res);

    // 档案 base=10000, housingFund=0.12 → social = 10000*(0.08+0.02+0.005+0.12)=2250
    expect(slip.socialAmount).toBe(2250);
    expect(slip.detail.social.source).toBe('profile');
    expect(slip.detail.social.base).toBe(10000);
    // taxable = 8300-2250-5000 = 1050 → 3% → 31.5
    expect(slip.taxAmount).toBe(31.5);
  });

  it('基数 clamp：城市政策 base 低于下限 → 取下限', async () => {
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);
    taxPolicyService.findActiveForMonth.mockResolvedValue(taxPolicy());
    insurancePolicyService.findActiveForCity.mockResolvedValue({
      ...nbePolicy(),
      socialBase: 3000, // 低于 4500 下限
    });
    slipRepo.find.mockResolvedValue([]);

    const res = await service.generateSlips('2026-08');
    const slip = firstSlip(res);
    expect(slip.detail.social.base).toBe(4500);
    expect(slip.socialAmount).toBe(787.5); // 4500*0.175
  });

  it('缺政策/基数 → needsReview=true 且备注', async () => {
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);
    taxPolicyService.findActiveForMonth.mockResolvedValue(null);
    insurancePolicyService.findActiveForCity.mockResolvedValue(null);
    slipRepo.find.mockResolvedValue([]);

    const res = await service.generateSlips('2026-08');
    const slip = firstSlip(res);
    expect(slip.needsReview).toBe(true);
    expect(slip.notes).toEqual(
      expect.arrayContaining([
        '无五险一金基数（档案与城市政策均未配置）',
        '无当月个税政策，按默认起征点估算',
      ]),
    );
  });

  it('幂等：teacherId+month 已存在则跳过', async () => {
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);
    taxPolicyService.findActiveForMonth.mockResolvedValue(taxPolicy());
    insurancePolicyService.findActiveForCity.mockResolvedValue(nbePolicy());
    slipRepo.find.mockResolvedValue([
      { id: 99, teacherId: 1, month: '2026-08' },
    ]);

    const res = await service.generateSlips('2026-08');
    expect(res.generated).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it('preview：dry-run 不落库（返回试算结果）', async () => {
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);
    taxPolicyService.findActiveForMonth.mockResolvedValue(taxPolicy());
    insurancePolicyService.findActiveForCity.mockResolvedValue(nbePolicy());

    const res = await service.preview('2026-08');
    expect(res.slips).toHaveLength(1);
    expect(res.slips[0].netAmount).toBe(6843);
    // dry-run 不应查询 persisted
    expect(slipRepo.find).not.toHaveBeenCalled();
  });

  it('recomputeByConfig：开关切换重算非 PAID，PAID 锁定不动', async () => {
    recordRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ month: '2026-08' }]),
    });
    recordRepo.find.mockResolvedValue(teacherRecords());
    profileRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);
    taxPolicyService.findActiveForMonth.mockResolvedValue(taxPolicy());
    insurancePolicyService.findActiveForCity.mockResolvedValue(nbePolicy());

    const pendingSlip = {
      id: 1,
      teacherId: 1,
      month: '2026-08',
      status: SalaryRecordStatus.PENDING,
      grossAmount: 0,
      socialAmount: 0,
      taxAmount: 0,
      netAmount: 0,
      detail: null,
      needsReview: false,
      notes: null,
      updatedBy: null,
    };
    const paidSlip = {
      id: 2,
      teacherId: 1,
      month: '2026-08',
      status: SalaryRecordStatus.PAID,
      grossAmount: 9999,
      socialAmount: 9999,
      taxAmount: 9999,
      netAmount: 9999,
      detail: null,
      needsReview: false,
      notes: '历史',
      updatedBy: null,
    };
    // build() 内部查一次 persisted，recompute 再查一次 → 均返回同一列表
    slipRepo.find.mockResolvedValue([pendingSlip, paidSlip]);
    const saveMock = jest
      .fn()
      .mockImplementation((s: unknown) => Promise.resolve(s));
    slipRepo.save.mockImplementation(saveMock);

    const res = await service.recomputeByConfig(9);

    expect(res.recomputed).toBe(1);
    expect(res.skippedPaid).toBe(1);
    expect(res.months).toEqual(['2026-08']);
    // PAID 锁定不动
    expect(paidSlip.grossAmount).toBe(9999);
    expect(paidSlip.status).toBe(SalaryRecordStatus.PAID);
    expect(saveMock).toHaveBeenCalledTimes(1);
    // PENDING 按最新配置重建（保留 status 与 id）
    expect(pendingSlip.grossAmount).toBe(8300);
    expect(pendingSlip.socialAmount).toBe(1400);
    expect(pendingSlip.taxAmount).toBe(57);
    expect(pendingSlip.netAmount).toBe(6843);
    expect(pendingSlip.status).toBe(SalaryRecordStatus.PENDING);
    expect(pendingSlip.updatedBy).toBe(9);
  });

  it('exportExcel：按筛选导出全部并生成 xlsx', async () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          teacherId: 1,
          month: '2026-08',
          grossAmount: 8300,
          socialAmount: 1400,
          taxAmount: 57,
          netAmount: 6843,
          status: SalaryRecordStatus.PENDING,
          needsReview: false,
          notes: null,
        },
      ]),
    };
    slipRepo.createQueryBuilder.mockReturnValue(qb);
    userRepo.find.mockResolvedValue([{ id: 1, name: '张老师' }]);

    const buf = await service.exportExcel({ month: '2026-08' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(slipRepo.createQueryBuilder).toHaveBeenCalledWith('s');

    const [, sheetName, , headers] = excelWriter.generate.mock.calls[0] as [
      unknown,
      string,
      unknown,
      string[],
    ];
    expect(sheetName).toBe('工资条');
    expect(headers).toContain('实发');
  });

  it('updateSlipStatus：PENDING→APPROVED 合法', async () => {
    const slip = {
      id: 1,
      teacherId: 1,
      month: '2026-08',
      status: SalaryRecordStatus.PENDING,
    };
    slipRepo.findOne.mockResolvedValue(slip);

    const res = await service.updateSlipStatus(1, 'APPROVED', undefined, 9);
    expect(res.status).toBe('APPROVED');
    expect(slipRepo.manager.transaction).toHaveBeenCalledTimes(1);
  });

  it('updateSlipStatus：非法流转抛错', async () => {
    slipRepo.findOne.mockResolvedValue({
      id: 1,
      status: SalaryRecordStatus.PENDING,
    });
    await expect(service.updateSlipStatus(1, 'PAID')).rejects.toThrow(
      'Invalid slip status transition',
    );
  });

  it('发放联动：slip 置 PAID → 当月该教师 salary_record 同步 PAID', async () => {
    const slip = {
      id: 1,
      teacherId: 1,
      month: '2026-08',
      status: SalaryRecordStatus.APPROVED,
    };
    slipRepo.findOne.mockResolvedValue(slip);
    const em = {
      save: jest.fn().mockResolvedValue(slip),
      update: jest.fn().mockResolvedValue({}),
    };
    defaultTransaction(em);

    const res = await service.updateSlipStatus(1, 'PAID', undefined, 9);
    expect(res.status).toBe('PAID');
    const [, where, set] = em.update.mock.calls[0] as [
      unknown,
      { teacherId: number; month: string; status: { value: string[] } },
      { status: string; updatedBy: number | null },
    ];
    expect(where.teacherId).toBe(1);
    expect(where.month).toBe('2026-08');
    expect(where.status.value).toEqual([
      SalaryRecordStatus.PENDING,
      SalaryRecordStatus.APPROVED,
    ]);
    expect(set.status).toBe(SalaryRecordStatus.PAID);
  });
});
