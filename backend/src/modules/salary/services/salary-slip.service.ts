import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { SalaryRecordEntity } from '../entities/salary-record.entity';
import { TeacherSalaryProfileEntity } from '../entities/teacher-salary-profile.entity';
import { User } from '@modules/identity/entities/user.entity';
import { SalaryRecordStatus } from '../enums/salary.enums';
import { TaxPolicyService } from './tax-policy.service';
import { InsurancePolicyService } from './insurance-policy.service';
import { QuerySalarySlipDto } from '../dto/salary-slip.dto';
import { ExcelWriter } from '@modules/export/utils/excel-writer.util';

/** 金额保留两位小数 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 个人五险一金合计 = Σ ratio × base（pension/medical/unemployment/housingFund）
 * 基数或比例缺失 → 0（由调用方用 needsReview 标记复核）
 */
export function calcSocial(
  base: number,
  ratios?: Record<string, any> | null,
): number {
  if (!base || !ratios) return 0;
  const keys = ['pension', 'medical', 'unemployment', 'housingFund'];
  let total = 0;
  for (const k of keys) {
    const r = Number(ratios[k]) || 0;
    total += base * r;
  }
  return round2(total);
}

/**
 * 月度估算个税（超额累进，用速算扣除数）：
 * taxable 落在某档 [min, max] → tax = taxable × rate − quickDeduction
 */
export function calcTax(
  taxable: number,
  brackets?: Record<string, any>[] | null,
): number {
  if (taxable <= 0 || !brackets?.length) return 0;
  for (const b of brackets) {
    const min = Number(b.min) || 0;
    const max =
      b.max === null || b.max === undefined ? Infinity : Number(b.max);
    if (taxable >= min && taxable <= max) {
      const rate = Number(b.rate) || 0;
      const qd = Number(b.quickDeduction) || 0;
      return round2(Math.max(0, taxable * rate - qd));
    }
  }
  return 0;
}

export interface SlipPreview {
  teacherId: number;
  teacherName?: string;
  grossAmount: number;
  socialAmount: number;
  taxAmount: number;
  netAmount: number;
  needsReview: boolean;
  notes: string[];
  detail: Record<string, any>;
}

@Injectable()
export class SalarySlipService {
  constructor(
    @InjectRepository(SalarySlipEntity)
    private readonly slipRepo: Repository<SalarySlipEntity>,
    @InjectRepository(SalaryRecordEntity)
    private readonly recordRepo: Repository<SalaryRecordEntity>,
    @InjectRepository(TeacherSalaryProfileEntity)
    private readonly profileRepo: Repository<TeacherSalaryProfileEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly taxPolicyService: TaxPolicyService,
    private readonly insurancePolicyService: InsurancePolicyService,
    private readonly excelWriter: ExcelWriter,
  ) {}

  /** 幂等生成：teacherId + month 已存在则跳过 */
  async generateSlips(month: string, teacherId?: number, operatedBy = 0) {
    const result = await this.build(month, teacherId, false);
    let generated = 0;
    let skipped = 0;
    if (result.persisted) {
      const existing = new Set(
        result.persisted.map((s) => `${s.teacherId}:${s.month}`),
      );
      const toCreate = result.preview
        .filter((p) => !existing.has(`${p.teacherId}:${month}`))
        .map((p) => this.toEntity(p, month, operatedBy));
      if (toCreate.length > 0) {
        generated = await this.slipRepo.manager.transaction(async (em) => {
          const saved = await em.save(
            SalarySlipEntity,
            toCreate as SalarySlipEntity[],
          );
          return saved.length;
        });
      }
      skipped = result.persisted.length;
    }
    return {
      month,
      teacherId,
      teachers: result.preview.length,
      generated,
      skipped,
      slips: result.preview,
    };
  }

  /** 试算（dry-run，不落库） */
  async preview(month: string, teacherId?: number) {
    const result = await this.build(month, teacherId, true);
    return {
      month,
      teacherId,
      teachers: result.preview.length,
      slips: result.preview,
    };
  }

  async getSlips(query: QuerySalarySlipDto) {
    const { month, teacherId, status, page = 1, pageSize = 20 } = query;
    const qb = this.slipRepo.createQueryBuilder('s');
    if (month) qb.andWhere('s.month = :month', { month });
    if (teacherId) qb.andWhere('s.teacherId = :teacherId', { teacherId });
    if (status) qb.andWhere('s.status = :status', { status });
    qb.orderBy('s.month', 'DESC').addOrderBy('s.id', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();

    const teacherIds = [...new Set(items.map((s) => Number(s.teacherId)))];
    const teachers = teacherIds.length
      ? await this.userRepo.find({
          where: { id: In(teacherIds) },
          select: { id: true, name: true, mobile: true },
        })
      : [];
    const nameByTeacher = new Map(teachers.map((u) => [Number(u.id), u.name]));
    const slips = items.map((s) => ({
      ...s,
      teacherName: nameByTeacher.get(Number(s.teacherId)) ?? null,
    }));
    return { slips, total, page, pageSize };
  }

  async getSlip(id: number) {
    const slip = await this.slipRepo.findOne({ where: { id } });
    if (!slip) throw new NotFoundException(`Salary slip ${id} not found`);
    const teacher = await this.userRepo.findOne({
      where: { id: Number(slip.teacherId) },
      select: { id: true, name: true, mobile: true },
    });
    return { ...slip, teacherName: teacher?.name ?? null };
  }

  /** 工资条 Excel 导出（按筛选条件导出全部，不分页） */
  async exportExcel(query: QuerySalarySlipDto): Promise<Buffer> {
    const { month, teacherId, status } = query;
    const qb = this.slipRepo.createQueryBuilder('s');
    if (month) qb.andWhere('s.month = :month', { month });
    if (teacherId) qb.andWhere('s.teacherId = :teacherId', { teacherId });
    if (status) qb.andWhere('s.status = :status', { status });
    qb.orderBy('s.month', 'DESC').addOrderBy('s.id', 'DESC');
    const items = await qb.getMany();

    const teacherIds = [...new Set(items.map((s) => Number(s.teacherId)))];
    const teachers = teacherIds.length
      ? await this.userRepo.find({
          where: { id: In(teacherIds) },
          select: { id: true, name: true },
        })
      : [];
    const nameByTeacher = new Map(teachers.map((u) => [Number(u.id), u.name]));

    const rows = items.map((s) => ({
      month: s.month,
      teacherName: nameByTeacher.get(Number(s.teacherId)) ?? '',
      grossAmount: Number(s.grossAmount) || 0,
      socialAmount: Number(s.socialAmount) || 0,
      taxAmount: Number(s.taxAmount) || 0,
      netAmount: Number(s.netAmount) || 0,
      status: s.status,
      needsReview: s.needsReview ? '是' : '',
      notes: s.notes ?? '',
    }));

    return this.excelWriter.generate(
      rows,
      '工资条',
      [
        'month',
        'teacherName',
        'grossAmount',
        'socialAmount',
        'taxAmount',
        'netAmount',
        'status',
        'needsReview',
        'notes',
      ],
      [
        '月份',
        '教师',
        '应发',
        '五险一金',
        '个税',
        '实发',
        '状态',
        '需复核',
        '备注',
      ],
    );
  }

  /**
   * 状态流转：PENDING→APPROVED→PAID（APPROVED→PENDING 允许重算；PAID 锁定）。
   * 置 PAID 时，事务内当月该教师所有 salary_record 同步置 PAID（发放联动）。
   */
  async updateSlipStatus(
    id: number,
    status: string,
    notes?: string,
    updatedBy?: number,
  ) {
    const slip = await this.slipRepo.findOne({ where: { id } });
    if (!slip) throw new NotFoundException(`Salary slip ${id} not found`);

    const validTransitions: Record<string, string[]> = {
      [SalaryRecordStatus.PENDING]: [SalaryRecordStatus.APPROVED],
      [SalaryRecordStatus.APPROVED]: [
        SalaryRecordStatus.PAID,
        SalaryRecordStatus.PENDING,
      ],
      [SalaryRecordStatus.PAID]: [],
    };
    if (!validTransitions[slip.status]?.includes(status)) {
      throw new BadRequestException(
        `Invalid slip status transition from ${slip.status} to ${status}`,
      );
    }

    const next = status as SalaryRecordStatus;
    return this.slipRepo.manager.transaction(async (em) => {
      slip.status = next;
      if (notes) slip.notes = notes;
      if (updatedBy) slip.updatedBy = updatedBy;
      await em.save(slip);

      // 发放联动：slip PAID → 当月该教师所有 salary_record 同步 PAID
      if (next === SalaryRecordStatus.PAID) {
        await em.update(
          SalaryRecordEntity,
          {
            teacherId: Number(slip.teacherId),
            month: slip.month,
            status: In([
              SalaryRecordStatus.PENDING,
              SalaryRecordStatus.APPROVED,
            ]),
          },
          { status: SalaryRecordStatus.PAID, updatedBy: updatedBy ?? null },
        );
      }
      return slip;
    });
  }

  // ─── 内部：聚合 + 计算 ───

  private async build(month: string, teacherId?: number, dryRun = false) {
    const recordWhere: Record<string, any> = { month };
    if (teacherId) recordWhere.teacherId = teacherId;
    const records = await this.recordRepo.find({ where: recordWhere });

    // 按教师聚合
    const group = new Map<number, SalaryRecordEntity[]>();
    for (const r of records) {
      const tid = Number(r.teacherId);
      const arr = group.get(tid) ?? [];
      arr.push(r);
      group.set(tid, arr);
    }

    const teacherIds = [...group.keys()];
    const profiles = teacherIds.length
      ? await this.profileRepo.find({ where: { teacherId: In(teacherIds) } })
      : [];
    const profileByTeacher = new Map<number, TeacherSalaryProfileEntity>();
    for (const p of profiles) profileByTeacher.set(Number(p.teacherId), p);

    const users = teacherIds.length
      ? await this.userRepo.find({
          where: { id: In(teacherIds) },
          select: { id: true, name: true },
        })
      : [];
    const nameByTeacher = new Map(users.map((u) => [Number(u.id), u.name]));

    const taxPolicy = await this.taxPolicyService.findActiveForMonth(month);

    const preview: SlipPreview[] = [];
    for (const tid of teacherIds) {
      const teacherRecords = group.get(tid) ?? [];
      const gross = round2(
        teacherRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      );
      // 收入分项（按 source 汇总）
      const breakdown = this.buildBreakdown(teacherRecords);

      const profile = profileByTeacher.get(tid) ?? null;
      const insurance = await this.insurancePolicyService.findActiveForCity(
        profile?.city ?? null,
        month,
      );

      const notes: string[] = [];
      let needsReview = false;

      // 五险一金
      let socialBase: number;
      if (profile?.socialBase != null) {
        socialBase = Number(profile.socialBase);
      } else if (insurance?.socialBase != null) {
        let base = Number(insurance.socialBase);
        if (
          insurance.socialBaseMin != null &&
          base < Number(insurance.socialBaseMin)
        ) {
          base = Number(insurance.socialBaseMin);
        }
        if (
          insurance.socialBaseMax != null &&
          base > Number(insurance.socialBaseMax)
        ) {
          base = Number(insurance.socialBaseMax);
        }
        socialBase = base;
      } else {
        socialBase = 0;
        needsReview = true;
        notes.push('无五险一金基数（档案与城市政策均未配置）');
      }
      if (socialBase > 0 && !insurance) {
        needsReview = true;
        notes.push('无城市五险一金政策');
      }

      const ratios = profile?.socialRatios ?? insurance?.ratios ?? null;
      if (!ratios) {
        needsReview = true;
        notes.push('无五险一金个人比例');
      }
      const socialAmount = calcSocial(socialBase, ratios);

      // 个税（月度估算口径）
      const threshold = taxPolicy ? Number(taxPolicy.taxThreshold) : 5000;
      const brackets = taxPolicy?.brackets ?? null;
      if (!taxPolicy) {
        needsReview = true;
        notes.push('无当月个税政策，按默认起征点估算');
      }
      const specialDeductions = (profile?.taxSpecialDeductions ?? []) as {
        type?: string;
        amount?: number;
      }[];
      const specialTotal = round2(
        specialDeductions.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      );
      const taxable = round2(
        Math.max(0, gross - socialAmount - threshold - specialTotal),
      );
      const taxAmount = calcTax(taxable, brackets);
      const netAmount = round2(gross - socialAmount - taxAmount);

      preview.push({
        teacherId: tid,
        teacherName: nameByTeacher.get(tid),
        grossAmount: gross,
        socialAmount,
        taxAmount,
        netAmount,
        needsReview,
        notes,
        detail: {
          breakdown,
          social: {
            base: socialBase,
            ratios,
            amount: socialAmount,
            source:
              profile?.socialBase != null
                ? 'profile'
                : insurance
                  ? 'policy'
                  : 'none',
          },
          tax: {
            method: '月度估算（未含累计预扣）',
            threshold,
            specialDeductions,
            taxable,
            brackets,
          },
          policies: {
            taxPolicy: taxPolicy
              ? {
                  id: taxPolicy.id,
                  name: taxPolicy.name,
                  effectiveFrom: taxPolicy.effectiveFrom,
                  effectiveTo: taxPolicy.effectiveTo,
                }
              : null,
            insurancePolicy: insurance
              ? {
                  id: insurance.id,
                  city: insurance.city,
                  name: insurance.name,
                  effectiveFrom: insurance.effectiveFrom,
                  effectiveTo: insurance.effectiveTo,
                }
              : null,
          },
        },
      });
    }

    const persisted = dryRun
      ? []
      : await this.slipRepo.find({
          where: teacherId ? { month, teacherId } : { month },
        });
    return { preview, persisted };
  }

  private toEntity(
    p: SlipPreview,
    month: string,
    operatedBy: number,
  ): Partial<SalarySlipEntity> {
    return {
      teacherId: p.teacherId,
      month,
      grossAmount: p.grossAmount,
      socialAmount: p.socialAmount,
      taxAmount: p.taxAmount,
      netAmount: p.netAmount,
      detail: p.detail,
      status: SalaryRecordStatus.PENDING,
      needsReview: p.needsReview,
      notes: p.notes.length ? p.notes.join('；') : null,
      createdBy: operatedBy,
    };
  }

  private buildBreakdown(
    records: SalaryRecordEntity[],
  ): { source: string; count: number; amount: number }[] {
    const map = new Map<string, { count: number; amount: number }>();
    for (const r of records) {
      const key = r.source as string;
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(r.amount) || 0;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([source, v]) => ({
        source,
        count: v.count,
        amount: round2(v.amount),
      }))
      .sort((a, b) => b.amount - a.amount);
  }
}
