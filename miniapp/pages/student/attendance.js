// pages/student/attendance.js
const { get } = require('../../utils/request');

Page({
  data: {
    attendanceList: [],
    stats: { total: 0, present: 0, absent: 0, late: 0, leave: 0, attendanceRate: 0 },
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
      const list = Array.isArray(res) ? res : [];
      const total = list.length;
      const present = list.filter(a => a.status === 'PRESENT').length;
      const absent = list.filter(a => a.status === 'ABSENT').length;
      const late = list.filter(a => a.status === 'LATE').length;
      const leave = list.filter(a => a.status === 'LEAVE').length;
      const attendanceRate = total > 0 ? Math.round((present + late) / total * 100) : 0;
      this.setData({
        attendanceList: list,
        stats: { total, present, absent, late, leave, attendanceRate },
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
