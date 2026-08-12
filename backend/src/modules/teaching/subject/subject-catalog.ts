/**
 * 默认学科目录（种子数据 + 新建自定义学科时的分组枚举）。
 *
 * 学科已从固定枚举扩展为可编辑目录（subjects 表）。
 * - 默认 31 条，覆盖 学科培优 / 艺术类 / 体育类 / 益智科技类 / 语言表达类 / 其他 6 组
 * - 教师可通过 POST /subjects 新增自定义学科（code = SUBJ + 4 位序号）
 * - code 入库存（course.subject / contract.subject 存 code），name 供展示
 */
export const SUBJECT_CATEGORIES = [
  'ACADEMIC',
  'ART',
  'SPORT',
  'STEM',
  'LANG',
  'OTHER',
] as const;

export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

export interface SubjectCatalogItem {
  code: string;
  name: string;
  category: SubjectCategory;
  sortOrder: number;
}

export const DEFAULT_SUBJECTS: SubjectCatalogItem[] = [
  // ── 学科培优 ACADEMIC ──
  { code: 'MATH', name: '数学', category: 'ACADEMIC', sortOrder: 1 },
  { code: 'ENGLISH', name: '英语', category: 'ACADEMIC', sortOrder: 2 },
  { code: 'CHINESE', name: '语文', category: 'ACADEMIC', sortOrder: 3 },
  { code: 'PHYSICS', name: '物理', category: 'ACADEMIC', sortOrder: 4 },
  { code: 'CHEMISTRY', name: '化学', category: 'ACADEMIC', sortOrder: 5 },

  // ── 艺术类 ART ──
  { code: 'ART', name: '美术', category: 'ART', sortOrder: 10 },
  { code: 'MUSIC', name: '音乐', category: 'ART', sortOrder: 11 },
  { code: 'DANCE', name: '舞蹈', category: 'ART', sortOrder: 12 },
  { code: 'CALLIGRAPHY', name: '书法', category: 'ART', sortOrder: 13 },
  { code: 'SKETCH', name: '素描', category: 'ART', sortOrder: 14 },
  { code: 'CHINESE_PAINTING', name: '国画', category: 'ART', sortOrder: 15 },
  { code: 'HANDCRAFT', name: '手工', category: 'ART', sortOrder: 16 },
  { code: 'CERAMICS', name: '陶艺', category: 'ART', sortOrder: 17 },
  { code: 'INSTRUMENT', name: '乐器', category: 'ART', sortOrder: 18 },

  // ── 体育类 SPORT ──
  { code: 'SPORTS', name: '体育', category: 'SPORT', sortOrder: 20 },
  { code: 'SWIMMING', name: '游泳', category: 'SPORT', sortOrder: 21 },
  { code: 'BASKETBALL', name: '篮球', category: 'SPORT', sortOrder: 22 },
  { code: 'FOOTBALL', name: '足球', category: 'SPORT', sortOrder: 23 },
  { code: 'BADMINTON', name: '羽毛球', category: 'SPORT', sortOrder: 24 },
  { code: 'TAEKWONDO', name: '跆拳道', category: 'SPORT', sortOrder: 25 },

  // ── 益智/科技类 STEM ──
  { code: 'CODING', name: '编程', category: 'STEM', sortOrder: 30 },
  { code: 'GO', name: '围棋', category: 'STEM', sortOrder: 31 },
  { code: 'CHESS', name: '象棋', category: 'STEM', sortOrder: 32 },
  { code: 'LEGO', name: '乐高', category: 'STEM', sortOrder: 33 },
  { code: 'ROBOTICS', name: '机器人', category: 'STEM', sortOrder: 34 },
  { code: 'SCIENCE_EXP', name: '科学实验', category: 'STEM', sortOrder: 35 },

  // ── 语言表达类 LANG ──
  { code: 'ELOQUENCE', name: '口才', category: 'LANG', sortOrder: 40 },
  { code: 'READING', name: '阅读', category: 'LANG', sortOrder: 41 },
  { code: 'HANDWRITING', name: '硬笔书法', category: 'LANG', sortOrder: 42 },
  { code: 'FOCUS', name: '专注力', category: 'LANG', sortOrder: 43 },

  // ── 其他 OTHER ──
  { code: 'OTHER', name: '其他', category: 'OTHER', sortOrder: 99 },
];
