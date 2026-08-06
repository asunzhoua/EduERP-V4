import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryRuleEntity } from '../entities/salary-rule.entity';
import { SalaryRecordEntity } from '../entities/salary-record.entity';
import { SalaryRuleType, SalaryRecordStatus } from '../enums/salary.enums';
import { LessonCompletedEvent } from '../events/lesson-completed.event';

@Injectable()
export class SalaryCalculator {
  private readonly logger = new Logger(SalaryCalculator.name);

  constructor(
    @InjectRepository(SalaryRuleEntity)
    private readonly salaryRuleRepo: Repository<SalaryRuleEntity>,
    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRecordRepo: Repository<SalaryRecordEntity>,
  ) {}

  async calculate(event: LessonCompletedEvent): Promise<SalaryRecordEntity> {
    // 1. 查找适用规则
    const rule = await this.findMatchingRule(event);
    if (!rule) {
      throw new Error(`No matching salary rule found for lesson ${event.lessonId}`);
    }

    // 2. 计算金额
    const amount = this.calculateAmount(rule, event);

    // 3. 创建记录
    const record = this.salaryRecordRepo.create({
      teacherId: event.teacherId,
      lessonId: event.lessonId,
      salaryRuleId: rule.id,
      ruleVersion: rule.updateTime?.toISOString() || new Date().toISOString(),
      amount,
      lessonDate: event.completedAt.toISOString().split('T')[0],
      duration: 60, // 默认 60 分钟，可从 Lesson 获取
      status: SalaryRecordStatus.PENDING,
    });

    return record;
  }

  private async findMatchingRule(event: LessonCompletedEvent): Promise<SalaryRuleEntity | null> {
    // 获取所有活跃规则
    const rules = await this.salaryRuleRepo.find({
      where: { isActive: true },
    });

    if (rules.length === 0) {
      return null;
    }

    // 4级优先级匹配
    // 优先级1: 课程类型 + 教师等级（精确匹配）
    // 优先级2: 课程类型（teacherLevel 通配）
    // 优先级3: 教师等级（courseType 通配）
    // 优先级4: 完全通用规则

    // 简化实现：按优先级排序后取第一个
    const sortedRules = rules.sort((a, b) => {
      const aScore = this.getRulePriorityScore(a);
      const bScore = this.getRulePriorityScore(b);
      return aScore - bScore;
    });

    return sortedRules[0] || null;
  }

  private getRulePriorityScore(rule: SalaryRuleEntity): number {
    // 分数越低优先级越高
    if (rule.courseType && rule.teacherLevel) return 1; // 最精确
    if (rule.courseType && !rule.teacherLevel) return 2; // 课程类型
    if (!rule.courseType && rule.teacherLevel) return 3; // 教师等级
    return 4; // 通用规则
  }

  private calculateAmount(rule: SalaryRuleEntity, event: LessonCompletedEvent): number {
    switch (rule.type) {
      case SalaryRuleType.PER_LESSON:
        return Number(rule.baseAmount) * Number(rule.multiplier);
      case SalaryRuleType.HOURLY:
        // 假设每节课 1 小时
        return Number(rule.baseAmount) * Number(rule.multiplier);
      case SalaryRuleType.MONTHLY:
        return Number(rule.baseAmount);
      default:
        return 0;
    }
  }
}
