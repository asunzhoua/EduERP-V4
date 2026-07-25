const { getExceptions } = require('../../../utils/lesson-exception-api');

Page({
  data: {
    loading: true,
    error: null,
    records: [],
    filterStatus: ''
  },

  onLoad() {
    this.loadRecords();
  },

  onShow() {
    this.loadRecords();
  },

  onPullDownRefresh() {
    this.loadRecords().finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  async loadRecords() {
    this.setData({ loading: true, error: null });
    try {
      const query = {};
      if (this.data.filterStatus) {
        query.status = this.data.filterStatus;
      }
      const data = await getExceptions(query);
      const records = Array.isArray(data) ? data : (data && data.items ? data.items : []);
      const processed = records.map(function(r) {
        return {
          id: r.id,
          type: r.type || 'LEAVE',
          typeText: r.type === 'SUSPEND' ? '停课' : r.type === 'MAKEUP' ? '补课' : '请假',
          status: r.status || 'PENDING',
          statusText: r.status === 'APPROVED' ? '已通过' : r.status === 'REJECTED' ? '已拒绝' : '待审批',
          courseName: r.courseName || r.subject || '--',
          date: r.date || r.lessonDate || '--',
          reason: r.reason || '--',
          createdAt: r.createdAt || '--'
        };
      });
      this.setData({ records: processed, loading: false });
    } catch (err) {
      console.error('[LeaveRecords] 加载失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  },

  // 状态过滤
  onFilter(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ filterStatus: status }, function() {
      this.loadRecords();
    });
  },

  // 跳转详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/student/exception-detail/exception-detail?id=' + id,
      fail: function() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
