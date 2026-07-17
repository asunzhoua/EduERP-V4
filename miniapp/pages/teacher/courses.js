// pages/teacher/courses.js
const { get } = require('../../utils/request');

Page({
  data: {
    courses: [],
    loading: true,
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad() {
    this.loadCourses();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, courses: [], hasMore: true });
    this.loadCourses().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadCourses() {
    this.setData({ loading: true });

    try {
      const data = await get('/courses', {
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      this.setData({
        courses: data.items || [],
        hasMore: (data.items || []).length >= this.data.pageSize,
        loading: false
      });
    } catch (err) {
      // 模拟数据
      this.setData({
        courses: [
          { id: 1, courseCode: 'CS2026070001', name: '数学思维训练', subject: '数学', status: 'PUBLISHED' },
          { id: 2, courseCode: 'CS2026070002', name: '英语口语提升', subject: '英语', status: 'PUBLISHED' },
          { id: 3, courseCode: 'CS2026070003', name: '编程启蒙', subject: '编程', status: 'DRAFT' }
        ],
        loading: false
      });
    }
  },

  async loadMore() {
    this.setData({ page: this.data.page + 1 });
    // 暂不实现分页
  },

  goToCourseDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/course-detail?code=${code}` });
  },

  getStatusText(status) {
    const map = {
      'DRAFT': '草稿',
      'PUBLISHED': '已发布',
      'ARCHIVED': '已归档'
    };
    return map[status] || status;
  }
});