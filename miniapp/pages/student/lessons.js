// pages/student/lessons.js
const { get } = require('../../utils/request');

Page({
  data: {
    lessons: [],
    loading: true,
    error: null
  },

  onLoad() {
    this.loadLessons();
  },

  async loadLessons() {
    try {
      this.setData({ loading: true, error: null });
      const data = await get('/students/self/lessons');
      this.setData({
        lessons: Array.isArray(data) ? data : [],
        loading: false
      });
    } catch (err) {
      this.setData({
        error: '加载失败，请稍后重试',
        loading: false
      });
    }
  },

  onPullDownRefresh() {
    this.loadLessons().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
