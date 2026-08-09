// pages/student/points/points.js
const { get } = require('../../utils/request');

Page({
  data: {
    summary: { balance: 0, totalEarned: 0, totalSpent: 0 },
    transactions: [],
    loading: true,
    error: null
  },

  onShow() {
    this.loadPoints();
  },

  onPullDownRefresh() {
    this.loadPoints().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadPoints() {
    try {
      this.setData({ loading: true, error: null });
      const data = await get('/students/self/points');
      const summary = data || {};
      const txs = Array.isArray(summary.transactions) ? summary.transactions : [];
      this.setData({
        summary: {
          balance: summary.balance || 0,
          totalEarned: summary.totalEarned || 0,
          totalSpent: summary.totalSpent || 0
        },
        transactions: txs.map(t => ({
          ...t,
          dateText: this.formatDate(t.createdAt),
          isEarn: t.type === 'EARN',
          amountText: (t.amount > 0 ? '+' : '') + t.amount
        })),
        loading: false
      });
    } catch (err) {
      console.error('[Points] 加载积分失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day} ${h}:${min}`;
  },

  goToMall() {
    wx.navigateTo({
      url: '/pkgStudent/pages/points-mall',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
