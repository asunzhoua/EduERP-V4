import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SalaryRuleEntity } from './entities/salary-rule.entity';
import { SalaryRecordEntity } from './entities/salary-record.entity';
import { SalaryRecordStatus } from './enums/salary.enums';
import {
  CreateSalaryRuleDto,
  UpdateSalaryRuleDto,
  QuerySalaryRecordDto,
  SalaryStatisticsQueryDto,
} from './dto/salary.dto';

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
    const { teacherId, startDate, endDate, status, page = 1, pageSize = 20 } = query;

    const qb = this.salaryRecordRepo.createQueryBuilder('record');

    if (teacherId) {
      qb.andWhere('record.teacherId = :teacherId', { teacherId });
    }

    if (startDate && endDate) {
      qb.andWhere('record.lessonDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    if (status) {
      qb.andWhere('record.status = :status', { status });
    }

    qb.orderBy('record.lessonDate', 'DESC');
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
    const month = query.month ?? now.getMonth() + 1;
    const { teacherId } = query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // 月末

    const base = this.salaryRecordRepo.createQueryBuilder('record');
    base.where('record.lessonDate BETWEEN :startDate AND :endDate', {
      startDate,
      endDate,
    });
    if (teacherId) {
      base.andWhere('record.teacherId = :teacherId', { teacherId });
    }

    const totals = await base
      .clone()
      .select([
        'COUNT(record.id) AS totalRecords',
        'SUM(record.amount) AS totalAmount',
        'SUM(record.duration) AS totalMinutes',
        'COUNT(DISTINCT record.teacherId) AS teacherCount',
      ])
      .getRawOne();

    const byStatus = await base
      .clone()
      .select(['record.status AS status', 'SUM(record.amount) AS amount'])
      .groupBy('record.status')
      .getRawMany();

    let paidAmount = 0;
    let pendingAmount = 0;
    for (const row of byStatus) {
      const amount = parseFloat(row.amount) || 0;
      if (row.status === SalaryRecordStatus.PAID) {
        paidAmount += amount;
      } else {
        pendingAmount += amount; // PENDING 与 CONFIRMED 均属未发放
      }
    }

    return {
      year,
      month,
      totalRecords: parseInt(totals.totalRecords) || 0,
      totalAmount: parseFloat(totals.totalAmount) || 0,
      totalMinutes: parseInt(totals.totalMinutes) || 0,
      teacherCount: parseInt(totals.teacherCount) || 0,
      recordCount: parseInt(totals.totalRecords) || 0,
      paidAmount,
      pendingAmount,
    };
  }

  async updateRecordStatus(id: number, status: string, notes?: string) {
    const record = await this.salaryRecordRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Salary record ${id} not found`);
    }

    // 验证状态流转
    const validTransitions: Record<string, string[]> = {
      [SalaryRecordStatus.PENDING]: [SalaryRecordStatus.CONFIRMED],
      [SalaryRecordStatus.CONFIRMED]: [SalaryRecordStatus.PAID],
      [SalaryRecordStatus.PAID]: [],
    };

    if (!validTransitions[record.status]?.includes(status as SalaryRecordStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${record.status} to ${status}`,
      );
    }

    record.status = status as SalaryRecordStatus;
    if (notes) {
      record.notes = notes;
    }

    return this.salaryRecordRepo.save(record);
  }

  // ==================== 规则管理 ====================

  async createRule(dto: CreateSalaryRuleDto) {
    const rule = this.salaryRuleRepo.create({
      ...dto,
      type: dto.type as any,
      multiplier: dto.multiplier || 1.0,
      isActive: dto.isActive !== false,
    });

    return this.salaryRuleRepo.save(rule);
  }

  async updateRule(id: number, dto: UpdateSalaryRuleDto) {
    const rule = await this.salaryRuleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Salary rule ${id} not found`);
    }

    Object.assign(rule, dto);
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
