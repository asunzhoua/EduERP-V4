// pages/teacher/student-detail.js
const { get } = require('../../utils/request');

Page({
  data: {
    studentCode: '',
    student: null,
    classes: [],
    loading: true,
    error: null,
    totalCompletedLessons: 0,
    totalLessons: 0,
    overallProgress: 0
  },

  onLoad(options) {
    // 角色守卫：学生不允许访问教师页面
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    if (role === 'Student' || role === 'Parent') {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

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

      const totalCompletedLessons = classes.reduce((sum, c) => sum + (c.completedLessons || 0), 0);
      const totalLessons = classes.reduce((sum, c) => sum + (c.totalLessons || 0), 0);
      const overallProgress = totalLessons > 0 ? Math.round(totalCompletedLessons / totalLessons * 100) : 0;

      this.setData({
        student,
        classes,
        loading: false,
        totalCompletedLessons,
        totalLessons,
        overallProgress
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

  // 跳看出勤记录（从所属班级进入，取第一个班级）
  goToLessonRecord() {
    const classes = this.data.classes;
    if (classes && classes.length > 0) {
      wx.navigateTo({
        url: `/pages/teacher/lesson-record?classCode=${classes[0].classCode}`,
        fail() {
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    } else {
      wx.showToast({ title: '该学生暂无班级信息', icon: 'none' });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  // 重试加载
  retryLoad() {
    if (this.data.studentCode) {
      this.loadData(this.data.studentCode);
    }
  }
});
