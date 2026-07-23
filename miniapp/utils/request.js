// utils/request.js

// Token 过期处理锁 — 防止多个并发请求同时触发跳转登录
let isLoggingOut = false;

// 网络状态缓存
let networkType = 'unknown';
let isConnected = true;

// 初始化网络状态监听
function initNetworkMonitor() {
  wx.getNetworkType({
    success: function(res) {
      networkType = res.networkType;
      isConnected = networkType !== 'none';
    }
  });

  wx.onNetworkStatusChange(function(res) {
    isConnected = res.isConnected;
    networkType = res.networkType;
    if (!res.isConnected) {
      wx.showToast({ title: '网络连接已断开', icon: 'none', duration: 2000 });
    }
  });
}

// 尝试初始化（可能在 app 启动前被 require）
try {
  initNetworkMonitor();
} catch (e) {
  // 静默失败，首次请求时会再检查
}

/**
 * 处理 Token 过期（全局单例 — 防止并发跳转）
 */
function handleTokenExpired() {
  if (isLoggingOut) return;
  isLoggingOut = true;

  wx.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2000 });

  // 延迟跳转，让用户看到提示
  setTimeout(function() {
    try {
      var app = getApp();
      if (app && app.logout) {
        app.logout();
      } else {
        wx.removeStorageSync('token');
        wx.reLaunch({ url: '/pages/login/login' });
      }
    } catch (e) {
      wx.removeStorageSync('token');
      wx.reLaunch({ url: '/pages/login/login' });
    }
    // 重置锁，允许下次登录后再触发
    setTimeout(function() { isLoggingOut = false; }, 3000);
  }, 500);
}

/**
 * 封装请求方法
 * @param {Object} options 请求配置
 * @param {number} [options.timeout] 超时时间（毫秒），默认 15000
 * @param {number} [options.retry] 重试次数，默认 1（仅网络错误重试）
 * @returns {Promise}
 */
function request(options) {
  var app = getApp();
  var timeout = options.timeout || 15000;
  var maxRetry = options.retry !== undefined ? options.retry : 1;
  var attempt = 0;

  function doRequest() {
    attempt++;
    return new Promise(function(resolve, reject) {
      // 网络状态预检
      if (!isConnected) {
        wx.showToast({ title: '网络未连接，请检查网络设置', icon: 'none', duration: 2000 });
        reject({ errMsg: 'network_unavailable' });
        return;
      }

      var token = (app && app.globalData && app.globalData.token) || wx.getStorageSync('token');
      var baseUrl = (app && app.globalData && app.globalData.baseUrl) || '';

      wx.request({
        url: baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        timeout: timeout,
        header: {
          'Authorization': token ? 'Bearer ' + token : '',
          'Content-Type': 'application/json'
        },
        success: function(res) {
          if (res.data && res.data.code === 0) {
            resolve(res.data.data);
          } else if (res.data && res.data.code === 2002) {
            // Token 过期
            handleTokenExpired();
            reject(res.data);
          } else {
            wx.showToast({
              title: (res.data && res.data.message) || '请求失败',
              icon: 'none'
            });
            reject(res.data);
          }
        },
        fail: function(err) {
          // 网络错误且还有重试次数
          if (attempt <= maxRetry && isConnected) {
            doRequest().then(resolve).catch(reject);
            return;
          }
          var errMsg = (err && err.errMsg) || '';
          if (errMsg.indexOf('timeout') > -1) {
            wx.showToast({ title: '请求超时，请检查网络后重试', icon: 'none', duration: 2000 });
          } else {
            wx.showToast({ title: '网络错误，请稍后重试', icon: 'none', duration: 2000 });
          }
          reject(err);
        }
      });
    });
  }

  return doRequest();
}

// GET 请求
function get(url, data) {
  return request({ url, method: 'GET', data });
}

// POST 请求
function post(url, data) {
  return request({ url, method: 'POST', data });
}

// PUT 请求
function put(url, data) {
  return request({ url, method: 'PUT', data });
}

// DELETE 请求
function del(url, data) {
  return request({ url, method: 'DELETE', data });
}

module.exports = {
  request,
  get,
  post,
  put,
  del
};