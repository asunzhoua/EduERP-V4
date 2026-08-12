// pkgTeacher/pages/course-form.js
const { get, post, put } = require('../../utils/request');

const SUBJECT_LABELS = {
  MATH: '数学', ENGLISH: '英语', CHINESE: '语文', PHYSICS: '物理',
  CHEMISTRY: '化学', ART: '美术', MUSIC: '音乐', DANCE: '舞蹈',
  SPORTS: '体育', CODING: '编程', OTHER: '其他'
};
const SUBJECT_VALUES = Object.keys(SUBJECT_LABELS);

const TYPE_LABELS = {
  INDIVIDUAL: '一对一', GROUP: '班课', TRIAL: '体验课', CAMP: '集训营'
};
const TYPE_VALUES = Object.keys(TYPE_LABELS);

Page({
  data: {
    isEdit: false,       // 编辑模式（带 code 进入）
    code: '',            // 编辑模式课程编码
    loading: false,      // 编辑模式预填加载中
    submitting: false,   // 提交中，防重复

    // 课程基础信息
    name: '',
    subject: '',
    subjectIndex: -1,
    subjectNames: SUBJECT_VALUES.map(function (v) { return SUBJECT_LABELS[v]; }),
    subjectValues: SUBJECT_VALUES,
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
    note: ''
  },

  onLoad(options) {
    const { code } = options;
    if (code) {
      this.setData({ isEdit: true, code });
      wx.setNavigationBarTitle({ title: '编辑课程' });
      this.loadCourseDetail(code);
    } else {
      wx.setNavigationBarTitle({ title: '创建课程' });
    }
  },

  // 编辑模式：预填课程详情
  async loadCourseDetail(code) {
    this.setData({ loading: true });
    try {
      const course = await get('/courses/' + code);
      if (!course) return;
      const subjectIndex = SUBJECT_VALUES.indexOf(course.subject);
      const typeIndex = TYPE_VALUES.indexOf(course.type);
      this.setData({
        name: course.name || '',
        subject: course.subject || '',
        subjectIndex: subjectIndex >= 0 ? subjectIndex : -1,
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

  // 学科下拉
  onSubjectChange(e) {
    const index = Number(e.detail.value);
    this.setData({ subjectIndex: index, subject: SUBJECT_VALUES[index] });
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
    if (!totalHours || Number(totalHours) <= 0) {
      wx.showToast({ title: '请填写总课时(小时)', icon: 'none' });
      return;
    }
    if (!totalLessons || Number(totalLessons) <= 0) {
      wx.showToast({ title: '请填写总课次数', icon: 'none' });
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
      totalHours: Number(totalHours),
      totalLessons: Number(totalLessons),
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
