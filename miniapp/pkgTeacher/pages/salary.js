// pages/teacher/salary/salary.js
// 教师工资明细：按月查看课时费/底薪/奖金/扣款记录
var request = require('../../utils/request');
var get = request.get;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function currentMonth() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

var SOURCE_MAP = {
  LESSON_FEE: { text: '课时费' },
  BASE: { text: '底薪' },
  DAY: { text: '按天' },
  BONUS: { text: '绩效' },
  ALLOWANCE: { text: '津贴' },
  DEDUCTION: { text: '扣款' },
  OUTING: { text: '外派' }
};

var STATUS_MAP = {
  PENDING: { text: '待确认', cls: 'status-PENDING' },
  APPROVED: { text: '已确认', cls: 'status-APPROVED' },
  PAID: { text: '已发放', cls: 'status-PAID' }
};

Page({
  data: {
    loading: true,
    error: null,
    month: currentMonth(),
    statistics: {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      recordCount: 0
    },
    records: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loadingMore: false
  },

  onLoad: function () {
    this.loadAll();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadAll().then(function () {
      wx.stopPullDownRefresh();
    }).catch(function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  onMonthChange: function (e) {
    this.setData({ month: e.detail.value });
    this.loadAll();
  },

  loadAll: function () {
    var self = this;
    self.setData({ loading: true, error: null, page: 1, records: [], total: 0, hasMore: false });
    return Promise.all([
      this.loadStatistics(),
      this.loadRecords(1, true)
    ]).then(function () {
      self.setData({ loading: false });
    }).catch(function (err) {
      console.error('[TeacherSalary] 加载失败:', err);
      self.setData({ loading: false, error: '加载失败，请稍后重试' });
    });
  },

  loadStatistics: function () {
    var self = this;
    var parts = this.data.month.split('-');
    return get('/salary/my-statistics', {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10)
    }).then(function (data) {
      data = data || {};
      self.setData({
        statistics: {
          totalAmount: data.totalAmount || 0,
          paidAmount: data.paidAmount || 0,
          pendingAmount: data.pendingAmount || 0,
          recordCount: data.recordCount || data.totalRecords || 0
        }
      });
    }).catch(function (err) {
      // 统计失败不阻断列表展示
      console.warn('[TeacherSalary] 统计加载失败:', err);
    });
  },

  loadRecords: function (page, reset) {
    var self = this;
    return get('/salary/my-records', {
      month: this.data.month,
      page: page,
      pageSize: this.data.pageSize
    }).then(function (data) {
      data = data || {};
      var items = Array.isArray(data) ? data : (data.records || data.items || []);
      var processed = items.map(function (item) {
        return self.processRecord(item);
      });
      var total = data.total || 0;
      var merged = reset ? processed : self.data.records.concat(processed);
      self.setData({
        records: merged,
        total: total,
        page: page,
        hasMore: merged.length < total
      });
    });
  },

  loadMore: function () {
    var self = this;
    this.setData({ loadingMore: true });
    this.loadRecords(this.data.page + 1, false).catch(function (err) {
      console.warn('[TeacherSalary] 加载更多失败:', err);
    }).then(function () {
      self.setData({ loadingMore: false });
    });
  },

  processRecord: function (item) {
    var src = SOURCE_MAP[item.source] || { text: item.source || '--' };
    var st = STATUS_MAP[item.status] || { text: item.status || '--', cls: 'status-UNKNOWN' };
    var amount = Number(item.amount) || 0;
    var isDeduction = item.source === 'DEDUCTION';
    return {
      id: item.id,
      sourceText: src.text,
      amount: amount,
      amountText: (isDeduction ? '-' : '') + amount.toFixed(2),
      isDeduction: isDeduction,
      statusText: st.text,
      statusCls: st.cls,
      lessonDate: item.lessonDate ? String(item.lessonDate).substring(0, 10) : '--',
      duration: item.duration,
      studentCount: item.studentCount,
      needsReview: !!item.needsReview,
      notes: item.notes || ''
    };
  }
});
