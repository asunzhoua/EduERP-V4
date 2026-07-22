// utils/request.js
const app = getApp();

/**
 * 封装请求方法
 * @param {Object} options 请求配置
 * @returns {Promise}
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const token = app.globalData.token || wx.getStorageSync('token');

    wx.request({
      url: app.globalData.baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.data && res.data.code === 0) {
          resolve(res.data.data);
        } else if (res.data && res.data.code === 2002) {
          // Token 过期，跳转登录
          app.logout();
          reject(res.data);
        } else {
          wx.showToast({
            title: (res.data && res.data.message) || '请求失败',
            icon: 'none'
          });
          reject(res && res.data);
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
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