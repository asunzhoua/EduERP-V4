// pages/teacher/lesson-record.js
const { get, post } = require('../../utils/request');

// Mock data switch - set to false for production
const ENABLE_MOCK = true;

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
    submitting: false,

    // 表单错误
    formErrors: {},

    // 加载状态
    loadingClasses: false,
    loadingStudents: false,

    // 提交结果
    submitResult: null,

    // 考勤计数（由JS计算，避免WXML中使用箭头函数）
    presentCount: 0,
    lateCount: 0,
    absentCount: 0
  },

  onLoad(options) {
    // 设置默认日期为今天
    const today = new Date();
    const dateStr = this.formatDate(today);

    // 设置默认时间为当前时间
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const defaultStartTime = `${hh}:${mm}`;

    this.setData({
      lessonDate: dateStr,
      startTime: defaultStartTime
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
    this.setData({ loadingClasses: true });
    try {
      const data = await get('/classes', { status: 'ACTIVE' });
      if (data && data.items) {
        this.setData({ classes: data.items });
      } else if (Array.isArray(data)) {
        this.setData({ classes: data });
      } else {
        this.setData({ classes: [] });
      }
    } catch (err) {
      console.warn('[lesson-record] 加载班级列表失败，使用降级数据:', err);
      if (ENABLE_MOCK) {
        // 模拟数据（降级方案）
        this.setData({
          classes: [
            { classCode: 'CL2026070001', name: '周六上午班', courseName: '数学思维训练' },
            { classCode: 'CL2026070002', name: '周日下午班', courseName: '英语口语提升' }
          ]
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    } finally {
      this.setData({ loadingClasses: false });
    }
  },

  // 加载学生列表
  async loadStudents(classCode) {
    this.setData({ loadingStudents: true });
    try {
      const data = await get(`/classes/${classCode}/students`);
      const students = (data || []).map(s => ({
        ...s,
        status: 'PRESENT', // 默认到课
        reason: ''
      }));
      const presentCount = students.filter(s => s.status === 'PRESENT').length;
      const lateCount = students.filter(s => s.status === 'LATE').length;
      const absentCount = students.filter(s => s.status === 'ABSENT').length;
      this.setData({
        students,
        selectedStudents: students.map(s => s.studentCode),
        presentCount,
        lateCount,
        absentCount
      });
    } catch (err) {
      console.warn('[lesson-record] 加载学生列表失败，使用降级数据:', err);
      if (ENABLE_MOCK) {
        // 模拟数据（降级方案）
        const mockStudents = [
          { studentCode: 'STU001', name: '张三', status: 'PRESENT' },
          { studentCode: 'STU002', name: '李四', status: 'PRESENT' },
          { studentCode: 'STU003', name: '王五', status: 'PRESENT' }
        ];
        const presentCount = mockStudents.filter(s => s.status === 'PRESENT').length;
        const lateCount = mockStudents.filter(s => s.status === 'LATE').length;
        const absentCount = mockStudents.filter(s => s.status === 'ABSENT').length;
        this.setData({
          students: mockStudents,
          selectedStudents: mockStudents.map(s => s.studentCode),
          presentCount,
          lateCount,
          absentCount
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    } finally {
      this.setData({ loadingStudents: false });
    }
  },

  // 选择班级
  onSelectClass(e) {
    const { code } = e.currentTarget.dataset;
    const selectedClass = this.data.classes.find(c => c.classCode === code);
    // 清除上一轮的提交结果和表单错误
    this.setData({
      selectedClass,
      step: 2,
      submitResult: null,
      formErrors: {}
    });
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
        const newStatus = statusMap[s.status] || 'PRESENT';
        let reason = s.reason || '';
        // 标记缺课或迟到时提示输入原因
        if (newStatus === 'ABSENT' || newStatus === 'LATE') {
          wx.showModal({
            title: newStatus === 'ABSENT' ? '缺课原因' : '迟到原因',
            editable: true,
            content: reason,
            placeholderText: '请填写原因（可选）',
            success: (res) => {
              if (res.confirm) {
                const updatedStudents = this.data.students.map(st => {
                  if (st.studentCode === code) {
                    return { ...st, status: newStatus, reason: res.content || '' };
                  }
                  return st;
                });
                const presentCount = updatedStudents.filter(s => s.status === 'PRESENT').length;
                const lateCount = updatedStudents.filter(s => s.status === 'LATE').length;
                const absentCount = updatedStudents.filter(s => s.status === 'ABSENT').length;
                this.setData({
                  students: updatedStudents,
                  presentCount,
                  lateCount,
                  absentCount
                });
              }
            }
          });
          return { ...s };
        }
        return { ...s, status: newStatus, reason: '' };
      }
      return s;
    });
    const presentCount = students.filter(s => s.status === 'PRESENT').length;
    const lateCount = students.filter(s => s.status === 'LATE').length;
    const absentCount = students.filter(s => s.status === 'ABSENT').length;
    this.setData({ students, presentCount, lateCount, absentCount });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      lessonDate: e.detail.value,
      'formErrors.date': undefined
    });
  },

  // 时间选择
  onStartTimeChange(e) {
    this.setData({
      startTime: e.detail.value,
      'formErrors.timeRange': undefined
    });
  },

  onEndTimeChange(e) {
    this.setData({
      endTime: e.detail.value,
      'formErrors.timeRange': undefined
    });
  },

  // 课题输入
  onTopicInput(e) {
    this.setData({ topic: e.detail.value });
  },

  // 表单验证 - 步骤3
  validateLessonForm() {
    const errors = {};
    const { lessonDate, startTime, endTime } = this.data;

    // 日期验证
    if (!lessonDate) {
      errors.date = '请选择日期';
    }

    // 时间验证
    if (!startTime) {
      errors.startTime = '请选择开始时间';
    }

    if (!endTime) {
      errors.endTime = '请选择结束时间';
    }

    // 结束时间必须晚于开始时间
    if (startTime && endTime) {
      if (endTime <= startTime) {
        errors.timeRange = '结束时间必须晚于开始时间';
      }
    }

    this.setData({ formErrors: errors });
    return Object.keys(errors).length === 0;
  },

  // 下一步
  nextStep() {
    const { step } = this.data;

    if (step === 2) {
      // 验证是否有选择班级
      if (!this.data.selectedClass) {
        wx.showToast({ title: '请先选择一个班级', icon: 'none' });
        return;
      }
      // 验证是否有到课学生 — 放宽为允许全部缺课的特殊情况
      const hasPresent = this.data.students.some(s => s.status === 'PRESENT');
      if (!hasPresent) {
        wx.showModal({
          title: '提示',
          content: '当前没有到课学生，是否继续？您可以在提交后补充说明。',
          success: (res) => {
            if (res.confirm) {
              this.setData({ step: 3 });
            }
          }
        });
        return;
      }
      this.setData({ step: 3 });
    } else if (step === 3) {
      // 严格的表单验证
      if (!this.validateLessonForm()) {
        wx.showToast({ title: '请检查表单中的错误', icon: 'none' });
        return;
      }
      this.setData({ step: 4 });
    }
  },

  // 上一步
  prevStep() {
    const { step } = this.data;
    if (step > 1) {
      this.setData({ step: step - 1, formErrors: {} });
    }
  },

  // 重新提交（失败后重试）
  retrySubmit() {
    this.setData({ submitResult: null, submitting: false });
    this.submitAttendance();
  },

  // 提交考勤
  async submitAttendance() {
    // 防重复提交
    if (this.data.submitting) {
      console.warn('[lesson-record] 请勿重复提交');
      return;
    }

    // 最终验证
    if (!this.data.selectedClass) {
      wx.showToast({ title: '请选择班级', icon: 'none' });
      return;
    }
    if (!this.validateLessonForm()) {
      wx.showToast({ title: '请检查表单中的错误', icon: 'none' });
      return;
    }

    this.setData({ submitting: true, submitResult: null });

    try {
      const attendanceRecords = this.data.students.map(s => ({
        studentCode: s.studentCode,
        status: s.status,
        ...(s.reason ? { reason: s.reason } : {})
      }));

      const payload = {
        classCode: this.data.selectedClass.classCode,
        lessonDate: this.data.lessonDate,
        startTime: this.data.startTime,
        endTime: this.data.endTime,
        topic: this.data.topic,
        attendanceRecords: attendanceRecords
      };

      await post('/lessons', payload);

      // 成功反馈
      const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
      const lateCount = attendanceRecords.filter(r => r.status === 'LATE').length;
      const absentCount = attendanceRecords.filter(r => r.status === 'ABSENT').length;

      this.setData({
        submitting: false,
        submitResult: { type: 'success' }
      });

      wx.showModal({
        title: '✅ 提交成功',
        content: [
          `班级：${this.data.selectedClass.name}`,
          `时间：${this.data.lessonDate} ${this.data.startTime}-${this.data.endTime}`,
          '',
          `📊 考勤汇总：到课 ${presentCount} 人，迟到 ${lateCount} 人，缺课 ${absentCount} 人`,
          `共记录 ${attendanceRecords.length} 名学生`
        ].join('\n'),
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    } catch (err) {
      console.error('[lesson-record] 提交失败:', err);

      // 错误分类处理
      let errorTitle = '提交失败';
      let errorContent = err.message || '未知错误，请稍后重试';

      if (err.code === 2002) {
        // Token 过期 — request.js 已处理跳转，此处只提示
        errorContent = '登录已过期，请重新登录';
      } else if (err.code === 400 || err.statusCode === 400) {
        errorContent = `请求数据有误：${err.message || '请检查输入'}`;
      } else if (err.code === 409 || err.statusCode === 409) {
        errorTitle = '⏰ 课时冲突';
        errorContent = '该时间段已有课时记录，请检查后重新提交';
      } else if (err.code === 404 || err.statusCode === 404) {
        errorContent = '班级或学生信息不存在，请刷新后重试';
      } else if (err.errMsg && err.errMsg.includes('timeout')) {
        errorContent = '网络连接超时，请检查网络后重试';
      } else if (err.errMsg && err.errMsg.includes('fail')) {
        errorContent = '网络请求失败，请检查网络连接';
      }

      this.setData({
        submitting: false,
        submitResult: {
          type: 'error',
          title: errorTitle,
          content: errorContent
        }
      });

      wx.showModal({
        title: `❌ ${errorTitle}`,
        content: errorContent + '\n\n点击「确定」返回修改，或「重试」重新提交',
        success: (res) => {
          if (res.confirm) {
            // 回到步骤3修改
            this.setData({ step: 3 });
          } else if (res.cancel) {
            // 重试
            this.retrySubmit();
          }
        }
      });
    }
  }
});