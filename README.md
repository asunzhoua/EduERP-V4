# EduERP V4 — Education ERP

> 版本：v4.0
> 状态：Backend Ready ✅ | Miniapp MVP ✅ | Build PASS ✅

---

## 项目简介

EduERP V4 是教培机构 ERP 系统。后端采用 NestJS + TypeScript + MySQL (DDD 架构)，前端为微信小程序，支持教师端和学生端核心业务流程。

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
