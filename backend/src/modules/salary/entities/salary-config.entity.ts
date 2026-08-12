import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 工资模块全局配置（单例行 id=1）
 *
 * enabled：社保 + 个税 总开关。
 *  - 开启：工资条计算并展示 五险一金 / 个税，实发 = 应发 − 社保 − 个税；
 *  - 关闭（默认）：工资条不计算不展示社保/个税，实发 = 应发。
 *
 * 比例/税率自定义仍走 salary_insurance_policy / salary_tax_policy（政策 Tab）。
 */
@Entity('salary_config')
export class SalaryConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  /** 社保 + 个税 总开关，默认关闭 */
  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;
}
