// pages/student/index.js
const { get } = require('../../utils/request');

Page({
  data: {
    studentInfo: {},
    contracts: [],
    recentLessons: [],
    loading: true,
    error: null
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    if (this.data.contracts.length > 0) {
      this.loadData();
    }
  },

  goToAttendance() {
    wx.navigateTo({
      url: '/pages/student/attendance',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToLessons() {
    wx.navigateTo({
      url: '/pages/student/lessons',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  async loadData() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: null });

    try {
      // 并行请求学生信息、合同、课时
      const [info, contracts, lessons] = await Promise.all([
        get('/students/self').catch(() => null),
        get('/students/self/contracts').catch(() => []),
        get('/students/self/lessons').catch(() => [])
      ]);

      this.setData({
        studentInfo: info || {},
        contracts: Array.isArray(contracts) ? contracts : [],
        recentLessons: Array.isArray(lessons) ? lessons.slice(0, 5) : [],
        loading: false
      });
    } catch (err) {
      console.error('[Student] 加载失败:', err);
      this.setData({
        error: '数据加载失败，请稍后重试',
        loading: false
      });
    }
  }
});
