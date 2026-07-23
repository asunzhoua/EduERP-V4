// pages/teacher/profile.js
var request = require('../../utils/request');
var get = request.get;

Page({
  data: {
    // 个人信息
    teacherInfo: {
      name: '',
      username: '',
      mobile: '',
      role: '',
      avatar: ''
    },
    // 班级统计
    stats: {
      totalClasses: 0,
      totalStudents: 0,
      totalLessons: 0
    },
    // 教学概览
    overview: {
      monthLessons: 0,
      monthAttendanceRate: '--',
      todayLessons: 0,
      pendingAttendance: 0
    },
    // 最近课程
    recentLessons: [],
    // UI 状态
    loading: true,
    error: null
  },

  onLoad: function () {
    this.loadData();
  },

  onShow: function () {
    this.loadData();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadData().then(function () {
      wx.stopPullDownRefresh();
    }).catch(function () {
      wx.stopPullDownRefresh();
    });
  },

  loadData: function () {
    var self = this;
    if (self._loading) return Promise.resolve();
    self._loading = true;
    self.setData({ loading: true, error: null });

    // 并行加载所有数据
    return Promise.all([
      self.loadTeacherInfo(),
      self.loadStats(),
      self.loadOverview(),
      self.loadRecentLessons()
    ]).then(function () {
      self.setData({ loading: false });
      self._loading = false;
    }).catch(function (err) {
      console.error('[TeacherProfile] 加载失败:', err);
      self.setData({
        loading: false,
        error: '加载失败，请稍后重试'
      });
      self._loading = false;
    });
  },

  // 加载教师个人信息
  loadTeacherInfo: function () {
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
        }
      });
    }).catch(function (err) {
      console.warn('[TeacherProfile] 获取个人信息失败:', err);
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
        }
      });
    });
  },

  // 加载班级统计
  loadStats: function () {
    var self = this;
    return Promise.all([
      get('/teacher-assignments').catch(function () { return []; }),
      get('/classes').catch(function () { return { items: [] }; })
    ]).then(function (results) {
      var assignments = results[0] || [];
      var classesData = results[1] || { items: [] };
      var classes = classesData.items || [];

      if (!Array.isArray(assignments)) assignments = [];

      // 统计活跃班级数
      var activeAssignments = assignments.filter(function (a) {
        return a.status === 'ACTIVE';
      });
      var totalClasses = activeAssignments.length;

      // 统计总学生数（从班级数据汇总）
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

  // 加载教学概览
  loadOverview: function () {
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
      console.warn('[TeacherProfile] 获取教学概览失败:', err);
    });
  },

  // 加载最近课程
  loadRecentLessons: function () {
    var self = this;
    return get('/teacher-assignments').then(function (assignments) {
      if (!Array.isArray(assignments) || assignments.length === 0) {
        self.setData({ recentLessons: [] });
        return;
      }

      // 获取活跃班级的 classCode
      var activeCodes = assignments
        .filter(function (a) { return a.status === 'ACTIVE'; })
        .map(function (a) { return a.classCode; })
        .slice(0, 3); // 最多取3个班级

      if (activeCodes.length === 0) {
        self.setData({ recentLessons: [] });
        return;
      }

      // 并行获取各班级的最近课程
      var promises = activeCodes.map(function (code) {
        return get('/classes/' + code + '/lessons').then(function (data) {
          if (!data || !data.items || data.items.length === 0) return null;
          // 取最近一条（按 lessonNumber 降序取第一条）
          var items = data.items;
          var latest = items[items.length - 1] || items[0];
          return {
            classCode: code,
            className: latest.className || code,
            lessonNumber: latest.lessonNumber,
            topic: latest.topic || '无主题',
            scheduledDate: latest.scheduledDate || '',
            status: latest.status || 'PLANNED',
            statusText: self.getStatusText(latest.status)
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

  // 课时状态文本
  getStatusText: function (status) {
    var map = {
      'PLANNED': '已计划',
      'TEACHING': '进行中',
      'COMPLETED': '已完成',
      'CANCELLED': '已取消'
    };
    return map[status] || status || '未知';
  },

  // 退出登录
  handleLogout: function () {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: function (res) {
        if (res.confirm) {
          var app = getApp();
          app.logout();
        }
      }
    });
  },

  // 跳转我的班级
  goToClasses: function () {
    wx.switchTab({ url: '/pages/teacher/classes' });
  },

  // 跳转我的课程
  goToCourses: function () {
    wx.switchTab({ url: '/pages/teacher/courses' });
  },

  // 跳转我的学生
  goToStudents: function () {
    wx.navigateTo({ url: '/pages/teacher/students' });
  }
});
