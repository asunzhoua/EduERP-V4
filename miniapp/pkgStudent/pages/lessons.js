// pages/student/lessons.js
const { get } = require('../../utils/request');
const { statusText } = require('../../utils/attendance-status');
const { ensureCurrentChild, studentApiPath, showChildSwitch } = require('../../utils/child-context');

Page({
  data: {
    lessons: [],
    allLessons: [],
    // 课时余额（来自合同）
    balance: { total: 0, used: 0, remaining: 0 },
    // 日期查询
    fromDate: '',
    toDate: '',
    stats: { total: 0, present: 0, absent: 0, late: 0, leave: 0, sick: 0, makeup: 0, online: 0, offline: 0 },
    filterStatus: 'ALL',
    loading: true,
    error: null,
    isParent: false,
    currentChildName: ''
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
    ensureCurrentChild().then((ctx) => {
      this.setData({ isParent: ctx.isParent, currentChildName: ctx.currentChild ? ctx.currentChild.name : '' });
      this.loadContracts();
      this.loadLessons();
    });
  },

  onShow() {
    // 从其他页面返回时刷新余额与课时（并同步当前孩子）
    ensureCurrentChild().then((ctx) => {
      this.setData({ isParent: ctx.isParent, currentChildName: ctx.currentChild ? ctx.currentChild.name : '' });
      this.loadContracts();
    });
  },

  onSwitchChild() {
    showChildSwitch((child) => {
      this.setData({ currentChildName: child.name });
      this.loadContracts();
      this.loadLessons();
    });
  },

  onPullDownRefresh() {
    Promise.all([this.loadContracts(), this.loadLessons()]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 课时余额：总课时 / 已使用 / 剩余
  async loadContracts() {
    try {
      const contracts = await get(studentApiPath('/students/self/contracts'));
      const list = Array.isArray(contracts) ? contracts : [];
      const total = list.reduce((s, c) => s + (c.totalLessons || 0), 0);
      const remaining = list.reduce((s, c) => s + (c.remainingLessons || 0), 0);
      this.setData({
        balance: { total, used: total - remaining, remaining }
      });
    } catch (err) {
      // 余额加载失败不影响课时列表
      this.setData({ balance: { total: 0, used: 0, remaining: 0 } });
    }
  },

  async loadLessons(from, to) {
    try {
      this.setData({ loading: true, error: null });
      const data = await get(studentApiPath('/students/self/lessons'), {
        from: from || this.data.fromDate,
        to: to || this.data.toDate
      });
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

  // 开始日期
  onFromDateChange(e) {
    const val = e.detail.value;
    let toDate = this.data.toDate;
    // 开始日期不能晚于结束日期
    if (toDate && val > toDate) {
      toDate = '';
    }
    this.setData({ fromDate: val, toDate });
  },

  // 结束日期
  onToDateChange(e) {
    const val = e.detail.value;
    let fromDate = this.data.fromDate;
    // 结束日期不能早于开始日期
    if (fromDate && val < fromDate) {
      fromDate = '';
    }
    this.setData({ toDate: val, fromDate });
  },

  // 查询
  onDateQuery() {
    this.loadLessons();
  },

  // 重置日期区间
  onDateReset() {
    this.setData({ fromDate: '', toDate: '' });
    this.loadLessons('', '');
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
