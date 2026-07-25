const { getExceptions } = require('../../../utils/lesson-exception-api');

Page({
  data: {
    loading: true,
    error: null,
    exceptions: [],
    filter: {
      status: '',
      type: ''
    }
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  // 状态过滤
  onFilterStatus(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ 'filter.status': value }, function() {
      this.loadData();
    });
  },

  // 类型过滤
  onFilterType(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ 'filter.type': value }, function() {
      this.loadData();
    });
  },

  async loadData() {
    this.setData({ loading: true, error: null });
    try {
      const query = {};
      if (this.data.filter.status) {
        query.status = this.data.filter.status;
      }
      if (this.data.filter.type) {
        query.type = this.data.filter.type;
      }
      const data = await getExceptions(query);
      const items = Array.isArray(data) ? data : (data && data.items ? data.items : []);
      const processed = items.map(function(item) {
        return {
          id: item.id,
          type: item.type || 'LEAVE',
          typeText: item.type === 'SUSPEND' ? '停课' : item.type === 'MAKEUP' ? '补课' : '请假',
          status: item.status || 'PENDING',
          statusText: item.status === 'APPROVED' ? '已通过'
            : item.status === 'REJECTED' ? '已拒绝'
            : '待审批',
          applicantName: item.applicantName || item.studentName || '--',
          courseName: item.courseName || item.subject || '--',
          reason: item.reason || '--',
          date: item.date || item.lessonDate || '--',
          createdAt: item.createdAt || '--'
        };
      });
      this.setData({ exceptions: processed, loading: false });
    } catch (err) {
      console.error('[ExceptionList] 加载失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  },

  // 跳转审批页面
  goToApprove(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/operation/exception-approve/exception-approve?id=' + id,
      fail: function() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
