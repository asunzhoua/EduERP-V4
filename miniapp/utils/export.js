const { post } = require('./request');

/**
 * 导出数据
 * @param {string} type - 导出类型：students, lessons, consumption, salary, finance
 * @param {object} filters - 过滤条件
 * @param {string} format - 格式：csv | excel
 * @returns {Promise<string>} 保存的文件路径
 */
async function exportData(type, filters = {}, format = 'csv') {
  try {
    const res = await post(`/export/${type}`, Object.assign({}, filters, { format: format }), {
      responseType: 'arraybuffer'
    });

    // 生成文件名
    const timestamp = new Date().getTime();
    const ext = format === 'excel' ? 'xlsx' : 'csv';
    const filename = type + '_' + timestamp + '.' + ext;

    // 保存文件
    return saveFile(res.data, filename);
  } catch (err) {
    console.error('[Export] 导出失败:', err);
    throw err;
  }
}

/**
 * 保存文件（微信小程序文件系统）
 * @param {ArrayBuffer} buffer
 * @param {string} filename
 * @returns {Promise<string>}
 */
function saveFile(buffer, filename) {
  return new Promise(function(resolve, reject) {
    var filePath = wx.env.USER_DATA_PATH + '/' + filename;
    wx.getFileSystemManager().writeFile({
      filePath: filePath,
      data: buffer,
      encoding: 'binary',
      success: function() {
        wx.showToast({
          title: '导出成功',
          icon: 'success'
        });
        resolve(filePath);
      },
      fail: function(err) {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

module.exports = {
  exportData: exportData,
  saveFile: saveFile
};
