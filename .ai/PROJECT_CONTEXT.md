# EduERP-V4 项目背景

## 一句话

EduERP-V4 是一个教育培训机构管理系统，老师用来记录课时和考勤，学生用来查课表和课时记录。

## 技术栈

后端：NestJS v11 / TypeScript 5.x / MySQL 8
前端：微信小程序（WXML + WXSS + JS）
测试：Jest + Supertest

## 架构风格

backend/src/ 按 DDD 分层：
- kernel/ — 通用基础设施、事件总线、BaseEntity
- modules/ — 业务模块
  - identity/ — 用户认证、角色管理
  - teaching/ — 课程、班级、课时、考勤、合同（核心业务）
  - student/ — 学生自服务
- shared/ — 公共 DTO、中间件
- config/ — 全局配置
- database/ — 迁移和种子数据

## 微信小程序页面

miniapp/pages/ 共 12 个页面：
- login/ — 登录（用户名密码 + 微信授权入口）
- index/ — 首页仪表盘

教师端：
- teacher/courses/ — 课程列表
- teacher/course-detail/ — 课程详情
- teacher/classes/ — 班级列表
- teacher/class-detail/ — 班级详情含学生列表
- teacher/students/ — 学生搜索列表
- teacher/student-detail/ — 学生详情含班级和课时记录
- teacher/lesson-record/ — 课时录入 4 步向导（选班→选学生→输入课时→确认提交）

家长端：
- student/index/ — 首页（课表、合同）
- student/classes/ — 我的班级
- student/class-detail/ — 班级详情

## 核心业务规则

### 课时考勤
每次课时录入记录：班级、日期、时间段、课题、每个学生的考勤状态。三种状态：PRESENT（到课）/ LATE（迟到）/ ABSENT（缺课）。迟到和缺课可以记录原因，教师通过弹出窗口输入。默认所有学生为 PRESENT，教师手动切换。后端 POST /lessons 一次性提交课时信息加全班考勤数据。

### 课时生命周期
课时状态机：PENDING -> IN_PROGRESS -> COMPLETED -> CONFIRMED。教师只能操作自己班级的课时。课时变更需要审批流程。

### 合同与报读
一个学生可报名多个班级（Enrollment 表）。合同（Contract）记录学生购买的课时总数和已消耗课时。

### 角色与权限
四种角色：SuperAdmin / Admin / Teacher / Student。JWT 认证，Token 有效期 2 小时，支持 refresh token。教师端和家长端根据角色跳转不同首页。

## 关键 API 端点

所有端点前缀 /api/v1，响应格式 { code: 0, message: "success", data: ... }

认证模块：
- POST /auth/login — 登录（公开）
- POST /auth/refresh — 刷新 Token（公开）
- GET /auth/me — 当前用户信息（JWT）

课程：
- GET /courses — 列表（Teacher+，分页）
- GET /courses/:code — 详情（Teacher+）
- POST /courses — 创建（Admin+）
- PUT /courses/:code — 更新（Admin+）

班级：
- GET /classes — 列表（Teacher+，分页筛选）
- GET /classes/:code — 详情（Teacher+）
- GET /classes/:code/students — 班级学生（Teacher+）

课时：
- POST /lessons — 创建含考勤（Teacher）
- GET /classes/:code/lessons — 班级课时（Teacher+）
- PATCH /classes/:code/lessons/:number/start — 开始上课（Teacher）
- PATCH /classes/:code/lessons/:number/complete — 完成上课（Teacher）

教师仪表盘：
- GET /teacher/dashboard — 首页数据（Teacher）

学生自服务：
- GET /students/self — 当前学生信息（Student）
- GET /students/self/contracts — 合同列表（Student）
- GET /students/self/lessons — 课时记录（Student）
- GET /students?keyword= — 搜索（Teacher+）
