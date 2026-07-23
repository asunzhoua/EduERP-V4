// pages/student/class-detail.js
const { get } = require('../../utils/request');

Page({
  data: {
    classCode: '',
    classInfo: null,
    loading: true,
    error: null
  },

  onLoad(options) {
    const { code } = options;
    if (code) {
      this.setData({ classCode: code });
      this.loadData(code);
    } else {
      this.setData({
        error: '缺少班级编码',
        loading: false
      });
    }
  },

  onPullDownRefresh() {
    this.loadData(this.data.classCode).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData(code) {
    this.setData({ loading: true, error: null });

    try {
      // 直接用 classCode 调班级详情 API
      const classDetail = await get('/classes/' + code);
      const info = classDetail.data || classDetail;

      const completedLessons = info.completedLessons || 0;
      const totalLessons = info.totalLessons || 0;
      const progress = totalLessons > 0 ? Math.round(completedLessons / totalLessons * 100) : 0;

      this.setData({
        classInfo: {
          classCode: code,
          subject: info.courseName || '',
          teacherName: info.teacherName || '',
          completedLessons,
          totalLessons,
          progress,
          status: info.status,
          contractCode: info.contractCode || ''
        },
        loading: false
      });
    } catch (err) {
      console.error('[Class Detail Student] 加载失败:', err);
      this.setData({
        error: '班级信息加载失败',
        loading: false
      });
    }
  },

  // 返回班级列表（避免导航栈堆积）
  goToMyClasses() {
    wx.navigateBack({
      fail() {
        // 如果导航栈为空，降级跳转到班级列表
        wx.navigateTo({ url: '/pages/student/classes' });
      }
    });
  },

  // 重试加载
  retryLoad() {
    this.loadData(this.data.classCode);
  },

  // 跳看出勤记录
  goToAttendance() {
    wx.navigateTo({
      url: '/pages/student/attendance',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 跳转课时记录
  goToLessons() {
    wx.navigateTo({
      url: '/pages/student/lessons',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
