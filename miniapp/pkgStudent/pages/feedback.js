// pages/student/feedback/feedback.js
const { get } = require('../../utils/request');

Page({
  data: {
    list: [],
    loading: true,
    error: null
  },

  onShow() {
    this.loadFeedback();
  },

  onPullDownRefresh() {
    this.loadFeedback().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadFeedback() {
    try {
      this.setData({ loading: true, error: null });
      const data = await get('/students/self/feedback');
      const list = (Array.isArray(data) ? data : []).map(f => ({
        ...f,
        dateText: f.lessonDate || ''
      }));
      this.setData({ list, loading: false });
    } catch (err) {
      console.error('[Feedback] 加载课程反馈失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  }
});
