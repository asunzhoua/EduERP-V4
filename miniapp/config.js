// miniapp/config.js
// 环境配置集中管理
// 微信小程序不支持 process.env，通过 __wxConfig 或手动切换

const ENV = 'development' // 部署时改为 'production'

const configs = {
  development: {
    baseUrl: 'http://localhost:3000/api/v1',
    debug: true
  },
  production: {
    baseUrl: 'https://your-production-domain.com/api/v1', // TODO: 替换为实际生产域名
    debug: false
  }
}

module.exports = configs[ENV]
