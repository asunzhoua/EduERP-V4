// app.js
App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'https://your-domain.com/api'
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
    wx.request({
      url: `${this.globalData.baseUrl}/auth/me`,
      header: {
        'Authorization': `Bearer ${this.globalData.token}`
      },
      success: (res) => {
        if (res.data.success) {
          this.globalData.userInfo = res.data.data;
        } else {
          this.logout();
        }
      },
      fail: () => {
        this.logout();
      }
    });
  },

  logout() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.reLaunch({ url: '/pages/login/login' });
  }
});