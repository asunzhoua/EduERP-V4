/**
 * Token / 登录状态管理工具
 * 提供统一的 token 存取、登录状态判断接口
 */

/**
 * 获取存储的 token
 * @returns {string|null}
 */
function getToken() {
  return wx.getStorageSync('token') || null;
}

/**
 * 设置 token 及过期时间
 * @param {string} token
 * @param {number} [expiresIn] 过期时间（秒），默认 86400
 */
function setToken(token, expiresIn) {
  wx.setStorageSync('token', token);
  if (expiresIn) {
    wx.setStorageSync('tokenExpiry', Date.now() + expiresIn * 1000);
  }
}

/**
 * 清除所有登录态信息
 */
function clearToken() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('tokenExpiry');
  wx.removeStorageSync('userInfo');
}

/**
 * 检查是否已登录
 * @returns {boolean}
 */
function isLoggedIn() {
  var token = getToken();
  if (!token) return false;

  // 检查过期时间
  var expiry = wx.getStorageSync('tokenExpiry');
  if (expiry && Date.now() > expiry) {
    clearToken();
    return false;
  }

  return true;
}

module.exports = {
  getToken: getToken,
  setToken: setToken,
  clearToken: clearToken,
  isLoggedIn: isLoggedIn,
};
