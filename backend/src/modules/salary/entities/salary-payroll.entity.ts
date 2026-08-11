import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * 发放批次
 *
 * 按月份把已确认的工资条打包成一批，支持状态流转与银行代发导出。
 * DRAFT → CONFIRMED → PAID → CLOSED；detail 存 slipId 列表。
 *
 * @see docs/SALARY-DEEP-ANALYSIS-AND-FULLCHAIN-ROADMAP.md
 */
export enum PayrollStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  CLOSED = 'CLOSED',
}

@Entity('salary_payroll')
@Unique(['batchNo'])
export class SalaryPayrollEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'char', length: 7 })
  @Index()
  month: string;

  @Column({ type: 'varchar', length: 30 })
  batchNo: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: PayrollStatus,
    default: PayrollStatus.DRAFT,
  })
  @Index()
  status: PayrollStatus;

  /** 明细：{ slipIds: number[], teacherCount, slipCount } */
  @Column({ type: 'json', nullable: true })
  detail: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;
}
