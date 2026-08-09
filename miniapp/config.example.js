// miniapp/config.example.js
// 小程序环境配置模板（占位符）—— 可安全提交
//
// 使用方式：
//   1. 复制本文件为 miniapp/config.js（config.js 已被 .gitignore 屏蔽，不会入库）
//   2. 在本地 config.js 中填入真实环境地址
//   3. 禁止在 config.js 或本模板中填写真实内网 IP / 公网 IP / 动态解析域名
//
// 微信小程序不支持 process.env，通过 __wxConfig 或手动切换

const ENV = 'development' // 部署时改为 'production'

const configs = {
  development: {
    // 本地联调地址：仅允许 localhost / 127.0.0.1
    baseUrl: 'http://localhost:3000/api/v1',
    debug: true,
    // 课时续费预警阈值（可选；缺省 5，与后端 RENEWAL_WARNING_THRESHOLD 对齐）
    renewalWarningThreshold: 5
  },
  production: {
    // 生产地址：仅允许占位符域名，部署时替换为已备案的真实域名（禁止裸 IP / 动态域名）
    baseUrl: 'https://your-production-domain.com/api/v1',
    debug: false,
    renewalWarningThreshold: 5
  }
}

module.exports = configs[ENV]
