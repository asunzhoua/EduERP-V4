// pages/operation/dashboard.js
const { get } = require('../../utils/request');

Page({
  data: {
    // 权限
    hasPermission: true,

    // Tab
    activeTab: 0,
    tabs: ['学员概览', '课程概览', '趋势分析'],

    // 时间范围
    days: 7,

    // 状态
    loading: true,
    error: null,
    trendLoading: false,
    trendError: null,

    // 指标数据
    totalStudents: 0,
    activeStudents: 0,
    totalCourses: 0,
    totalClasses: 0,
    activeRate: '0',

    // 趋势数据（已处理，含 heightPercent）
    enrollmentTrend: [],
    lessonTrend: [],

    // 空状态
    isEmpty: false
  },

  onLoad() {
    // 权限检查
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    if (!userInfo || (userInfo.role !== 'Admin' && userInfo.role !== 'SuperAdmin')) {
      this.setData({ hasPermission: false, loading: false });
      return;
    }
    this.setData({ hasPermission: true });
    this.loadAllData();
  },

  // 下拉刷新
  onPullDownRefresh() {
    if (!this.data.hasPermission) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadAllData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载全部数据
  async loadAllData() {
    this.setData({ loading: true, error: null });

    try {
      const [metricsRes, trendRes] = await Promise.all([
        get('/analytics/institution').catch(() => null),
        get('/analytics/institution/trend', { days: this.data.days }).catch(() => null)
      ]);

      // 处理指标数据
      if (metricsRes && metricsRes.metrics) {
        this.processMetrics(metricsRes.metrics);
      } else {
        // 指标为空，设置默认值
        this.setData({
          totalStudents: 0,
          activeStudents: 0,
          totalCourses: 0,
          totalClasses: 0,
          activeRate: '0',
          isEmpty: true
        });
      }

      // 处理趋势数据
      if (trendRes) {
        this.processTrend(trendRes);
      } else {
        this.setData({
          enrollmentTrend: [],
          lessonTrend: []
        });
      }

      this.setData({ loading: false, error: null });
    } catch (err) {
      console.error('[Dashboard] 加载失败:', err);
      this.setData({
        loading: false,
        error: err.message || '数据加载失败，请稍后重试'
      });
    }
  },

  // 仅加载趋势数据（切换时间范围时）
  async loadTrendData() {
    this.setData({ trendLoading: true, trendError: null });

    try {
      const trendRes = await get('/analytics/institution/trend', { days: this.data.days });
      if (trendRes) {
        this.processTrend(trendRes);
      } else {
        this.setData({ enrollmentTrend: [], lessonTrend: [] });
      }
      this.setData({ trendLoading: false });
    } catch (err) {
      console.error('[Dashboard] 趋势加载失败:', err);
      this.setData({
        trendLoading: false,
        trendError: '趋势数据加载失败'
      });
    }
  },

  // 处理指标数据
  processMetrics(metrics) {
    const data = {};
    metrics.forEach(function(m) {
      data[m.name] = m.value || 0;
    });

    const totalStudents = data.totalStudents || 0;
    const activeStudents = data.activeStudents || 0;
    const totalCourses = data.totalCourses || 0;
    const totalClasses = data.totalClasses || 0;

    // 计算活跃率
    let activeRate = '0';
    if (totalStudents > 0) {
      activeRate = Math.round((activeStudents / totalStudents) * 100).toString();
    }

    const isEmpty = totalStudents === 0 && totalCourses === 0 && totalClasses === 0;

    this.setData({
      totalStudents: totalStudents,
      activeStudents: activeStudents,
      totalCourses: totalCourses,
      totalClasses: totalClasses,
      activeRate: activeRate,
      isEmpty: isEmpty
    });
  },

  // 处理趋势数据
  processTrend(trendRes) {
    const enrollmentTrend = this.processTrendData(trendRes.enrollmentTrend);
    const lessonTrend = this.processTrendData(trendRes.lessonTrend);
    this.setData({ enrollmentTrend, lessonTrend });
  },

  // 趋势数据预处理 — 计算柱状图高度百分比
  processTrendData(trend) {
    if (!trend || trend.length === 0) return [];
    var maxVal = 0;
    for (var i = 0; i < trend.length; i++) {
      if (trend[i].value > maxVal) maxVal = trend[i].value;
    }
    if (maxVal === 0) maxVal = 1;

    return trend.map(function(d) {
      return {
        date: d.date,
        shortDate: d.date.slice(5),
        value: d.value,
        heightPercent: Math.round((d.value / maxVal) * 100)
      };
    });
  },

  // Tab 切换
  switchTab(e) {
    var index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
  },

  // 时间范围切换
  switchDays(e) {
    var days = e.currentTarget.dataset.days;
    if (days === this.data.days) return;
    this.setData({ days: days });
    this.loadTrendData();
  },

  // 重试
  retry() {
    this.loadAllData();
  },

  // 返回首页
  goBack() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 重试趋势加载
  retryTrend() {
    this.loadTrendData();
  }
});
