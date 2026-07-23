// pages/teacher/classes.js
const { get } = require('../../utils/request');

Page({
  data: {
    classes: [],
    loading: true,
    error: null,
    filter: 'ALL',
    progressMap: {},
    courseCode: ''  // 班级进度缓存
  },

  onLoad(options) {
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    if (role === 'Student' || role === 'Parent') {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    if (options.courseCode) {
      this.setData({ courseCode: options.courseCode });
    }
    this.loadClasses();
  },

  // 下拉刷新
  onPullDownRefresh() {
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
      
      // 计算每个班级的进度
      const progressMap = {};
      classes.forEach(cls => {
        progressMap[cls.classCode] = this.calculateProgress(cls);
      });

      this.setData({
        classes: classes,
        progressMap: progressMap,
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

  // 计算班级进度
  calculateProgress(classItem) {
    if (!classItem.totalLessons || classItem.totalLessons === 0) return 0;
    return Math.round((classItem.completedLessons || 0) / classItem.totalLessons * 100);
  },

  // 筛选切换
  onFilterChange(e) {
    const { value } = e.currentTarget.dataset;
    if (value === this.data.filter) return;
    
    this.setData({ filter: value, classes: [] });
    this.loadClasses();
  },

  // 跳转班级详情
  goToClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pages/teacher/class-detail?code=${code}`,
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
      url: `/pages/teacher/students?classCode=${code}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 记录课时
  goToRecordLesson(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pages/teacher/lesson-record?classCode=${code}`,
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