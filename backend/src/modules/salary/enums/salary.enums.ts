/**
 * 薪酬规则类型
 *
 * 规则 `type` 决定课时费的计费方式；底薪/绩效/扣款通过 `config` JSON 配置。
 *
 * PER_LESSON   — 固定课时费（每上一次课固定费用）
 * PER_DAY      — 按天计费（当天有课即一次固定费用）
 * PER_HEAD     — 按人数（每出勤学生单价，可配人数阶梯）
 * TIER         — 阶梯课时费（累计课时阶梯，如 1-20@30 / 21+@35）
 * PART_TIME    — 兼职（固定一次课，可自定义）
 * OUTING       — 外出课（固定一次课时费用）
 * MONTHLY      — 固定月薪（每月一条 BASE 汇总，不随课时）
 * HOURLY       — 历史遗留，按小时语义并入 PER_LESSON（迁移后仅作兼容）
 */
export enum SalaryRuleType {
  PER_LESSON = 'PER_LESSON',
  PER_DAY = 'PER_DAY',
  PER_HEAD = 'PER_HEAD',
  TIER = 'TIER',
  PART_TIME = 'PART_TIME',
  OUTING = 'OUTING',
  MONTHLY = 'MONTHLY',
  HOURLY = 'HOURLY',
}

/**
 * 工资记录来源
 *
 * LESSON_FEE — 每课一条（lessonId 非空）
 * BASE       — 底薪汇总（lessonId 空，按 teacherId + month 一条）
 * DAY        — 按天汇总（lessonId 空，按 teacherId + month + 日期一条）
 * BONUS      — 绩效奖励（lessonId 空）
 * ALLOWANCE  — 津贴（通勤/住房/高温/其他，按 teacherId + month 汇总一条）
 * DEDUCTION  — 扣款（请假/其他，按 teacherId + month 汇总一条）
 * OUTING     — 外派课时（每笔一条，lessonId 存 outing_record.id，独立来源避免与 LESSON_FEE 的 lessonId 冲突）
 */
export enum SalaryRecordSource {
  LESSON_FEE = 'LESSON_FEE',
  BASE = 'BASE',
  DAY = 'DAY',
  BONUS = 'BONUS',
  ALLOWANCE = 'ALLOWANCE',
  DEDUCTION = 'DEDUCTION',
  OUTING = 'OUTING',
}

/**
 * 教师聘用形式（教师薪资档案）
 *
 * FULL_TIME — 全职（底薪 + 课时费）
 * PART_TIME — 兼职
 * OUTER     — 外聘
 */
export enum TeacherEmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  OUTER = 'OUTER',
}

/**
 * 外派课时记录状态
 *
 * PENDING   — 待确认
 * CONFIRMED — 已确认（仅 CONFIRMED 计入结算）
 */
export enum OutingRecordStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
}

/**
 * 津贴类型（教师薪资档案 / 规则 config.allowances）
 */
export enum AllowanceType {
  COMMUTING = 'COMMUTING',
  HOUSING = 'HOUSING',
  HIGH_TEMP = 'HIGH_TEMP',
  OTHER = 'OTHER',
}

/**
 * 扣款类型（教师薪资档案 / 规则 config.deductions）
 */
export enum DeductionType {
  LEAVE = 'LEAVE',
  OTHER = 'OTHER',
}

/**
 * 工资记录状态
 *
 * PENDING  — 结算生成，待审批
 * APPROVED — 已审批
 * PAID     — 已发放（锁定，不可修改）
 */
export enum SalaryRecordStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
}
