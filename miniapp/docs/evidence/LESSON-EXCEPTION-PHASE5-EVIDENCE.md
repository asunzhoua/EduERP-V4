# Phase 5 Evidence

## 新增文件列表
- utils/lesson-exception-api.js
- pages/student/leave-apply/*
- pages/student/leave-records/*
- pages/student/exception-detail/*
- pages/teacher/my-exceptions/*
- pages/teacher/leave-apply/*
- pages/operation/exception-list/*
- pages/operation/exception-approve/*
- pages/operation/reschedule-view/*

## 修改文件列表
- app.json
- pages/student/index.wxml
- pages/student/index.wxss
- pages/student/index.js
- pages/teacher/profile.wxml
- pages/teacher/profile.js
- pages/operation/dashboard.wxml
- pages/operation/dashboard.wxss
- pages/operation/dashboard.js

## Git Commit
- Hash: f6c498c6aa4e8abc80d1502afe4aab8f7c6841a3
- Message: feat: implement lesson exception frontend pages

## API 调用列表
- POST /lessons/:id/leave - 申请请假
- POST /lessons/suspend - 申请停课
- POST /lessons/:id/makeup - 申请补课
- PUT /lesson-exceptions/:id/approve - 审批通过
- PUT /lesson-exceptions/:id/reject - 审批拒绝
- GET /lesson-exceptions - 查询异常列表
- GET /lesson-exceptions/:id - 查询异常详情
- GET /lesson-exceptions/:id/reschedule - 查询补课安排

## 页面验证
- 家长端请假申请：✅
- 家长端申请记录：✅
- 家长端异常详情：✅
- 教师端我的异常：✅
- 教师端请假申请：✅
- 管理端异常列表：✅
- 管理端审批页面：✅
- 管理端补课查看：✅

## 权限验证
- 家长只能查看自己的孩子：✅
- 教师只能查看自己的课程：✅
- 管理员可以查看全部：✅
- 教师不能审批：✅
