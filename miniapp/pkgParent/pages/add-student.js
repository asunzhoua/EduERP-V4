// pkgParent/pages/add-student.js
const { post, get } = require('../../utils/request');

Page({
  data: {
    name: '',
    genderIndex: -1,
    genderOptions: ['男', '女'],
    birthDate: '',
    grade: '',
    school: '',
    classes: [],
    classLabels: ['暂不选择班级'],
    classIndex: 0,
    today: '',
    loading: false
  },

  onLoad() {
    const d = new Date();
    const today =
      d.getFullYear() +
      '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
    this.setData({ today });
    this.loadOpenClasses();
  },

  // 加载可选班级（选填，失败不影响填表）
  loadOpenClasses() {
    var self = this;
    get('/classes/open').then(function (res) {
      var classes = (res && res.items) || [];
      var labels = ['暂不选择班级'].concat(classes.map(function (c) {
        return c.name + (c.schedule ? ' · ' + c.schedule : '');
      }));
      self.setData({ classes: classes, classLabels: labels });
    }).catch(function () {
      // 班级加载失败时仍可提交（不选班级）
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

  onClassChange: function (e) {
    this.setData({ classIndex: Number(e.detail.value) });
  },

  onSubmit: function () {
    var self = this;
    if (self.data.loading) return; // 防重复点击

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

    var selectedClass = self.data.classIndex > 0
      ? self.data.classes[self.data.classIndex - 1]
      : null;

    self.setData({ loading: true });
    post('/students/my-children', {
      name: name,
      gender: self.data.genderIndex === 0 ? 'MALE' : 'FEMALE',
      birthDate: birthDate,
      grade: grade,
      school: school || undefined,
      classCode: selectedClass ? selectedClass.classCode : undefined
    }).then(function () {
      wx.showToast({ title: '添加成功', icon: 'success' });
      setTimeout(function () {
        wx.navigateBack({
          fail: function () {
            wx.reLaunch({ url: '/pages/student/index' });
          }
        });
      }, 1000);
    }).catch(function () {
      // request.js 已弹具体错误（如手机号已被注册等），留在当前页
    }).finally(function () {
      self.setData({ loading: false });
    });
  }
});
