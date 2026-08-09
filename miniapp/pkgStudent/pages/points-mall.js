// pages/student/points-mall/points-mall.js
const { get, post } = require('../../utils/request');

Page({
  data: {
    balance: 0,
    products: [],
    loading: true,
    exchangingId: null,
    error: null
  },

  onShow() {
    this.loadMall();
  },

  onPullDownRefresh() {
    this.loadMall().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadMall() {
    let failed = 0;
    this.setData({ loading: true, error: null });
    const [points, products] = await Promise.all([
      get('/students/self/points').catch(() => { failed++; return null; }),
      get('/students/self/points-mall/products').catch(() => { failed++; return null; })
    ]);
    // 全部失败才显示错误态，部分失败容错（保留已成功数据）
    if (failed === 2) {
      this.setData({ error: '加载失败，请稍后重试', loading: false });
      return;
    }
    this.setData({
      balance: (points && points.balance) || 0,
      products: Array.isArray(products) ? products : [],
      loading: false
    });
  },

  async onExchange(e) {
    const productId = e.currentTarget.dataset.id;
    if (!productId || this.data.exchangingId) return;
    const product = this.data.products.find(p => Number(p.id) === Number(productId));
    if (!product) return;

    if (product.pointsPrice > this.data.balance) {
      wx.showToast({ title: '积分不足，无法兑换', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: `确定用 ${product.pointsPrice} 积分兑换「${product.name}」吗？`,
      success: (res) => {
        if (!res.confirm) return;
        this.doExchange(product);
      }
    });
  },

  async doExchange(product) {
    this.setData({ exchangingId: product.id });
    try {
      await post('/students/self/points-mall/exchange', {
        productId: product.id,
        quantity: 1
      });
      wx.showToast({ title: '兑换成功', icon: 'success' });
      this.loadMall();
    } catch (err) {
      // 后端已通过 wx.showToast 提示错误信息
      console.error('[PointsMall] 兑换失败:', err);
    } finally {
      this.setData({ exchangingId: null });
    }
  },

  // 返回积分页（子页，原生返回 + 兜底）
  goBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pkgStudent/pages/points' })
    });
  }
});
