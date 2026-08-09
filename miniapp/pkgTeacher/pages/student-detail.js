// pages/teacher/student-detail.js
const { get } = require('../../utils/request');
const { RENEWAL_WARNING_THRESHOLD, RENEWAL_CRITICAL_THRESHOLD } = require('../../utils/renewal-threshold');

const SUBJECT_LABELS = {
  MATH: '数学', ENGLISH: '英语', CHINESE: '语文', PHYSICS: '物理',
  CHEMISTRY: '化学', ART: '美术', MUSIC: '音乐', DANCE: '舞蹈',
  SPORTS: '体育', CODING: '编程', OTHER: '其他'
};

const CONTRACT_STATUS_LABELS = {
  ACTIVE: '生效中', EXHAUSTED: '已用完', EXPIRED: '已过期',
  REFUNDED: '已退款', FROZEN: '已冻结'
};

// ACTIVE 合同剩余课时 <= 阈值 → warn；<= 阈值一半 → critical
function calcWarningLevel(status, remaining) {
  if (status !== 'ACTIVE' || remaining == null) return 'none';
  if (remaining <= RENEWAL_CRITICAL_THRESHOLD) return 'critical';
  if (remaining <= RENEWAL_WARNING_THRESHOLD) return 'warn';
  return 'none';
}

Page({
  data: {
    studentCode: '',
    student: null,
    classes: [],
    contracts: [],
    contractSummary: { total: 0, remaining: 0 },
    loading: true,
    error: null,
    totalCompletedLessons: 0,
    totalLessons: 0,
    overallProgress: 0
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

    const { code } = options;
    if (code) {
      this.setData({ studentCode: code });
      this.loadData(code);
    } else {
      this.setData({
        error: '缺少学生编码',
        loading: false
      });
    }
  },

  // 首次进入由 onLoad 加载；返回页面时刷新拿到最新课时
  onShow() {
    if (!this._inited) {
      this._inited = true;
      return;
    }
    if (this.data.studentCode) {
      this.loadData(this.data.studentCode);
    }
  },

  async loadData(code) {
    this.setData({ loading: true, error: null });

    try {
      const [studentResult, enrollments, contractsRes] = await Promise.all([
        get('/students', { studentCode: code }),
        get(`/enrollments/students/${code}/enrollments`),
        get(`/contracts/students/${code}/contracts`).catch(() => [])
      ]);

      const student = studentResult && studentResult.items && studentResult.items[0] ? studentResult.items[0] : null;

      // Transform enrollments to class format
      const classes = (enrollments || []).map(e => ({
        classCode: e.classCode || '',
        name: e.className || '',
        courseName: e.courseName || '',
        completedLessons: e.completedLessons || 0,
        totalLessons: e.totalLessons || 0
      }));

      // 合同课时（与家长/学生/后台同源：contract.remainingLessons）
      const contractList = (Array.isArray(contractsRes) ? contractsRes : []).map(c => ({
        contractCode: c.contractCode,
        subject: SUBJECT_LABELS[c.subject] || c.subject,
        totalLessons: c.totalLessons || 0,
        remainingLessons: c.remainingLessons || 0,
        status: c.status,
        statusText: CONTRACT_STATUS_LABELS[c.status] || c.status,
        warningLevel: calcWarningLevel(c.status, c.remainingLessons)
      }));
      const contractSummary = {
        total: contractList.reduce((s, c) => s + c.totalLessons, 0),
        remaining: contractList.reduce((s, c) => s + c.remainingLessons, 0)
      };

      const totalCompletedLessons = classes.reduce((sum, c) => sum + (c.completedLessons || 0), 0);
      const totalLessons = classes.reduce((sum, c) => sum + (c.totalLessons || 0), 0);
      const overallProgress = totalLessons > 0 ? Math.round(totalCompletedLessons / totalLessons * 100) : 0;

      this.setData({
        student,
        classes,
        contracts: contractList,
        contractSummary,
        loading: false,
        totalCompletedLessons,
        totalLessons,
        overallProgress
      });
    } catch (err) {
      console.error('[Student Detail] 加载失败:', err);
      this.setData({
        error: err.message || '加载失败',
        student: null,
        classes: [],
        contracts: [],
        contractSummary: { total: 0, remaining: 0 },
        loading: false
      });
    }
  },

  // 跳转班级详情
  goToClassDetail(e) {
    const { code } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pkgTeacher/pages/class-detail?code=${code}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 跳看出勤记录（从所属班级进入，取第一个班级）
  goToLessonRecord() {
    const classes = this.data.classes;
    if (classes && classes.length > 0) {
      wx.navigateTo({
        url: `/pkgTeacher/pages/lesson-record?classCode=${classes[0].classCode}`,
        fail() {
          wx.showToast({ title: '页面跳转失败', icon: 'none' });
        }
      });
    } else {
      wx.showToast({ title: '该学生暂无班级信息', icon: 'none' });
    }
  },

  // 跳转课时消耗明细（合同扣课流水）
  goToConsumeRecords(e) {
    const { code } = e.currentTarget.dataset;
    if (!code) return;
    wx.navigateTo({
      url: `/pkgStudent/pages/consume-records?code=${code}`,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 返回
  onBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  // 重试加载
  retryLoad() {
    if (this.data.studentCode) {
      this.loadData(this.data.studentCode);
    }
  }
});
