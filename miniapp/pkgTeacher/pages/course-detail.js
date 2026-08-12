// pages/teacher/course-detail.js
const { get, del } = require('../../utils/request');
const { getSubjectMap } = require('../../utils/subjects');

Page({
  data: {
    courseCode: '',
    course: null,
    loading: true,
    error: null
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
      this.setData({ courseCode: code });
      this.loadCourseDetail(code);
    } else {
      this.setData({ 
        error: '缺少课程编码',
        loading: false 
      });
    }
  },

  // 从编辑页返回后刷新详情（首次 onShow 时 course 尚未加载，跳过）
  onShow() {
    if (this.data.course && this.data.courseCode) {
      this.loadCourseDetail(this.data.courseCode, true);
    }
  },

  // 加载课程详情
  async loadCourseDetail(code, silent) {
    if (!silent) {
      this.setData({ loading: true, error: null });
    }

    try {
      const data = await get(`/courses/${code}`);
      if (!data) {
        this.setData({ error: '未找到该课程信息', loading: false });
        return;
      }
      const map = await getSubjectMap();
      this.setData({
        course: Object.assign({}, data, { subject: map[data.subject] || data.subject }),
        loading: false
      });
    } catch (err) {
      console.error('[Course Detail] 加载失败:', err);
      this.setData({
        error: err.message || '加载失败',
        loading: false
      });
    }
  },

  // 返回上一页
  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  // 重试加载
  retryLoad() {
    if (this.data.courseCode) {
      this.loadCourseDetail(this.data.courseCode);
    }
  },

  // 跳转班级列表
  goToClasses() {
    wx.navigateTo({
      url: `/pages/teacher/classes?courseCode=${this.data.courseCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 编辑课程（仅 DRAFT 显示入口）
  goToEdit() {
    wx.navigateTo({
      url: `/pkgTeacher/pages/course-form?code=${this.data.courseCode}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 删除课程（仅 DRAFT 显示入口）
  goToDelete() {
    wx.showModal({
      title: '删除课程',
      content: '删除该课程？删除后不可恢复',
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
      await del('/courses/' + this.data.courseCode);
      wx.showToast({ title: '删除成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      console.error('[Course Detail] 删除失败:', err);
      // request.js 已 toast 后端错误
    }
  }
});