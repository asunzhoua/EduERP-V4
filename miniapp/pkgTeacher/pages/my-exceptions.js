const { getExceptions } = require('../../utils/lesson-exception-api');

Page({
  data: {
    loading: true,
    error: null,
    activeTab: 0,
    todayExceptions: [],
    historyExceptions: [],
    makeups: []
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

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.setData({ activeTab: index });
  },

  async loadData() {
    this.setData({ loading: true, error: null });
    try {
      const data = await getExceptions({});
      const items = Array.isArray(data) ? data : (data && data.items ? data.items : []);

      const todayExceptions = [];
      const historyExceptions = [];
      const makeups = [];

      const now = new Date();
      const todayStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

      items.forEach(function(item) {
        const processed = {
          id: item.id,
          type: item.type || 'LEAVE',
          typeText: item.type === 'SUSPEND' ? '停课' : item.type === 'MAKEUP' ? '补课' : '请假',
          status: item.status || 'PENDING',
          statusText: item.status === 'APPROVED' ? '已通过'
            : item.status === 'REJECTED' ? '已拒绝'
            : '待审批',
          courseName: item.courseName || item.subject || '--',
          studentName: item.studentName || '--',
          reason: item.reason || '--',
          date: item.date || item.lessonDate || '--',
          createdAt: item.createdAt || '--'
        };

        // 根据类型和日期分流
        if (item.type === 'MAKEUP' || item.status === 'APPROVED' && item.makeupDate) {
          makeups.push({
            id: item.id,
            originalCourse: item.courseName || '--',
            date: item.makeupDate || item.date || '--',
            startTime: item.makeupStartTime || '--',
            endTime: item.makeupEndTime || '--',
            studentName: item.studentName || '--'
          });
        }

        // 今日异常
        const itemDate = (item.date || item.lessonDate || '').substring(0, 10);
        if (itemDate === todayStr) {
          todayExceptions.push(processed);
        } else {
          historyExceptions.push(processed);
        }
      });

      this.setData({
        todayExceptions: todayExceptions,
        historyExceptions: historyExceptions,
        makeups: makeups,
        loading: false
      });
    } catch (err) {
      console.error('[MyExceptions] 加载失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pkgStudent/pages/exception-detail?id=' + id,
      fail: function() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
