# EduERP-V4 当前状态

更新日期：2026-07-22

## Phase 进度

Phase 1 基础搭建 — 已完成（后端模块、DB、测试框架）
Phase 2 页面结构 — 已完成（小程序全部页面、TabBar、编译通过）
Phase 3 编译与入口闭环 — 已完成（登录路由、资源补齐、Mock开关、WXML编译修复）
Phase 4 业务流程闭环 — 已完成（前后端 API 调用链全部对齐，12条链路确认）
Phase 5 真实数据与清理 — 进行中（详见下方 Phase 5 进度）

## 测试

75 suites / 935 tests ALL PASS。
覆盖 identity/auth（58 tests）和 teaching 多模块。
类型：单元测试 + E2E 集成测试。

## 构建

27 个 TS 编译错误，不阻塞开发和测试。原因是 isolatedModules 导出语法问题。

## 安全

JWT 密钥 — 已加固（64字节随机 hex）
.gitignore — 已配置（排除 .env、node_modules、dist）
DB 密码 — 硬编码 root/sun123456，待修复
管理员密码 — 硬编码 admin123，待修复
API Key — 文档中已替换为占位符

## 后端运行状态

NestJS 运行于 localhost:3000，全局前缀 /api/v1。
种子账号：admin / admin123（SuperAdmin）。
数据库：MySQL，EduOS 库，19 张表。

## 微信开发者工具状态

已登录，项目已导入，IDE 运行中。
模拟器可正常渲染页面（当前显示登录页）。
可通过桌面自动化操作 GUI。

## 远程仓库

https://github.com/asunzhoua/EduERP-V4（公开）

## EOS 治理

EOS/ 目录包含完整治理体系：RULES、PROJECT_STATE、DECISION_LOG、EVIDENCE_LOG、MISSION_QUEUE、TEMPLATES。
已完成 4 个 EOS Mission（MultiAgent 验证、角色验证、Evidence 验证、WeChat Agent 隔离）。

## Phase 5 进度

P0 路由分裂修复 — 已完成
- 教师端 student-detail 合并（index.js 实现 → student-detail.js，清理硬编码 Mock）
- 学生端 class-detail 合并（index.js 实现 → class-detail.js，清理硬编码 Mock）
- 删除重复的 index.js 目录文件

P1 Mock 开关关闭 — 已完成
- courses.js / classes.js / students.js / lesson-record.js 的 ENABLE_MOCK 改为 false
- Mock 代码保留，切回 true 可恢复

P2 后端接口补全 — 已完成
- GET /students/self/contracts 新增返回 classCode 和 teacherName
- 通过 enrollment + teacher-assignment + user 四步查询链获取

P2 基础设施 — 已完成
- baseUrl 加 TODO 注释标注部署替换点
- checkLoginStatus 改用 request.js 统一封装

P3 未实现功能 — 待定（微信授权登录 / 创建课程 / 导航提示）
