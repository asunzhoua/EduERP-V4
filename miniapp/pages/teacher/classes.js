// pages/teacher/classes.js
const { get } = require('../../utils/request');

Page({
  data: {
    classes: [],
    loading: true,
    filter: 'ALL'
  },

  onLoad() {
    this.loadClasses();
  },

  onPullDownRefresh() {
    this.loadClasses().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadClasses() {
    this.setData({ loading: true });

    try {
      const data = await get('/classes', {
        status: this.data.filter === 'ALL' ? undefined : this.data.filter
      });

      this.setData({
        classes: data.items || [],
        loading: false
      });
    } catch (err) {
      // 模拟数据
      this.setData({
        classes: [
          {
            id: 1,
            classCode: 'CL2026070001',
            name: '周六上午班',
            courseName: '数学思维训练',
            status: 'ACTIVE',
            startDate: '2026-07-15',
            currentStudents: 12,
            maxStudents: 15
          },
          {
            id: 2,
            classCode: 'CL2026070002',
            name: '周日下午班',
            courseName: '英语口语提升',
            status: 'ACTIVE',
            startDate: '2026-07-16',
            currentStudents: 8,
            maxStudents: 12
          }
        ],
        loading: false
      });
    }
  },

  onFilterChange(e) {
    const { value } = e.currentTarget.dataset;
    this.setData({ filter: value });
    this.loadClasses();
  },

  goToClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/class-detail?code=${code}` });
  },

  goToRecordLesson(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/lesson-record?classCode=${code}` });
  },

  getStatusText(status) {
    const map = {
      'DRAFT': '草稿',
      'ACTIVE': '进行中',
      'COMPLETED': '已结束',
      'CANCELLED': '已取消'
    };
    return map[status] || status;
  }
});