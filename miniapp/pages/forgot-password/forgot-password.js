// pages/forgot-password/forgot-password.js
// 找回密码（B2 方案）：不依赖后端短信验证码，改为引导家长联系机构线下重置。
Page({
  // 联系机构引导（无机构电话等品牌信息，不做假调用）
  goContact() {
    wx.showModal({
      title: '联系机构',
      content: '请拨打机构前台电话，或在小程序「我的-联系客服」留言；机构核实身份后为您重置密码。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/login/login' })
    });
  }
});
