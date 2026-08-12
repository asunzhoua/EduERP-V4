import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';
import { TeacherSalaryProfileEntity } from './entities/teacher-salary-profile.entity';
import { OutingRecordEntity } from './entities/outing-record.entity';
import {
  OutingRecordStatus,
  SalaryRecordSource,
  SalaryRecordStatus,
  SalaryRuleType,
  TeacherEmploymentType,
} from './enums/salary.enums';
import { validateRuleConfig } from './dto/rule-config.util';
import { SalaryRuleConfigDto } from './dto/salary-rule-config.dto';
import {
  CreateSalaryRuleDto,
  UpdateSalaryRuleDto,
  QuerySalaryRecordDto,
  SalaryStatisticsQueryDto,
} from './dto/salary.dto';
import {
  UpsertTeacherSalaryProfileDto,
  QuerySalaryTeacherDto,
  CreateOutingRecordDto,
  UpdateOutingRecordDto,
  QueryOutingRecordDto,
} from './dto/salary-profile.dto';
import { User } from '@modules/identity/entities/user.entity';
import {
  mergeItems,
  round2,
  type BreakdownItem,
} from './services/salary-slip.service';

type SalaryTotalsRow = {
  totalRecords: string;
  totalAmount: string;
  totalMinutes: string;
  teacherCount: string;
};

type SalaryStatusRow = {
  status: SalaryRecordStatus;
  amount: string;
};

/** 解析记录 detail.items（raw 查询 JSON 列可能为字符串），容错返回空数组 */
function parseDetailItems(
  detail: unknown,
): { type?: string; name?: string; amount?: number }[] {
  if (detail == null) return [];
  let obj: unknown = detail;
  if (typeof detail === 'string') {
    try {
      obj = JSON.parse(detail);
    } catch {
      return [];
    }
  }
  const items = (obj as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as { type?: string; name?: string; amount?: number }[]) : [];
}

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(SalaryRuleEntity)
    private readonly salaryRuleRepo: Repository<SalaryRuleEntity>,
    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRecordRepo: Repository<SalaryRecordEntity>,
    @InjectRepository(TeacherSalaryProfileEntity)
    private readonly profileRepo: Repository<TeacherSalaryProfileEntity>,
    @InjectRepository(OutingRecordEntity)
    private readonly outingRepo: Repository<OutingRecordEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ==================== 工资记录查询 ====================

  async getRecords(query: QuerySalaryRecordDto) {
    const {
      teacherId,
      teacherName,
      month,
      startDate,
      endDate,
      status,
      source,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.salaryRecordRepo.createQueryBuilder('record');

    if (teacherId) {
      qb.andWhere('record.teacherId = :teacherId', { teacherId });
    }

    // 教师姓名模糊搜索：join User.name
    if (teacherName) {
      qb.innerJoin(User, 'u', 'u.id = record.teacherId').andWhere(
        'u.name LIKE :teacherName',
        { teacherName: `%${teacherName}%` },
      );
    }

    if (month) {
      qb.andWhere('record.month = :month', { month });
    } else if (startDate && endDate) {
      qb.andWhere('record.lessonDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    if (status) {
      qb.andWhere('record.status = :status', { status });
    }

    if (source) {
      qb.andWhere('record.source = :source', { source });
    }

    qb.orderBy('record.lessonDate', 'DESC').addOrderBy('record.id', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [records, total] = await qb.getManyAndCount();

    // 附加教师姓名（批量取 User.name，与工资条 getSlips 同模式）
    const teacherIds = [...new Set(records.map((r) => Number(r.teacherId)))];
    const users = teacherIds.length
      ? await this.userRepo.find({
          where: { id: In(teacherIds) },
          select: { id: true, name: true },
        })
      : [];
    const nameByTeacher = new Map(users.map((u) => [Number(u.id), u.name]));
    const items = records.map((r) => ({
      ...r,
      teacherName: nameByTeacher.get(Number(r.teacherId)) ?? null,
    }));

    return {
      records: items,
      total,
      page,
      pageSize,
    };
  }

  async getStatistics(query: SalaryStatisticsQueryDto) {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const monthNum = query.month ?? now.getMonth() + 1;
    const month = `${year}-${String(monthNum).padStart(2, '0')}`;
    const { teacherId } = query;

    const qb = this.salaryRecordRepo.createQueryBuilder('record');
    // 未指定月份时统计全量，与记录列表默认视图保持一致
    if (query.month !== undefined) {
      qb.where('record.month = :month', { month });
    } else if (query.year !== undefined) {
      qb.where('record.month LIKE :yearPrefix', { yearPrefix: `${year}-%` });
    }
    if (teacherId) {
      qb.andWhere('record.teacherId = :teacherId', { teacherId });
    }

    const totals = (await qb
      .clone()
      .select([
        'COUNT(record.id) AS totalRecords',
        'SUM(record.amount) AS totalAmount',
        'SUM(record.duration) AS totalMinutes',
        'COUNT(DISTINCT record.teacherId) AS teacherCount',
      ])
      .getRawOne<SalaryTotalsRow>()) as SalaryTotalsRow;

    const byStatus = await qb
      .clone()
      .select(['record.status AS status', 'SUM(record.amount) AS amount'])
      .groupBy('record.status')
      .getRawMany<SalaryStatusRow>();

    let paidAmount = 0;
    let pendingAmount = 0;
    for (const row of byStatus) {
      const amount = parseFloat(row.amount) || 0;
      if (row.status === SalaryRecordStatus.PAID) {
        paidAmount += amount;
      } else {
        pendingAmount += amount; // PENDING 与 APPROVED 均属未发放
      }
    }

    // 按来源聚合（工资构成：底薪/课时费/津贴/绩效…），管理端与教师端共用
    const bySource = await qb
      .clone()
      .select([
        'record.source AS source',
        'COUNT(record.id) AS count',
        'SUM(record.amount) AS amount',
      ])
      .groupBy('record.source')
      .getRawMany<{ source: string; count: string; amount: string }>();

    // 应发 = 收入项和（不含扣款）；扣款单列（|Σ DEDUCTION|）
    let totalAmount = 0;
    let deductionAmount = 0;
    for (const row of bySource) {
      const amt = parseFloat(row.amount) || 0;
      if (row.source === SalaryRecordSource.DEDUCTION) {
        deductionAmount += Math.abs(amt);
      } else {
        totalAmount += amt;
      }
    }

    // 津贴/绩效构成子项（ALLOWANCE/BONUS 记录 detail.items）
    const itemRows = await qb
      .clone()
      .select(['record.source AS source', 'record.detail AS detail'])
      .andWhere("record.source IN ('ALLOWANCE', 'BONUS')")
      .getRawMany<{ source: string; detail: unknown }>();

    const breakdown = bySource
      .filter((row) => row.source !== SalaryRecordSource.DEDUCTION)
      .map((row) => {
        const items: BreakdownItem[] = [];
        if (
          row.source === SalaryRecordSource.ALLOWANCE ||
          row.source === SalaryRecordSource.BONUS
        ) {
          for (const ir of itemRows) {
            if (ir.source !== row.source) continue;
            const sub = parseDetailItems(ir.detail);
            if (sub.length) items.push(...mergeItems(sub));
          }
        }
        return {
          source: row.source,
          count: parseInt(row.count, 10) || 0,
          amount: parseFloat(row.amount) || 0,
          items,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // 扣款明细（DEDUCTION 记录 detail.items 合并，教师端/管理端展示扣款构成）
    const deductionRows = await qb
      .clone()
      .select(['record.source AS source', 'record.detail AS detail'])
      .andWhere("record.source = 'DEDUCTION'")
      .getRawMany<{ source: string; detail: unknown }>();
    const deductionItems: BreakdownItem[] = [];
    for (const ir of deductionRows) {
      const sub = parseDetailItems(ir.detail);
      if (sub.length) deductionItems.push(...mergeItems(sub));
    }

    return {
      year,
      month,
      monthNum,
      totalRecords: parseInt(totals.totalRecords) || 0,
      totalAmount,
      deductionAmount,
      netAmount: round2(totalAmount - deductionAmount),
      deduction: { amount: deductionAmount, items: deductionItems },
      totalMinutes: parseInt(totals.totalMinutes) || 0,
      teacherCount: parseInt(totals.teacherCount) || 0,
      recordCount: parseInt(totals.totalRecords) || 0,
      paidAmount,
      pendingAmount,
      breakdown,
    };
  }

  async updateRecordStatus(
    id: number,
    status: string,
    notes?: string,
    updatedBy?: number,
  ) {
    const record = await this.salaryRecordRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Salary record ${id} not found`);
    }

    // 状态机：PENDING → APPROVED → PAID；APPROVED → PENDING 允许重算；PAID 锁定
    const validTransitions: Record<string, string[]> = {
      [SalaryRecordStatus.PENDING]: [SalaryRecordStatus.APPROVED],
      [SalaryRecordStatus.APPROVED]: [
        SalaryRecordStatus.PAID,
        SalaryRecordStatus.PENDING,
      ],
      [SalaryRecordStatus.PAID]: [],
    };

    if (!validTransitions[record.status]?.includes(status)) {
      throw new BadRequestException(
        `Invalid status transition from ${record.status} to ${status}`,
      );
    }

    record.status = status as SalaryRecordStatus;
    if (notes) {
      record.notes = notes;
    }
    if (updatedBy) {
      record.updatedBy = updatedBy;
    }

    return this.salaryRecordRepo.save(record);
  }

  // ==================== 规则管理 ====================

  async createRule(dto: CreateSalaryRuleDto, createdBy: number) {
    const config = validateRuleConfig(dto.type as SalaryRuleType, dto.config);

    const rule = this.salaryRuleRepo.create({
      name: dto.name,
      type: dto.type as SalaryRuleType,
      baseAmount: dto.baseAmount,
      multiplier: dto.multiplier ?? 1.0,
      courseType: dto.courseType ?? null,
      teacherLevel: dto.teacherLevel ?? null,
      isActive: dto.isActive !== false,
      note: dto.note ?? null,
      config,
      createdBy,
    });

    return this.salaryRuleRepo.save(rule);
  }

  async updateRule(id: number, dto: UpdateSalaryRuleDto, updatedBy: number) {
    const rule = await this.salaryRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Salary rule ${id} not found`);
    }

    const nextType = (dto.type ?? rule.type) as SalaryRuleType;
    // config 变更时按新 type 校验；若 type 变而 config 未给，沿用旧 config 再校验
    let config = rule.config;
    if (dto.config !== undefined) {
      config = validateRuleConfig(nextType, dto.config);
    } else if (
      dto.type !== undefined &&
      (dto.type as SalaryRuleType) !== rule.type
    ) {
      config = validateRuleConfig(
        nextType,
        rule.config as SalaryRuleConfigDto | null,
      );
    }

    Object.assign(rule, dto);
    if (config !== undefined) {
      rule.config = config;
    }
    rule.updatedBy = updatedBy;

    return this.salaryRuleRepo.save(rule);
  }

  async deleteRule(id: number) {
    const rule = await this.salaryRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Salary rule ${id} not found`);
    }

    // 软删除
    rule.isActive = false;
    await this.salaryRuleRepo.save(rule);
  }

  async getRules(activeOnly: boolean = true) {
    const where = activeOnly ? { isActive: true } : {};
    return this.salaryRuleRepo.find({ where, order: { createTime: 'DESC' } });
  }

  async getRule(id: number) {
    const rule = await this.salaryRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Salary rule ${id} not found`);
    }
    return rule;
  }

  // ==================== 教师薪资档案 ====================

  async getProfile(teacherId: number) {
    return this.profileRepo.findOne({ where: { teacherId } });
  }

  async upsertProfile(
    teacherId: number,
    dto: UpsertTeacherSalaryProfileDto,
    operatedBy: number,
  ) {
    const config = validateRuleConfig(
      dto.ruleType as SalaryRuleType,
      dto.salaryConfig ?? null,
    );
    const existing = await this.profileRepo.findOne({ where: { teacherId } });
    if (existing) {
      Object.assign(existing, {
        employmentType: dto.employmentType as TeacherEmploymentType,
        ruleType: dto.ruleType as SalaryRuleType,
        salaryConfig: config,
        allowances: dto.allowances ?? null,
        deductions: dto.deductions ?? null,
        city: dto.city ?? null,
        socialBase: dto.socialBase ?? null,
        socialRatios: dto.socialRatios ?? null,
        taxSpecialDeductions: dto.taxSpecialDeductions ?? null,
        effectiveFrom: dto.effectiveFrom ?? null,
        effectiveTo: dto.effectiveTo ?? null,
        isActive: dto.isActive !== false,
        note: dto.note ?? null,
        updatedBy: operatedBy,
      });
      return this.profileRepo.save(existing);
    }
    const profile = this.profileRepo.create({
      teacherId,
      employmentType: dto.employmentType as TeacherEmploymentType,
      ruleType: dto.ruleType as SalaryRuleType,
      salaryConfig: config,
      allowances: dto.allowances ?? null,
      deductions: dto.deductions ?? null,
      city: dto.city ?? null,
      socialBase: dto.socialBase ?? null,
      socialRatios: dto.socialRatios ?? null,
      taxSpecialDeductions: dto.taxSpecialDeductions ?? null,
      effectiveFrom: dto.effectiveFrom ?? null,
      effectiveTo: dto.effectiveTo ?? null,
      isActive: dto.isActive !== false,
      note: dto.note ?? null,
      createdBy: operatedBy,
    });
    return this.profileRepo.save(profile);
  }

  // ==================== 教师列表（建档选择） ====================

  async getTeachers(query: QuerySalaryTeacherDto) {
    const { keyword, page = 1, pageSize = 20 } = query;
    const qb = this.userRepo.createQueryBuilder('user');
    qb.where('user.role = :role', { role: 'Teacher' });
    qb.andWhere('user.status = :status', { status: 1 });
    if (keyword) {
      qb.andWhere('(user.name LIKE :kw OR user.mobile LIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }
    qb.orderBy('user.id', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);
    qb.select([
      'user.id',
      'user.name',
      'user.mobile',
      'user.teacherLevel',
      'user.status',
      'user.createTime',
    ]);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  // ==================== 外派课时记录 ====================

  async createOuting(dto: CreateOutingRecordDto, operatedBy: number) {
    const outing = this.outingRepo.create({
      teacherId: dto.teacherId,
      outingDate: dto.outingDate,
      location: dto.location ?? null,
      lessonCount: dto.lessonCount ?? 1,
      note: dto.note ?? null,
      status: OutingRecordStatus.PENDING,
      createdBy: operatedBy,
    });
    return this.outingRepo.save(outing);
  }

  async updateOuting(
    id: number,
    dto: UpdateOutingRecordDto,
    operatedBy: number,
  ) {
    const outing = await this.outingRepo.findOne({ where: { id } });
    if (!outing) {
      throw new NotFoundException(`Outing record ${id} not found`);
    }
    Object.assign(outing, dto);
    outing.updatedBy = operatedBy;
    return this.outingRepo.save(outing);
  }

  async updateOutingStatus(id: number, status: string, operatedBy: number) {
    const outing = await this.outingRepo.findOne({ where: { id } });
    if (!outing) {
      throw new NotFoundException(`Outing record ${id} not found`);
    }
    if (
      !Object.values(OutingRecordStatus).includes(status as OutingRecordStatus)
    ) {
      throw new BadRequestException(`Invalid outing status ${status}`);
    }
    outing.status = status as OutingRecordStatus;
    outing.updatedBy = operatedBy;
    return this.outingRepo.save(outing);
  }

  async deleteOuting(id: number) {
    const outing = await this.outingRepo.findOne({ where: { id } });
    if (!outing) {
      throw new NotFoundException(`Outing record ${id} not found`);
    }
    await this.outingRepo.delete(id);
  }

  async getOutings(query: QueryOutingRecordDto) {
    const { teacherId, month, status, page = 1, pageSize = 20 } = query;
    const qb = this.outingRepo.createQueryBuilder('outing');
    if (teacherId) {
      qb.andWhere('outing.teacherId = :teacherId', { teacherId });
    }
    if (status) {
      qb.andWhere('outing.status = :status', { status });
    }
    if (month) {
      const m = /^(\d{4})-(\d{2})$/.exec(month);
      if (m) {
        const lastDay = new Date(Number(m[1]), Number(m[2]), 0).getDate();
        qb.andWhere('outing.outingDate BETWEEN :start AND :end', {
          start: `${month}-01`,
          end: `${month}-${String(lastDay).padStart(2, '0')}`,
        });
      }
    }
    qb.orderBy('outing.outingDate', 'DESC').addOrderBy('outing.id', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [records, total] = await qb.getManyAndCount();
    return { records, total, page, pageSize };
  }
}
