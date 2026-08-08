// pages/parent/child-detail.js
const { get } = require('../../utils/request');

Page({
  data: {
    childId: null,
    childInfo: null,
    contracts: [],
    attendance: [],
    loading: true,
    error: null,
    activeTab: 'overview'
  },

  onLoad(options) {
    if (options.id) {
      // 从 URL 参数获取基本信息
      const childInfo = {
        id: options.id,
        name: decodeURIComponent(options.name || ''),
        studentCode: decodeURIComponent(options.studentCode || ''),
        school: decodeURIComponent(options.school || ''),
        grade: decodeURIComponent(options.grade || '')
      };
      
      this.setData({ 
        childId: options.id,
        childInfo: childInfo
      });
      this.loadData(options.id);
    }
  },

  onShow() {
    // 首次进入由 onLoad 加载；返回页面时刷新拿到最新课时
    if (!this._inited) {
      this._inited = true;
      return;
    }
    if (this.data.childId) {
      this.loadData(this.data.childId);
    }
  },

  onPullDownRefresh() {
    if (this.data.childId) {
      this.loadData(this.data.childId).finally(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  async loadData(childId) {
    this.setData({ loading: true, error: null });

    try {
      // 只请求合同和出勤数据
      const [contracts, attendance] = await Promise.all([
        get(`/students/${childId}/contracts`).catch(() => []),
        get(`/students/${childId}/attendance`).catch(() => [])
      ]);

      this.setData({
        contracts: Array.isArray(contracts) ? contracts : (contracts.items || []),
        attendance: Array.isArray(attendance) ? attendance : (attendance.items || []),
        loading: false
      });
    } catch (err) {
      console.error('[Parent] 加载孩子详情失败:', err);
      this.setData({
        error: '加载失败，请稍后重试',
        loading: false
      });
    }
  },

  onTabChange(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({ activeTab: tab });
  }
});
