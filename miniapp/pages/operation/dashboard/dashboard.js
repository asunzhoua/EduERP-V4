const { get } = require('../../utils/request');
const { exportData } = require('../../utils/export');

Page({
  data: {
    loading: true,
    error: null,
    overview: null,
    lessons: null,
    students: null,
    teachers: null,
    finance: null,
    showExport: false,
  },

  onLoad() {
    // 权限控制：仅管理员可见导出按钮
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'ADMIN') {
      this.setData({ showExport: true });
    } else {
      this.setData({ showExport: false });
    }

    this.loadDashboard();
  },

  async loadDashboard() {
    this.setData({ loading: true, error: null });

    try {
      // 并行请求所有数据
      const [overview, lessons, students, teachers, finance] = await Promise.all([
        get('/dashboard/overview'),
        get('/dashboard/lessons'),
        get('/dashboard/students'),
        get('/dashboard/teachers'),
        get('/dashboard/finance'),
      ]);

      this.setData({
        overview,
        lessons,
        students,
        teachers,
        finance,
        loading: false,
      });
    } catch (err) {
      console.error('[Dashboard] 加载失败:', err);
      this.setData({
        error: '加载失败，请稍后重试',
        loading: false,
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    }
  },

  onPullDownRefresh() {
    this.loadDashboard().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // === 导出功能 ===

  async exportStudents() {
    wx.showLoading({ title: '导出中...' });
    try {
      await exportData('students', {}, 'csv');
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '导出失败',
        icon: 'none',
      });
    }
  },

  async exportLessons() {
    wx.showLoading({ title: '导出中...' });
    try {
      await exportData('lessons', {}, 'csv');
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '导出失败',
        icon: 'none',
      });
    }
  },

  async exportConsumption() {
    wx.showLoading({ title: '导出中...' });
    try {
      await exportData('consumption', {}, 'csv');
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '导出失败',
        icon: 'none',
      });
    }
  },

  async exportSalary() {
    wx.showLoading({ title: '导出中...' });
    try {
      await exportData('salary', {}, 'csv');
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '导出失败',
        icon: 'none',
      });
    }
  },

  async exportFinance() {
    wx.showLoading({ title: '导出中...' });
    try {
      await exportData('finance', {}, 'csv');
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '导出失败',
        icon: 'none',
      });
    }
  },
});
