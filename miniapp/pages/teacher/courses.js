// pages/teacher/courses.js
const { get } = require('../../utils/request');

// Mock data switch - set to false for production
const ENABLE_MOCK = true;

Page({
  data: {
    courses: [],
    filteredCourses: [],  // 搜索过滤后的列表
    loading: true,
    loadingMore: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    searchKeyword: '',  // 搜索关键词
    total: 0
  },

  onLoad() {
    this.loadCourses();
  },

  // 下拉刷新
  onPullDownRefresh() {
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

  // 加载课程列表
  async loadCourses() {
    this.setData({ loading: true });

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

      console.log('[Courses] 加载成功:', courses.length, '条');

    } catch (err) {
      console.error('[Courses] 加载失败:', err);
      
      if (ENABLE_MOCK) {
        // 使用模拟数据作为兜底
        const mockCourses = [
          { 
            id: 1, 
            courseCode: 'CS2026070001', 
            name: '数学思维训练', 
            subject: '数学', 
            status: 'PUBLISHED',
            description: '培养学生数学思维能力',
            lessonCount: 24,
            enrolledClasses: 3
          },
          { 
            id: 2, 
            courseCode: 'CS2026070002', 
            name: '英语口语提升', 
            subject: '英语', 
            status: 'PUBLISHED',
            description: '提升英语口语表达能力',
            lessonCount: 20,
            enrolledClasses: 2
          },
          { 
            id: 3, 
            courseCode: 'CS2026070003', 
            name: '编程启蒙', 
            subject: '编程', 
            status: 'DRAFT',
            description: '少儿编程入门课程',
            lessonCount: 16,
            enrolledClasses: 0
          }
        ];

        this.setData({
          courses: mockCourses,
          filteredCourses: mockCourses,
          loading: false,
          hasMore: false
        });

        wx.showToast({
          title: '使用离线数据',
          icon: 'none',
          duration: 1500
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
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
      this.setData({ page: this.data.page - 1 }); // 回退页码
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  // 跳转课程详情
  goToCourseDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pages/teacher/course-detail?code=${code}`,
      fail: (err) => {
        console.warn('[Navigation] 课程详情页不存在:', err);
        wx.showToast({
          title: '详情页开发中',
          icon: 'none'
        });
      }
    });
  },

  // 创建新课程
  createCourse() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
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