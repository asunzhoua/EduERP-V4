// pages/teacher/course-detail.js
const { get } = require('../../utils/request');

Page({
  data: {
    courseCode: '',
    course: null,
    loading: true,
    error: null
  },

  onLoad(options) {
    // 角色守卫：学生不允许访问教师页面
    const app = getApp();
    const role = app.globalData.userInfo?.role;
    if (role === 'Student' || role === 'Parent') {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    const { code } = options;
    if (code) {
      this.setData({ courseCode: code });
      this.loadCourseDetail(code);
    } else {
      this.setData({ 
        error: '缺少课程编码',
        loading: false 
      });
    }
  },

  // 加载课程详情
  async loadCourseDetail(code) {
    this.setData({ loading: true, error: null });

    try {
      const data = await get(`/courses/${code}`);
      this.setData({
        course: data,
        loading: false
      });
    } catch (err) {
      console.error('[Course Detail] 加载失败:', err);
      this.setData({
        error: err.message || '加载失败',
        loading: false
      });
    }
  },

  // 返回上一页
  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  // 重试加载
  retryLoad() {
    if (this.data.courseCode) {
      this.loadCourseDetail(this.data.courseCode);
    }
  },

  // 跳转班级列表
  goToClasses() {
    wx.navigateTo({
      url: `/pages/teacher/classes?courseCode=${this.data.courseCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});