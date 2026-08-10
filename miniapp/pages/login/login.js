// pages/login/login.js
const { post } = require('../../utils/request');
const { getHomePage, setupTabBarByRole } = require('../../utils/role');
const wxSubscribe = require('../../utils/wechat-subscribe');
const app = getApp();

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    agreed: false   // 协议勾选，未勾选禁用登录
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  goToAgreement(e) {
    const type = e.currentTarget.dataset.type;
    const url = type === 'privacy'
      ? '/pages/agreement/privacy-policy/privacy-policy'
      : '/pages/agreement/user-agreement/user-agreement';
    wx.navigateTo({ url });
  },

  goToForgot() {
    wx.navigateTo({ url: '/pages/forgot-password/forgot-password' });
  },

  onShow() {
    // 注册成功后回填用户名
    const prefill = wx.getStorageSync('prefillUsername');
    if (prefill) {
      this.setData({ username: prefill });
      wx.removeStorageSync('prefillUsername');
    }
  },

  goToRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  onInputUsername(e) {
    this.setData({ username: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async onLogin() {
    if (this.data.loading) return;   // 防双击穿透（setData 异步渲染前两次 tap 都能进）
    const { username, password, agreed } = this.data;

    if (!agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议', icon: 'none' });
      return;
    }
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const data = await post('/auth/login', { username, password });

      // 保存 token（使用统一的 saveLoginInfo 方法）
      app.saveLoginInfo(data.accessToken, data.user, data.expiresIn);

      // 静默绑定微信（best-effort，失败不影响登录）
      wx.login({
        success: function(res) {
          if (res.code) {
            post('/auth/wechat/bind', { code: res.code }, { silent: true }).catch(function() {});
          }
        }
      });

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

          // 微信登录已有 openid，轻提示引导开启订阅消息
          wxSubscribe.offerSubscriptionOnLogin();
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