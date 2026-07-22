// pages/login/login.js
const { post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    username: '',
    password: '',
    loading: false
  },

  onInputUsername(e) {
    this.setData({ username: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async onLogin() {
    const { username, password } = this.data;

    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const data = await post('/auth/login', { username, password });

      // 保存 token
      app.globalData.token = data.accessToken;
      app.globalData.userInfo = data.user;
      wx.setStorageSync('token', data.accessToken);

      // 根据角色跳转
      const role = data.user.role;
      if (role === 'Teacher') {
        wx.switchTab({ url: '/pages/index/index' });
      } else if (role === 'Student' || role === 'Parent') {
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        wx.switchTab({ url: '/pages/index/index' });
      }
    } catch (err) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onWechatLogin() {
    // 微信授权登录（待实现）
    wx.showToast({ title: '微信授权登录待实现', icon: 'none' });
  }
});