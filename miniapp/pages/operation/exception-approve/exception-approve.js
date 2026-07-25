const { getExceptionDetail, approveException, rejectException } = require('../../../utils/lesson-exception-api');

Page({
  data: {
    loading: true,
    error: null,
    submitting: false,
    detail: {},
    approvals: [],
    remark: ''
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
      const applicantRoleText = detail.applicantRole === 'Teacher' ? '教师'
        : detail.applicantRole === 'Parent' ? '家长'
        : '--';

      this.setData({
        detail: {
          id: detail.id,
          type: detail.type,
          typeText: typeText,
          status: detail.status || 'PENDING',
          statusText: statusText,
          applicantName: detail.applicantName || detail.studentName || '--',
          applicantRole: detail.applicantRole || '',
          applicantRoleText: applicantRoleText,
          courseName: detail.courseName || detail.subject || '--',
          date: detail.date || detail.lessonDate || '--',
          reason: detail.reason || '--',
          attachments: detail.attachments || []
        },
        approvals: Array.isArray(detail.approvals) ? detail.approvals : [],
        loading: false
      });
    } catch (err) {
      console.error('[ExceptionApprove] 加载失败:', err);
      this.setData({ error: '加载失败，请稍后重试', loading: false });
    }
  },

  onInputRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  // 审批通过
  async onApprove() {
    const self = this;
    wx.showModal({
      title: '确认通过',
      content: '确定要通过此申请吗？',
      success: async function(res) {
        if (res.confirm) {
          self.setData({ submitting: true });
          try {
            await approveException(self.exceptionId, {
              remark: self.data.remark.trim()
            });
            wx.showToast({ title: '已通过', icon: 'success' });
            setTimeout(function() {
              wx.navigateBack();
            }, 1500);
          } catch (err) {
            console.error('[ExceptionApprove] 审批失败:', err);
            wx.showToast({ title: '操作失败，请稍后重试', icon: 'none' });
          } finally {
            self.setData({ submitting: false });
          }
        }
      }
    });
  },

  // 审批拒绝
  async onReject() {
    const self = this;
    if (!this.data.remark.trim()) {
      wx.showToast({ title: '拒绝时请填写审批意见', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认拒绝',
      content: '确定要拒绝此申请吗？',
      success: async function(res) {
        if (res.confirm) {
          self.setData({ submitting: true });
          try {
            await rejectException(self.exceptionId, {
              remark: self.data.remark.trim()
            });
            wx.showToast({ title: '已拒绝', icon: 'success' });
            setTimeout(function() {
              wx.navigateBack();
            }, 1500);
          } catch (err) {
            console.error('[ExceptionApprove] 拒绝失败:', err);
            wx.showToast({ title: '操作失败，请稍后重试', icon: 'none' });
          } finally {
            self.setData({ submitting: false });
          }
        }
      }
    });
  }
});
