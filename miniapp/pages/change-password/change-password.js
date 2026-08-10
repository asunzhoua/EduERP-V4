// pages/change-password/change-password.js
const { post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    loading: false
  },

  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var data = {};
    data[field] = e.detail.value;
    this.setData(data);
  },

  onSubmit: function () {
    var self = this;
    if (self.data.loading) return; // 防重复点击

    var oldPassword = self.data.oldPassword || '';
    var newPassword = self.data.newPassword || '';
    var confirmPassword = self.data.confirmPassword || '';

    if (!oldPassword || !newPassword || !confirmPassword) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    // 与后端 change-password.dto.ts 校验规则一致：大小写字母+数字，6-64 位
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,64}$/.test(newPassword)) {
      wx.showToast({ title: '新密码需包含大小写字母和数字，长度 6-64 位', icon: 'none' });
      return;
    }
    if (newPassword === oldPassword) {
      wx.showToast({ title: '新密码不能与原密码相同', icon: 'none' });
      return;
    }
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' });
      return;
    }

    self.setData({ loading: true });
    post('/auth/change-password', {
      oldPassword: oldPassword,
      newPassword: newPassword
    }).then(function () {
      wx.showToast({ title: '密码修改成功，请重新登录', icon: 'success' });
      setTimeout(function () {
        app.logout();
      }, 1200);
    }).catch(function () {
      // request.js 已弹具体错误（如原密码错误），留在当前页
    }).finally(function () {
      self.setData({ loading: false });
    });
  },

  goBack: function () {
    wx.navigateBack({
      fail: function () {
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  }
});
