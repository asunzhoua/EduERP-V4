// pages/student/consume-records.js
const { get } = require('../../utils/request');

const SUBJECT_LABELS = {
  MATH: '数学', ENGLISH: '英语', CHINESE: '语文', PHYSICS: '物理',
  CHEMISTRY: '化学', ART: '美术', MUSIC: '音乐', DANCE: '舞蹈',
  SPORTS: '体育', CODING: '编程', OTHER: '其他'
};

const PAGE_SIZE = 20;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

Page({
  data: {
    contractCode: '',
    records: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    hasMore: true,
    loading: true,
    loadingMore: false,
    error: null
  },

  onLoad(options) {
    const { code } = options;
    if (!code) {
      this.setData({ error: '缺少合同编号', loading: false });
      return;
    }
    this.setData({ contractCode: code });
    this.loadRecords(1, true);
  },

  onPullDownRefresh() {
    this.loadRecords(1, true).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) {
      this.loadRecords(this.data.page + 1, false);
    }
  },

  async loadRecords(page, reset) {
    if (reset) {
      this.setData({ loading: true, error: null });
    } else {
      this.setData({ loadingMore: true });
    }

    try {
      const data = await get('/contracts/' + this.data.contractCode + '/consume-records', {
        page: page,
        pageSize: PAGE_SIZE
      });
      const items = Array.isArray(data) ? data : (data && data.items ? data.items : []);
      const total = data && data.total != null ? data.total : items.length;
      const processed = items.map((r) => ({
        lessonId: r.lessonId,
        lessonDate: r.lessonDate || '',
        startTime: r.startTime || '',
        endTime: r.endTime || '',
        courseName: r.courseName || '',
        subjectLabel: SUBJECT_LABELS[r.subject] || r.subject || '',
        lessonTypeLabel: r.lessonTypeLabel || (r.lessonType === 'MAKEUP' ? '补课' : '正常'),
        lessonsConsumed: r.lessonsConsumed || 1,
        topic: r.topic || '',
        status: r.status || '',
        deductedAt: formatDateTime(r.deductedAt)
      }));

      this.setData({
        records: reset ? processed : this.data.records.concat(processed),
        total: total,
        page: page,
        hasMore: items.length >= PAGE_SIZE,
        loading: false,
        loadingMore: false
      });
    } catch (err) {
      console.error('[ConsumeRecords] 加载失败:', err);
      this.setData({
        loading: false,
        loadingMore: false,
        error: reset ? (err.message || '加载失败') : this.data.error
      });
    }
  },

  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  }
});
