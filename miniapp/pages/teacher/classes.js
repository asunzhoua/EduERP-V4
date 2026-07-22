// pages/teacher/classes.js
const { get } = require('../../utils/request');

// Mock data switch - set to false for production
const ENABLE_MOCK = false;

Page({
  data: {
    classes: [],
    loading: true,
    filter: 'ALL',
    progressMap: {}  // 班级进度缓存
  },

  onLoad() {
    const app = getApp();
    const role = app.globalData.userInfo?.role;
    if (role === 'Student' || role === 'Parent') {
      wx.redirectTo({ url: '/pages/student/classes' });
      return;
    }
    this.loadClasses();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadClasses().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载班级列表
  async loadClasses() {
    this.setData({ loading: true });

    try {
      const data = await get('/classes', {
        status: this.data.filter === 'ALL' ? undefined : this.data.filter
      });

      const classes = data.items || [];
      
      // 计算每个班级的进度
      const progressMap = {};
      classes.forEach(cls => {
        progressMap[cls.classCode] = this.calculateProgress(cls);
      });

      this.setData({
        classes: classes,
        progressMap: progressMap,
        loading: false
      });

    } catch (err) {
      console.error('[Classes] 加载失败:', err);
      
      if (ENABLE_MOCK) {
        // 使用模拟数据作为兜底
        const mockClasses = [
          {
            id: 1,
            classCode: 'CL2026070001',
            name: '周六上午班',
            courseName: '数学思维训练',
            courseCode: 'CS2026070001',
            status: 'ACTIVE',
            startDate: '2026-07-15',
            endDate: '2026-08-15',
            currentStudents: 12,
            maxStudents: 15,
            completedLessons: 8,
            totalLessons: 24,
            schedule: '周六 09:00-11:00'
          },
          {
            id: 2,
            classCode: 'CL2026070002',
            name: '周日下午班',
            courseName: '英语口语提升',
            courseCode: 'CS2026070002',
            status: 'ACTIVE',
            startDate: '2026-07-16',
            endDate: '2026-08-16',
            currentStudents: 8,
            maxStudents: 12,
            completedLessons: 5,
            totalLessons: 20,
            schedule: '周日 14:00-16:00'
          },
          {
            id: 3,
            classCode: 'CL2026070003',
            name: '周三晚班',
            courseName: '编程启蒙',
            courseCode: 'CS2026070003',
            status: 'DRAFT',
            startDate: '2026-07-20',
            endDate: '2026-08-20',
            currentStudents: 0,
            maxStudents: 10,
            completedLessons: 0,
            totalLessons: 16,
            schedule: '周三 19:00-20:30'
          }
        ];

        const progressMap = {};
        mockClasses.forEach(cls => {
          progressMap[cls.classCode] = this.calculateProgress(cls);
        });

        this.setData({
          classes: mockClasses,
          progressMap: progressMap,
          loading: false
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

  // 计算班级进度
  calculateProgress(classItem) {
    if (!classItem.totalLessons || classItem.totalLessons === 0) return 0;
    return Math.round((classItem.completedLessons || 0) / classItem.totalLessons * 100);
  },

  // 筛选切换
  onFilterChange(e) {
    const { value } = e.currentTarget.dataset;
    if (value === this.data.filter) return;
    
    this.setData({ filter: value, classes: [] });
    this.loadClasses();
  },

  // 跳转班级详情
  goToClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pages/teacher/class-detail?code=${code}`,
      fail: (err) => {
        console.warn('[Navigation] 班级详情页不存在:', err);
        wx.showToast({
          title: '详情页开发中',
          icon: 'none'
        });
      }
    });
  },

  // 查看学生列表
  goToStudents(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pages/teacher/students?classCode=${code}`
    });
  },

  // 记录课时
  goToRecordLesson(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ 
      url: `/pages/teacher/lesson-record?classCode=${code}`
    });
  },

  // 获取状态文本
  getStatusText(status) {
    const map = {
      'DRAFT': '草稿',
      'ACTIVE': '进行中',
      'COMPLETED': '已结束',
      'CANCELLED': '已取消'
    };
    return map[status] || status;
  },

  // 获取状态颜色类名
  getStatusClass(status) {
    const map = {
      'DRAFT': 'status-draft',
      'ACTIVE': 'status-active',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return map[status] || '';
  }
});