import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import {
  SalaryRecordStatus,
  SalaryRecordSource,
} from '../enums/salary.enums';

/**
 * 工资记录实体
 *
 * 月度结算服务（SalarySettlementService.settle）基于当月 FINISHED 课时 + 出勤
 * 统一批量生成，不再由 lesson.completed 事件即时写入。
 *
 * - LESSON_FEE：每课一条，lessonId 非空，amount 为单课课时费
 * - BASE：底薪一条，lessonId 空，按 (teacherId, month) 唯一
 * - DAY：按天一条，lessonId 空，按 (teacherId, month, 日期) 唯一
 * - BONUS / DEDUCTION：绩效/扣款，lessonId 空
 *
 * 状态机：PENDING → APPROVED → PAID；PAID 锁定不可改。
 * 幂等：唯一索引 (teacherId, month, source, lessonId) + settle 先查重再插。
 * 审计：detail JSON 记录 { ruleId, ruleSnapshot, headcount, feeMode, tierLevel, amount, calcFormula }。
 */
@Entity('salary_record')
@Unique(['teacherId', 'month', 'source', 'lessonId'])
export class SalaryRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── 关联 ───

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;

  /** LESSON_FEE 记录 = 课时 id；BASE/DAY/BONUS/DEDUCTION 记录为 NULL */
  @Column({ type: 'bigint', nullable: true })
  @Index()
  lessonId: number | null;

  @Column({ type: 'bigint', nullable: true })
  attendanceId: number | null;

  @Column({ type: 'bigint' })
  @Index()
  salaryRuleId: number;

  // ─── 结算维度 ───

  /** 记录来源：LESSON_FEE / BASE / DAY / BONUS / DEDUCTION */
  @Column({ type: 'varchar', length: 20, default: SalaryRecordSource.LESSON_FEE })
  @Index()
  source: SalaryRecordSource;

  /** 结算月份 'YYYY-MM'（结算维度，唯一索引组成部分） */
  @Column({ type: 'char', length: 7 })
  @Index()
  month: string;

  // ─── 规则版本 ───

  @Column({ type: 'varchar', length: 50 })
  ruleVersion: string;

  // ─── 金额 ───

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // ─── 课时信息 ───

  @Column({ type: 'date', nullable: true })
  @Index()
  lessonDate: string | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  /** 该课出勤学生数（DEDUCTIBLE_STATUSES 计数），PER_HEAD / 审计用 */
  @Column({ type: 'int', nullable: true })
  studentCount: number | null;

  // ─── 审计明细 ───

  /** 计算过程审计：{ ruleId, ruleSnapshot, headcount, feeMode, tierLevel, amount, calcFormula } */
  @Column({ type: 'json', nullable: true })
  detail: Record<string, any> | null;

  // ─── 状态 ───

  /** 无适用规则等异常场景标记为待人工审核（不静默丢失） */
  @Column({ type: 'boolean', default: false })
  @Index()
  needsReview: boolean;

  @Column({
    type: 'enum',
    enum: SalaryRecordStatus,
    default: SalaryRecordStatus.PENDING,
  })
  @Index()
  status: SalaryRecordStatus;

  // ─── 备注 ───

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ─── 审计字段 ───

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;
}
