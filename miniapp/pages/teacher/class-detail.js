// pages/teacher/class-detail.js
const { get } = require('../../utils/request');

Page({
  data: {
    classCode: '',
    classInfo: null,
    students: [],
    loading: true,
    error: null,
    activeTab: 'info'  // info | students | lessons
  },

  onLoad(options) {
    const { code } = options;
    if (code) {
      this.setData({ classCode: code });
      this.loadClassDetail(code);
    } else {
      this.setData({ 
        error: '缺少班级编码',
        loading: false 
      });
    }
  },

  // 加载班级详情
  async loadClassDetail(code) {
    this.setData({ loading: true, error: null });

    try {
      const [classInfo, studentsData] = await Promise.all([
        get(`/classes/${code}`),
        get(`/classes/${code}/students`)
      ]);

      this.setData({
        classInfo,
        students: studentsData || [],
        loading: false
      });
    } catch (err) {
      console.error('[Class Detail] 加载失败:', err);
      this.setData({
        error: err.message || '加载失败',
        loading: false
      });
    }
  },

  // 切换 Tab
  onTabChange(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({ activeTab: tab });
  },

  // 跳转学生列表
  goToStudents() {
    wx.navigateTo({
      url: `/pages/teacher/students?classCode=${this.data.classCode}`
    });
  },

  // 跳转课时记录
  goToRecordLesson() {
    wx.navigateTo({
      url: `/pages/teacher/lesson-record?classCode=${this.data.classCode}`
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});