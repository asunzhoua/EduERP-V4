import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryTaxPolicyEntity } from '../entities/salary-tax-policy.entity';
import {
  CreateTaxPolicyDto,
  UpdateTaxPolicyDto,
  QueryTaxPolicyDto,
} from '../dto/salary-policy.dto';

/** 月度 7 档超额累进税率表（2026 起征点 5000），未启用自定义时作默认 */
export const DEFAULT_TAX_BRACKETS = [
  { min: 0, max: 3000, rate: 0.03, quickDeduction: 0 },
  { min: 3000, max: 12000, rate: 0.1, quickDeduction: 210 },
  { min: 12000, max: 25000, rate: 0.2, quickDeduction: 1410 },
  { min: 25000, max: 35000, rate: 0.25, quickDeduction: 2660 },
  { min: 35000, max: 55000, rate: 0.3, quickDeduction: 4410 },
  { min: 55000, max: 80000, rate: 0.35, quickDeduction: 7160 },
  { min: 80000, max: null, rate: 0.45, quickDeduction: 15160 },
];

export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class TaxPolicyService {
  constructor(
    @InjectRepository(SalaryTaxPolicyEntity)
    private readonly taxPolicyRepo: Repository<SalaryTaxPolicyEntity>,
  ) {}

  /** 创建个税政策版本（版本化，不覆盖历史） */
  async create(dto: CreateTaxPolicyDto, createdBy: number) {
    const entity = this.taxPolicyRepo.create({
      name: dto.name,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
      taxThreshold: dto.taxThreshold ?? 5000,
      brackets: dto.brackets?.length ? dto.brackets : DEFAULT_TAX_BRACKETS,
      note: dto.note ?? null,
      createdBy,
    });
    return this.taxPolicyRepo.save(entity);
  }

  async update(id: number, dto: UpdateTaxPolicyDto, updatedBy: number) {
    const policy = await this.taxPolicyRepo.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Tax policy ${id} not found`);
    }
    Object.assign(policy, dto);
    if (dto.brackets !== undefined) {
      policy.brackets = dto.brackets?.length
        ? dto.brackets
        : DEFAULT_TAX_BRACKETS;
    }
    policy.updatedBy = updatedBy;
    return this.taxPolicyRepo.save(policy);
  }

  async remove(id: number) {
    const policy = await this.taxPolicyRepo.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Tax policy ${id} not found`);
    }
    // 硬删除：历史工资条 detail 已留存政策快照，删除不影响历史月
    await this.taxPolicyRepo.delete(id);
  }

  async list(query: QueryTaxPolicyDto) {
    const { activeOnly, page = 1, pageSize = 20 } = query;
    const qb = this.taxPolicyRepo.createQueryBuilder('p');
    if (activeOnly) {
      const today = dateStr(new Date());
      qb.where('p.effectiveFrom <= :today', { today }).andWhere(
        '(p.effectiveTo IS NULL OR p.effectiveTo >= :today)',
        { today },
      );
    }
    qb.orderBy('p.effectiveFrom', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** 当月生效版本（工资条生成用）：按 effectiveFrom 最新取一条 */
  async findActiveForMonth(
    month: string,
  ): Promise<SalaryTaxPolicyEntity | null> {
    const monthStart = `${month}-01`;
    const items = await this.taxPolicyRepo
      .createQueryBuilder('p')
      .where('p.effectiveFrom <= :monthStart', { monthStart })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= :monthStart)', {
        monthStart,
      })
      .orderBy('p.effectiveFrom', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .getMany();
    return items[0] ?? null;
  }

  /** 取一个当月生效版本，否则抛异常 */
  async requireActiveForMonth(month: string): Promise<SalaryTaxPolicyEntity> {
    const policy = await this.findActiveForMonth(month);
    if (!policy) {
      throw new BadRequestException(
        `月份 ${month} 无生效个税政策，请先创建 salary_tax_policy`,
      );
    }
    return policy;
  }
}
