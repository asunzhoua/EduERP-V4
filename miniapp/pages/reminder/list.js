// pages/reminder/list.js
const { get, request } = require('../../utils/request');

// 状态映射
var STATUS_MAP = {
  'PENDING': '待处理',
  'READ': '已读',
  'DISMISSED': '已忽略'
};

// 类型映射
var TYPE_MAP = {
  'CLASS_REMINDER': '课程提醒',
  'ATTENDANCE_REMINDER': '出勤提醒',
  'CONTRACT_EXPIRY': '合同到期',
  'MISSION_STALL': '任务停滞',
  'SYSTEM': '系统通知'
};

Page({
  data: {
    // 筛选 Tab
    activeFilter: '',
    filters: [
      { label: '全部', value: '' },
      { label: '待处理', value: 'PENDING' },
      { label: '已读', value: 'READ' },
      { label: '已忽略', value: 'DISMISSED' }
    ],

    // 列表数据
    reminders: [],
    loading: true,
    error: null,
    isEmpty: false,

    // 分页
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loadingMore: false,

    // 未读数
    unreadCount: 0
  },

  onLoad: function() {
    this.loadData();
    this.loadUnreadCount();
  },

  onShow: function() {
    // 从详情页返回时刷新列表
    this.loadData();
    this.loadUnreadCount();
  },

  onPullDownRefresh: function() {
    var self = this;
    this.setData({ page: 1 });
    this.loadData().then(function() {
      self.loadUnreadCount();
    }).finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  // 切换筛选
  onFilterChange: function(e) {
    var value = e.currentTarget.dataset.value;
    this.setData({
      activeFilter: value,
      page: 1,
      reminders: []
    });
    this.loadData();
  },

  // 加载提醒列表
  loadData: function() {
    var self = this;
    self.setData({ loading: true, error: null });

    var params = {
      page: self.data.page,
      pageSize: self.data.pageSize
    };
    if (self.data.activeFilter) {
      params.status = self.data.activeFilter;
    }

    return get('/reminders', params).then(function(res) {
      var items = (res && res.items) || [];
      // 格式化数据
      var formatted = items.map(function(item) {
        return {
          id: item.id,
          title: item.title || '未命名提醒',
          content: item.content || '',
          type: item.type,
          typeText: TYPE_MAP[item.type] || '其他',
          status: item.status,
          statusText: STATUS_MAP[item.status] || item.status,
          createdAt: self.formatDate(item.createdAt),
          createdAtRaw: item.createdAt,
          readAt: item.readAt ? self.formatDate(item.readAt) : '',
          relatedEntityType: item.relatedEntityType || '',
          relatedEntityId: item.relatedEntityId || null
        };
      });

      var total = (res && res.total) || 0;
      self.setData({
        reminders: formatted,
        total: total,
        hasMore: formatted.length < total,
        loading: false,
        isEmpty: formatted.length === 0
      });
    }).catch(function(err) {
      console.error('[Reminder] 加载失败:', err);
      self.setData({
        loading: false,
        error: '加载失败，请稍后重试'
      });
    });
  },

  // 加载更多
  loadMore: function() {
    var self = this;
    if (self._loadingMore) return;
    self._loadingMore = true;
    self.setData({ loadingMore: true });

    var nextPage = self.data.page + 1;
    var params = {
      page: nextPage,
      pageSize: self.data.pageSize
    };
    if (self.data.activeFilter) {
      params.status = self.data.activeFilter;
    }

    get('/reminders', params).then(function(res) {
      var items = (res && res.items) || [];
      var formatted = items.map(function(item) {
        return {
          id: item.id,
          title: item.title || '未命名提醒',
          content: item.content || '',
          type: item.type,
          typeText: TYPE_MAP[item.type] || '其他',
          status: item.status,
          statusText: STATUS_MAP[item.status] || item.status,
          createdAt: self.formatDate(item.createdAt),
          createdAtRaw: item.createdAt,
          readAt: item.readAt ? self.formatDate(item.readAt) : '',
          relatedEntityType: item.relatedEntityType || '',
          relatedEntityId: item.relatedEntityId || null
        };
      });

      var allItems = self.data.reminders.concat(formatted);
      var total = (res && res.total) || 0;
      self.setData({
        reminders: allItems,
        page: nextPage,
        total: total,
        hasMore: allItems.length < total,
        loadingMore: false
      });
    }).catch(function(err) {
      console.error('[Reminder] 加载更多失败:', err);
      self.setData({ loadingMore: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }).finally(function() {
      self._loadingMore = false;
    });
  },

  // 加载未读数
  loadUnreadCount: function() {
    var self = this;
    get('/reminders/unread-count').then(function(res) {
      self.setData({
        unreadCount: (res && res.count) || 0
      });
    }).catch(function() {
      // 静默失败
    });
  },

  // 点击提醒 → 跳转详情
  onReminderTap: function(e) {
    var item = e.currentTarget.dataset.item;
    var jsonStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({
      url: '/pages/reminder/detail?data=' + jsonStr,
      fail: function() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 全部标记已读
  onMarkAllRead: function() {
    var self = this;
    if (self.data.unreadCount === 0) {
      wx.showToast({ title: '没有未读提醒', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认操作',
      content: '确定将所有提醒标记为已读？',
      success: function(res) {
        if (res.confirm) {
          request({
            url: '/api/v1/reminders/read-all',
            method: 'PATCH'
          }).then(function() {
            wx.showToast({ title: '已全部标记为已读', icon: 'success' });
            self.setData({ page: 1 });
            self.loadData();
            self.loadUnreadCount();
          }).catch(function(err) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
        }
      }
    });
  },

  // 格式化日期
  formatDate: function(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var month = (d.getMonth() + 1);
    var day = d.getDate();
    var hours = d.getHours();
    var minutes = d.getMinutes();
    return month + '-' + day + ' ' + (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
  },

  // 重试
  onRetry: function() {
    this.setData({ page: 1 });
    this.loadData();
  }
});
