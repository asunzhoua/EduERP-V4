// utils/subjects.js
// 动态学科目录：GET /subjects 拉取默认 + 自定义学科，code 入库存、name 供展示。
// 模块级缓存，参照 child-context.js 的缓存模式；新增学科后 invalidateSubjects() 强制重拉。
const { get, post } = require('./request');

const CATEGORY_LABELS = {
  ACADEMIC: '学科培优',
  ART: '艺术类',
  SPORT: '体育类',
  STEM: '益智/科技类',
  LANG: '语言表达类',
  OTHER: '其他',
};

// 静态兜底：目录接口不可用时，默认 31 门仍能映射中文名（新增自定义学科仅靠目录）
const STATIC_SUBJECT_LABELS = {
  MATH: '数学', ENGLISH: '英语', CHINESE: '语文', PHYSICS: '物理', CHEMISTRY: '化学',
  ART: '美术', MUSIC: '音乐', DANCE: '舞蹈', CALLIGRAPHY: '书法', SKETCH: '素描',
  CHINESE_PAINTING: '国画', HANDCRAFT: '手工', CERAMICS: '陶艺', INSTRUMENT: '乐器',
  SPORTS: '体育', SWIMMING: '游泳', BASKETBALL: '篮球', FOOTBALL: '足球',
  BADMINTON: '羽毛球', TAEKWONDO: '跆拳道',
  CODING: '编程', GO: '围棋', CHESS: '象棋', LEGO: '乐高', ROBOTICS: '机器人',
  SCIENCE_EXP: '科学实验',
  ELOQUENCE: '口才', READING: '阅读', HANDWRITING: '硬笔书法', FOCUS: '专注力',
  OTHER: '其他',
};

let _subjectsCache = null;

// 拉取目录（可强制刷新）
function fetchSubjects(force) {
  if (!force && _subjectsCache) return Promise.resolve(_subjectsCache);
  return get('/subjects')
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      _subjectsCache = list;
      return list;
    })
    .catch(() => _subjectsCache || []);
}

// 失效目录缓存：新增学科成功后调用
function invalidateSubjects() {
  _subjectsCache = null;
}

// code → 中文名 映射表（目录优先，静态兜底）
function getSubjectMap() {
  return fetchSubjects().then((list) => {
    const map = {};
    list.forEach((s) => {
      if (s && s.code) map[s.code] = s.name;
    });
    // 兜底：目录未覆盖的默认码仍映射中文
    Object.keys(STATIC_SUBJECT_LABELS).forEach((code) => {
      if (!map[code]) map[code] = STATIC_SUBJECT_LABELS[code];
    });
    return map;
  });
}

// 按 category 分组，[{ category, label, items: [{ code, name }] }]
function getSubjectGroups() {
  return fetchSubjects().then((list) => {
    const groups = [];
    const buckets = {};
    list.forEach((s) => {
      if (!s || !s.code) return;
      const cat = s.category || 'OTHER';
      if (!buckets[cat]) {
        buckets[cat] = [];
        groups.push({ category: cat, label: CATEGORY_LABELS[cat] || cat, items: buckets[cat] });
      }
      buckets[cat].push({ code: s.code, name: s.name });
    });
    return groups;
  });
}

// 新增学科（幂等）：成功后失效缓存
function addSubject(payload) {
  return post('/subjects', {
    name: payload.name,
    category: payload.category,
  }).then((data) => {
    invalidateSubjects();
    return data;
  });
}

module.exports = {
  CATEGORY_LABELS,
  STATIC_SUBJECT_LABELS,
  fetchSubjects,
  invalidateSubjects,
  getSubjectMap,
  getSubjectGroups,
  addSubject,
};
