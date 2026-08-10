// pages/parent/index.js
const { get } = require('../../utils/request');

Page({
  data: {
    children: [],
    loading: true,
    error: null
  },

  onLoad() {
    this.loadChildren();
  },

  onShow() {
    this.loadChildren();
  },

  onPullDownRefresh() {
    this.loadChildren().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadChildren() {
    this.setData({ loading: true, error: null });

    try {
      const data = await get('/students/my-children');
      const children = Array.isArray(data) ? data : (data.items || []);
      
      this.setData({
        children: children,
        loading: false
      });
    } catch (err) {
      console.error('[Parent] 加载孩子列表失败:', err);
      this.setData({
        error: '加载失败，请稍后重试',
        loading: false
      });
    }
  },

  goToAddStudent() {
    wx.navigateTo({
      url: '/pkgParent/pages/add-student',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  goToChildDetail(e) {
    const { id, name, studentcode, school, grade } = e.currentTarget.dataset;
    // 将基本信息通过 URL 参数传递
    wx.navigateTo({
      url: `/pkgParent/pages/child-detail?id=${id}&name=${encodeURIComponent(name || '')}&studentCode=${encodeURIComponent(studentcode || '')}&school=${encodeURIComponent(school || '')}&grade=${encodeURIComponent(grade || '')}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
