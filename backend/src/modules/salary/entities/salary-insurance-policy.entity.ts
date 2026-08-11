import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 五险一金政策版本表（地方差异）
 *
 * 各城市社保/公积金比例与基数上下限差异大、每年调整，故做成「城市 × 生效区间」多版本。
 * 同城市多版本：生成工资条时取「当月生效」一条，并把版本快照写入 salary_slip.detail。
 *
 * ratios:         个人比例 { pension, medical, unemployment, housingFund }
 * employerRatios: 单位比例（留档用，可空）
 * socialBase:     默认估算基数（教师可覆盖）；socialBaseMin/Max 城市上下限用于 clamp。
 *
 * @see docs/SALARY-DEEP-ANALYSIS-AND-FULLCHAIN-ROADMAP.md
 */
@Entity('salary_insurance_policy')
export class SalaryInsurancePolicyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  city: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'date' })
  @Index()
  effectiveFrom: string;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  /** 缴费基数下限（城市社平 60%） */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  socialBaseMin: number | null;

  /** 缴费基数上限（城市社平 300%） */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  socialBaseMax: number | null;

  /** 默认估算基数（教师可覆盖） */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  socialBase: number | null;

  /** 个人比例 { pension, medical, unemployment, housingFund } */
  @Column({ type: 'json', nullable: true })
  ratios: Record<string, any> | null;

  /** 单位比例（留档，可空） */
  @Column({ type: 'json', nullable: true })
  employerRatios: Record<string, any> | null;

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
