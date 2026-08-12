// pages/teacher/class-detail.js
const { get, del } = require('../../utils/request');

Page({
  data: {
    classCode: '',
    classInfo: null,
    students: [],
    loading: true,
    error: null,
    activeTab: 'info',  // info | students | lessons
    lessons: [],
    lessonsLoading: false,
    lessonsError: null,
    attendanceRate: 0
  },

  onLoad(options) {
    // 角色守卫：学生不允许访问教师页面
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    if (role === 'Student' || role === 'Parent') {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    const { code } = options;
    if (code) {
      this.setData({ classCode: code });
      this.loadClassDetail(code);
    } else {
      this.setData({
        error: '缺少班级编码',
        loading: false
      });
    }
  },

  // 从编辑页返回后刷新详情（首次 onShow 时 classInfo 尚未加载，跳过）
  onShow() {
    if (this.data.classInfo && this.data.classCode) {
      this.loadClassDetail(this.data.classCode, true);
    }
  },

  // 加载班级详情
  async loadClassDetail(code, silent) {
    if (!silent) {
      this.setData({ loading: true, error: null });
    }

    try {
      const [classInfo, studentsData] = await Promise.all([
        get(`/classes/${code}`),
        get(`/classes/${code}/students`)
      ]);

      this.setData({
        classInfo,
        students: studentsData || [],
        loading: false
      });
    } catch (err) {
      console.error('[Class Detail] 加载失败:', err);
      this.setData({
        error: err.message || '加载失败',
        loading: false
      });
    }
  },

  // 切换 Tab
  onTabChange(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({ activeTab: tab });
    if (tab === 'lessons') {
      this.loadLessons();
    }
  },

  // 跳转学生列表
  goToStudents() {
    wx.navigateTo({
      url: `/pkgTeacher/pages/students?classCode=${this.data.classCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 跳转学生详情
  goToStudentDetail(e) {
    const { code } = e.currentTarget.dataset;
    if (code) {
      wx.navigateTo({
        url: `/pkgTeacher/pages/student-detail?code=${code}`,
        fail() {
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    }
  },

  // 跳转课时记录
  goToRecordLesson() {
    wx.navigateTo({
      url: `/pkgTeacher/pages/lesson-record?classCode=${this.data.classCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 编辑班级（仅 DRAFT 显示入口）
  goToEdit() {
    wx.navigateTo({
      url: `/pkgTeacher/pages/class-form?code=${this.data.classCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 删除班级（仅 DRAFT 显示入口）
  goToDelete() {
    wx.showModal({
      title: '删除班级',
      content: '删除该班级？删除后不可恢复',
      confirmText: '删除',
      confirmColor: '#C4483F',
      success: (res) => {
        if (!res.confirm) return;
        this.doDelete();
      }
    });
  },

  async doDelete() {
    try {
      await del('/classes/' + this.data.classCode);
      wx.showToast({ title: '删除成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      console.error('[Class Detail] 删除失败:', err);
      // request.js 已 toast 后端错误
    }
  },

  // 返回
  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  // 重试加载
  retryLoad() {
    if (this.data.classCode) {
      this.loadClassDetail(this.data.classCode);
    }
  },

  // 加载课时列表
  async loadLessons() {
    if (this.data.lessons.length > 0 || this.data.lessonsLoading) return;
    this.setData({ lessonsLoading: true, lessonsError: null });
    try {
      const data = await get(`/classes/${this.data.classCode}/lessons`);
      const lessons = Array.isArray(data) ? data : (data.items || []);
      const attendanceRate = this.calculateAttendanceRate(lessons);
      this.setData({ lessons: lessons, lessonsLoading: false, attendanceRate });
    } catch (err) {
      console.error('[Class Detail] 课时加载失败:', err);
      this.setData({ lessonsLoading: false, lessonsError: '课时加载失败' });
    }
  },

  // 重试加载课时
  retryLessons() {
    this.setData({ lessons: [], lessonsError: null });
    this.loadLessons();
  },

  // 计算出勤率
  calculateAttendanceRate(lessons) {
    if (!lessons || lessons.length === 0) return 0;
    let totalRecords = 0;
    let presentRecords = 0;
    lessons.forEach(lesson => {
      if (lesson.attendance && Array.isArray(lesson.attendance)) {
        lesson.attendance.forEach(record => {
          totalRecords++;
          // 分子与后端扣课集合 DEDUCTIBLE_STATUSES 对齐：PRESENT/LATE/ONLINE/OFFLINE
          if (record.status === 'PRESENT' || record.status === 'LATE' || record.status === 'ONLINE' || record.status === 'OFFLINE') {
            presentRecords++;
          }
        });
      }
    });
    return totalRecords > 0 ? Math.round(presentRecords / totalRecords * 100) : 0;
  },

});