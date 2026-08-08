/**
 * 订阅消息模板定义（5 个，冻结设计文档 §3 / WECHAT-PRODUCTION-PLAN §2.1）。
 * templateId 从配置取，未配置则为空（前端展示占位、发送时静默 skip）。
 */

export interface WechatTemplate {
  templateType: string;
  name: string;
  title: string;
  fields: string[];
  fieldDescriptions: Record<string, string>;
}

export const WECHAT_TEMPLATES: WechatTemplate[] = [
  {
    templateType: 'CLASS_REMINDER',
    name: '上课提醒',
    title: '课程提醒',
    fields: ['thing1', 'thing2', 'time3', 'thing4'],
    fieldDescriptions: {
      thing1: '课程名称',
      thing2: '上课地点',
      time3: '上课时间',
      thing4: '温馨提示',
    },
  },
  {
    templateType: 'ATTENDANCE_NOTICE',
    name: '考勤通知',
    title: '考勤通知',
    fields: ['thing1', 'thing2', 'phrase3', 'time4'],
    fieldDescriptions: {
      thing1: '学生姓名',
      thing2: '课程名称',
      phrase3: '出勤状态',
      time4: '上课时间',
    },
  },
  {
    templateType: 'COURSE_CHANGE',
    name: '课时变动',
    title: '课时变动',
    fields: ['thing1', 'thing2', 'thing3', 'time4'],
    fieldDescriptions: {
      thing1: '课程名称',
      thing2: '变动类型',
      thing3: '变动说明',
      time4: '变动时间',
    },
  },
  {
    templateType: 'FEEDBACK_NOTICE',
    name: '课程反馈',
    title: '学习反馈',
    fields: ['thing1', 'thing2', 'thing3'],
    fieldDescriptions: {
      thing1: '课程名称',
      thing2: '教师姓名',
      thing3: '反馈摘要',
    },
  },
  {
    templateType: 'LEAVE_RESULT',
    name: '请假审批结果',
    title: '审批通知',
    fields: ['thing1', 'thing2', 'thing3', 'time4'],
    fieldDescriptions: {
      thing1: '请假课程',
      thing2: '审批结果',
      thing3: '审批人',
      time4: '审批时间',
    },
  },
];

/** 微信字段类型长度上限（设计文档 §10.2）：thing 20 字、phrase 10 字。 */
const FIELD_KEY_LIMITS: Record<string, number> = {
  thing: 20,
  phrase: 10,
};

/** 校验模板字段值是否超长；返回超长字段 key，无超长返回 null。 */
export function findOversizedField(
  templateType: string,
  data: Record<string, { value: string }>,
): string | null {
  const template = WECHAT_TEMPLATES.find(
    (t) => t.templateType === templateType,
  );
  if (!template) {
    return null;
  }
  for (const key of template.fields) {
    const entry = data[key];
    if (!entry || entry.value === undefined) {
      continue;
    }
    const limit = FIELD_KEY_LIMITS[key.replace(/[0-9]/g, '')];
    if (limit && entry.value.length > limit) {
      return key;
    }
  }
  return null;
}
