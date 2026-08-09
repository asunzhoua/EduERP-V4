const { getExceptionDetail, getReschedule } = require('../../utils/lesson-exception-api');

Page({
  data: {
    loading: true,
    error: null,
    detail: {},
    approvals: [],
    reschedule: null
  },

  onLoad(options) {
    this.exceptionId = options.id;
    if (this.exceptionId) {
      this.loadDetail();
    } else {
      this.setData({ error: '缺少参数', loading: false });
    }
  },

  async loadDetail() {
    if (!this.exceptionId) return;
    this.setData({ loading: true, error: null });

    try {
      const detail = await getExceptionDetail(this.exceptionId);
      const statusText = detail.status === 'APPROVED' ? '已通过'
        : detail.status === 'REJECTED' ? '已拒绝'
        : '待审批';
      const typeText = detail.type === 'SUSPEND' ? '停课'
        : detail.type === 'MAKEUP' ? '补课'
        : '请假';

      this.setData({
        detail: {
          id: detail.id,
          type: detail.type,
          typeText: typeText,
          status: detail.status || 'PENDING',
          statusText: statusText,
          courseName: detail.courseName || detail.subject || '--',
          date: detail.date || detail.lessonDate || '--',
          reason: detail.reason || '--',
          remark: detail.remark || ''
        },
        approvals: Array.isArray(detail.approvals) ? detail.approvals : [],
        loading: false
      });

      // 加载补课安排
      if (detail.status === 'APPROVED') {
        this.loadReschedule();
      }
    } catch (err) {
      console.error('[ExceptionDetail] 加载失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  },

  async loadReschedule() {
    try {
      const reschedule = await getReschedule(this.exceptionId);
      if (reschedule) {
        this.setData({ reschedule: reschedule });
      }
    } catch (err) {
      console.warn('[ExceptionDetail] 补课信息加载失败:', err);
    }
  }
});
