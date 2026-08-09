const { get } = require('../../utils/request');
const { applyLeave } = require('../../utils/lesson-exception-api');

Page({
  data: {
    loading: false,
    submitting: false,
    // 课程选择
    courses: [],
    selectedCourse: null,
    // 请假类型
    leaveType: '',
    // 日期
    selectedDate: '',
    // 原因
    reason: '',
    // 附件
    files: []
  },

  onLoad() {
    this.loadCourses();
  },

  // 加载可选课程
  async loadCourses() {
    this.setData({ loading: true });
    try {
      const courses = await get('/students/self/lessons');
      this.setData({
        courses: Array.isArray(courses) ? courses : [],
        loading: false
      });
    } catch (err) {
      console.error('[LeaveApply] 加载课程失败:', err);
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
      return c.subject + ' - ' + (c.teacherName || '未知教师');
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

  // 上传文件
  onUploadFile() {
    const self = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success(res) {
        const file = res.tempFiles[0];
        const files = self.data.files.concat([{
          id: Date.now(),
          name: file.name,
          path: file.path,
          size: file.size
        }]);
        self.setData({ files: files });
      }
    });
  },

  // 删除文件
  onRemoveFile(e) {
    const id = e.currentTarget.dataset.id;
    const files = this.data.files.filter(function(f) {
      return f.id !== id;
    });
    this.setData({ files: files });
  },

  // 提交申请
  async onSubmit() {
    const { selectedCourse, leaveType, selectedDate, reason, files } = this.data;

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
    if (leaveType === 'SICK' && files.length === 0) {
      wx.showToast({ title: '病假必须上传附件', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const lessonId = selectedCourse.id || selectedCourse.lessonId;
      await applyLeave(lessonId, {
        type: leaveType,
        date: selectedDate,
        reason: reason.trim(),
        attachments: files.map(function(f) { return { name: f.name, path: f.path }; })
      });

      wx.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error('[LeaveApply] 提交失败:', err);
      wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
