import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { SalaryRecordStatus } from '../enums/salary.enums';

/**
 * 工资条
 *
 * 由当月 salary_record 聚合生成（独立服务 SalarySlipService，不塞进 settle）：
 *   grossAmount = Σ 收入 source 金额（BASE/DAY/LESSON_FEE/ALLOWANCE/BONUS/OUTING，不含扣款）
 *   deductionAmount = |Σ DEDUCTION 金额|（考勤/其他扣款，单列在应发与实发之间）
 *   socialAmount = 个人五险一金（档案覆盖优先，否则取当期 insurance policy）
 *   taxAmount = 月度估算个税（(gross − social − 起征点 − 专项附加) → 税率表）
 *   netAmount = gross − deduction − social − tax
 *
 * detail 含：收入分项（按 source 汇总）、扣款快照、个税/五险政策快照、计算过程。
 * UNIQUE(teacherId, month) 幂等；status 置 PAID 时联动当月 salary_record 置 PAID。
 *
 * @see docs/SALARY-DEEP-ANALYSIS-AND-FULLCHAIN-ROADMAP.md
 */
@Entity('salary_slip')
@Unique(['teacherId', 'month'])
export class SalarySlipEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;

  @Column({ type: 'char', length: 7 })
  @Index()
  month: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  deductionAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  socialAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  netAmount: number;

  /** 计算过程 + 政策快照（审计留痕） */
  @Column({ type: 'json', nullable: true })
  detail: Record<string, any> | null;

  @Column({
    type: 'enum',
    enum: SalaryRecordStatus,
    default: SalaryRecordStatus.PENDING,
  })
  @Index()
  status: SalaryRecordStatus;

  @Column({ type: 'boolean', default: false })
  needsReview: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;
}
