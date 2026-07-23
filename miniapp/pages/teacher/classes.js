// pages/teacher/classes.js
const { get } = require('../../utils/request');

Page({
  data: {
    classes: [],
    loading: true,
    filter: 'ALL',
    progressMap: {}  // 班级进度缓存
  },

  onLoad() {
    const app = getApp();
    const role = app.globalData.userInfo?.role;
    if (role === 'Student' || role === 'Parent') {
      wx.redirectTo({ url: '/pages/student/classes' });
      return;
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
    this.setData({ loading: true });

    try {
      const data = await get('/classes', {
        status: this.data.filter === 'ALL' ? undefined : this.data.filter
      });

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
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
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
      url: `/pages/teacher/students?classCode=${code}`
    });
  },

  // 记录课时
  goToRecordLesson(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pages/teacher/lesson-record?classCode=${code}`
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