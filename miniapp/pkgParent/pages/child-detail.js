// pages/parent/child-detail.js
const { get, del } = require('../../utils/request');
const { setCurrentChildId, invalidateChildrenCache } = require('../../utils/child-context');
const { getSubjectMap } = require('../../utils/subjects');
const { RENEWAL_WARNING_THRESHOLD, RENEWAL_CRITICAL_THRESHOLD } = require('../../utils/renewal-threshold');

const LESSON_STATUS_TEXT = {
  DRAFT: '草稿',
  SCHEDULED: '待上课',
  TEACHING: '进行中',
  FINISHED: '已完成',
  ARCHIVED: '已归档',
  CANCELLED: '已取消',
  SUSPENDED: '已停课',
  RESCHEDULED: '已改期',
  MAKEUP_PENDING: '待补课',
  MAKEUP_COMPLETED: '补课完成'
};

const ATTENDANCE_STATUS_TEXT = {
  PRESENT: '出勤',
  ABSENT: '缺勤',
  LATE: '迟到',
  LEAVE: '请假'
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
    childId: null,
    childInfo: null,
    contracts: [],
    attendance: [],
    timetable: [],
    loading: true,
    error: null,
    activeTab: 'overview',
    // 预警：课时不足的合同（ACTIVE 且剩余课时 <= 阈值）
    lowLessonContracts: []
  },

  onLoad(options) {
    if (options.id) {
      // 设置当前孩子，后续学生维度请求映射到该孩子
      setCurrentChildId(options.id);

      // 从 URL 参数获取基本信息
      const childInfo = {
        id: options.id,
        name: decodeURIComponent(options.name || ''),
        studentCode: decodeURIComponent(options.studentCode || ''),
        school: decodeURIComponent(options.school || ''),
        grade: decodeURIComponent(options.grade || '')
      };

      this.setData({
        childId: options.id,
        childInfo: childInfo
      });
      this.loadData(options.id);
    }
  },

  onShow() {
    // 首次进入由 onLoad 加载；返回页面时刷新拿到最新课时
    if (!this._inited) {
      this._inited = true;
      return;
    }
    if (this.data.childId) {
      this.loadData(this.data.childId);
    }
  },

  onPullDownRefresh() {
    if (this.data.childId) {
      this.loadData(this.data.childId).finally(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  async loadData(childId) {
    this.setData({ loading: true, error: null });

    try {
      // 合同、出勤、课表（班级驱动：含 SCHEDULED 未来课）
      const [contracts, attendance, lessons] = await Promise.all([
        get(`/students/${childId}/contracts`).catch(() => []),
        get(`/students/${childId}/attendance`).catch(() => []),
        get(`/students/${childId}/lessons`).catch(() => [])
      ]);

      const rawContracts = Array.isArray(contracts) ? contracts : (contracts.items || []);
      const map = await getSubjectMap();
      const decoratedContracts = rawContracts.map((c) => ({
        ...c,
        subject: map[c.subject] || c.subject,
        warningLevel: calcWarningLevel(c.status, c.remainingLessons)
      }));

      const rawTimetable = Array.isArray(lessons) ? lessons : (lessons.items || []);
      const decoratedTimetable = rawTimetable.map((l) => ({
        ...l,
        lessonStatusText: LESSON_STATUS_TEXT[l.lessonStatus] || l.lessonStatus || '-',
        statusText: l.status ? (ATTENDANCE_STATUS_TEXT[l.status] || l.status) : ''
      }));

      this.setData({
        contracts: decoratedContracts,
        lowLessonContracts: decoratedContracts.filter((c) => c.warningLevel !== 'none'),
        attendance: Array.isArray(attendance) ? attendance : (attendance.items || []),
        timetable: decoratedTimetable,
        loading: false
      });
    } catch (err) {
      console.error('[Parent] 加载孩子详情失败:', err);
      this.setData({
        error: '加载失败，请稍后重试',
        loading: false
      });
    }
  },

  onTabChange(e) {
    const { tab } = e.currentTarget.dataset;
    this.setData({ activeTab: tab });
  },

  // 查看合同消耗明细（扣课流水）
  goToConsumeRecords(e) {
    const { code } = e.currentTarget.dataset;
    if (!code) return;
    wx.navigateTo({
      url: '/pkgStudent/pages/consume-records?code=' + code,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 课时不足行动引导：联系机构续费
  goToContact() {
    wx.navigateTo({
      url: '/pkgParent/pages/contact',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 编辑孩子基本信息
  goToEdit() {
    wx.navigateTo({
      url: '/pkgParent/pages/edit-student?id=' + this.data.childId,
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  },

  // 解绑孩子
  goToUnbind() {
    var self = this;
    var childInfo = this.data.childInfo || {};
    wx.showModal({
      title: '解绑孩子',
      content: '确定解除与「' + (childInfo.name || '') + '」的绑定吗？解绑后无法在此查看孩子数据。',
      success: function (res) {
        if (!res.confirm) return;
        del('/students/my-children/' + self.data.childId).then(function () {
          invalidateChildrenCache();
          wx.showToast({ title: '已解除绑定', icon: 'success' });
          setTimeout(function () {
            wx.navigateBack({
              fail: function () {
                wx.switchTab({ url: '/pages/index/index' });
              }
            });
          }, 1000);
        }).catch(function () {
          // request.js 已 toast 错误，留在当前页
        });
      }
    });
  },

  // 切换孩子：跳转多孩子列表页（parent/index 全量列表）
  goToChildSwitch() {
    wx.navigateTo({
      url: '/pkgParent/pages/index',
      fail() {
        wx.showToast({ title: '页面跳转失败', icon: 'none' });
      }
    });
  }
});
