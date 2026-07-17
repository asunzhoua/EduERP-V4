// pages/teacher/lesson-record.js
const { get, post } = require('../../utils/request');

Page({
  data: {
    // 步骤控制
    step: 1, // 1: 选择班级, 2: 选择学生, 3: 输入课时, 4: 确认提交

    // 班级相关
    classes: [],
    selectedClass: null,

    // 学生相关
    students: [],
    selectedStudents: [],

    // 课时信息
    lessonDate: '',
    startTime: '',
    endTime: '',
    topic: '',

    // 考勤记录
    attendanceRecords: [],

    // 提交状态
    submitting: false
  },

  onLoad(options) {
    // 设置默认日期为今天
    const today = new Date();
    const dateStr = this.formatDate(today);

    this.setData({
      lessonDate: dateStr
    });

    // 如果有传入 classCode，直接进入步骤 2
    if (options.classCode) {
      this.loadClasses().then(() => {
        const selectedClass = this.data.classes.find(c => c.classCode === options.classCode);
        if (selectedClass) {
          this.setData({ selectedClass, step: 2 });
          this.loadStudents(selectedClass.classCode);
        }
      });
    } else {
      this.loadClasses();
    }
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  // 加载班级列表
  async loadClasses() {
    try {
      const data = await get('/classes', { status: 'ACTIVE' });
      this.setData({ classes: data.items || [] });
    } catch (err) {
      // 模拟数据
      this.setData({
        classes: [
          { classCode: 'CL2026070001', name: '周六上午班', courseName: '数学思维训练' },
          { classCode: 'CL2026070002', name: '周日下午班', courseName: '英语口语提升' }
        ]
      });
    }
  },

  // 加载学生列表
  async loadStudents(classCode) {
    try {
      const data = await get(`/classes/${classCode}/students`);
      const students = (data || []).map(s => ({
        ...s,
        status: 'PRESENT' // 默认到课
      }));
      this.setData({ students, selectedStudents: students.map(s => s.studentCode) });
    } catch (err) {
      // 模拟数据
      const mockStudents = [
        { studentCode: 'STU001', name: '张三', status: 'PRESENT' },
        { studentCode: 'STU002', name: '李四', status: 'PRESENT' },
        { studentCode: 'STU003', name: '王五', status: 'PRESENT' }
      ];
      this.setData({ students: mockStudents, selectedStudents: mockStudents.map(s => s.studentCode) });
    }
  },

  // 选择班级
  onSelectClass(e) {
    const { code } = e.currentTarget.dataset;
    const selectedClass = this.data.classes.find(c => c.classCode === code);
    this.setData({ selectedClass, step: 2 });
    this.loadStudents(code);
  },

  // 切换学生考勤状态
  toggleStudentStatus(e) {
    const { code } = e.currentTarget.dataset;
    const students = this.data.students.map(s => {
      if (s.studentCode === code) {
        const statusMap = {
          'PRESENT': 'ABSENT',
          'ABSENT': 'LATE',
          'LATE': 'PRESENT'
        };
        return { ...s, status: statusMap[s.status] || 'PRESENT' };
      }
      return s;
    });
    this.setData({ students });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({ lessonDate: e.detail.value });
  },

  // 时间选择
  onStartTimeChange(e) {
    this.setData({ startTime: e.detail.value });
  },

  onEndTimeChange(e) {
    this.setData({ endTime: e.detail.value });
  },

  // 课题输入
  onTopicInput(e) {
    this.setData({ topic: e.detail.value });
  },

  // 下一步
  nextStep() {
    const { step } = this.data;

    if (step === 2) {
      // 验证是否有到课学生
      const hasPresent = this.data.students.some(s => s.status === 'PRESENT');
      if (!hasPresent) {
        wx.showToast({ title: '请至少选择一名到课学生', icon: 'none' });
        return;
      }
      this.setData({ step: 3 });
    } else if (step === 3) {
      // 验证课时信息
      if (!this.data.lessonDate || !this.data.startTime || !this.data.endTime) {
        wx.showToast({ title: '请填写完整的课时信息', icon: 'none' });
        return;
      }
      this.setData({ step: 4 });
    }
  },

  // 上一步
  prevStep() {
    const { step } = this.data;
    if (step > 1) {
      this.setData({ step: step - 1 });
    }
  },

  // 提交考勤
  async submitAttendance() {
    this.setData({ submitting: true });

    try {
      const records = this.data.students
        .filter(s => s.status !== 'ABSENT')
        .map(s => ({
          studentCode: s.studentCode,
          status: s.status
        }));

      const payload = {
        classCode: this.data.selectedClass.classCode,
        lessonDate: this.data.lessonDate,
        startTime: this.data.startTime,
        endTime: this.data.endTime,
        topic: this.data.topic,
        attendanceRecords: records
      };

      // 实际 API 调用
      // await post('/lessons', payload);

      // 模拟成功
      await new Promise(resolve => setTimeout(resolve, 1000));

      wx.showModal({
        title: '提交成功',
        content: `已记录 ${records.length} 名学生的课时`,
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});