// pages/teacher/student-detail.js
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
      this.setData({
        error: err.message || '加载失败',
        student: null,
        classes: [],
        loading: false
      });
    }
  },

  // 跳转班级详情
  goToClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/class-detail?code=${code}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 跳转出勤记录
  goToLessonRecord() {
    wx.navigateTo({
      url: `/pages/teacher/lesson-record`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 重试加载
  retryLoad() {
    if (this.data.studentCode) {
      this.loadData(this.data.studentCode);
    }
  }
});
