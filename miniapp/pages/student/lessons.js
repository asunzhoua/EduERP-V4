// pages/student/lessons.js
const { get } = require('../../utils/request');
const { statusText } = require('../../utils/attendance-status');

Page({
  data: {
    lessons: [],
    allLessons: [],
    stats: { total: 0, present: 0, absent: 0, late: 0, leave: 0, sick: 0, makeup: 0, online: 0, offline: 0 },
    filterStatus: 'ALL',
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
    this.loadLessons();
  },

  async loadLessons() {
    try {
      this.setData({ loading: true, error: null });
      const data = await get('/students/self/lessons');
      const allLessons = (Array.isArray(data) ? data : []).map(l => ({
        ...l,
        statusText: statusText(l.status)
      }));
      const present = allLessons.filter(l => l.status === 'PRESENT').length;
      const absent = allLessons.filter(l => l.status === 'ABSENT').length;
      const late = allLessons.filter(l => l.status === 'LATE').length;
      const leave = allLessons.filter(l => l.status === 'LEAVE').length;
      const sick = allLessons.filter(l => l.status === 'SICK').length;
      const makeup = allLessons.filter(l => l.status === 'MAKEUP').length;
      const online = allLessons.filter(l => l.status === 'ONLINE').length;
      const offline = allLessons.filter(l => l.status === 'OFFLINE').length;

      this.setData({
        allLessons,
        lessons: allLessons,
        stats: { total: allLessons.length, present, absent, late, leave, sick, makeup, online, offline },
        filterStatus: 'ALL',
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
    this.loadLessons().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  filterByStatus(e) {
    const status = e.currentTarget.dataset.status;
    const filtered = status === 'ALL'
      ? this.data.allLessons
      : this.data.allLessons.filter(l => l.status === status);
    this.setData({
      lessons: filtered,
      filterStatus: status
    });
  }
});
