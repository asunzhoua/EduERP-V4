import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SalaryRuleType } from '../enums/salary.enums';

/**
 * 薪酬规则实体
 *
 * 管理员配置的工资规则，决定教师工资的计算方式。
 * 支持按课程类型设置费用、按教师等级系数、以及特殊规则（如补课不计费）。
 *
 * 一条规则可绑定到特定 courseType 和/或 teacherLevel；
 * 当两者都匹配时，取最精确的规则（courseType + teacherLevel 组合优先）。
 *
 * 设计原则：工资不是输入数据，而是 Lesson Finished 事件产生的业务结果。
 * 后续 Phase 将引入更丰富的薪酬模式（含底薪+阶梯课时费、自定义规则引擎等），
 * 届时本实体将作为规则配置的基础载体。
 *
 * @see docs/SALARY-DATA-MODEL-DESIGN.md
 * @see docs/SALARY-DATABASE-DESIGN.md
 */
@Entity('salary_rule')
export class SalaryRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── 规则标识 ───

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: SalaryRuleType })
  @Index()
  type: SalaryRuleType;

  // ─── 金额配置 ───

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  baseAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.0 })
  multiplier: number;

  // ─── 适用范围 ───

  @Column({ type: 'varchar', length: 50, nullable: true })
  courseType: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  teacherLevel: string | null;

  // ─── 状态 ───

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  // ─── 备注 ───

  @Column({ type: 'text', nullable: true })
  note: string | null;

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
