// pages/login/login.js
const { post } = require('../../utils/request');
const { getHomePage, setupTabBarByRole } = require('../../utils/role');
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

      // 保存 token（使用统一的 saveLoginInfo 方法）
      app.saveLoginInfo(data.accessToken, data.user, data.expiresIn);

      // 根据角色配置 TabBar 文字和图标
      const role = data.user.role;
      setupTabBarByRole(role);

      // 根据角色跳转到对应首页
      const homePage = getHomePage(role);
      wx.switchTab({ url: homePage });
    } catch (err) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onWechatLogin() {
    var self = this;
    self.setData({ loading: true });

    wx.login({
      success: function(loginRes) {
        if (!loginRes.code) {
          wx.showToast({ title: '微信授权失败，请重试', icon: 'none' });
          self.setData({ loading: false });
          return;
        }

        // 调用后端微信登录接口
        post('/auth/wechat-login', { code: loginRes.code }).then(function(data) {
          // 保存 token 和用户信息
          app.saveLoginInfo(data.accessToken, data.user, data.expiresIn);

          // 配置 TabBar
          var role = data.user.role;
          setupTabBarByRole(role);

          // 跳转首页
          var homePage = getHomePage(role);
          wx.switchTab({ url: homePage });
        }).catch(function(err) {
          wx.showToast({ title: (err && err.message) || '微信登录失败', icon: 'none' });
        }).finally(function() {
          self.setData({ loading: false });
        });
      },
      fail: function() {
        wx.showToast({ title: '微信授权失败', icon: 'none' });
        self.setData({ loading: false });
      }
    });
  }
});