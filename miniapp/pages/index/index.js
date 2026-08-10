// pages/index/index.js
const app = getApp();
const { get } = require('../../utils/request');
const { statusText } = require('../../utils/attendance-status');
const { RENEWAL_WARNING_THRESHOLD } = require('../../utils/renewal-threshold');

Page({
  data: {
    userInfo: null,
    role: '',
    roleText: '',
    todayLessons: 0,
    pendingAttendance: 0,
    totalStudents: 0,
    recentLessons: [],
    totalClasses: 0,
    loading: false,  // 加载状态
    error: null,     // 错误信息
    // 家长/学生首页新增
    children: [],
    greeting: '',
    parentName: '家长',
    childCountText: '',
    overviewStats: { totalLessons: 0, usedLessons: 0, remainingLessons: 0, overallProgress: 0 },
    todayClasses: [],
    isLowBalance: false,
    // 消息未读数 / 当前积分
    unreadCount: 0,
    pointsBalance: 0,
    recentFeedback: []
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadDashboard();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadDashboard().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({
        userInfo,
        role: userInfo.role,
        roleText: this.getRoleText(userInfo.role),
        greeting: this.getGreeting(),
        parentName: userInfo.name || '家长'
      });
      if (userInfo.role === 'Student' || userInfo.role === 'Parent') {
        this.loadChildren();
      }
    }
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
  },

  todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  },

  isLessonPast(l) {
    const hm = (l.endTime || '').split(':');
    if (hm.length < 2) return false;
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +hm[0], +hm[1]);
    return now > end;
  },

  async loadChildren() {
    try {
      const data = await get('/students/my-children');
      const children = Array.isArray(data) ? data : (data && data.items) || [];
      this.setData({
        children,
        childCountText: children.length > 0 ? children.length + ' 个孩子已关联' : ''
      });
    } catch (err) {
      this.setData({ children: [], childCountText: '' });
    }
  },

  getRoleText(role) {
    const roleMap = {
      'Teacher': '教师',
      'Student': '学生',
      'Parent': '家长',
      'Admin': '管理员'
    };
    return roleMap[role] || '用户';
  },

  // 加载仪表盘数据
  async loadDashboard() {
    // 避免重复加载
    if (this.data.loading) return;

    this.setData({ loading: true, error: null });

    const role = this.data.role;

    if (role === 'Student' || role === 'Parent') {
      // 学生/家长端数据：全失败才错误态，部分失败容错（保留已成功数据）
      // 家长没有学生身份，self 端点按 userId 解析会 404，必须走孩子维度端点
      let failed = 0;
      let contracts, lessons, unread, points, feedback;

      if (role === 'Parent') {
        // 先确保 children 已加载（避免 loadDashboard 早于 loadChildren 完成的竞态）
        if (!this.data.children || this.data.children.length === 0) {
          await this.loadChildren();
        }
        const children = this.data.children || [];
        if (children.length === 0) {
          // 无关联孩子：空态
          this.applyStudentHomeData([], [], { count: 0 }, { balance: 0 }, []);
          return;
        }
        const childId = children[0].id;
        [contracts, lessons, unread, points, feedback] = await Promise.all([
          get('/students/' + childId + '/contracts').catch(() => { failed += 1; return []; }),
          get('/students/' + childId + '/lessons').catch(() => { failed += 1; return []; }),
          get('/reminders/unread-count').catch(() => { failed += 1; return { count: 0 }; }),
          get('/students/' + childId + '/points').catch(() => { failed += 1; return { balance: 0 }; }),
          get('/students/' + childId + '/feedback').catch(() => { failed += 1; return []; })
        ]);
      } else {
        [contracts, lessons, unread, points, feedback] = await Promise.all([
          get('/students/self/contracts').catch(() => { failed += 1; return []; }),
          get('/students/self/lessons').catch(() => { failed += 1; return []; }),
          get('/reminders/unread-count').catch(() => { failed += 1; return { count: 0 }; }),
          get('/students/self/points').catch(() => { failed += 1; return { balance: 0 }; }),
          get('/students/self/feedback').catch(() => { failed += 1; return []; })
        ]);
      }

      if (failed === 5) {
        this.setData({ error: '数据加载失败，请稍后重试', loading: false });
        return;
      }
      this.applyStudentHomeData(contracts, lessons, unread, points, feedback);
    } else {
      // 教师端数据
      try {
        const [data, classesData] = await Promise.all([
          get('/teacher/dashboard'),
          get('/classes', { pageSize: 1 }).catch(() => null)
        ]);

        const totalClasses = data.totalClasses || (classesData && classesData.total) || 0;

        this.setData({
          todayLessons: data.todayLessons || 0,
          pendingAttendance: data.pendingAttendance || 0,
          totalStudents: data.totalStudents || 0,
          totalClasses: totalClasses,
          loading: false
        });

      } catch (err) {
        console.error('[Dashboard] 教师端加载失败:', err);

        this.setData({
          error: err.message || '加载失败',
          loading: false,
          todayLessons: 0,
          pendingAttendance: 0,
          totalStudents: 0,
          totalClasses: 0
        });

        if (err.code !== 2002) {
          wx.showToast({ title: '数据加载失败，请稍后重试', icon: 'none', duration: 2000 });
        }
      }
    }
  },

  // 学生/家长首页共享的数据组装（self 与孩子维度端点返回结构一致，复用同一视图）
  applyStudentHomeData(contracts, lessons, unread, points, feedback) {
    const contractList = Array.isArray(contracts) ? contracts : [];
    const lessonList = Array.isArray(lessons) ? lessons : [];

    const totalLessons = contractList.reduce((s, c) => s + (c.totalLessons || 0), 0);
    const remainingLessons = contractList.reduce((s, c) => s + (c.remainingLessons || 0), 0);
    const usedLessons = totalLessons - remainingLessons;
    const overallProgress = totalLessons > 0 ? Math.round(usedLessons / totalLessons * 100) : 0;

    const today = this.todayStr();
    const todayClasses = lessonList
      .filter(l => l.lessonDate === today)
      .slice(0, 4)
      .map(l => ({ ...l, isPast: this.isLessonPast(l) }));

    // 课时预警（D-3）：剩余 ≤ 预警阈值 或 ≤20%，先到先触发（阈值集中配置在 utils/renewal-threshold.js）
    const isLowBalance = remainingLessons > 0 &&
      (remainingLessons <= RENEWAL_WARNING_THRESHOLD || (totalLessons > 0 && remainingLessons / totalLessons <= 0.2));

    const recentLessons = lessonList.slice(0, 5).map(l => ({
      ...l,
      statusText: statusText(l.status)
    }));

    this.setData({
      recentLessons,
      overviewStats: { totalLessons, usedLessons, remainingLessons, overallProgress },
      todayClasses,
      isLowBalance,
      unreadCount: (unread && unread.count) || 0,
      pointsBalance: (points && points.balance) || 0,
      recentFeedback: (Array.isArray(feedback) ? feedback : []).slice(0, 3),
      loading: false
    });
  },

  // 重新加载
  retryLoad() {
    this.loadDashboard();
  },

  goToCourses() {
    wx.switchTab({ 
      url: '/pages/teacher/courses',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToClasses() {
    wx.switchTab({ 
      url: '/pages/teacher/classes',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToStudents() {
    wx.navigateTo({ 
      url: '/pkgTeacher/pages/students',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToLessons() {
    wx.navigateTo({ 
      url: '/pkgTeacher/pages/lesson-record',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 学生端导航
  goToMyLessonRecords() {
    wx.navigateTo({
      url: '/pkgStudent/pages/lessons',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 请假申请
  goToStudentLeaveApply() {
    wx.navigateTo({
      url: '/pkgStudent/pages/leave-apply',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 我的申请（请假记录）
  goToLeaveRecords() {
    wx.navigateTo({
      url: '/pkgStudent/pages/leave-records',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 孩子切换 → 进入对应孩子详情
  goToChild(e) {
    const d = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pkgParent/pages/child-detail?id=' + d.id +
        '&name=' + encodeURIComponent(d.name || '') +
        '&studentCode=' + encodeURIComponent(d.studentcode || '') +
        '&school=' + encodeURIComponent(d.school || '') +
        '&grade=' + encodeURIComponent(d.grade || ''),
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 联系机构
  goToContact() {
    wx.showToast({ title: '请拨打机构前台电话联系', icon: 'none' });
  },

  // 运营看板（仅 Admin/SuperAdmin）
  goToDashboard() {
    wx.navigateTo({
      url: '/pkgOperation/pages/dashboard',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 我的提醒
  goToReminders() {
    wx.navigateTo({
      url: '/pkgReminder/pages/list',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 学生/家长端 — 出勤记录
  goToAttendance() {
    wx.navigateTo({
      url: '/pkgStudent/pages/attendance',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 学生/家长端 — 个人中心
  goToStudentProfile() {
    wx.navigateTo({
      url: '/pkgStudent/pages/profile',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 学生/家长端 — 我的积分
  goToPoints() {
    wx.navigateTo({
      url: '/pkgStudent/pages/points',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 学生/家长端 — 积分商城
  goToPointsMall() {
    wx.navigateTo({
      url: '/pkgStudent/pages/points-mall',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 学生/家长端 — 课程反馈
  goToFeedback() {
    wx.navigateTo({
      url: '/pkgStudent/pages/feedback',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 个人中心（教师端）
  goToProfile() {
    wx.navigateTo({
      url: '/pkgTeacher/pages/profile',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});