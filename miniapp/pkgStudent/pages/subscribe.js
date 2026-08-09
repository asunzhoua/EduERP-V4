// pages/student/subscribe/subscribe.js
// 消息订阅管理：展示可用模板、发起订阅授权、查看剩余配额
var wxSubscribe = require('../../utils/wechat-subscribe');

Page({
  data: {
    templates: [],
    loading: true,
    error: null
  },

  onLoad: function () {
    this.loadData();
  },

  loadData: function () {
    var self = this;
    self.setData({ loading: true, error: null });

    return Promise.all([
      wxSubscribe.getTemplates().catch(function () { return []; }),
      wxSubscribe.getMySubscriptions().catch(function () { return []; })
    ]).then(function (results) {
      var templates = results[0] || [];
      var subs = results[1] || [];
      var subMap = {};
      subs.forEach(function (s) { subMap[s.templateType] = s; });

      // 仅展示已配置模板（templateId 非空），避免授权无效 ID
      var items = templates
        .filter(function (t) { return t.templateId; })
        .map(function (t) {
          var my = subMap[t.templateType] || {};
          return {
            templateId: t.templateId,
            templateType: t.templateType,
            templateName: t.templateName || t.templateType,
            templateTitle: t.templateTitle || '',
            fields: t.fields || [],
            fieldDescriptions: t.fieldDescriptions || {},
            quota: my.quota || 0,
            lastSubscribedAt: my.lastSubscribedAt || null
          };
        });

      self.setData({ templates: items, loading: false, error: null });
    }).catch(function (err) {
      console.error('[Subscribe] 加载失败:', err);
      self.setData({ loading: false, error: '加载失败，请稍后重试' });
    });
  },

  onSubscribe: function (e) {
    var index = e.currentTarget.dataset.index;
    var item = this.data.templates[index];
    var self = this;
    if (!item) return;

    wxSubscribe.requestSubscription([item]).then(function () {
      wx.showToast({ title: '订阅成功', icon: 'success' });
      self.loadData();
    }).catch(function () {
      // 用户拒绝或失败：静默刷新状态，不打断
      self.loadData();
    });
  }
});
