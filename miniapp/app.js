// app.js
const config = require('./config')

App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: config.baseUrl,
  },

  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.checkLoginStatus();
    }
  },

  checkLoginStatus() {
    // 验证 token 是否有效
    const { get } = require('./utils/request');
    get('/auth/me').then(data => {
      this.globalData.userInfo = data;
    }).catch(() => {
      this.logout();
    });
  },

  logout() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.reLaunch({ url: '/pages/login/login' });
  }
});