import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';
import {
  SalaryRecordStatus,
  SalaryRecordSource,
  SalaryRuleType,
} from './enums/salary.enums';
import { validateRuleConfig } from './dto/rule-config.util';
import { SalaryRuleConfigDto } from './dto/salary-rule-config.dto';
import {
  CreateSalaryRuleDto,
  UpdateSalaryRuleDto,
  QuerySalaryRecordDto,
  SalaryStatisticsQueryDto,
} from './dto/salary.dto';

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

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(SalaryRuleEntity)
    private readonly salaryRuleRepo: Repository<SalaryRuleEntity>,
    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRecordRepo: Repository<SalaryRecordEntity>,
  ) {}

  // ==================== 工资记录查询 ====================

  async getRecords(query: QuerySalaryRecordDto) {
    const {
      teacherId,
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

    return {
      records,
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
    qb.where('record.month = :month', { month });
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

    return {
      year,
      month,
      monthNum,
      totalRecords: parseInt(totals.totalRecords) || 0,
      totalAmount: parseFloat(totals.totalAmount) || 0,
      totalMinutes: parseInt(totals.totalMinutes) || 0,
      teacherCount: parseInt(totals.teacherCount) || 0,
      recordCount: parseInt(totals.totalRecords) || 0,
      paidAmount,
      pendingAmount,
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
}
