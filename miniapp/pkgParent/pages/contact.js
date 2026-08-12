// pkgParent/pages/contact.js
const { get } = require('../../utils/request');

Page({
  data: {
    contactInfo: {
      name: '',
      address: '',
      phone: ''
    }
  },

  onLoad() {
    this.loadContact();
  },

  // 加载机构联系信息
  loadContact() {
    var self = this;
    get('/public/settings/contact').then(function (res) {
      var info = res || {};
      self.setData({
        contactInfo: {
          name: info.name || '',
          address: info.address || '',
          phone: info.phone || ''
        }
      });
    }).catch(function () {
      // 加载失败保持空态，页面展示占位文案
    });
  },

  callPhone() {
    var phone = this.data.contactInfo.phone;
    if (!phone) {
      wx.showToast({ title: '机构暂未提供联系电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: function () {
        wx.showToast({ title: '拨打电话失败', icon: 'none' });
      }
    });
  },

  goBack() {
    wx.navigateBack({
      fail: function () {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  }
});
