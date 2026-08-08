/**
 * 相关业务实体的类型常量（Mimo P2 采纳：用常量替代裸字符串）。
 * 存于 wechat_message_log.relatedEntityType，供幂等与审计。
 */
export const RELATED_ENTITY = {
  LESSON: 'lesson',
} as const;

export type RelatedEntityType =
  (typeof RELATED_ENTITY)[keyof typeof RELATED_ENTITY];
