// utils/child-context.js
// 家长端「当前孩子」上下文：全局 globalData + storage 持久化。
// pkgStudent 页面在家长（Parent）模式下，把 /students/self/* 路由映射为 /students/:childId/*，
// 修复家长访问 self 端点 404 的问题。
const { get } = require('./request');

const STORAGE_KEY = 'currentChildId';
let _childrenCache = null;

function isParentRole() {
  const app = getApp();
  const user = (app && app.globalData && app.globalData.userInfo) || {};
  return user.role === 'Parent';
}

function getChildren(force) {
  if (!force && _childrenCache) return Promise.resolve(_childrenCache);
  return get('/students/my-children')
    .then((data) => {
      const children = Array.isArray(data) ? data : (data && data.items) || [];
      _childrenCache = children;
      return children;
    })
    .catch(() => _childrenCache || []);
}

function setCurrentChildId(id) {
  const app = getApp();
  if (app && app.globalData) app.globalData.currentChildId = id;
  wx.setStorageSync(STORAGE_KEY, id);
}

// 失效孩子列表缓存：新增/编辑/解绑孩子成功后调用，强制下次 getChildren() 重新拉取。
function invalidateChildrenCache() {
  _childrenCache = null;
}

function getCurrentChildId() {
  const app = getApp();
  if (app && app.globalData && app.globalData.currentChildId) {
    return app.globalData.currentChildId;
  }
  return wx.getStorageSync(STORAGE_KEY) || null;
}

// 确保已有「当前孩子」：无则默认第一个。返回页面渲染上下文。
function ensureCurrentChild() {
  return getChildren().then((children) => {
    const isParent = isParentRole();
    if (!isParent || !children.length) {
      return { isParent, currentChild: null, children };
    }
    let currentId = getCurrentChildId();
    if (!currentId || !children.some((c) => Number(c.id) === Number(currentId))) {
      currentId = children[0].id;
      setCurrentChildId(currentId);
    }
    const current =
      children.find((c) => Number(c.id) === Number(currentId)) || children[0];
    return { isParent, currentChild: current, children };
  });
}

// 把 self 路由按角色映射到孩子维度；Student 角色原样返回 self 路由。
function studentApiPath(selfPath) {
  if (!isParentRole()) return selfPath;
  const childId = getCurrentChildId();
  if (!childId) return selfPath;
  if (selfPath === '/students/self') return '/students/my-children/' + childId;
  return '/students/' + childId + selfPath.replace(/^\/students\/self/, '');
}

// 页面顶部孩子切换条：ActionSheet 列出孩子，选中后回调 onSelected(child)。
function showChildSwitch(onSelected) {
  getChildren().then((children) => {
    if (!children.length) {
      wx.showToast({ title: '暂无关联孩子', icon: 'none' });
      return;
    }
    if (children.length === 1) {
      wx.showToast({ title: '仅一个孩子，无需切换', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: children.map((c) => c.name + (c.grade ? ' · ' + c.grade : '')),
      success(res) {
        const child = children[res.tapIndex];
        if (!child) return;
        setCurrentChildId(child.id);
        if (typeof onSelected === 'function') onSelected(child);
      },
    });
  });
}

module.exports = {
  isParentRole,
  getChildren,
  setCurrentChildId,
  getCurrentChildId,
  invalidateChildrenCache,
  ensureCurrentChild,
  studentApiPath,
  showChildSwitch,
};
