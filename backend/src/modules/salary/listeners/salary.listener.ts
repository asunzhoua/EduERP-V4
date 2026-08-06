import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonCompletedEvent } from '../events/lesson-completed.event';
import { SalaryRecordEntity } from '../entities/salary-record.entity';
import { SalaryCalculator } from '../services/salary-calculator.service';

@Injectable()
export class SalaryListener {
  private readonly logger = new Logger(SalaryListener.name);

  constructor(
    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRecordRepo: Repository<SalaryRecordEntity>,
    private readonly calculator: SalaryCalculator,
  ) {}

  @OnEvent('lesson.completed')
  async handleLessonCompleted(event: LessonCompletedEvent) {
    this.logger.log(`Received lesson.completed event for lesson ${event.lessonId}`);

    // 幂等检查：如果已生成工资，跳过
    const existing = await this.salaryRecordRepo.findOne({
      where: { lessonId: event.lessonId },
    });

    if (existing) {
      this.logger.log(`Salary record already exists for lesson ${event.lessonId}, skipping`);
      return;
    }

    try {
      // 计算工资
      const record = await this.calculator.calculate(event);

      // 保存记录
      await this.salaryRecordRepo.save(record);

      this.logger.log(`Salary record created for lesson ${event.lessonId}, amount: ${record.amount}`);
    } catch (error) {
      this.logger.error(
        `Failed to calculate salary for lesson ${event.lessonId}: ${error.message}`,
        error instanceof Error ? error.stack : undefined,
      );
      // 不抛出异常，避免影响主流程
    }
  }
}
