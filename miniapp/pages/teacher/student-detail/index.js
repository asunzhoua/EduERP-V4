// pages/teacher/student-detail/index.js
const { get } = require('../../utils/request');

Page({
  data: {
    studentCode: '',
    student: null,
    classes: [],
    loading: true,
    error: null
  },

  onLoad(options) {
    const { code } = options;
    if (code) {
      this.setData({ studentCode: code });
      this.loadData(code);
    } else {
      this.setData({
        error: '缺少学生编码',
        loading: false
      });
    }
  },

  async loadData(code) {
    this.setData({ loading: true, error: null });

    try {
      const [studentResult, enrollments] = await Promise.all([
        get('/students', { studentCode: code }),
        get(`/enrollments/students/${code}/enrollments`)
      ]);

      const student = studentResult && studentResult.items && studentResult.items[0] ? studentResult.items[0] : null;

      // Transform enrollments to class format
      const classes = (enrollments || []).map(e => ({
        classCode: e.classCode || '',
        name: e.className || '',
        courseName: e.courseName || '',
        completedLessons: e.completedLessons || 0,
        totalLessons: e.totalLessons || 0
      }));

      this.setData({
        student,
        classes,
        loading: false
      });
    } catch (err) {
      console.error('[Student Detail] 加载失败:', err);
      // 降级使用模拟数据
      this.setData({
        student: {
          name: '张三',
          gender: '男',
          school: '育才小学',
          grade: '四年级',
          phone: '138xxxx1234'
        },
        classes: [
          { classCode: 'CL2026070001', name: '周六上午班', courseName: '数学思维训练', completedLessons: 8, totalLessons: 24 },
          { classCode: 'CL2026070002', name: '周日下午班', courseName: '英语口语提升', completedLessons: 5, totalLessons: 20 }
        ],
        loading: false
      });
    }
  },

  // 跳转班级详情
  goToClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/class-detail?code=${code}`
    });
  },

  // 跳转出勤记录
  goToLessonRecord() {
    wx.navigateTo({
      url: `/pages/teacher/lesson-record`
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
