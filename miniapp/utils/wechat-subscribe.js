// utils/wechat-subscribe.js
// 微信订阅消息封装：模板列表 / 发起授权（wx.requestSubscribeMessage + 回传后端）/ 我的订阅
var request = require('./request');
var get = request.get;
var post = request.post;

/** 获取后端可用模板列表。 */
function getTemplates() {
  return get('/wechat/subscribe/templates').then(function (data) {
    return (data && data.templates) || [];
  });
}

/**
 * 发起订阅授权：调 wx.requestSubscribeMessage，把 accept/reject/ban 结果回传后端。
 * @param {Array<{templateId:string,templateType:string}>} templates 已配置模板
 * @returns {Promise}
 */
function requestSubscription(templates) {
  var available = templates.filter(function (t) { return t.templateId; });
  if (available.length === 0) {
    return Promise.reject({ message: '暂无可用订阅模板' });
  }

  var tmplIds = available.map(function (t) { return t.templateId; });

  return new Promise(function (resolve, reject) {
    wx.requestSubscribeMessage({
      tmplIds: tmplIds,
      success: function (res) {
        // res[templateId] = 'accept' | 'reject' | 'ban'
        var subscriptions = available.map(function (t) {
          return {
            templateId: t.templateId,
            templateType: t.templateType,
            status: res[t.templateId] || 'reject'
          };
        });
        post('/wechat/subscribe', { subscriptions: subscriptions })
          .then(resolve)
          .catch(reject);
      },
      fail: function (err) {
        // 用户取消授权弹窗等场景，静默返回，不阻塞
        reject(err);
      }
    });
  });
}

/** 查询当前用户订阅列表（含剩余配额）。 */
function getMySubscriptions() {
  return get('/wechat/subscribe/my').then(function (data) {
    return (data && data.subscriptions) || [];
  });
}

/**
 * 登录成功后轻提示：仅微信登录（已有 openid）触发，且每个设备只提示一次。
 */
function offerSubscriptionOnLogin() {
  try {
    if (wx.getStorageSync('wxSubscribePrompted')) return;

    getTemplates().then(function (templates) {
      var available = templates.filter(function (t) { return t.templateId; });
      if (available.length === 0) return;

      wx.setStorageSync('wxSubscribePrompted', true);
      wx.showModal({
        title: '开启消息提醒',
        content: '订阅后可在微信接收考勤、课时变动等通知，是否开启？',
        confirmText: '去开启',
        cancelText: '暂不',
        success: function (res) {
          if (res.confirm) {
            requestSubscription(available)
              .then(function () {
                wx.showToast({ title: '订阅成功', icon: 'success' });
              })
              .catch(function () {
                // 用户拒绝或失败：不打扰
              });
          }
        }
      });
    }).catch(function () {
      // 静默失败
    });
  } catch (e) {
    // 静默失败
  }
}

module.exports = {
  getTemplates: getTemplates,
  requestSubscription: requestSubscription,
  getMySubscriptions: getMySubscriptions,
  offerSubscriptionOnLogin: offerSubscriptionOnLogin
};
