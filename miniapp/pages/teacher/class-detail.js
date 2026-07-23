// pages/teacher/class-detail.js
const { get } = require('../../utils/request');

Page({
  data: {
    classCode: '',
    classInfo: null,
    students: [],
    loading: true,
    error: null,
    activeTab: 'info',  // info | students | lessons
    lessons: [],
    lessonsLoading: false
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
    if (tab === 'lessons') {
      this.loadLessons();
    }
  },

  // 跳转学生列表
  goToStudents() {
    wx.navigateTo({
      url: `/pages/teacher/students?classCode=${this.data.classCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 跳转课时记录
  goToRecordLesson() {
    wx.navigateTo({
      url: `/pages/teacher/lesson-record?classCode=${this.data.classCode}`,
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
    if (this.data.classCode) {
      this.loadClassDetail(this.data.classCode);
    }
  },

  // 加载课时列表
  async loadLessons() {
    if (this.data.lessons.length > 0 || this.data.lessonsLoading) return;
    this.setData({ lessonsLoading: true });
    try {
      const data = await get(`/classes/${this.data.classCode}/lessons`);
      const lessons = Array.isArray(data) ? data : (data.items || []);
      this.setData({ lessons: lessons, lessonsLoading: false });
    } catch (err) {
      console.error('[Class Detail] 课时加载失败:', err);
      this.setData({ lessonsLoading: false });
      wx.showToast({ title: '课时加载失败', icon: 'none' });
    }
  },

});