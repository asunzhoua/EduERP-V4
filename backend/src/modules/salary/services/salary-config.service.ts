import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryConfigEntity } from '../entities/salary-config.entity';

/**
 * 工资模块全局配置（社保 + 个税 总开关）
 */
@Injectable()
export class SalaryConfigService {
  constructor(
    @InjectRepository(SalaryConfigEntity)
    private readonly configRepo: Repository<SalaryConfigEntity>,
  ) {}

  /** 读总开关；表空时回退默认关（不落库，避免读路径写库） */
  async get() {
    const row = await this.configRepo.findOne({ where: { id: 1 } });
    return { enabled: row?.enabled ?? false };
  }

  /** 幂等 upsert 单例行 id=1 */
  async update(enabled: boolean, operatedBy: number) {
    const existing = await this.configRepo.findOne({ where: { id: 1 } });
    if (existing) {
      existing.enabled = enabled;
      existing.updatedBy = operatedBy;
      await this.configRepo.save(existing);
      return { enabled: existing.enabled };
    }
    const row = this.configRepo.create({
      id: 1,
      enabled,
      createdBy: operatedBy,
    });
    await this.configRepo.save(row);
    return { enabled: row.enabled };
  }
}
