// pages/student/attendance.js
const { get } = require('../../utils/request');

Page({
  data: {
    attendanceList: [],
    loading: true,
    error: null
  },

  onLoad() {
    this.loadAttendance();
  },

  async loadAttendance() {
    try {
      this.setData({ loading: true, error: null });
      const res = await get('/students/self/attendance');
      this.setData({
        attendanceList: Array.isArray(res) ? res : [],
        loading: false
      });
    } catch (err) {
      console.error('[Attendance] 加载失败:', err);
      this.setData({
        error: '加载失败，请稍后重试',
        loading: false
      });
    }
  },

  onPullDownRefresh() {
    this.loadAttendance().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
