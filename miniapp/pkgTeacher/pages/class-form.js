// pkgTeacher/pages/class-form.js
const { get, post, put } = require('../../utils/request');

const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

Page({
  data: {
    isEdit: false,       // 编辑模式（带 code 进入）
    code: '',            // 编辑模式班级编码
    loading: false,      // 初始数据（课程/教室/班级详情）加载中
    submitting: false,   // 提交中，防重复

    // 课程下拉
    courses: [],
    courseNames: [],
    courseIndex: 0,
    courseCode: '',

    // 班级基础信息
    name: '',
    startDate: '',

    // 星期多选（数字数组，0=周日 .. 6=周六）
    dayOfWeek: [],
    dayLabels: DAY_LABELS,
    selectedDaysText: '',

    // 时间
    startTime: '',
    endTime: '',

    // 教室下拉（index 0 = 不分配）
    classrooms: [],
    classroomNames: ['不分配'],
    classroomIndex: 0,
    classroomId: '',

    // 容量 / 备注
    maxStudents: '',
    note: ''
  },

  onLoad(options) {
    const { code } = options;
    if (code) {
      this.setData({ isEdit: true, code });
      wx.setNavigationBarTitle({ title: '编辑班级' });
    } else {
      wx.setNavigationBarTitle({ title: '创建班级' });
    }
    // 先加载课程/教室，再预填班级详情（避免详情预填读到空课程列表）
    this.loadCoursesAndClassrooms().then(() => {
      if (code) {
        this.loadClassDetail(code);
      }
    });
  },

  // 加载课程与教室下拉数据
  async loadCoursesAndClassrooms() {
    this.setData({ loading: true });
    try {
      const [coursesData, classroomsData] = await Promise.all([
        get('/courses', { pageSize: 100 }),
        get('/classrooms')
      ]);
      const courses = (coursesData && coursesData.items) || [];
      const classrooms = (classroomsData && classroomsData.items) || [];
      this.setData({
        courses,
        courseNames: courses.map(function (c) { return c.name; }),
        classrooms,
        classroomNames: ['不分配'].concat(classrooms.map(function (c) { return c.name; })),
        loading: false
      });
    } catch (err) {
      console.error('[ClassForm] 加载课程/教室失败:', err);
      this.setData({ loading: false });
    }
  },

  // 编辑模式：预填班级详情
  async loadClassDetail(code) {
    try {
      const cls = await get('/classes/' + code);
      if (!cls) return;

      // 课程：优先在已加载列表中找到对应项，找不到则把当前课程补为第一项
      let courses = this.data.courses;
      let courseNames = this.data.courseNames;
      let courseIndex = 0;
      if (cls.courseCode) {
        const idx = courses.findIndex(function (c) { return c.courseCode === cls.courseCode; });
        if (idx >= 0) {
          courseIndex = idx;
        } else {
          const fallbackName = cls.courseName || cls.courseCode;
          courses = [{ name: fallbackName, courseCode: cls.courseCode }].concat(courses);
          courseNames = [fallbackName].concat(courseNames);
          courseIndex = 0;
        }
      }

      // 教室：index 0 = 不分配，找到则 +1
      let classroomIndex = 0;
      if (cls.classroomId) {
        const idx = this.data.classrooms.findIndex(function (c) {
          return String(c.id) === String(cls.classroomId);
        });
        if (idx >= 0) {
          classroomIndex = idx + 1;
        }
      }

      const dayOfWeek = Array.isArray(cls.dayOfWeek) ? cls.dayOfWeek.slice().sort(function (a, b) { return a - b; }) : [];

      this.setData({
        courses,
        courseNames,
        courseIndex,
        courseCode: cls.courseCode || '',
        name: cls.name || '',
        startDate: cls.startDate || '',
        dayOfWeek,
        selectedDaysText: this.computeDayText(dayOfWeek),
        startTime: cls.startTime || '',
        endTime: cls.endTime || '',
        classroomIndex,
        classroomId: cls.classroomId || '',
        maxStudents: cls.maxStudents != null ? String(cls.maxStudents) : '',
        note: cls.note || ''
      });
    } catch (err) {
      console.error('[ClassForm] 加载班级详情失败:', err);
      // request.js 已 toast 错误，留在页内
    }
  },

  computeDayText(dayOfWeek) {
    return dayOfWeek.map(function (d) { return DAY_LABELS[d]; }).join('、');
  },

  // 课程下拉
  onCourseChange(e) {
    const index = Number(e.detail.value);
    const item = this.data.courses[index];
    this.setData({
      courseIndex: index,
      courseCode: item ? item.courseCode : ''
    });
  },

  // 班级名称
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  // 开课日期
  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  // 星期多选切换
  onDayToggle(e) {
    const day = Number(e.currentTarget.dataset.day);
    let dayOfWeek = this.data.dayOfWeek.slice();
    const idx = dayOfWeek.indexOf(day);
    if (idx >= 0) {
      dayOfWeek.splice(idx, 1);
    } else {
      dayOfWeek.push(day);
    }
    dayOfWeek.sort(function (a, b) { return a - b; });
    this.setData({
      dayOfWeek,
      selectedDaysText: this.computeDayText(dayOfWeek)
    });
  },

  // 开始时间
  onStartTimeChange(e) {
    this.setData({ startTime: e.detail.value });
  },

  // 结束时间
  onEndTimeChange(e) {
    this.setData({ endTime: e.detail.value });
  },

  // 教室下拉
  onClassroomChange(e) {
    const index = Number(e.detail.value);
    const classrooms = this.data.classrooms;
    const classroomId = index === 0
      ? ''
      : (classrooms[index - 1] ? String(classrooms[index - 1].id) : '');
    this.setData({ classroomIndex: index, classroomId });
  },

  // 人数上限
  onMaxStudentsInput(e) {
    this.setData({ maxStudents: e.detail.value });
  },

  // 备注
  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  // 提交
  async onSubmit() {
    if (this.data.submitting) return;

    const { courseCode, name, startDate, dayOfWeek, startTime, endTime, classroomId, maxStudents, note, isEdit, code } = this.data;

    // 校验
    if (!courseCode) {
      wx.showToast({ title: '请选择课程', icon: 'none' });
      return;
    }
    if (!name.trim()) {
      wx.showToast({ title: '请填写班级名称', icon: 'none' });
      return;
    }
    if (!startDate) {
      wx.showToast({ title: '请选择开课日期', icon: 'none' });
      return;
    }
    if (dayOfWeek.length === 0) {
      wx.showToast({ title: '请至少选择一周中的一天', icon: 'none' });
      return;
    }
    if (!startTime) {
      wx.showToast({ title: '请选择开始时间', icon: 'none' });
      return;
    }
    if (!endTime) {
      wx.showToast({ title: '请选择结束时间', icon: 'none' });
      return;
    }
    if (endTime <= startTime) {
      wx.showToast({ title: '结束时间需晚于开始时间', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    const payload = {
      courseCode,
      name: name.trim(),
      startDate,
      dayOfWeek,
      startTime,
      endTime,
      classroomId: classroomId ? Number(classroomId) : undefined,
      maxStudents: maxStudents ? Number(maxStudents) : undefined,
      note: note.trim() || undefined
    };

    try {
      if (isEdit) {
        await put('/classes/' + code, payload);
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(function () { wx.navigateBack(); }, 1200);
      } else {
        const data = await post('/classes', payload);
        const newCode = (data && data.classCode) || '';
        wx.showToast({ title: '创建成功', icon: 'success' });
        setTimeout(function () {
          if (newCode) {
            wx.redirectTo({ url: '/pkgTeacher/pages/class-detail?code=' + newCode });
          } else {
            wx.navigateBack();
          }
        }, 1200);
      }
    } catch (err) {
      console.error('[ClassForm] 提交失败:', err);
      // request.js 已 toast 后端错误，留在页内
    } finally {
      this.setData({ submitting: false });
    }
  }
});
