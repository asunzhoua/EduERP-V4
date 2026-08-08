import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

/** 系统设置：按分类分组返回，前端按分类渲染表单 */
export interface SettingEntry {
  key: string;
  value: string;
  category: string;
  description?: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  /** 按分类分组返回全部设置 */
  async findAllGrouped(): Promise<Record<string, SettingEntry[]>> {
    const settings = await this.settingRepo.find({ order: { category: 'ASC', key: 'ASC' } });
    const grouped: Record<string, SettingEntry[]> = {};
    for (const s of settings) {
      const category = s.category || 'system';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({ key: s.key, value: s.value || '', category, description: s.description });
    }
    return grouped;
  }

  /** 批量保存（按 key upsert），返回更新后的分组结果 */
  async bulkSave(entries: SettingEntry[], operatorId: number): Promise<Record<string, SettingEntry[]>> {
    for (const e of entries) {
      const key = e.key?.trim();
      if (!key) continue;
      const existing = await this.settingRepo.findOne({ where: { key } });
      if (existing) {
        existing.value = e.value ?? '';
        existing.category = e.category || existing.category;
        if (e.description !== undefined) existing.description = e.description;
        existing.updatedBy = operatorId;
        await this.settingRepo.save(existing);
      } else {
        const s = this.settingRepo.create({
          key,
          value: e.value ?? '',
          category: e.category || 'system',
          description: e.description ?? null,
          updatedBy: operatorId,
        });
        await this.settingRepo.save(s);
      }
    }
    return this.findAllGrouped();
  }

  async getValue(key: string): Promise<string | null> {
    const s = await this.settingRepo.findOne({ where: { key } });
    return s ? s.value : null;
  }

  async findOne(key: string): Promise<Setting> {
    const s = await this.settingRepo.findOne({ where: { key } });
    if (!s) throw new NotFoundException('设置项不存在');
    return s;
  }
}
