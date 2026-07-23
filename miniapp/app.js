// app.js
const config = require('./config')

App({
  globalData: {
    userInfo: null,
    token: null,
    tokenExpiry: null,  // Token 过期时间戳（毫秒）
    baseUrl: config.baseUrl,
    systemInfo: null,   // 系统信息缓存
  },

  onLaunch() {
    // 获取系统信息（用于兼容性判断）
    try {
      this.globalData.systemInfo = wx.getSystemInfoSync();
    } catch (e) {
      console.warn('[App] getSystemInfoSync failed:', e);
    }

    // 检查登录状态
    const token = wx.getStorageSync('token');
    const tokenExpiry = wx.getStorageSync('tokenExpiry');

    if (token) {
      // 检查本地存储的 token 是否已过期
      if (tokenExpiry && Date.now() > tokenExpiry) {
        console.log('[App] Token expired locally, clearing');
        this.logout();
        return;
      }
      this.globalData.token = token;
      this.globalData.tokenExpiry = tokenExpiry || null;
      this.checkLoginStatus();
    }
  },

  checkLoginStatus() {
    // 验证 token 是否有效
    var self = this;
    var requestModule = require('./utils/request');
    requestModule.get('/auth/me').then(function(data) {
      self.globalData.userInfo = data;
    }).catch(function() {
      // 静默失败 — request.js 的 token 过期处理会负责跳转
      // 这里不重复调用 logout，避免双重跳转
      console.warn('[App] checkLoginStatus failed, waiting for request interceptor');
    });
  },

  /**
   * 保存登录信息
   * @param {string} token - JWT token
   * @param {number} [expiresIn] - 过期时间（秒），默认 86400（24小时）
   * @param {Object} userInfo - 用户信息
   */
  saveLoginInfo(token, userInfo, expiresIn) {
    this.globalData.token = token;
    this.globalData.userInfo = userInfo;

    // 计算并存储 token 过期时间
    var expiry = Date.now() + (expiresIn || 86400) * 1000;
    this.globalData.tokenExpiry = expiry;

    wx.setStorageSync('token', token);
    wx.setStorageSync('tokenExpiry', expiry);
  },

  logout() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    this.globalData.tokenExpiry = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('tokenExpiry');
    wx.reLaunch({ url: '/pages/login/login' });
  }
});