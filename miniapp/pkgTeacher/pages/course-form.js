// pkgTeacher/pages/course-form.js
const { get, post, put } = require('../../utils/request');
const {
  getSubjectGroups,
  getSubjectMap,
  addSubject,
  CATEGORY_LABELS,
} = require('../../utils/subjects');

const TYPE_LABELS = {
  INDIVIDUAL: '一对一', GROUP: '班课', TRIAL: '体验课', CAMP: '集训营'
};
const TYPE_VALUES = Object.keys(TYPE_LABELS);

const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS);
const CATEGORY_NAMES = CATEGORY_VALUES.map(function (c) { return CATEGORY_LABELS[c]; });

Page({
  data: {
    isEdit: false,       // 编辑模式（带 code 进入）
    code: '',            // 编辑模式课程编码
    loading: false,      // 编辑模式预填加载中
    submitting: false,   // 提交中，防重复

    // 课程基础信息
    name: '',
    subject: '',         // 学科 code
    subjectName: '',     // 学科中文名（展示）
    type: '',
    typeIndex: -1,
    typeNames: TYPE_VALUES.map(function (v) { return TYPE_LABELS[v]; }),
    typeValues: TYPE_VALUES,

    // 内容指标
    totalHours: '',
    totalLessons: '',
    defaultDuration: '',

    // 描述 / 备注
    description: '',
    note: '',

    // 学科分组弹窗
    subjectModal: false,
    subjectGroups: [],
    expandedMap: {},     // { category: true } 分组展开状态
    subjectLoaded: false,

    // 新增学科
    subjectAddMode: false,
    newSubjectName: '',
    newSubjectCategoryIndex: 0,
    newSubjectCategoryNames: CATEGORY_NAMES,
    newSubjectCategoryValues: CATEGORY_VALUES,
    addingSubject: false,
  },

  onLoad(options) {
    const { code } = options;
    this.loadSubjectGroups();
    if (code) {
      this.setData({ isEdit: true, code });
      wx.setNavigationBarTitle({ title: '编辑课程' });
      this.loadCourseDetail(code);
    } else {
      wx.setNavigationBarTitle({ title: '创建课程' });
    }
  },

  // 拉取学科目录（分组）；编辑模式若已设 subject，顺带补中文名
  async loadSubjectGroups() {
    const groups = await getSubjectGroups();
    const expandedMap = {};
    groups.forEach(function (g) { expandedMap[g.category] = true; });
    const patch = { subjectGroups: groups, expandedMap: expandedMap, subjectLoaded: true };
    if (this.data.subject && !this.data.subjectName) {
      const map = await getSubjectMap();
      patch.subjectName = map[this.data.subject] || this.data.subject;
    }
    this.setData(patch);
  },

  // 编辑模式：预填课程详情
  async loadCourseDetail(code) {
    this.setData({ loading: true });
    try {
      const course = await get('/courses/' + code);
      if (!course) return;
      const typeIndex = TYPE_VALUES.indexOf(course.type);
      const map = await getSubjectMap();
      this.setData({
        name: course.name || '',
        subject: course.subject || '',
        subjectName: (course.subject && map[course.subject]) || course.subject || '',
        type: course.type || '',
        typeIndex: typeIndex >= 0 ? typeIndex : -1,
        totalHours: course.totalHours != null ? String(course.totalHours) : '',
        totalLessons: course.totalLessons != null ? String(course.totalLessons) : '',
        defaultDuration: course.defaultDuration != null ? String(course.defaultDuration) : '',
        description: course.description || '',
        note: course.note || '',
        loading: false
      });
    } catch (err) {
      console.error('[CourseForm] 加载课程详情失败:', err);
      this.setData({ loading: false });
    }
  },

  // 课程名称
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  // 学科弹窗
  openSubjectModal() {
    this.setData({ subjectModal: true, subjectAddMode: false });
  },

  closeSubjectModal() {
    this.setData({ subjectModal: false, subjectAddMode: false });
  },

  noop() {},

  toggleSubjectGroup(e) {
    const cat = e.currentTarget.dataset.category;
    const expandedMap = Object.assign({}, this.data.expandedMap);
    expandedMap[cat] = !expandedMap[cat];
    this.setData({ expandedMap: expandedMap });
  },

  selectSubject(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({ subject: code, subjectName: name, subjectModal: false, subjectAddMode: false });
  },

  // 新增学科
  openAddSubject() {
    this.setData({ subjectAddMode: true, newSubjectName: '', newSubjectCategoryIndex: 0 });
  },

  cancelAddSubject() {
    this.setData({ subjectAddMode: false });
  },

  onAddSubjectNameInput(e) {
    this.setData({ newSubjectName: e.detail.value });
  },

  onAddSubjectCategoryChange(e) {
    this.setData({ newSubjectCategoryIndex: Number(e.detail.value) });
  },

  async confirmAddSubject() {
    const name = this.data.newSubjectName.trim();
    if (!name) {
      wx.showToast({ title: '请输入学科名称', icon: 'none' });
      return;
    }
    if (this.data.addingSubject) return;
    this.setData({ addingSubject: true });
    try {
      const category = this.data.newSubjectCategoryValues[this.data.newSubjectCategoryIndex] || 'OTHER';
      const created = await addSubject({ name: name, category: category });
      const code = (created && created.code) || '';
      const displayName = (created && created.name) || name;
      await this.loadSubjectGroups(); // 刷新分组
      this.setData({
        subject: code,
        subjectName: displayName,
        subjectAddMode: false,
        subjectModal: false,
      });
      wx.showToast({ title: '学科已添加', icon: 'success' });
    } catch (err) {
      console.error('[CourseForm] 新增学科失败:', err);
      // request.js 已 toast 后端错误，留在弹窗内
    } finally {
      this.setData({ addingSubject: false });
    }
  },

  // 课程类型下拉
  onTypeChange(e) {
    const index = Number(e.detail.value);
    this.setData({ typeIndex: index, type: TYPE_VALUES[index] });
  },

  // 总课时(小时)
  onTotalHoursInput(e) {
    this.setData({ totalHours: e.detail.value });
  },

  // 总课次数
  onTotalLessonsInput(e) {
    this.setData({ totalLessons: e.detail.value });
  },

  // 每节分钟数
  onDefaultDurationInput(e) {
    this.setData({ defaultDuration: e.detail.value });
  },

  // 课程描述
  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  // 内部备注
  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  // 提交
  async onSubmit() {
    if (this.data.submitting) return;

    const { name, subject, type, totalHours, totalLessons, defaultDuration, description, note, isEdit, code } = this.data;

    // 校验
    if (!name.trim()) {
      wx.showToast({ title: '请填写课程名称', icon: 'none' });
      return;
    }
    if (!subject) {
      wx.showToast({ title: '请选择学科', icon: 'none' });
      return;
    }
    if (!type) {
      wx.showToast({ title: '请选择课程类型', icon: 'none' });
      return;
    }
    if (totalHours && Number(totalHours) <= 0) {
      wx.showToast({ title: '总课时需大于 0', icon: 'none' });
      return;
    }
    if (totalLessons && Number(totalLessons) <= 0) {
      wx.showToast({ title: '总课次数需大于 0', icon: 'none' });
      return;
    }
    if (!defaultDuration || Number(defaultDuration) <= 0) {
      wx.showToast({ title: '请填写每节课分钟数', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    const payload = {
      name: name.trim(),
      subject,
      type,
      totalHours: totalHours ? Number(totalHours) : undefined,
      totalLessons: totalLessons ? Number(totalLessons) : undefined,
      defaultDuration: Number(defaultDuration),
      description: description.trim() || undefined,
      note: note.trim() || undefined
    };

    try {
      if (isEdit) {
        await put('/courses/' + code, payload);
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(function () { wx.navigateBack(); }, 1200);
      } else {
        const data = await post('/courses', payload);
        const newCode = (data && data.courseCode) || '';
        wx.showToast({ title: '创建成功', icon: 'success' });
        setTimeout(function () {
          if (newCode) {
            wx.redirectTo({ url: '/pkgTeacher/pages/course-detail?code=' + newCode });
          } else {
            wx.navigateBack();
          }
        }, 1200);
      }
    } catch (err) {
      console.error('[CourseForm] 提交失败:', err);
      // request.js 已 toast 后端错误，留在页内
    } finally {
      this.setData({ submitting: false });
    }
  }
});
