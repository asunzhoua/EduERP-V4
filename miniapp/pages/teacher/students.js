// pages/teacher/students.js
const { get } = require('../../utils/request');

Page({
  data: {
    students: [],
    loading: true,
    error: null,
    keyword: ''
  },

  onLoad(options) {
    // 角色守卫：学生不允许访问教师页面
    const app = getApp();
    const role = app.globalData.userInfo?.role;
    if (role === 'Student' || role === 'Parent') {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    if (options.classCode) {
      this.setData({ classCode: options.classCode });
    }
    this.loadStudents();
  },

  onPullDownRefresh() {
    this.loadStudents().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.loadStudents();
  },

  async loadStudents() {
    this.setData({ loading: true, error: null });

    try {
      let students = [];
      
      if (this.data.classCode) {
        // 如果有 classCode，从 classes API 获取该班级的学生
        const data = await get(`/classes/${this.data.classCode}/students`);
        students = data || [];
      } else {
        const params = {};
        if (this.data.keyword) {
          params.keyword = this.data.keyword;
        }
        const data = await get('/students', params);
        students = data.items || data || [];
      }

      this.setData({
        students,
        loading: false
      });
    } catch (err) {
      console.error('[Students] 加载失败:', err);
      this.setData({ 
        error: '加载失败，请稍后重试',
        loading: false 
      });
    }
  },

  goToStudentDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/teacher/student-detail?code=${code}`,
      fail: (err) => {
        console.error('[Navigation] 跳转学生详情失败:', err);
        wx.showToast({ title: '跳转失败', icon: 'none' });
      }
    });
  }
});