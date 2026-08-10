/**
 * 课时来源标记（台账追溯）。
 * 用于区分课时由谁/何种方式创建，供管理端追溯每个课时来源。
 */
export enum LessonSource {
  /** 管理员批量排课（一键排课） */
  ADMIN_BATCH = 'ADMIN_BATCH',
  /** 管理员手动创建 */
  ADMIN_MANUAL = 'ADMIN_MANUAL',
  /** 教师端手动创建 */
  TEACHER_MANUAL = 'TEACHER_MANUAL',
}
