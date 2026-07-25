import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SalaryRecordStatus } from '../enums/salary.enums';

/**
 * 工资记录实体
 *
 * 每次 Lesson Finished 事件触发产生的工资计算结果。
 * 每条记录对应一个具体课时（Lesson），关联考勤（Attendance）和使用的规则（SalaryRule）。
 *
 * 核心原则：工资不是输入数据，而是 Lesson Finished 事件产生的业务结果。
 * - 当 Lesson 状态变为 FINISHED 时，系统根据教师的 ACTIVE SalaryRule 自动计算工资
 * - 记录包含完整的计算依据（规则版本号、使用的规则 ID）
 * - 支持状态流转：PENDING → CONFIRMED → PAID
 *
 * @see docs/SALARY-DATA-MODEL-DESIGN.md
 * @see docs/SALARY-DATABASE-DESIGN.md
 */
@Entity('salary_record')
export class SalaryRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── 关联 ───

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;

  @Column({ type: 'bigint' })
  @Index()
  lessonId: number;

  @Column({ type: 'bigint', nullable: true })
  attendanceId: number | null;

  @Column({ type: 'bigint' })
  @Index()
  salaryRuleId: number;

  // ─── 规则版本 ───

  @Column({ type: 'varchar', length: 20 })
  ruleVersion: string;

  // ─── 金额 ───

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // ─── 课时信息 ───

  @Column({ type: 'date' })
  @Index()
  lessonDate: string;

  @Column({ type: 'int' })
  duration: number;

  // ─── 状态 ───

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
