// pages/teacher/courses.js
const { get } = require('../../utils/request');

Page({
  data: {
    courses: [],
    filteredCourses: [],  // 搜索过滤后的列表
    loading: true,
    loadingMore: false,
    error: null,
    page: 1,
    pageSize: 20,
    hasMore: true,
    searchKeyword: '',  // 搜索关键词
    total: 0,
    isStudentView: false,  // 家长/学生视图：课程 Tab 原地渲染孩子课程，保留 tab 栏
    studentCourses: []
  },

  onLoad() {
    const app = getApp();
    var userInfo = app.globalData.userInfo || {};
    const role = userInfo.role;
    const isStudentView = role === 'Student' || role === 'Parent';
    this.setData({ isStudentView });
    if (isStudentView) {
      this.loadStudentCourses();
    } else {
      this.loadCourses();
    }
  },

  // Tab 页 onLoad 仅一次；家长/学生视图每次切回刷新（从详情页返回后更新）
  onShow() {
    if (this.data.isStudentView) {
      this.loadStudentCourses();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    if (this.data.isStudentView) {
      this.loadStudentCourses().finally(() => {
        wx.stopPullDownRefresh();
      });
      return;
    }
    this.setData({
      page: 1,
      courses: [],
      hasMore: true,
      searchKeyword: ''
    });
    this.loadCourses().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.isStudentView) return;
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  // 搜索功能
  onSearch(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword });
    
    if (!keyword) {
      // 清空搜索，显示全部
      this.setData({ filteredCourses: this.data.courses });
      return;
    }

    // 本地过滤
    const filtered = this.data.courses.filter(course => 
      course.name.includes(keyword) || 
      course.courseCode.includes(keyword) ||
      course.subject.includes(keyword)
    );
    
    this.setData({ filteredCourses: filtered });
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: '',
      filteredCourses: this.data.courses
    });
  },

  // 家长/学生视图：加载孩子课程（复用 student/classes 的 contracts 映射）
  async loadStudentCourses() {
    if (this._studentLoading) return;
    this._studentLoading = true;
    this.setData({ loading: true, error: null });

    try {
      const contracts = await get('/students/self/contracts');
      const studentCourses = (Array.isArray(contracts) ? contracts : []).map(c => ({
        classCode: c.classCode,
        subject: c.subject,
        teacherName: c.teacherName || '',
        totalLessons: c.totalLessons,
        remainingLessons: c.remainingLessons,
        progress: c.totalLessons > 0
          ? Math.round((c.totalLessons - c.remainingLessons) / c.totalLessons * 100)
          : 0
      }));

      this.setData({ studentCourses, loading: false });
    } catch (err) {
      console.error('[Courses] 孩子课程加载失败:', err);
      this.setData({
        error: '数据加载失败，请稍后重试',
        loading: false
      });
    } finally {
      this._studentLoading = false;
    }
  },

  // 家长/学生视图：进入班级详情
  goToStudentClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pkgStudent/pages/class-detail?code=${code}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 加载课程列表
  async loadCourses() {
    this.setData({ loading: true, error: null });

    try {
      const data = await get('/courses', {
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      const courses = data.items || [];
      
      this.setData({
        courses: courses,
        filteredCourses: courses,  // 初始化时显示全部
        hasMore: courses.length >= this.data.pageSize,
        total: data.total || courses.length,
        loading: false
      });

    } catch (err) {
      console.error('[Courses] 加载失败:', err);
      this.setData({ 
        error: '加载失败，请稍后重试',
        loading: false 
      });
    }
  },

  // 加载更多
  async loadMore() {
    if (!this.data.hasMore) return;

    this.setData({ loadingMore: true, page: this.data.page + 1 });

    try {
      const data = await get('/courses', {
        page: this.data.page,
        pageSize: this.data.pageSize,
        keyword: this.data.searchKeyword || undefined
      });

      const newCourses = data.items || [];
      
      if (newCourses.length > 0) {
        const allCourses = [...this.data.courses, ...newCourses];
        this.setData({
          courses: allCourses,
          filteredCourses: allCourses,
          hasMore: newCourses.length >= this.data.pageSize
        });
      } else {
        this.setData({ hasMore: false });
      }

    } catch (err) {
      console.error('[Courses] 加载更多失败:', err);
      this.setData({ page: this.data.page - 1, hasMore: true }); // 回退页码，允许重试
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  // 跳转课程详情
  goToCourseDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pkgTeacher/pages/course-detail?code=${code}`,
      fail: (err) => {
        console.error('[Navigation] 跳转课程详情失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 右下角 FAB：创建课程
  createCourse() {
    wx.navigateTo({
      url: '/pkgTeacher/pages/course-form',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 获取状态文本
  getStatusText(status) {
    const map = {
      'DRAFT': '草稿',
      'PUBLISHED': '已发布',
      'ARCHIVED': '已归档'
    };
    return map[status] || status;
  }
});