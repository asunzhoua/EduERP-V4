# WeChat Mini Program Current Status Report

**Mission**: M-2026-07-26-WeChat-MiniProgram-Development-Resume
**Date**: 2026-07-22
**Type**: Status Baseline

---

## 1. Project Overview

| Item | Value |
|:-----|:------|
| 项目路径 | `C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4\miniapp` |
| 框架 | 微信原生小程序 |
| API 基础路径 | `http://localhost:3000/api/v1` |
| 页面数 | 10（已注册） |
| TabBar | 3（首页/课程/班级） |
| 后端状态 | NestJS 运行于 localhost:3000 |
| 后端全局前缀 | /api/v1 |

---

## 2. Page Inventory

### 2.1 已实现页面

| 页面 | 文件路径 | 功能 | 状态 |
|:-----|:---------|:-----|:-----|
| 登录 | pages/login/login.{js,wxml,wxss} | 用户名密码登录，角色路由 | ✅ 完成 |
| 首页 | pages/index/index.{js,wxml,wxss} | 角色识别 + 仪表盘（课次/待考勤/学生数） | ✅ 完成 |
| 课程列表 | pages/teacher/courses.{js,wxml,wxss} | 课程列表 + 搜索 + 分页 + 下拉刷新 | ✅ 完成 |
| 课程详情 | pages/teacher/course-detail.{js,wxml,wxss} | 课程信息展示 | ✅ 完成 |
| 班级列表 | pages/teacher/classes.{js,wxml,wxss} | 班级列表 + 进度 + 筛选 + 下拉刷新 | ✅ 完成 |
| 班级详情 | pages/teacher/class-detail.{js,wxml,wxss} | 信息/学生/课时 Tab 切换 | ✅ 完成 |
| 学生列表 | pages/teacher/students.{js,wxml,wxss} | 学生列表 + 搜索 | ✅ 完成 |
| 课时录入 | pages/teacher/lesson-record.{js,wxml,wxss} | 4 步流程：选班→选学生→输入课时→确认提交 | ✅ 完成 |
| 学生首页 | pages/student/index.{js,wxml,wxss} | 学生信息 + 合同 + 最近课时 | ✅ 完成 |
| 学生班级 | pages/student/classes.{js,wxml,wxss} | 已报名班级 + 进度 | ✅ 完成 |

### 2.2 缺失页面

| 页面 | 被引用位置 | 状态 |
|:-----|:-----------|:-----|
| pages/teacher/student-detail | pages/teacher/students.js → goToStudentDetail | ❌ 不存在 |

### 2.3 空目录

| 目录 | 说明 |
|:-----|:------|
| pages/teacher/lesson-record/ | 计划存放分拆组件，当前为空 |
| pages/teacher/students/ | 计划存放分拆组件，当前为空 |

---

## 3. Key Technical Details

### 3.1 请求封装 (utils/request.js)
- 统一 Token 注入（从 app.globalData / Storage 读取）
- 响应格式校验：`res.data.code === 0` 视为成功
- Token 过期（code 2002）自动跳转登录
- 封装 GET/POST/PUT/DELETE
- 所有页面通过 `const { get, post } = require('../../utils/request')` 引用

### 3.2 登录流程
- POST /auth/login → 获取 accessToken + user
- 按 role 路由：Teacher → /teacher/courses, Student/Parent → /student/index
- 启动时自动检查 token 有效性（GET /auth/me）
- 微信授权登录标记为"待实现"

### 3.3 课时录入流程
- Step 1: GET /classes?status=ACTIVE 选班
- Step 2: GET /classes/:code/students 选学生
- Step 3: 输入日期/时间/主题
- Step 4: POST /lessons 确认提交
- 含考勤状态切换（PRESENT/LATE/ABSENT）及原因填写
- 每一层都有 mock 降级

### 3.4 家长端
- GET /students/self — 个人信息
- GET /students/self/contracts — 合同列表
- GET /students/self/lessons — 课时记录
- 学生班级列表从 contracts 派生（计算剩余课时/进度）

### 3.5 仪表盘
- GET /teacher/dashboard — 今日课次/待考勤/学生总数
- 加载失败时使用默认值（0）

---

## 4. API 依赖清单

| 路径 | 方法 | 调用方 | 后端状态 |
|:-----|:-----|:-------|:---------|
| /auth/login | POST | login.js | ✅ 存在 |
| /auth/me | GET | app.js | ✅ 存在 |
| /courses | GET | courses.js | ✅ 存在 |
| /courses/:code | GET | course-detail.js | ✅ 存在 |
| /classes | GET | classes.js, lesson-record.js | ✅ 存在 |
| /classes/:code | GET | class-detail.js | ✅ 存在 |
| /classes/:code/students | GET | lesson-record.js | ✅ 存在 |
| /students | GET | students.js | ✅ 存在 |
| /lessons | POST | lesson-record.js | ✅ 存在 |
| /students/self | GET | student/index.js | ✅ 存在 |
| /students/self/contracts | GET | student/index.js, student/classes.js | ✅ 存在 |
| /students/self/lessons | GET | student/index.js | ✅ 存在 |
| /teacher/dashboard | GET | index.js | ❓ 未确认 |

---

## 5. 已知问题

| ID | 问题 | 影响 | Evidence |
|:---|:-----|:-----|:---------|
| MP-001 | student-detail 页面不存在（students.js 引用了但未创建） | 点击学生条目会白屏 | 文件不存 |
| MP-002 | sitemap.json 不存在（app.json 引用了） | 微信搜索收录异常，不阻塞运行 | 文件不存 |
| MP-003 | /teacher/dashboard API 端点未确认是否存在 | 首页仪表盘可能报错 | 未验证 |
| MP-004 | 所有页面含 mock 数据降级方案 | 生产前需清理 | 代码审查 |
| MP-005 | TabBar 只含教师端页面 | 家长端无法通过 TabBar 导航 | app.json 配置 |

---

## 6. 下一开发任务建议

按优先级排列（基于当前事实，不作推测）：

1. **[P1] 创建 student-detail 页面** — 修复 students.js 导航白屏
2. **[P1] 验证 /teacher/dashboard API** — 确认仪表盘可工作
3. **[P2] 创建 sitemap.json** — 修复 app.json 引用缺失
4. **[P2] 清除 mock 降级数据** — 生产前清理
5. **[P3] 家长端 TabBar 入口** — 如果家长端需要独立导航

---

## 7. 编译状态

编译状态需在微信开发者工具中确认（当前未连接 DevTools CLI 进行编译测试）。
