// pages/teacher/classes.js
const { get } = require('../../utils/request');
const { statusText, statusClass } = require('../../utils/attendance-status');

Page({
  data: {
    classes: [],
    loading: true,
    error: null,
    filter: 'ALL',
    courseCode: '',  // 班级筛选
    isStudentView: false,  // 家长/学生视图：出勤 Tab 原地渲染出勤记录，保留 tab 栏
    studentAllAttendance: [],
    studentAttendance: [],
    attStats: { total: 0, present: 0, absent: 0, late: 0, leave: 0, sick: 0, makeup: 0, online: 0, offline: 0, attendanceRate: 0 },
    attFilterStatus: 'ALL'
  },

  onLoad(options) {
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    const isStudentView = role === 'Student' || role === 'Parent';
    this.setData({ isStudentView });
    if (isStudentView) {
      this.loadStudentAttendance();
      return;
    }
    if (options.courseCode) {
      this.setData({ courseCode: options.courseCode });
    }
    this.loadClasses();
  },

  // Tab 页 onLoad 仅一次；每次切回刷新（创建/删除/编辑返回后能看到最新班级）
  onShow() {
    if (this.data.isStudentView) {
      this.loadStudentAttendance();
    } else {
      this.loadClasses();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    if (this.data.isStudentView) {
      this.loadStudentAttendance().finally(() => {
        wx.stopPullDownRefresh();
      });
      return;
    }
    this.loadClasses().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载班级列表
  async loadClasses() {
    if (this._dataLoading) return;
    this._dataLoading = true;
    this.setData({ loading: true, error: null });

    try {
      const params = {
        status: this.data.filter === 'ALL' ? undefined : this.data.filter
      };
      if (this.data.courseCode) {
        params.courseCode = this.data.courseCode;
      }
      const data = await get('/classes', params);

      const classes = data.items || [];

      this.setData({
        classes: classes,
        loading: false
      });

    } catch (err) {
      console.error('[Classes] 加载失败:', err);
      this.setData({ 
        error: '加载失败，请稍后重试',
        loading: false 
      });
    } finally {
      this._dataLoading = false;
    }
  },

  // 家长/学生视图：加载出勤记录（口径对齐 student/attendance：分子 PRESENT/LATE/ONLINE/OFFLINE）
  async loadStudentAttendance() {
    if (this._studentLoading) return;
    this._studentLoading = true;

    try {
      this.setData({ loading: true, error: null });
      const data = await get('/students/self/attendance');
      const all = (Array.isArray(data) ? data : []).map(a => ({
        ...a,
        statusText: statusText(a.status),
        statusClass: statusClass(a.status)
      }));
      const present = all.filter(a => a.status === 'PRESENT').length;
      const absent = all.filter(a => a.status === 'ABSENT').length;
      const late = all.filter(a => a.status === 'LATE').length;
      const leave = all.filter(a => a.status === 'LEAVE').length;
      const sick = all.filter(a => a.status === 'SICK').length;
      const makeup = all.filter(a => a.status === 'MAKEUP').length;
      const online = all.filter(a => a.status === 'ONLINE').length;
      const offline = all.filter(a => a.status === 'OFFLINE').length;
      const deductCount = all.filter(a =>
        a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'ONLINE' || a.status === 'OFFLINE'
      ).length;
      const attendanceRate = all.length > 0 ? Math.round(deductCount / all.length * 100) : 0;

      this.setData({
        studentAllAttendance: all,
        studentAttendance: all,
        attStats: { total: all.length, present, absent, late, leave, sick, makeup, online, offline, attendanceRate },
        attFilterStatus: 'ALL',
        loading: false
      });
    } catch (err) {
      console.error('[Classes] 孩子出勤加载失败:', err);
      this.setData({
        error: '加载失败，请稍后重试',
        loading: false
      });
    } finally {
      this._studentLoading = false;
    }
  },

  // 家长/学生视图：状态筛选
  filterStudentAttendance(e) {
    const status = e.currentTarget.dataset.status;
    const filtered = status === 'ALL'
      ? this.data.studentAllAttendance
      : this.data.studentAllAttendance.filter(a => a.status === status);
    this.setData({
      studentAttendance: filtered,
      attFilterStatus: status
    });
  },

  // 筛选切换
  onFilterChange(e) {
    const { value } = e.currentTarget.dataset;
    if (value === this.data.filter) return;

    this.setData({ filter: value, classes: [] });
    this.loadClasses();
  },

  // 右下角 FAB：创建班级
  createClass() {
    wx.navigateTo({
      url: '/pkgTeacher/pages/class-form',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 跳转班级详情
  goToClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pkgTeacher/pages/class-detail?code=${code}`,
      fail: (err) => {
        console.error('[Navigation] 跳转班级详情失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 查看学生列表
  goToStudents(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pkgTeacher/pages/students?classCode=${code}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 记录课时
  goToRecordLesson(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pkgTeacher/pages/lesson-record?classCode=${code}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 获取状态文本
  getStatusText(status) {
    const map = {
      'DRAFT': '草稿',
      'ACTIVE': '进行中',
      'COMPLETED': '已结束',
      'CANCELLED': '已取消'
    };
    return map[status] || status;
  },

  // 获取状态颜色类名
  getStatusClass(status) {
    const map = {
      'DRAFT': 'status-draft',
      'ACTIVE': 'status-active',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return map[status] || '';
  }
});