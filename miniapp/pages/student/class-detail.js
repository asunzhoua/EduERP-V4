// pages/student/class-detail.js
const { get } = require('../../utils/request');

Page({
  data: {
    classCode: '',
    classInfo: null,
    loading: true,
    error: null
  },

  onLoad(options) {
    const { code } = options;
    if (code) {
      this.setData({ classCode: code });
      this.loadData(code);
    } else {
      this.setData({
        error: '缺少班级编码',
        loading: false
      });
    }
  },

  async loadData(code) {
    this.setData({ loading: true, error: null });

    try {
      // 先从 contracts 获取列表，再过滤出当前班级
      const contracts = await get('/students/self/contracts');

      // 找到匹配的班级（classCode 从 contractCode 派生）
      const classInfo = contracts.find(c =>
        ('CT' + c.contractCode) === code || c.contractCode === code
      );

      if (classInfo) {
        const completedLessons = (classInfo.totalLessons || 0) - (classInfo.remainingLessons || 0);
        const totalLessons = classInfo.totalLessons || 0;
        const progress = totalLessons > 0 ? Math.round(completedLessons / totalLessons * 100) : 0;

        this.setData({
          classInfo: {
            classCode: code,
            subject: classInfo.subject,
            teacherName: classInfo.teacherName || '',
            completedLessons,
            totalLessons,
            progress,
            status: classInfo.status,
            contractCode: classInfo.contractCode
          },
          loading: false
        });
      } else {
        this.setData({
          error: '未找到该班级信息',
          loading: false
        });
      }
    } catch (err) {
      console.error('[Class Detail Student] 加载失败:', err);
      this.setData({
        classInfo: null,
        loading: false
      });
    }
  },

  // 查看课程详情
  goToCourseDetail() {
    wx.navigateTo({
      url: `/pages/student/classes`
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
