import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryInsurancePolicyEntity } from '../entities/salary-insurance-policy.entity';
import {
  CreateInsurancePolicyDto,
  UpdateInsurancePolicyDto,
  ImportInsurancePolicyDto,
  SyncInsurancePolicyDto,
  QueryInsurancePolicyDto,
} from '../dto/salary-policy.dto';
import { INSURANCE_POLICY_SEED } from '../data/insurance-policy-seed';
import { dateStr } from './tax-policy.service';

/** 第三方数据源开关：builtin = 用内置 seed（本期默认）；disabled = 关闭同步 */
const POLICY_PROVIDER = (process.env.POLICY_PROVIDER as string) || 'builtin';

/** 可配置的城市列表（供前端下拉） */
export function seedCities(): string[] {
  return [...new Set(INSURANCE_POLICY_SEED.map((s) => s.city))];
}

/** 次月 1 日 YYYY-MM-DD（import 缺省生效日） */
export function nextMonthFirstDay(now = new Date()): string {
  return dateStr(new Date(now.getFullYear(), now.getMonth() + 1, 1));
}

@Injectable()
export class InsurancePolicyService {
  constructor(
    @InjectRepository(SalaryInsurancePolicyEntity)
    private readonly policyRepo: Repository<SalaryInsurancePolicyEntity>,
  ) {}

  // ─── CRUD ───

  async create(dto: CreateInsurancePolicyDto, createdBy: number) {
    const entity = this.policyRepo.create({
      city: dto.city,
      name: dto.name,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
      socialBaseMin: dto.socialBaseMin ?? null,
      socialBaseMax: dto.socialBaseMax ?? null,
      socialBase: dto.socialBase ?? null,
      ratios: (dto.ratios as Record<string, any> | undefined) ?? null,
      employerRatios: dto.employerRatios ?? null,
      note: dto.note ?? null,
      createdBy,
    });
    return this.policyRepo.save(entity);
  }

  async update(id: number, dto: UpdateInsurancePolicyDto, updatedBy: number) {
    const policy = await this.policyRepo.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Insurance policy ${id} not found`);
    }
    Object.assign(policy, dto);
    if (dto.ratios !== undefined) {
      policy.ratios = (dto.ratios as Record<string, any>) ?? null;
    }
    policy.updatedBy = updatedBy;
    return this.policyRepo.save(policy);
  }

  async remove(id: number) {
    const policy = await this.policyRepo.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Insurance policy ${id} not found`);
    }
    await this.policyRepo.delete(id);
  }

  async list(query: QueryInsurancePolicyDto) {
    const { city, activeOnly, page = 1, pageSize = 20 } = query;
    const qb = this.policyRepo.createQueryBuilder('p');
    if (city) {
      qb.andWhere('p.city = :city', { city });
    }
    if (activeOnly) {
      const today = dateStr(new Date());
      qb.andWhere('p.effectiveFrom <= :today', { today }).andWhere(
        '(p.effectiveTo IS NULL OR p.effectiveTo >= :today)',
        { today },
      );
    }
    qb.orderBy('p.effectiveFrom', 'DESC').addOrderBy('p.id', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  // ─── 一键导入内置 seed（新版本，不覆盖历史） ───

  async importFromSeed(dto: ImportInsurancePolicyDto, operatedBy: number) {
    const seed = INSURANCE_POLICY_SEED.find((s) => s.city === dto.city);
    if (!seed) {
      throw new BadRequestException(
        `内置种子库无「${dto.city}」数据，可用城市：${seedCities().join('、')}`,
      );
    }
    const effectiveFrom = dto.effectiveFrom ?? nextMonthFirstDay();
    const entity = this.policyRepo.create({
      city: seed.city,
      name: seed.name,
      effectiveFrom,
      effectiveTo: null,
      socialBaseMin: seed.socialBaseMin,
      socialBaseMax: seed.socialBaseMax,
      socialBase: seed.socialBase,
      ratios: seed.ratios,
      employerRatios: seed.employerRatios,
      note: '一键导入内置种子（约数，上线前请按当地最新标准核校）',
      createdBy: operatedBy,
    });
    return this.policyRepo.save(entity);
  }

  // ─── 第三方数据源同步（本期预留扩展点） ───

  async sync(dto: SyncInsurancePolicyDto, operatedBy: number) {
    if (POLICY_PROVIDER !== 'builtin') {
      return {
        enabled: false,
        provider: POLICY_PROVIDER,
        message: '第三方数据源未启用（POLICY_PROVIDER 非 builtin），未同步',
        imported: 0,
      };
    }
    const external = await this.fetchExternalPolicy(dto.city);
    if (!external) {
      return {
        enabled: true,
        provider: POLICY_PROVIDER,
        city: dto.city,
        message:
          '当前为内置 seed 模式，未对接第三方数据源；请用「一键导入」内置版本，或后续实现 fetchExternalPolicy 适配器',
        imported: 0,
      };
    }
    // 适配器返回数据 → 生成新版本（本期不会走到，预留）
    const effectiveFrom = dto.effectiveFrom ?? nextMonthFirstDay();
    const entity = this.policyRepo.create({
      city: external.city,
      name: `${external.city} 第三方同步版`,
      effectiveFrom,
      effectiveTo: null,
      socialBaseMin: external.socialBaseMin ?? null,
      socialBaseMax: external.socialBaseMax ?? null,
      socialBase: external.socialBase ?? null,
      ratios: external.ratios ?? null,
      employerRatios: external.employerRatios ?? null,
      note: '第三方数据源同步生成',
      createdBy: operatedBy,
    });
    const saved = await this.policyRepo.save(entity);
    return {
      enabled: true,
      provider: POLICY_PROVIDER,
      imported: 1,
      version: saved,
    };
  }

  /**
   * 第三方数据源适配器（预留接口）
   *
   * 将来接入付费数据源（阿里云市场/聚合数据等）时，只需在此实现按城市拉取
   * 「基数上下限 + 个人比例」，返回同结构对象即可，结算逻辑不用改。
   */
  fetchExternalPolicy(_city: string): Promise<{
    city: string;
    socialBaseMin?: number | null;
    socialBaseMax?: number | null;
    socialBase?: number | null;
    ratios?: Record<string, any>;
    employerRatios?: Record<string, any>;
  } | null> {
    return Promise.resolve(null);
  }

  // ─── 工资条生成用 ───

  /** 取某城市当月生效政策（含兜底：档案未配城市 → 全库生效首条） */
  async findActiveForCity(
    city: string | null | undefined,
    month: string,
  ): Promise<SalaryInsurancePolicyEntity | null> {
    const monthStart = `${month}-01`;
    const qb = this.policyRepo.createQueryBuilder('p');
    qb.where('p.effectiveFrom <= :monthStart', { monthStart }).andWhere(
      '(p.effectiveTo IS NULL OR p.effectiveTo >= :monthStart)',
      { monthStart },
    );
    if (city) {
      qb.andWhere('p.city = :city', { city });
    }
    qb.orderBy('p.effectiveFrom', 'DESC').addOrderBy('p.id', 'DESC');
    const items = await qb.getMany();
    if (items.length > 0) return items[0];
    // 城市无当期政策 → 兜底取全库当期首条（全局默认）
    const anyItems = await this.policyRepo
      .createQueryBuilder('p')
      .where('p.effectiveFrom <= :monthStart', { monthStart })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo >= :monthStart)', {
        monthStart,
      })
      .orderBy('p.effectiveFrom', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .getMany();
    return anyItems[0] ?? null;
  }
}
