// pages/teacher/students.js
const { get } = require('../../utils/request');

Page({
  data: {
    students: [],
    loading: true,
    keyword: ''
  },

  onLoad(options) {
    if (options.classCode) {
      this.setData({ classCode: options.classCode });
    }
    this.loadStudents();
  },

  onPullDownRefresh() {
    this.loadStudents().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.loadStudents();
  },

  async loadStudents() {
    this.setData({ loading: true });

    try {
      const params = {};
      if (this.data.classCode) {
        params.classCode = this.data.classCode;
      }
      if (this.data.keyword) {
        params.keyword = this.data.keyword;
      }

      const data = await get('/students', params);

      this.setData({
        students: data.items || data || [],
        loading: false
      });
    } catch (err) {
      // 模拟数据
      this.setData({
        students: [
          { id: 1, studentCode: 'STU001', name: '张三', gender: 'MALE', school: '育才小学', grade: '四年级' },
          { id: 2, studentCode: 'STU002', name: '李四', gender: 'FEMALE', school: '育才小学', grade: '四年级' },
          { id: 3, studentCode: 'STU003', name: '王五', gender: 'MALE', school: '实验一小', grade: '五年级' }
        ],
        loading: false
      });
    }
  },

  goToStudentDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/student-detail?code=${code}` });
  }
});