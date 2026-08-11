import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SalaryRuleType, TeacherEmploymentType } from '../enums/salary.enums';

/**
 * 教师薪资档案（G8 个性化载体）
 *
 * 每位老师一条生效档案，作为该老师当月结算的「个人规则」：
 * - 有 active 档案 → 结算用档案（档案优先），不参与全局规则打分
 * - 无档案 → 回落全局 salary_rule 打分匹配
 *
 * salaryConfig 复用 SalaryRuleConfigDto（底薪/课时费/阶梯/绩效/津贴/扣款），
 * allowances/deductions 为该老师个人津贴与扣款（通勤/住房/高温/请假/其他）。
 *
 * 审计：结算时对档案做 ruleVersion + ruleSnapshot，历史月不受后续改档案影响。
 *
 * @see docs/SALARY-DEEP-ANALYSIS-AND-FULLCHAIN-ROADMAP.md (G8)
 */
@Entity('teacher_salary_profile')
export class TeacherSalaryProfileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── 归属 ───

  @Column({ type: 'bigint' })
  @Index({ unique: true })
  teacherId: number;

  // ─── 聘用形式 ───

  @Column({
    type: 'enum',
    enum: TeacherEmploymentType,
    default: TeacherEmploymentType.FULL_TIME,
  })
  employmentType: TeacherEmploymentType;

  // ─── 薪酬结构 ───

  /** 计费类型（PER_LESSON / TIER / MONTHLY ...），与 salaryConfig 配套 */
  @Column({ type: 'varchar', length: 20 })
  @Index()
  ruleType: SalaryRuleType;

  /** 扩展配置（SalaryRuleConfigDto 强类型校验后落库）：底薪/课时费/阶梯/绩效 */
  @Column({ type: 'json', nullable: true })
  salaryConfig: Record<string, any> | null;

  /** 个人津贴：[{ type, name, amount }]（COMMUTING/HOUSING/HIGH_TEMP/OTHER） */
  @Column({ type: 'json', nullable: true })
  allowances: Record<string, any>[] | null;

  /** 个人扣款：[{ type, name, amount }]（LEAVE/OTHER） */
  @Column({ type: 'json', nullable: true })
  deductions: Record<string, any>[] | null;

  // ─── 五险一金与个税（P2/P3） ───

  /** 五险一金参保城市（如：北京/宁波）；缺省取系统内置默认 */
  @Column({ type: 'varchar', length: 50, nullable: true })
  city: string | null;

  /** 五险一金缴费基数（覆盖城市政策；缺省取当期 insurance policy） */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  socialBase: number | null;

  /** 五险一金个人比例 { pension, medical, unemployment, housingFund }（覆盖城市政策） */
  @Column({ type: 'json', nullable: true })
  socialRatios: Record<string, any> | null;

  /** 个税专项附加扣除 [{ type, amount }]（子女教育/赡养老人/房贷利息/房租等） */
  @Column({ type: 'json', nullable: true })
  taxSpecialDeductions: Record<string, any>[] | null;

  // ─── 生效区间 ───

  @Column({ type: 'date', nullable: true })
  effectiveFrom: string | null;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  // ─── 状态 ───

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

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
