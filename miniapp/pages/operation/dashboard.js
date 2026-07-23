// pages/operation/dashboard.js
const { get } = require('../../utils/request');

// 指标说明文案
const METRIC_DESCRIPTIONS = {
  totalStudents: '系统中所有已注册学员的总数，包含在读和休学状态。',
  activeStudents: '近7天内有登录记录或出勤记录的学员数量，反映实际活跃情况。',
  totalClasses: '系统中已创建的班级总数，包含所有状态的班级。',
  activeRate: '活跃学员占总学员的百分比，反映整体学习活跃度。',
  totalCourses: '系统中已开设的课程总数。'
};

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
    refreshing: false,

    // 指标数据
    totalStudents: 0,
    activeStudents: 0,
    totalCourses: 0,
    totalClasses: 0,
    activeRate: '0',

    // 趋势数据（已处理，含 heightPercent）
    enrollmentTrend: [],
    lessonTrend: [],

    // 图表交互
    selectedBar: null,
    selectedBarType: null,

    // 空状态
    isEmpty: false,

    // 指标说明 tooltip
    activeTooltip: '',
    tooltipDesc: '',

    // 趋势摘要
    enrollmentSummary: null,
    lessonSummary: null
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

  // 显示指标说明 tooltip
  showMetricDesc(e) {
    var key = e.currentTarget.dataset.key;
    var desc = METRIC_DESCRIPTIONS[key] || '';
    if (this.data.activeTooltip === key) {
      // 再次点击同一个，关闭 tooltip
      this.setData({ activeTooltip: '', tooltipDesc: '' });
    } else {
      this.setData({ activeTooltip: key, tooltipDesc: desc });
    }
  },

  // 关闭 tooltip
  hideTooltip() {
    this.setData({ activeTooltip: '', tooltipDesc: '' });
  },

  // 计算趋势摘要（总计、日均、最高）
  calcTrendSummary(trendArr) {
    if (!trendArr || trendArr.length === 0) return null;
    var values = trendArr.map(function(item) { return item.value; });
    var total = 0;
    var max = 0;
    var maxDate = '';
    for (var i = 0; i < values.length; i++) {
      total += values[i];
      if (values[i] > max) {
        max = values[i];
        maxDate = trendArr[i].date;
      }
    }
    var avg = Math.round(total / values.length * 10) / 10;
    // 格式化最高日期为 MM/DD
    var maxDateShort = '';
    if (maxDate) {
      var parts = maxDate.split('-');
      maxDateShort = parts[1] + '/' + parts[2];
    }
    return {
      total: total,
      avg: avg,
      max: max,
      maxDate: maxDateShort
    };
  },

  // 处理趋势数据
  processTrend(trendRes) {
    const enrollmentTrend = this.processTrendData(trendRes.enrollmentTrend);
    const lessonTrend = this.processTrendData(trendRes.lessonTrend);
    const enrollmentSummary = this.calcTrendSummary(enrollmentTrend);
    const lessonSummary = this.calcTrendSummary(lessonTrend);
    this.setData({
      enrollmentTrend,
      lessonTrend,
      enrollmentSummary,
      lessonSummary
    });
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
    this.setData({ days: days, selectedBar: null, selectedBarType: null });
    this.loadTrendData();
  },

  // 手动刷新
  onManualRefresh() {
    if (this.data.loading || this.data.refreshing) return;
    this.setData({ refreshing: true });
    this.loadAllData().finally(function() {
      this.setData({ refreshing: false });
    }.bind(this));
  },

  // 图表柱状点击
  onBarTap(e) {
    var index = e.currentTarget.dataset.index;
    var type = e.currentTarget.dataset.type;
    this.setData({
      selectedBar: index,
      selectedBarType: type
    });
  },

  // 数据导出（占位）
  onExportData() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none',
      duration: 2000
    });
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
