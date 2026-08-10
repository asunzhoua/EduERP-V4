/**
 * 课时变更审计：动作类型与来源。
 * 用于记录每一次课时「分配类」变更（增加/删除/覆盖），
 * 由管理员/导入/优惠活动/合同创建触发，供管理端追溯。
 */
export enum LessonAdjustmentAction {
  /** 增加课时 */
  ADD = 'ADD',
  /** 减少课时 */
  DELETE = 'DELETE',
  /** 覆盖设置（前后剩余课时不变，仅调整总额等） */
  SET = 'SET',
}

export enum LessonAdjustmentSource {
  /** 管理员在后台手动调整 */
  ADMIN_MANUAL = 'ADMIN_MANUAL',
  /** 批量导入 */
  IMPORT = 'IMPORT',
  /** 优惠活动（赠送/扣减） */
  PROMO = 'PROMO',
  /** 新建合同 */
  CONTRACT_CREATE = 'CONTRACT_CREATE',
}
