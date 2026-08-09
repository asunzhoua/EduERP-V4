// pages/reminder/detail.js
var { request } = require('../../utils/request');

// 类型映射
var TYPE_MAP = {
  'CLASS_REMINDER': '课程提醒',
  'ATTENDANCE_REMINDER': '出勤提醒',
  'CONTRACT_EXPIRY': '合同到期',
  'MISSION_STALL': '任务停滞',
  'SYSTEM': '系统通知'
};

// 状态映射
var STATUS_MAP = {
  'PENDING': '待处理',
  'READ': '已读',
  'DISMISSED': '已忽略'
};

Page({
  data: {
    reminder: null,
    loading: true,
    error: null,
    marking: false
  },

  onLoad: function(options) {
    if (options.data) {
      try {
        var data = JSON.parse(decodeURIComponent(options.data));
        // 补充映射字段
        data.typeText = TYPE_MAP[data.type] || '其他';
        data.statusText = STATUS_MAP[data.status] || data.status;
        this.setData({
          reminder: data,
          loading: false
        });
      } catch (e) {
        console.error('[Reminder Detail] 数据解析失败:', e);
        this.setData({
          loading: false,
          error: '数据解析失败'
        });
      }
    } else {
      this.setData({
        loading: false,
        error: '未找到提醒数据'
      });
    }
  },

  // 标记为已读
  onMarkAsRead: function() {
    var self = this;
    var reminder = self.data.reminder;
    if (!reminder || reminder.status !== 'PENDING') return;

    self.setData({ marking: true });

    request({
      url: '/reminders/' + reminder.id + '/read',
      method: 'PATCH'
    }).then(function(res) {
      // 更新本地状态
      self.setData({
        'reminder.status': 'READ',
        'reminder.statusText': '已读',
        marking: false
      });
      wx.showToast({ title: '已标记为已读', icon: 'success' });
    }).catch(function(err) {
      console.error('[Reminder Detail] 标记失败:', err);
      self.setData({ marking: false });
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    });
  },

  // 标记为已忽略
  onDismiss: function() {
    var self = this;
    var reminder = self.data.reminder;
    if (!reminder) return;

    wx.showModal({
      title: '确认操作',
      content: '确定忽略此提醒？',
      success: function(res) {
        if (res.confirm) {
          // 后端没有 dismiss 接口，这里用 markAsRead 代替
          // 如果后续有 dismiss 接口可以替换
          self.setData({ marking: true });
          request({
            url: '/reminders/' + reminder.id + '/read',
            method: 'PATCH'
          }).then(function() {
            self.setData({
              'reminder.status': 'DISMISSED',
              'reminder.statusText': '已忽略',
              marking: false
            });
            wx.showToast({ title: '已忽略', icon: 'success' });
          }).catch(function(err) {
            console.error('[Reminder Detail] 忽略失败:', err);
            self.setData({ marking: false });
            wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  // 返回并刷新列表
  onUnload: function() {
    // 页面卸载时，列表页的 onShow 会自动触发刷新
  }
});
