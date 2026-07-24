// pages/student/profile.js
var request = require('../../utils/request');
var get = request.get;

Page({
  data: {
    // 基础信息
    studentInfo: {},
    // 合同列表
    contracts: [],
    contractStats: {
      activeCount: 0,
      expiringCount: 0,
      expiredCount: 0
    },
    // 学习概览
    learningOverview: {
      totalLessons: 0,
      usedLessons: 0,
      remainingLessons: 0,
      attendanceRate: 0,
      attendanceRateText: '--'
    },
    // 最近课程
    recentLessons: [],
    // UI 状态
    loading: true,
    error: null
  },

  onLoad: function () {
    // 角色守卫：教师不允许访问学生专属页面
    var app = getApp();
    var userInfo = app.globalData.userInfo || {};
    var role = userInfo.role;
    if (role === 'Teacher') {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
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

    return Promise.all([
      get('/students/self').catch(function () { return null; }),
      get('/students/self/contracts').catch(function () { return []; }),
      get('/students/self/attendance').catch(function () { return []; })
    ]).then(function (results) {
      var info = results[0] || {};
      var contracts = results[1] || [];
      var attendance = results[2] || [];

      if (!Array.isArray(contracts)) contracts = [];
      if (!Array.isArray(attendance)) attendance = [];

      // 处理基础信息
      var genderText = '未设置';
      if (info.gender === 'MALE' || info.gender === 1) genderText = '男';
      else if (info.gender === 'FEMALE' || info.gender === 2) genderText = '女';

      var studentInfo = {
        name: info.name || '学生',
        studentCode: info.studentCode || '--',
        gender: genderText,
        phone: info.phone || '未绑定'
      };

      // 处理合同状态
      var now = new Date();
      var activeCount = 0;
      var expiringCount = 0;
      var expiredCount = 0;

      var processedContracts = contracts.map(function (c) {
        var statusText = '未知';
        var statusClass = 'status-unknown';

        if (c.status === 'ACTIVE') {
          statusText = '有效';
          statusClass = 'status-active';
          activeCount++;
          // 检查是否即将到期（30天内）
          if (c.validTo) {
            var validToDate = new Date(c.validTo);
            var daysLeft = Math.ceil((validToDate - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 30 && daysLeft > 0) {
              statusText = '即将到期';
              statusClass = 'status-expiring';
              expiringCount++;
              activeCount--; // 从 active 中减去
            } else if (daysLeft <= 0) {
              statusText = '已过期';
              statusClass = 'status-expired';
              activeCount--;
              expiredCount++;
            }
          }
        } else if (c.status === 'EXPIRED' || c.status === 'COMPLETED') {
          statusText = '已过期';
          statusClass = 'status-expired';
          expiredCount++;
        } else if (c.status === 'SUSPENDED') {
          statusText = '已暂停';
          statusClass = 'status-suspended';
        }

        return {
          contractCode: c.contractCode || '--',
          subject: c.subject || '未知科目',
          teacherName: c.teacherName || '未分配',
          totalLessons: c.totalLessons || 0,
          remainingLessons: c.remainingLessons || 0,
          usedLessons: (c.totalLessons || 0) - (c.remainingLessons || 0),
          validFrom: c.validFrom || '--',
          validTo: c.validTo || '长期',
          status: c.status,
          statusText: statusText,
          statusClass: statusClass,
          progress: c.totalLessons > 0
            ? Math.round(((c.totalLessons - c.remainingLessons) / c.totalLessons) * 100)
            : 0
        };
      });

      // 计算学习概览
      var totalLessons = 0;
      var remainingLessons = 0;
      for (var i = 0; i < contracts.length; i++) {
        totalLessons += (contracts[i].totalLessons || 0);
        remainingLessons += (contracts[i].remainingLessons || 0);
      }
      var usedLessons = totalLessons - remainingLessons;

      // 计算出勤率
      var totalAttendance = attendance.length;
      var presentCount = 0;
      for (var j = 0; j < attendance.length; j++) {
        var s = attendance[j].status;
        if (s === 'PRESENT' || s === 'LATE') {
          presentCount++;
        }
      }
      var attendanceRate = totalAttendance > 0
        ? Math.round(presentCount / totalAttendance * 100)
        : 0;
      var attendanceRateText = totalAttendance > 0
        ? attendanceRate + '%'
        : '--';

      // 最近3条课程
      var recentLessons = attendance.slice(0, 3).map(function (a) {
        var statusText = '待确认';
        var statusClass = 'status-pending';
        if (a.status === 'PRESENT') {
          statusText = '已到课';
          statusClass = 'status-present';
        } else if (a.status === 'ABSENT') {
          statusText = '缺勤';
          statusClass = 'status-absent';
        } else if (a.status === 'LATE') {
          statusText = '迟到';
          statusClass = 'status-late';
        } else if (a.status === 'LEAVE') {
          statusText = '请假';
          statusClass = 'status-leave';
        }

        return {
          courseName: a.courseName || '未知课程',
          className: a.className || '',
          lessonDate: a.lessonDate || '--',
          timeRange: (a.startTime || '--') + ' - ' + (a.endTime || '--'),
          statusText: statusText,
          statusClass: statusClass
        };
      });

      self.setData({
        studentInfo: studentInfo,
        contracts: processedContracts,
        contractStats: {
          activeCount: activeCount,
          expiringCount: expiringCount,
          expiredCount: expiredCount
        },
        learningOverview: {
          totalLessons: totalLessons,
          usedLessons: usedLessons,
          remainingLessons: remainingLessons,
          attendanceRate: attendanceRate,
          attendanceRateText: attendanceRateText
        },
        recentLessons: recentLessons,
        loading: false,
        error: null
      });
    }).catch(function (err) {
      console.error('[Profile] 加载失败:', err);
      self.setData({
        error: '数据加载失败，请稍后重试',
        loading: false
      });
    }).finally(function () {
      self._loading = false;
    });
  },

  goBack: function () {
    wx.navigateBack({ fail: function () {
      wx.switchTab({ url: '/pages/student/index' });
    }});
  }
});
