# EduERP V4 — Education ERP

> 版本：v4.0
> 状态：Backend Ready ✅ | Miniapp MVP ✅ | Build PASS ✅

---

## 项目简介

EduERP V4 是教培机构 ERP 系统。后端采用 NestJS + TypeScript + MySQL (DDD 架构)，前端为微信小程序，支持教师端和家长端核心业务流程。

## 项目结构

```
EduERP-V4/
├── README.md
├── backend/              — NestJS 后端
│   ├── src/              — 源代码 (DDD: kernel/modules/shared)
│   ├── test/             — 测试 (947 tests, 76 suites)
│   └── bot/              — 飞书 Bot Server
├── miniapp/              — 微信小程序前端
│   ├── pages/            — 页面 (teacher/ + student/)
│   └── utils/            — 工具 (request.js 等)
├── docs/                 — 文档体系
├── .ai/                  — AI Context 体系
└── database/             — 数据库脚本 (EduOS 19 tables)
```

## 技术栈

- **后端**: NestJS + TypeScript + MySQL 8.0 (TypeORM)
- **前端**: 微信小程序原生开发
- **认证**: JWT + Passport + RBAC
- **事件**: @nestjs/event-emitter
- **API 文档**: Swagger (自动生成)

## 快速开始

```bash
# 后端
cd backend
npm install
npm run start:dev
npx jest --no-coverage    # 运行测试

# 小程序
# 使用微信开发者工具打开 miniapp/ 目录
```

## 部署指南

### 环境要求

- Node.js 18+
- MySQL 8.0+
- npm 9+
- 微信开发者工具（小程序发布）

### 后端部署

```bash
# 1. 克隆仓库
git clone https://github.com/asunzhoua/EduERP-V4.git
cd EduERP-V4/backend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入实际的数据库密码、JWT Secret 等

# 4. 初始化数据库（首次部署）
npm run seed

# 5. 生产模式启动
npm run start:prod
```

### 小程序部署

1. 修改 `miniapp/config.js` 中的 `ENV` 为 `'production'`
2. 将 `production.baseUrl` 替换为实际生产环境 API 域名
3. 使用微信开发者工具打开 `miniapp/` 目录
4. 点击"上传" → 填写版本号 → 提交审核
5. 审核通过后发布

### 环境变量说明

| 变量 | 说明 | 示例 |
|:-----|:-----|:-----|
| DB_HOST | 数据库地址 | localhost |
| DB_PORT | 数据库端口 | 3306 |
| DB_USERNAME | 数据库用户名 | your_db_user |
| DB_PASSWORD | 数据库密码 | （必填，无默认值） |
| DB_DATABASE | 数据库名称 | EduOS |
| JWT_SECRET | JWT 签名密钥 | 64位随机hex字符串 |
| JWT_EXPIRES_IN | Token 有效期 | 7d |
| SERVER_PORT | 后端服务端口 | 3000 |
| LOG_LEVEL | 日志级别 | debug / info / warn |
| WECHAT_APP_ID | 微信小程序 AppID | （预留） |
| WECHAT_APP_SECRET | 微信小程序 AppSecret | （预留） |
| REDIS_HOST | Redis 地址 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |

## 核心模块

- **identity** — 用户认证 (注册/登录/JWT)
- **student** — 学生管理
- **teaching** — 教学核心 (课程/班级/合同/报名/课时/考勤/调课)

## 当前状态

- 测试: 947 tests / 76 suites ALL PASS ✅
- 构建: PASS (0 TS errors) ✅
- 数据库: EduOS 19 tables + 6 indexes ✅
- P1 模块: 27/27 COMPLETED ✅
- GitHub: https://github.com/asunzhoua/EduERP-V4

## 文档

完整文档见 [docs/](./docs/) 目录，AI 上下文见 [.ai/AI_ENTRYPOINT.md](./.ai/AI_ENTRYPOINT.md)。
