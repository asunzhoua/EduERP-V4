// pages/student/index.js
const { get } = require('../../utils/request');
const { statusText } = require('../../utils/attendance-status');

Page({
  data: {
    studentInfo: {},
    contracts: [],
    recentLessons: [],
    overviewStats: { totalLessons: 0, usedLessons: 0, remainingLessons: 0, overallProgress: 0 },
    loading: true,
    error: null,
    // 教师/管理员视图（个人中心）：与家长视图互斥渲染，两视图字段互不混用
    isTeacherView: false,
    teacherInfo: { name: '', username: '', mobile: '', role: '', avatar: '' },
    stats: { totalClasses: 0, totalStudents: 0, totalLessons: 0 },
    overview: { monthLessons: 0, monthAttendanceRate: '--', todayLessons: 0, pendingAttendance: 0 },
    isAdmin: false,
    // 家长「我的」视图
    children: [],
    subs: { lesson: true, balance: true, approval: true }
  },

  onLoad() {
    // 角色自适应：教师/管理员 → 个人中心；学生/家长 → 我的（均为 tab 槽位，保留底部栏）
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    const isTeacherView = role === 'Teacher' || role === 'Admin' || role === 'SuperAdmin';
    this.setData({ isTeacherView });
    if (isTeacherView) {
      this.loadTeacherProfile();
    } else {
      this.loadData();
      this.loadChildren();
    }
  },

  onShow() {
    // TabBar 页面 onLoad 仅执行一次，onShow 每次切换都会触发
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    const isTeacherView = role === 'Teacher' || role === 'Admin' || role === 'SuperAdmin';
    this.setData({ isTeacherView });
    if (isTeacherView) {
      this.loadTeacherProfile();
    } else {
      this.loadData();
      this.loadChildren();
    }
  },

  onPullDownRefresh() {
    if (this.data.isTeacherView) {
      this.loadTeacherProfile().finally(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      this.loadData().finally(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  goToAttendance() {
    wx.navigateTo({
      url: '/pages/student/attendance',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToLessons() {
    wx.navigateTo({
      url: '/pages/student/lessons',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/student/profile',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToStudentLeaveApply() {
    wx.navigateTo({
      url: '/pages/student/leave-apply/leave-apply',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToLeaveRecords() {
    wx.navigateTo({
      url: '/pages/student/leave-records/leave-records',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  async loadChildren() {
    try {
      const data = await get('/students/my-children');
      this.setData({ children: Array.isArray(data) ? data : (data && data.items) || [] });
    } catch (err) {
      this.setData({ children: [] });
    }
  },

  goToChildDetail(e) {
    const d = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pages/parent/child-detail?id=' + d.id +
        '&name=' + encodeURIComponent(d.name || '') +
        '&studentCode=' + encodeURIComponent(d.studentcode || '') +
        '&school=' + encodeURIComponent(d.school || '') +
        '&grade=' + encodeURIComponent(d.grade || ''),
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToContractManage() {
    wx.navigateTo({
      url: '/pages/student/profile',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToContact() {
    wx.showToast({ title: '请拨打机构前台电话联系', icon: 'none' });
  },

  goToAbout() {
    wx.showToast({ title: 'EduERP · 教育培训管理系统', icon: 'none' });
  },

  // 消息订阅开关（前端偏好，落地后接订阅消息模板 TODO-T）
  toggleSubscribe(e) {
    const key = e.currentTarget.dataset.key;
    const subs = Object.assign({}, this.data.subs);
    if (subs.hasOwnProperty(key)) {
      subs[key] = !subs[key];
      this.setData({ subs });
    }
  },

  async loadData() {
    if (this._dataLoading) return;
    this._dataLoading = true;
    this.setData({ loading: true, error: null });

    try {
      // 并行请求学生信息、合同、课时
      const [info, contracts, lessons] = await Promise.all([
        get('/students/self').catch(() => null),
        get('/students/self/contracts').catch(() => []),
        get('/students/self/lessons').catch(() => [])
      ]);

      const contractList = Array.isArray(contracts) ? contracts : [];

      // Compute overview stats from contracts
      const totalLessons = contractList.reduce((sum, c) => sum + (c.totalLessons || 0), 0);
      const remainingLessons = contractList.reduce((sum, c) => sum + (c.remainingLessons || 0), 0);
      const usedLessons = totalLessons - remainingLessons;
      const overallProgress = totalLessons > 0 ? Math.round(usedLessons / totalLessons * 100) : 0;

      const recentLessons = (Array.isArray(lessons) ? lessons : []).slice(0, 5).map(l => ({
        ...l,
        statusText: statusText(l.status)
      }));

      this.setData({
        studentInfo: info || {},
        contracts: contractList,
        recentLessons,
        overviewStats: { totalLessons, usedLessons, remainingLessons, overallProgress },
        loading: false
      });
    } catch (err) {
      console.error('[Student] 加载失败:', err);
      this.setData({
        error: '数据加载失败，请稍后重试',
        loading: false
      });
    } finally {
      this._dataLoading = false;
    }
  },

  // ===== 教师/管理员视图：个人中心（复用 teacher/profile 数据逻辑）=====
  loadTeacherProfile() {
    var self = this;
    if (self._tpLoading) return Promise.resolve();
    self._tpLoading = true;
    self.setData({ loading: true, error: null });

    return Promise.all([
      self.loadTeacherInfo(),
      self.loadTeacherStats(),
      self.loadTeacherOverview(),
      self.loadTeacherRecentLessons()
    ]).then(function () {
      self.setData({ loading: false });
      self._tpLoading = false;
    }).catch(function (err) {
      console.error('[StudentIndex] 教师个人中心加载失败:', err);
      self.setData({ loading: false, error: '加载失败，请稍后重试' });
      self._tpLoading = false;
    });
  },

  loadTeacherInfo() {
    var self = this;
    return get('/auth/me').then(function (data) {
      if (!data) data = {};
      var roleText = '教师';
      if (data.role === 'SuperAdmin') roleText = '超级管理员';
      else if (data.role === 'Admin') roleText = '管理员';
      else if (data.role === 'Teacher') roleText = '教师';

      self.setData({
        teacherInfo: {
          name: data.name || '教师',
          username: data.username || '--',
          mobile: data.mobile || '未绑定',
          role: roleText,
          avatar: data.avatar || ''
        },
        isAdmin: data.role === 'Admin' || data.role === 'SuperAdmin'
      });
    }).catch(function (err) {
      console.warn('[StudentIndex] 获取个人信息失败:', err);
      // 降级：从 globalData 获取
      var app = getApp();
      var userInfo = app.globalData.userInfo || {};
      self.setData({
        teacherInfo: {
          name: userInfo.name || '教师',
          username: userInfo.username || '--',
          mobile: userInfo.mobile || '未绑定',
          role: userInfo.role === 'Teacher' ? '教师' : userInfo.role || '教师',
          avatar: userInfo.avatar || ''
        },
        isAdmin: userInfo.role === 'Admin' || userInfo.role === 'SuperAdmin'
      });
    });
  },

  loadTeacherStats() {
    var self = this;
    return Promise.all([
      get('/teacher-assignments').catch(function () { return []; }),
      get('/classes').catch(function () { return { items: [] }; })
    ]).then(function (results) {
      var assignments = results[0] || [];
      var classesData = results[1] || { items: [] };
      var classes = classesData.items || [];

      if (!Array.isArray(assignments)) assignments = [];

      var activeAssignments = assignments.filter(function (a) {
        return !a.effectiveTo;
      });
      var totalClasses = activeAssignments.length;

      var totalStudents = 0;
      var totalLessons = 0;
      classes.forEach(function (cls) {
        totalStudents += (cls.currentStudents || 0);
        totalLessons += (cls.completedLessons || 0);
      });

      self.setData({
        stats: {
          totalClasses: totalClasses,
          totalStudents: totalStudents,
          totalLessons: totalLessons
        }
      });
    });
  },

  loadTeacherOverview() {
    var self = this;
    return get('/teacher/dashboard').then(function (data) {
      if (!data) data = {};
      self.setData({
        overview: {
          todayLessons: data.todayLessons || 0,
          pendingAttendance: data.pendingAttendance || 0,
          monthLessons: 0, // 后端暂无月度统计，后续扩展
          monthAttendanceRate: '--' // 后端暂无出勤率统计，后续扩展
        }
      });
    }).catch(function (err) {
      console.warn('[StudentIndex] 获取教学概览失败:', err);
    });
  },

  loadTeacherRecentLessons() {
    var self = this;
    return get('/teacher-assignments').then(function (assignments) {
      if (!Array.isArray(assignments) || assignments.length === 0) {
        self.setData({ recentLessons: [] });
        return;
      }

      var activeCodes = assignments
        .filter(function (a) { return !a.effectiveTo; })
        .map(function (a) { return a.classCode; })
        .slice(0, 3);

      if (activeCodes.length === 0) {
        self.setData({ recentLessons: [] });
        return;
      }

      var promises = activeCodes.map(function (code) {
        return get('/classes/' + code + '/lessons').then(function (data) {
          var items = Array.isArray(data) ? data : (data && data.items ? data.items : []);
          if (!items || items.length === 0) return null;
          var latest = items[items.length - 1] || items[0];
          return {
            classCode: code,
            className: latest.className || code,
            lessonNumber: latest.lessonNumber,
            topic: latest.topic || '无主题',
            scheduledDate: latest.scheduledDate || '',
            status: latest.status || 'PLANNED',
            statusText: self.getTeacherStatusText(latest.status)
          };
        }).catch(function () { return null; });
      });

      return Promise.all(promises).then(function (results) {
        var recentLessons = results.filter(function (r) { return r !== null; });
        self.setData({ recentLessons: recentLessons });
      });
    }).catch(function () {
      self.setData({ recentLessons: [] });
    });
  },

  getTeacherStatusText(status) {
    var map = {
      'PLANNED': '已计划',
      'TEACHING': '进行中',
      'COMPLETED': '已完成',
      'CANCELLED': '已取消'
    };
    return map[status] || status || '未知';
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: function (res) {
        if (res.confirm) {
          getApp().logout();
        }
      }
    });
  },

  goToClasses() {
    wx.switchTab({ url: '/pages/teacher/classes' });
  },

  goToCourses() {
    wx.switchTab({ url: '/pages/teacher/courses' });
  },

  goToStudents() {
    wx.navigateTo({ url: '/pages/teacher/students' });
  },

  goToMyExceptions() {
    wx.navigateTo({ url: '/pages/teacher/my-exceptions/my-exceptions' });
  },

  goToLeaveApply() {
    wx.navigateTo({ url: '/pages/teacher/leave-apply/leave-apply' });
  },

  goToParentManage() {
    wx.navigateTo({ url: '/pages/operation/parent-manage/parent-manage' });
  }
});
