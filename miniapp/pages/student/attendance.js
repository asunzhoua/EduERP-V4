// pages/student/attendance.js
const { get } = require('../../utils/request');
const { statusText, statusClass } = require('../../utils/attendance-status');

Page({
  data: {
    attendanceList: [],
    stats: { total: 0, present: 0, absent: 0, late: 0, leave: 0, sick: 0, makeup: 0, online: 0, offline: 0, attendanceRate: 0 },
    loading: true,
    error: null
  },

  onLoad() {
    // 角色守卫：教师不允许访问学生专属页面
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    if (role === 'Teacher') {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    this.loadAttendance();
  },

  async loadAttendance() {
    try {
      this.setData({ loading: true, error: null });
      const res = await get('/students/self/attendance');
      const attendanceList = (Array.isArray(res) ? res : []).map(a => ({
        ...a,
        statusText: statusText(a.status),
        statusClass: statusClass(a.status)
      }));
      const total = attendanceList.length;
      const present = attendanceList.filter(a => a.status === 'PRESENT').length;
      const absent = attendanceList.filter(a => a.status === 'ABSENT').length;
      const late = attendanceList.filter(a => a.status === 'LATE').length;
      const leave = attendanceList.filter(a => a.status === 'LEAVE').length;
      const sick = attendanceList.filter(a => a.status === 'SICK').length;
      const makeup = attendanceList.filter(a => a.status === 'MAKEUP').length;
      const online = attendanceList.filter(a => a.status === 'ONLINE').length;
      const offline = attendanceList.filter(a => a.status === 'OFFLINE').length;
      // 到课率分子与后端扣课集合 DEDUCTIBLE_STATUSES 对齐：PRESENT/LATE/ONLINE/OFFLINE
      const deductCount = attendanceList.filter(a =>
        a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'ONLINE' || a.status === 'OFFLINE'
      ).length;
      const attendanceRate = total > 0 ? Math.round(deductCount / total * 100) : 0;
      this.setData({
        attendanceList,
        stats: { total, present, absent, late, leave, sick, makeup, online, offline, attendanceRate },
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
    this.loadAttendance().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
