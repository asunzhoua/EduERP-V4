// pages/student/classes.js
const { get } = require('../../utils/request');

Page({
  data: {
    classes: [],
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
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    if (this._dataLoading) return;
    this._dataLoading = true;
    this.setData({ loading: true, error: null });

    try {
      const contracts = await get('/students/self/contracts');
      
      const classes = contracts.map(c => ({
        classCode: c.classCode,
        subject: c.subject,
        teacherName: c.teacherName || '',
        totalLessons: c.totalLessons,
        remainingLessons: c.remainingLessons,
        progress: c.totalLessons > 0 
          ? Math.round((c.totalLessons - c.remainingLessons) / c.totalLessons * 100) 
          : 0
      }));

      this.setData({ classes, loading: false });
    } catch (err) {
      console.error('[Classes] 加载失败:', err);
      this.setData({
        error: '数据加载失败，请稍后重试',
        loading: false
      });
    } finally {
      this._dataLoading = false;
    }
  },

  goToDetail(e) {
    const classData = e.currentTarget.dataset.class;
    wx.navigateTo({
      url: `/pages/student/class-detail?code=${classData.classCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
