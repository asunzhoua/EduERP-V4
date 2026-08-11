import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 个税政策版本表
 *
 * 版本化 + 生效区间：税率表 / 起征点政策一变，管理员新增版本，不覆盖旧版。
 * 结算/生成工资条时取「当月生效」的版本，并把版本快照写入 salary_slip.detail，
 * 历史月永不重算，保持已发放口径。
 *
 * brackets: [{ min, max, rate, quickDeduction }] 7 档超额累进；max=null 为最后一档。
 *
 * @see docs/SALARY-DEEP-ANALYSIS-AND-FULLCHAIN-ROADMAP.md
 */
@Entity('salary_tax_policy')
export class SalaryTaxPolicyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'date' })
  @Index()
  effectiveFrom: string;

  @Column({ type: 'date', nullable: true })
  @Index()
  effectiveTo: string | null;

  /** 起征点（月，元） */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5000 })
  taxThreshold: number;

  /** 7 档税率表 [{min,max,rate,quickDeduction}] */
  @Column({ type: 'json', nullable: true })
  brackets: Record<string, any>[] | null;

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
