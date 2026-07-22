// pages/student/classes.js
const { get } = require('../../utils/request');

Page({
  data: {
    classes: [],
    loading: false,
    error: null
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: null });

    try {
      const contracts = await get('/students/self/contracts');
      
      const classes = contracts.map(c => ({
        classCode: c.classCode,
        subject: c.subject,
        teacherName: c.teacherName || '',
        totalLessons: c.totalLessons,
        remainingLessons: c.remainingLessons,
        progress: c.totalLessons > 0 
          ? Math.round((c.totalLessons - c.remainingLessons) / c.totalLessons * 100) 
          : 0
      }));

      this.setData({ classes, loading: false });
    } catch (err) {
      console.error('[Classes] 加载失败:', err);
      this.setData({
        error: '数据加载失败，请稍后重试',
        loading: false
      });
    }
  },

  goToDetail(e) {
    const classData = e.currentTarget.dataset.class;
    wx.navigateTo({
      url: `/pages/student/class-detail?code=${classData.classCode}`
    });
  }
});
