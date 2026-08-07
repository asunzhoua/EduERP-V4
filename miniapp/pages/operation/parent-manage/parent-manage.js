// pages/operation/parent-manage/parent-manage.js
const { get, post } = require('../../../utils/request');

Page({
  data: {
    activeTab: 'create',
    // 开户表单
    createUsername: '',
    createName: '',
    createMobile: '',
    createPassword: '',
    createStudentId: null,
    createStudentName: '选填，暂不绑定学生',
    // 绑定表单
    bindParentId: null,
    bindParentName: '请选择家长',
    bindStudentId: null,
    bindStudentName: '请选择学生',
    // 选项数据
    students: [],
    studentNames: [],
    parents: [],
    parentNames: [],
    loading: true,
    submitting: false
  },

  onLoad() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    if (!['Admin', 'SuperAdmin'].includes(userInfo.role)) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.loadStudents().finally(() => this.setData({ loading: false }));
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'bind') this.loadParents();
  },

  async loadStudents() {
    try {
      const data = await get('/students', { page: 1, pageSize: 200 });
      const students = (data && data.items) || data || [];
      this.setData({
        students,
        studentNames: students.map(s => s.name + (s.studentCode ? '（' + s.studentCode + '）' : ''))
      });
    } catch (err) {
      console.warn('[ParentManage] 加载学生列表失败:', err);
    }
  },

  async loadParents() {
    try {
      const data = await get('/auth/admin/parents', { page: 1, pageSize: 200 });
      const items = (data && data.items) || data || [];
      const parents = Array.isArray(items) ? items : [];
      this.setData({
        parents,
        parentNames: parents.map(p => p.name + (p.username ? '（' + p.username + '）' : ''))
      });
    } catch (err) {
      console.warn('[ParentManage] 加载家长列表失败:', err);
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[field] = e.detail.value;
    this.setData(patch);
  },

  onPickStudent(e) {
    const idx = Number(e.detail.value);
    const s = this.data.students[idx];
    this.setData({
      createStudentId: s ? s.id : null,
      createStudentName: s ? this.data.studentNames[idx] : '选填，暂不绑定学生'
    });
  },

  async onCreateParent() {
    const { createUsername, createName, createMobile, createPassword, createStudentId } = this.data;
    if (!createUsername || !createName || !createMobile || !createPassword) {
      wx.showToast({ title: '请填写用户名、姓名、手机号和密码', icon: 'none' });
      return;
    }
    if (createPassword.length < 6) {
      wx.showToast({ title: '密码至少 6 位', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await post('/auth/admin/parents', {
        username: createUsername.trim(),
        name: createName.trim(),
        mobile: createMobile.trim(),
        password: createPassword,
        studentId: createStudentId ? Number(createStudentId) : undefined
      });
      wx.showToast({ title: '开户成功', icon: 'success' });
      this.setData({
        createUsername: '',
        createName: '',
        createMobile: '',
        createPassword: '',
        createStudentId: null,
        createStudentName: '选填，暂不绑定学生'
      });
      this.loadParents();
    } catch (err) {
      // 错误提示由 request 统一处理
    } finally {
      this.setData({ submitting: false });
    }
  },

  onPickBindParent(e) {
    const idx = Number(e.detail.value);
    const p = this.data.parents[idx];
    this.setData({
      bindParentId: p ? p.id : null,
      bindParentName: p ? this.data.parentNames[idx] : '请选择家长'
    });
  },

  onPickBindStudent(e) {
    const idx = Number(e.detail.value);
    const s = this.data.students[idx];
    this.setData({
      bindStudentId: s ? s.id : null,
      bindStudentName: s ? this.data.studentNames[idx] : '请选择学生'
    });
  },

  async onBindParent() {
    const { bindParentId, bindStudentId } = this.data;
    if (!bindParentId || !bindStudentId) {
      wx.showToast({ title: '请选择家长和学生', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await post('/students/' + bindStudentId + '/parents', { parentId: Number(bindParentId) });
      wx.showToast({ title: '绑定成功', icon: 'success' });
      this.setData({
        bindParentId: null,
        bindParentName: '请选择家长',
        bindStudentId: null,
        bindStudentName: '请选择学生'
      });
    } catch (err) {
      // 错误提示由 request 统一处理
    } finally {
      this.setData({ submitting: false });
    }
  }
});
