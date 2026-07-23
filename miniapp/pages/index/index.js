// pages/index/index.js
const app = getApp();
const { get } = require('../../utils/request');

Page({
  data: {
    userInfo: null,
    role: '',
    roleText: '',
    todayLessons: 0,
    pendingAttendance: 0,
    totalStudents: 0,
    myContracts: [],
    recentLessons: [],
    totalClasses: 0,
    loading: false,  // 加载状态
    error: null,     // 错误信息
    refreshing: false // 下拉刷新状态
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadDashboard();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.loadDashboard().finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({
        userInfo,
        role: userInfo.role,
        roleText: this.getRoleText(userInfo.role)
      });
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
      // 学生端数据
      try {
        const [contracts, lessons] = await Promise.all([
          get('/students/self/contracts').catch(() => []),
          get('/students/self/lessons').catch(() => [])
        ]);
        this.setData({
          myContracts: Array.isArray(contracts) ? contracts : [],
          recentLessons: Array.isArray(lessons) ? lessons.slice(0, 5) : [],
          loading: false
        });
      } catch (err) {
        console.error('[Dashboard] 学生端加载失败:', err);
        this.setData({ error: err.message || '加载失败', loading: false });
        if (err.code !== 2002) {
          wx.showToast({ title: '数据加载失败，请稍后重试', icon: 'none', duration: 2000 });
        }
      }
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
      url: '/pages/teacher/students',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToLessons() {
    wx.navigateTo({ 
      url: '/pages/teacher/lesson-record',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 学生端导航
  goToMyClasses() {
    wx.navigateTo({
      url: '/pages/student/classes',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToMyLessonRecords() {
    wx.navigateTo({
      url: '/pages/student/lessons',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 运营看板（仅 Admin/SuperAdmin）
  goToDashboard() {
    wx.navigateTo({
      url: '/pages/operation/dashboard/dashboard',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});