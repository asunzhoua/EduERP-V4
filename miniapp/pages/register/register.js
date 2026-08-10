// pages/register/register.js
var post = require('../../utils/request').post;
var { getHomePage, setupTabBarByRole } = require('../../utils/role');
var app = getApp();

Page({
  data: {
    role: 'Parent',
    username: '',
    name: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    loading: false
  },

  onSelectRole: function (e) {
    var role = e.currentTarget.dataset.role;
    if (role === 'Teacher' || role === 'Parent') {
      this.setData({ role: role });
    }
  },

  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var data = {};
    data[field] = e.detail.value;
    this.setData(data);
  },

  onRegister: function () {
    var self = this;
    if (self.data.loading) return; // 防重复点击

    var data = self.data;
    var username = (data.username || '').trim();
    var name = (data.name || '').trim();
    var mobile = (data.mobile || '').trim();
    var password = data.password || '';
    var confirmPassword = data.confirmPassword || '';

    if (!username || !name || !mobile || !password) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码至少 6 位', icon: 'none' });
      return;
    }
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }

    self.setData({ loading: true });
    var registered = false;

    post('/auth/register', {
      username: username,
      name: name,
      mobile: mobile,
      password: password,
      role: self.data.role
    }).then(function () {
      // 注册成功 → 自动登录
      registered = true;
      return post('/auth/login', {
        username: username,
        password: password
      });
    }).then(function (data) {
      app.saveLoginInfo(data.accessToken, data.user, data.expiresIn);
      setupTabBarByRole(data.user.role);
      wx.showToast({ title: '注册成功', icon: 'success' });
      wx.switchTab({ url: getHomePage(data.user.role) });
    }).catch(function () {
      // 注册失败：request.js 已弹具体错误，留在当前页
      // 注册成功但自动登录失败：回登录页并回填用户名，让用户手动登录
      if (registered) {
        wx.setStorageSync('prefillUsername', username);
        wx.navigateBack();
      }
    }).finally(function () {
      self.setData({ loading: false });
    });
  },

  goToAgreement: function (e) {
    var type = e.currentTarget.dataset.type;
    var url = type === 'privacy'
      ? '/pages/agreement/privacy-policy/privacy-policy'
      : '/pages/agreement/user-agreement/user-agreement';
    wx.navigateTo({ url: url });
  },

  goToLogin: function () {
    wx.navigateBack();
  }
});
