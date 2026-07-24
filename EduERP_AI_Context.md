# EduERP-V4 项目上下文

> 生成日期：2026-07-22
> 用途：给 AI（如 GPT/Claude）快速理解项目全貌

---

## 一、项目概要

EduERP-V4 是一个教育培训机构管理系统，采用 NestJS + TypeScript + MySQL 技术栈，按 DDD（领域驱动设计）架构组织。

技术栈：
- 后端：NestJS v11 / TypeScript 5.x / MySQL 8
- 前端：微信小程序（WXML + WXSS + JS）
- 测试：Jest + Supertest，75 suites / 935 tests ALL PASS
- 构建：27 个 TS 编译错误（isolatedModules 问题），不阻塞开发与测试
- 远程：https://github.com/asunzhoua/EduERP-V4（公开仓库）

架构风格：
backend/src/ 下分为 kernel/（通用基础设施、事件总线、BaseEntity），modules/（业务模块，DDD 组织），shared/（公共 DTO、中间件），config/（全局配置），database/（迁移+种子数据），events/（事件定义和注册）。

modules/ 包含三个子模块：
- identity/ — 用户认证、角色管理
- teaching/ — 课程、班级、课时、考勤、合同（核心业务）
- student/ — 学生自服务（课表、合同、课时记录）

---

微信小程序结构：
miniapp/pages/ 包含登录页（login/）、首页仪表盘（index/）、教师端 7 个页面、家长端 3 个页面。

教师端页面：
- courses/ — 课程列表
- course-detail/ — 课程详情
- classes/ — 班级列表
- class-detail/ — 班级详情（含学生列表）
- students/ — 学生搜索列表
- student-detail/ — 学生详情（含班级、课时记录）
- lesson-record/ — 课时录入 4 步向导（选班→选学生→输入课时→确认提交）

家长端页面：
- index/ — 学生首页（课表、合同）
- classes/ — 我的班级
- class-detail/ — 班级详情

---

## 二、核心业务规则

### 课时考勤
每次课时录入必须记录：班级、日期、时间段、课题、每个学生的考勤状态。考勤状态分三种：PRESENT（到课）、LATE（迟到）、ABSENT（缺课）。迟到和缺课可以记录原因，教师通过弹出窗口输入。默认所有学生为 PRESENT，教师手动切换状态。后端 POST /lessons 一次性提交课时信息加全班考勤数据。

课时状态机：PENDING -> IN_PROGRESS -> COMPLETED -> CONFIRMED。教师只能操作自己班级的课时。课时变更需要审批流程（LessonChangeRequest）。

### 合同与报读
一个学生可以报名多个班级，记录在 Enrollment 表中。合同（Contract）记录学生购买的课时总数、已消耗课时。

### 角色与权限
4 种角色：SuperAdmin / Admin / Teacher / Student。JWT 认证，Token 有效期 2 小时，支持 refresh token。教师端与家长端路由根据角色跳转。

---

## 三、关键 API 端点

所有端点前缀 /api/v1，响应格式 { code: 0, message: "success", data: ... }。

### 认证（identity/auth）
POST /auth/login — 用户名密码登录（公开）
POST /auth/refresh — 刷新 Token（公开）
GET /auth/me — 获取当前用户信息（需 JWT）

### 课程（teaching/course）
GET /courses — 课程列表，支持分页和筛选（Teacher+）
GET /courses/:code — 课程详情（Teacher+）
POST /courses — 创建课程（Admin+）
PUT /courses/:code — 更新课程（Admin+）

### 班级（teaching/class）
GET /classes — 班级列表，支持分页和筛选（Teacher+）
GET /classes/:code — 班级详情（Teacher+）
GET /classes/:code/students — 班级学生列表（Teacher+）

### 课时（teaching/lesson）
POST /lessons — 创建课时含全班考勤（Teacher）
GET /classes/:code/lessons — 查询班级课时列表（Teacher+）
PATCH /classes/:code/lessons/:number/start — 开始上课（Teacher）
PATCH /classes/:code/lessons/:number/complete — 完成上课（Teacher）

### 教师仪表盘
GET /teacher/dashboard — 教师首页数据：今日课时、待考勤人数（Teacher）

### 学生自服务（student）
GET /students/self — 当前学生信息（Student）
GET /students/self/contracts — 我的合同列表（Student）
GET /students/self/lessons — 我的课时记录（Student）
GET /students?keyword= — 学生搜索（Teacher+）

---

## 四、Phase 进度

Phase 1 基础搭建 — 已完成（后端模块、DB、测试框架）
Phase 2 页面结构 — 已完成（小程序全部页面配置、TabBar、编译通过）
Phase 3 编译与入口闭环 — 已完成（登录路由、资源补齐、Mock开关、WXML编译修复）
Phase 4 业务流程闭环 — 已完成（后端 API 与前端页面调用链全部对齐，12条链路已确认）
Phase 5 真实数据与清理 — 待开始（关闭 Mock、清理占位逻辑、真实数据联调）

---

## 五、EOS 治理体系

项目根目录有 EOS/ 目录，包含完整的治理体系。
- RULES.md — EOS 运行核心规则
- PROJECT_STATE.md — 当前项目状态快照
- DECISION_LOG.md — 架构决策记录
- EVIDENCE_LOG.md — 证据链索引
- MISSION_QUEUE.md — 任务队列
- TEMPLATES/ — Mission/Report/CC-Task 模板
- missions/ — 已完成 Mission 记录（含 final-report + evidence）

已完成的 EOS Mission：
- 2026-07-23：Multi-Agent 基础链路验证
- 2026-07-24：Agent 角色有效性验证
- 2026-07-25：Evidence Governance 规则验证
- 2026-07-26：WeChat Agent 上下文隔离迁移

---

## 六、安全现状

JWT 密钥 — 已加固（64字节随机 hex）
.gitignore — 已配置（排除 .env、node_modules、dist 等）
DB 密码 — hardcode root/sun123456，待修复
管理员密码 — hardcode admin123，待修复
API Key 泄露 — 已在文档中替换为占位符

---

## 七、运行方式

后端启动：cd backend，npm install，npm run seed（填充种子数据），npm run start:dev（localhost:3000）。

小程序预览：用微信开发者工具打开 miniapp/ 目录，appID 需要替换为真实小程序 AppID。

种子账号：管理员 admin / admin123（SuperAdmin），教师和学生账号在 seed.service.ts 中定义。

测试：cd backend，npm test，75 suites / 935 tests ALL PASS。包括 identity/auth 58 tests、teaching 多模块覆盖（课程、班级、课时、考勤、合同），单元测试 + E2E 集成测试。

---

## 八、目录结构速览（仅关键路径）

EduERP-V4/
  backend/
    src/
      kernel/ — DDD 内核（事件、实体基类）
      modules/
        identity/ — 认证模块
        teaching/ — 核心业务（课程/班级/课时/考勤/合同）
        student/ — 学生自服务
      config/ — 全局配置
      database/ — 迁移+种子
    docs/ — 技术文档（EOS 设计、飞书集成）
    tools/ — 工具脚本
  miniapp/
    pages/ — 12 个页面
    utils/ — 请求封装、工具函数
    images/ — TabBar 图标等资源
  docs/ — 业务规则、架构文档
  EOS/ — 治理体系
  ACCOUNT_ADAPTER_DESIGN.md — AI 账号适配设计
  AI_GATEWAY_MVP_REPORT.md — AI Gateway 部署报告
  SERVER_ACCESS_AUDIT.md — 服务器安全审计
  EduERP_AI_Context.md — 本文件

---

*此文件由 EOS Orchestrator（龙虾）生成，旨在让 AI 阅读者快速建立项目上下文。*
