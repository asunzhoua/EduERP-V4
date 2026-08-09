// utils/renewal-threshold.js
// 课时续费预警阈值（集中配置，与后端 RENEWAL_WARNING_THRESHOLD 默认值 5 对齐）
// 优先级：miniapp/config.js 的 renewalWarningThreshold（本地可覆盖）> 默认 5
// config.js 被 .gitignore 屏蔽（本地文件），故此处提供默认值兜底，缺失时不会抛错。

let config = {};
try {
  config = require('../config');
} catch (e) {
  // config.js 不存在时使用默认阈值
}

const RENEWAL_WARNING_THRESHOLD = (config && config.renewalWarningThreshold) || 5;
const RENEWAL_CRITICAL_THRESHOLD = Math.floor(RENEWAL_WARNING_THRESHOLD / 2);

module.exports = {
  RENEWAL_WARNING_THRESHOLD,
  RENEWAL_CRITICAL_THRESHOLD
};
