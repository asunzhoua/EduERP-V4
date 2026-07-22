// pages/teacher/students.js
const { get } = require('../../utils/request');

// Mock data switch - set to false for production
const ENABLE_MOCK = true;

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
      let students = [];
      
      if (this.data.classCode) {
        // 如果有 classCode，从 classes API 获取该班级的学生
        const data = await get(`/classes/${this.data.classCode}/students`);
        students = data || [];
      } else {
        const params = {};
        if (this.data.keyword) {
          params.keyword = this.data.keyword;
        }
        const data = await get('/students', params);
        students = data.items || data || [];
      }

      this.setData({
        students,
        loading: false
      });
    } catch (err) {
      if (ENABLE_MOCK) {
        // 模拟数据
        this.setData({
          students: [
            { id: 1, studentCode: 'STU001', name: '张三', gender: 'MALE', school: '育才小学', grade: '四年级' },
            { id: 2, studentCode: 'STU002', name: '李四', gender: 'FEMALE', school: '育才小学', grade: '四年级' },
            { id: 3, studentCode: 'STU003', name: '王五', gender: 'MALE', school: '实验一小', grade: '五年级' }
          ],
          loading: false
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }
  },

  goToStudentDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/teacher/student-detail?code=${code}` });
  }
});