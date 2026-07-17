// pages/index/index.js
const app = getApp();
const { get } = require('../../utils/request');

Page({
  data: {
    userInfo: null,
    role: '',
    roleText: '',
    todayLessons: 0,
    pendingAttendance: 0,
    totalStudents: 0,
    loading: false,  // 加载状态
    error: null,     // 错误信息
    refreshing: false // 下拉刷新状态
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadDashboard();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.loadDashboard().finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({
        userInfo,
        role: userInfo.role,
        roleText: this.getRoleText(userInfo.role)
      });
    }
  },

  getRoleText(role) {
    const roleMap = {
      'Teacher': '教师',
      'Student': '学生',
      'Parent': '家长',
      'Admin': '管理员'
    };
    return roleMap[role] || '用户';
  },

  // 加载仪表盘数据
  async loadDashboard() {
    // 避免重复加载
    if (this.data.loading) return;

    this.setData({ loading: true, error: null });

    try {
      // 调用真实 API
      const data = await get('/teacher/dashboard');
      
      this.setData({
        todayLessons: data.todayLessons || 0,
        pendingAttendance: data.pendingAttendance || 0,
        totalStudents: data.totalStudents || 0,
        loading: false
      });

      console.log('[Dashboard] 加载成功:', data);

    } catch (err) {
      console.error('[Dashboard] 加载失败:', err);
      
      // 错误处理：显示错误信息并使用默认值
      this.setData({
        error: err.message || '加载失败',
        loading: false,
        // 使用默认值保证界面可用
        todayLessons: 0,
        pendingAttendance: 0,
        totalStudents: 0
      });

      // 如果是 Token 过期，request.js 已经处理了跳转
      // 这里只显示提示
      if (err.code !== 2002) {
        wx.showToast({
          title: '数据加载失败，请稍后重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  // 重新加载
  retryLoad() {
    this.loadDashboard();
  },

  goToCourses() {
    wx.switchTab({ url: '/pages/teacher/courses' });
  },

  goToClasses() {
    wx.switchTab({ url: '/pages/teacher/classes' });
  },

  goToStudents() {
    wx.navigateTo({ url: '/pages/teacher/students' });
  },

  goToLessons() {
    wx.navigateTo({ url: '/pages/teacher/lesson-record' });
  }
});