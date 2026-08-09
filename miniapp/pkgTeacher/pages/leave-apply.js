const { get } = require('../../utils/request');
const { applySuspend } = require('../../utils/lesson-exception-api');

Page({
  data: {
    loading: false,
    submitting: false,
    courses: [],
    selectedCourse: null,
    leaveType: '',
    selectedDate: '',
    reason: ''
  },

  onLoad() {
    this.loadCourses();
  },

  async loadCourses() {
    this.setData({ loading: true });
    try {
      const data = await get('/teacher/assignments');
      const courses = Array.isArray(data) ? data : (data && data.items ? data.items : []);
      this.setData({ courses: courses, loading: false });
    } catch (err) {
      console.error('[TeacherLeaveApply] 加载课程失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载课程失败', icon: 'none' });
    }
  },

  // 选择课程
  onSelectCourse() {
    const { courses } = this.data;
    if (!courses || courses.length === 0) {
      wx.showToast({ title: '暂无可用课程', icon: 'none' });
      return;
    }
    const items = courses.map(function(c) {
      return (c.className || '') + ' - ' + (c.courseName || c.subject || '未知课程');
    });
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        if (res.tapIndex >= 0 && res.tapIndex < courses.length) {
          this.setData({ selectedCourse: courses[res.tapIndex] });
        }
      }
    });
  },

  // 选择请假类型
  onSelectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ leaveType: type });
  },

  // 选择日期
  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
  },

  // 输入原因
  onInputReason(e) {
    this.setData({ reason: e.detail.value });
  },

  // 提交申请
  async onSubmit() {
    const { selectedCourse, leaveType, selectedDate, reason } = this.data;

    // 校验
    if (!selectedCourse) {
      wx.showToast({ title: '请选择课程', icon: 'none' });
      return;
    }
    if (!leaveType) {
      wx.showToast({ title: '请选择请假类型', icon: 'none' });
      return;
    }
    if (!selectedDate) {
      wx.showToast({ title: '请选择请假日期', icon: 'none' });
      return;
    }
    if (!reason.trim()) {
      wx.showToast({ title: '请填写请假原因', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await applySuspend({
        classId: selectedCourse.classId || selectedCourse.id,
        type: leaveType,
        date: selectedDate,
        reason: reason.trim()
      });

      wx.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error('[TeacherLeaveApply] 提交失败:', err);
      wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
