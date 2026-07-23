// pages/student/index.js
const { get } = require('../../utils/request');

Page({
  data: {
    studentInfo: {},
    contracts: [],
    recentLessons: [],
    overviewStats: { totalLessons: 0, usedLessons: 0, remainingLessons: 0, overallProgress: 0 },
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
    this.loadData();
  },

  onShow() {
    // 每次显示页面时都刷新数据（从详情页返回时需要更新）
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
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

      this.setData({
        studentInfo: info || {},
        contracts: contractList,
        recentLessons: Array.isArray(lessons) ? lessons.slice(0, 5) : [],
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
  }
});
