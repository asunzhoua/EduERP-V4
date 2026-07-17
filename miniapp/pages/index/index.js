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
    totalStudents: 0
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadDashboard();
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

  async loadDashboard() {
    try {
      // 模拟数据（后续对接真实 API）
      this.setData({
        todayLessons: 3,
        pendingAttendance: 2,
        totalStudents: 45
      });
    } catch (err) {
      console.error('Load dashboard error:', err);
    }
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