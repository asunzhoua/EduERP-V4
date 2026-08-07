/**
 * 角色判断工具函数
 * 封装角色常量、判断逻辑、首页路由和 TabBar 配置
 */

// 角色常量
var ROLES = {
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'SuperAdmin',
};

// 角色中文名映射
var ROLE_TEXT_MAP = {
  Teacher: '教师',
  Student: '学生',
  Parent: '家长',
  Admin: '管理员',
  SuperAdmin: '管理员',
};

/**
 * 判断是否为教师角色
 * @param {string} role
 * @returns {boolean}
 */
function isTeacher(role) {
  return role === ROLES.TEACHER;
}

/**
 * 判断是否为教师角色（含 Admin / SuperAdmin）
 * @param {string} role
 * @returns {boolean}
 */
function isTeacherOrAbove(role) {
  return role === ROLES.TEACHER || role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
}

/**
 * 判断是否为学生角色
 * @param {string} role
 * @returns {boolean}
 */
function isStudent(role) {
  return role === ROLES.STUDENT;
}

/**
 * 判断是否为家长角色
 * @param {string} role
 * @returns {boolean}
 */
function isParent(role) {
  return role === ROLES.PARENT;
}

/**
 * 判断是否为家长或学生角色
 * @param {string} role
 * @returns {boolean}
 */
function isStudentOrParent(role) {
  return role === ROLES.STUDENT || role === ROLES.PARENT;
}

/**
 * 获取角色对应的首页路由（用于登录后跳转）
 * @param {string} role
 * @returns {string}
 */
function getHomePage(role) {
  if (isTeacherOrAbove(role)) {
    return '/pages/index/index';
  }
  if (isStudentOrParent(role)) {
    return '/pages/student/index';
  }
  // 兜底
  return '/pages/index/index';
}

/**
 * 获取角色中文名
 * @param {string} role
 * @returns {string}
 */
function getRoleText(role) {
  return ROLE_TEXT_MAP[role] || '用户';
}

/**
 * 根据角色配置 TabBar
 * 注意：wx.setTabBarItem 只能修改 text / iconPath / selectedIconPath
 * 不能修改 pagePath，因此所有角色共享同一组 TabBar 页面路由，
 * 不匹配的页面通过 onLoad 重定向到角色合适的页面。
 *
 * @param {string} role
 */
function setupTabBarByRole(role) {
  if (isTeacherOrAbove(role)) {
    // 教师 TabBar
    wx.setTabBarItem({
      index: 0,
      text: '首页',
      iconPath: 'images/home.png',
      selectedIconPath: 'images/home-active.png',
    });
    wx.setTabBarItem({
      index: 1,
      text: '课程',
      iconPath: 'images/course.png',
      selectedIconPath: 'images/course-active.png',
    });
    wx.setTabBarItem({
      index: 2,
      text: '班级',
      iconPath: 'images/class.png',
      selectedIconPath: 'images/class-active.png',
    });
    wx.setTabBarItem({
      index: 3,
      text: '个人',
      iconPath: 'images/home.png',
      selectedIconPath: 'images/home-active.png',
    });
  } else if (isStudentOrParent(role)) {
    // 学生/家长 TabBar
    wx.setTabBarItem({
      index: 0,
      text: '首页',
      iconPath: 'images/home.png',
      selectedIconPath: 'images/home-active.png',
    });
    wx.setTabBarItem({
      index: 1,
      text: '课程',
      iconPath: 'images/course.png',
      selectedIconPath: 'images/course-active.png',
    });
    wx.setTabBarItem({
      index: 2,
      text: '学习',
      iconPath: 'images/class.png',
      selectedIconPath: 'images/class-active.png',
    });
    wx.setTabBarItem({
      index: 3,
      text: '我的',
      iconPath: 'images/home.png',
      selectedIconPath: 'images/home-active.png',
    });
  }
}

module.exports = {
  ROLES: ROLES,
  isTeacher: isTeacher,
  isTeacherOrAbove: isTeacherOrAbove,
  isStudent: isStudent,
  isParent: isParent,
  isStudentOrParent: isStudentOrParent,
  getHomePage: getHomePage,
  getRoleText: getRoleText,
  setupTabBarByRole: setupTabBarByRole,
};
