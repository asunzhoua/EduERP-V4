const { getExceptionDetail, getReschedule } = require('../../../utils/lesson-exception-api');

Page({
  data: {
    loading: true,
    error: null,
    exception: {},
    original: {},
    reschedule: null
  },

  onLoad(options) {
    this.exceptionId = options.id;
    if (this.exceptionId) {
      this.loadData();
    } else {
      this.setData({ error: '缺少参数', loading: false });
    }
  },

  async loadData() {
    if (!this.exceptionId) return;
    this.setData({ loading: true, error: null });
    try {
      const [detail, reschedule] = await Promise.all([
        getExceptionDetail(this.exceptionId),
        getReschedule(this.exceptionId).catch(function() { return null; })
      ]);

      const statusText = detail.status === 'APPROVED' ? '已通过'
        : detail.status === 'REJECTED' ? '已拒绝'
        : '待审批';
      const typeText = detail.type === 'SUSPEND' ? '停课'
        : detail.type === 'MAKEUP' ? '补课'
        : '请假';

      this.setData({
        exception: {
          id: detail.id,
          type: detail.type,
          typeText: typeText,
          status: detail.status || 'PENDING',
          statusText: statusText,
          applicantName: detail.applicantName || detail.studentName || '--'
        },
        original: {
          courseName: detail.courseName || detail.subject || '--',
          date: detail.date || detail.lessonDate || '--',
          startTime: detail.startTime || '--',
          endTime: detail.endTime || '--',
          teacherName: detail.teacherName || '--',
          room: detail.room || '--'
        },
        reschedule: reschedule ? {
          date: reschedule.date || '--',
          startTime: reschedule.startTime || '--',
          endTime: reschedule.endTime || '--',
          teacherName: reschedule.teacherName || '--',
          room: reschedule.room || '--',
          courseName: reschedule.courseName || '--'
        } : null,
        loading: false
      });
    } catch (err) {
      console.error('[RescheduleView] 加载失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  }
});
