// pages/teacher/student-picker.js
const { get, post } = require('../../utils/request');

Page({
  data: {
    classCode: '',
    keyword: '',
    students: [],
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

    const { classCode } = options;
    if (!classCode) {
      this.setData({ error: '缺少班级编码', loading: false });
      return;
    }
    this.setData({ classCode });
    this.loadCandidates();
  },

  onPullDownRefresh() {
    this.loadCandidates().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.loadCandidates();
  },

  onClearSearch() {
    this.setData({ keyword: '' });
    this.loadCandidates();
  },

  async loadCandidates() {
    if (this._dataLoading) return;
    this._dataLoading = true;
    this.setData({ loading: true, error: null });

    try {
      const params = { classCode: this.data.classCode };
      if (this.data.keyword) {
        params.keyword = this.data.keyword;
      }
      const data = await get('/enrollments/candidates', params);
      const students = data || [];

      // 预计算首字母
      var studentsWithInitial = students.map(function(s) {
        return Object.assign({}, s, {
          initial: (s.name && s.name.length > 0) ? s.name[0] : '?'
        });
      });

      this.setData({
        students: studentsWithInitial,
        loading: false
      });
    } catch (err) {
      console.error('[StudentPicker] 加载失败:', err);
      this.setData({
        error: err.message || '加载失败，请稍后重试',
        loading: false
      });
    } finally {
      this._dataLoading = false;
    }
  },

  // 点击学生：弹出选合同（含「无需合同」）
  onSelectStudent(e) {
    const { index } = e.currentTarget.dataset;
    const student = this.data.students[index];
    if (!student) return;

    const contracts = student.contracts || [];
    const itemList = contracts.map((c) => {
      return `${c.subject || '课程'} ${c.contractCode} 剩余${c.remainingLessons}节`;
    });
    itemList.push('无需合同');

    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const tapIndex = res.tapIndex;
        if (tapIndex < contracts.length) {
          this.submitEnroll(student.studentCode, contracts[tapIndex].contractCode);
        } else {
          this.submitEnroll(student.studentCode, undefined);
        }
      }
    });
  },

  async submitEnroll(studentCode, contractCode) {
    wx.showLoading({ title: '添加中...', mask: true });
    try {
      const body = { classCode: this.data.classCode, studentCode: studentCode };
      if (contractCode) {
        body.contractCode = contractCode;
      }
      await post('/enrollments', body);
      wx.hideLoading();
      wx.showToast({ title: '添加成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      wx.hideLoading();
      // 后端 400（冲突/容量/重复）由 request.js toast 展示，保留在页内
      console.error('[StudentPicker] 添加失败:', err);
    }
  },

  retryLoad() {
    if (this.data.classCode) {
      this.loadCandidates();
    }
  }
});
