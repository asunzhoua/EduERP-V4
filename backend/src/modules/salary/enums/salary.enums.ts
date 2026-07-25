/**
 * 薪酬规则类型
 *
 * PER_LESSON — 按课时计费（纯课时费）
 * HOURLY    — 按小时计费
 * MONTHLY   — 按月固定薪资
 *
 * 注：完整的薪酬模式扩展（LESSON_FIXED / BASE_PLUS_LESSON / BASE_PLUS_TIER / CUSTOM_ENGINE）
 * 见 SALARY-DATABASE-DESIGN.md, 后续 Phase 会逐步引入。
 */
export enum SalaryRuleType {
  PER_LESSON = 'PER_LESSON',
  HOURLY = 'HOURLY',
  MONTHLY = 'MONTHLY',
}

/**
 * 工资记录状态
 *
 * PENDING   — 待确认（计算引擎生成后默认状态）
 * CONFIRMED — 已确认（管理员审核确认）
 * PAID      — 已支付（财务完成支付）
 */
export enum SalaryRecordStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
}
