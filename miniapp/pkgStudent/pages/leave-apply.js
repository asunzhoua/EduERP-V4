const { get } = require('../../utils/request');
const { applyLeave } = require('../../utils/lesson-exception-api');

Page({
  data: {
    loading: false,
    submitting: false,
    // 孩子
    children: [],
    childLabels: [],
    selectedChild: null,
    // 课程
    courses: [],
    selectedCourse: null,
    // 请假类型
    leaveType: '',
    // 原因
    reason: ''
  },

  onLoad() {
    this.loadChildren();
  },

  // 加载孩子列表（家长）
  async loadChildren() {
    this.setData({ loading: true });
    try {
      const children = await get('/students/my-children');
      if (!children || children.length === 0) {
        this.setData({ loading: false });
        wx.showModal({
          title: '提示',
          content: '您还没有关联孩子，请先在「我的-我的孩子」中添加',
          showCancel: false,
          success: function() {
            wx.navigateBack();
          }
        });
        return;
      }
      const childLabels = children.map(function(c) {
        return c.grade ? c.name + '（' + c.grade + '）' : c.name;
      });
      this.setData({
        children: children,
        childLabels: childLabels,
        selectedChild: children[0],
        loading: false
      });
      this.loadCourses(children[0].id);
    } catch (err) {
      console.error('[LeaveApply] 加载孩子失败:', err);
      this.setData({ loading: false });
    }
  },

  // 切换孩子
  onSelectChild(e) {
    const index = e.detail.value;
    const child = this.data.children[index];
    if (!child) return;
    this.setData({ selectedChild: child, selectedCourse: null });
    this.loadCourses(child.id);
  },

  // 加载孩子的可请假课时
  async loadCourses(childId) {
    this.setData({ loading: true });
    try {
      const lessons = await get('/students/' + childId + '/lessons');
      const today = this.today();
      const courses = (Array.isArray(lessons) ? lessons : []).filter(function(l) {
        return l.lessonDate && l.startTime && l.endTime && l.lessonDate >= today;
      });
      this.setData({ courses: courses, selectedCourse: null, loading: false });
      if (courses.length === 0) {
        wx.showToast({ title: '该孩子暂无可用课程', icon: 'none' });
      }
    } catch (err) {
      console.error('[LeaveApply] 加载课程失败:', err);
      this.setData({ loading: false });
    }
  },

  today() {
    var d = new Date();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day);
  },

  // 选择课程
  onSelectCourse() {
    const { courses } = this.data;
    if (!courses || courses.length === 0) {
      wx.showToast({ title: '暂无可用课程', icon: 'none' });
      return;
    }
    const items = courses.map(function(c) {
      return (c.courseName || '课程') + ' · ' + c.lessonDate + ' ' + c.startTime + '~' + c.endTime;
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

  // 输入原因
  onInputReason(e) {
    this.setData({ reason: e.detail.value });
  },

  // 提交申请
  async onSubmit() {
    const { selectedCourse, leaveType, reason } = this.data;

    // 校验
    if (!selectedCourse) {
      wx.showToast({ title: '请选择课程', icon: 'none' });
      return;
    }
    if (!leaveType) {
      wx.showToast({ title: '请选择请假类型', icon: 'none' });
      return;
    }
    if (!reason.trim()) {
      wx.showToast({ title: '请填写请假原因', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      await applyLeave(selectedCourse.lessonId, {
        exceptionType: 'LEAVE_' + leaveType,
        reason: reason.trim(),
        startTime: selectedCourse.lessonDate + 'T' + selectedCourse.startTime + ':00',
        endTime: selectedCourse.lessonDate + 'T' + selectedCourse.endTime + ':00'
      });

      wx.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      // request.js 已 toast 后端错误信息，这里不重复提示
      console.error('[LeaveApply] 提交失败:', err);
    } finally {
      this.setData({ submitting: false });
    }
  }
});
