// pkgParent/pages/edit-student.js
const { get, put } = require('../../utils/request');
const { invalidateChildrenCache } = require('../../utils/child-context');

Page({
  data: {
    childId: null,
    name: '',
    genderIndex: -1,
    genderOptions: ['男', '女'],
    birthDate: '',
    grade: '',
    school: '',
    today: '',
    loading: false
  },

  onLoad(options) {
    const d = new Date();
    const today =
      d.getFullYear() +
      '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
    this.setData({ today: today, childId: options.id || null });

    if (options.id) {
      this.loadChild(options.id);
    }
  },

  // 加载孩子详情并预填表单
  loadChild(id) {
    var self = this;
    get('/students/my-children/' + id).then(function (child) {
      var genderIndex = child.gender === 'MALE' ? 0 : 1;
      var birthDate = child.birthDate || '';
      // 非 'YYYY-MM-DD' 格式时尽量截取前 10 位
      if (birthDate && !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) {
        birthDate = birthDate.slice(0, 10);
      }
      self.setData({
        name: child.name || '',
        genderIndex: genderIndex,
        birthDate: birthDate,
        grade: child.grade || '',
        school: child.school || ''
      });
    }).catch(function () {
      // request.js 已 toast 错误，留在当前页
    });
  },

  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    var data = {};
    data[field] = e.detail.value;
    this.setData(data);
  },

  onGenderChange: function (e) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },

  onBirthChange: function (e) {
    this.setData({ birthDate: e.detail.value });
  },

  onSubmit: function () {
    var self = this;
    if (self.data.loading) return; // 防重复点击
    if (!self.data.childId) {
      wx.showToast({ title: '孩子信息缺失', icon: 'none' });
      return;
    }

    var name = (self.data.name || '').trim();
    var birthDate = self.data.birthDate || '';
    var grade = (self.data.grade || '').trim();
    var school = (self.data.school || '').trim();

    if (!name) {
      wx.showToast({ title: '请填写小朋友姓名', icon: 'none' });
      return;
    }
    if (self.data.genderIndex === -1) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      return;
    }
    if (!birthDate) {
      wx.showToast({ title: '请选择生日', icon: 'none' });
      return;
    }
    if (!grade) {
      wx.showToast({ title: '请填写就读年级', icon: 'none' });
      return;
    }
    if (grade.length > 50) {
      wx.showToast({ title: '年级名称过长', icon: 'none' });
      return;
    }

    self.setData({ loading: true });
    put('/students/my-children/' + self.data.childId, {
      name: name,
      gender: self.data.genderIndex === 0 ? 'MALE' : 'FEMALE',
      birthDate: birthDate,
      grade: grade,
      school: school || undefined
    }).then(function () {
      invalidateChildrenCache();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(function () {
        wx.navigateBack({
          fail: function () {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }, 1000);
    }).catch(function () {
      // request.js 已 toast 错误，留在当前页
    }).finally(function () {
      self.setData({ loading: false });
    });
  }
});
