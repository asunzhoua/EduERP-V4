# MINIAPP-DATA-MIGRATION-PLAN

> 基于 Research Agent 扫描报告 (28 Findings) + Review Agent 审计 (4 RFs)
> 生成：2026-07-22 | Orchestrator: ACCEPT WITH CORRECTIONS
> Review 结论：28/28 Findings PASS Evidence Audit, RF-001~004 已纳入计划

---

## 优先级规则

P0 — 阻塞：页面空白、路由不可达、用户看见假数据
P1 — 主要：当前启用 Mock 的页面，关闭 Mock 前确认后端就绪
P2 — 正常：数据链路缺失、字段不完整
P3 — 低优：功能未实现、基础设施改进

---

## P0: 修复路由分裂（合并文件）

### T-001 教师端 student-detail 合并

参考 Finding: F-015/F-016
Review 修正: RF-001（index.js 中也有硬编码 Mock，合并时需清理）

现状：
- app.json 注册 "pages/teacher/student-detail" → 加载空壳 student-detail.js
- 完整实现在 student-detail/index.js 中 → 路由不可达

处理方案：
- 将 index.js 的业务逻辑、API 调用合并到 student-detail.js
- 删除 student-detail/index.js 中的硬编码 Mock（catch 块里的虚假数据）
- 改为空值默认策略（catch 块设空数组/空对象，不塞假数据）
- 删除 student-detail/index.js.bak
- 删除 student-detail/index.js / .json / .wxml / .wxss

涉及文件：
- miniapp/pages/teacher/student-detail.js（空壳 → 填入实现）
- miniapp/pages/teacher/student-detail/index.js（删除）
- miniapp/pages/teacher/student-detail/index.json（删除）
- miniapp/pages/teacher/student-detail/index.wxml（删除）
- miniapp/pages/teacher/student-detail/index.wxss（删除）
- miniapp/pages/teacher/student-detail/index.js.bak（删除）

工作量：小

---

### T-002 学生端 class-detail 合并

参考 Finding: F-023/F-024
Review 修正: RF-001

现状：同 T-001 模式，完整实现在 index.js 中不可达

处理方案：同上
- 将 index.js 实现合并到 class-detail.js
- 清理 catch 块中的硬编码 Mock
- 删除 index.js 目录

涉及文件：
- miniapp/pages/student/class-detail.js（空壳 → 填入实现）
- miniapp/pages/student/class-detail/index.js（删除）
- miniapp/pages/student/class-detail/index.json（删除）
- miniapp/pages/student/class-detail/index.wxml（删除）
- miniapp/pages/student/class-detail/index.wxss（删除）

工作量：小

---

## P1: 关闭 Mock 开关

### T-003 courses.js — ENABLE_MOCK = false

参考 Finding: F-005

操作：
- 将 ENABLE_MOCK 改为 false
- 保留 Mock 代码不改，方便开发调试
- 确认后端 GET /courses 可正常返回数据（需用 curl 验证）

涉及文件：
- miniapp/pages/teacher/courses.js

工作量：极小

---

### T-004 classes.js — ENABLE_MOCK = false

参考 Finding: F-011

操作：同上

涉及文件：
- miniapp/pages/teacher/classes.js

工作量：极小

---

### T-005 students.js — ENABLE_MOCK = false

参考 Finding: F-014

操作：同上

涉及文件：
- miniapp/pages/teacher/students.js

工作量：极小

---

### T-006 lesson-record.js — ENABLE_MOCK = false

参考 Finding: F-017

操作：同上（注意有 2 处 Mock 降级路径）

涉及文件：
- miniapp/pages/teacher/lesson-record.js

工作量：极小

---

## P2: 数据链路修复

### T-007 学生端 contract 补充 classCode 和 teacherName

参考 Finding: F-020/F-021
Review 修正: RF-002（不是"加字段"，而是需要 JOIN 查询）

现状：
- GET /students/self/contracts 只查 contract 表，不返回 classCode 和 teacherName
- Contract 实体本身没有 classCode 列
- 需要 enrollments 表 JOIN 获取 classCode
- teacherName 需要从 teacher-assignment JOIN 获取

处理方案：
- 修改后端 student.controller.ts 中 getSelfContracts 方法
- 通过 studentCode 查 enrollment 表获取 classCode
- 通过 teacher-assignment 表获取 teacherName
- 返回包含 classCode 和 teacherName 的增强数据结构

涉及文件：
- backend/src/modules/student/services/（需确认具体文件名）
- 可能涉及 enrollment.service

工作量：中

---

### T-008 baseUrl 改为可配置

参考 Finding: F-025

现状：app.js 中 baseUrl 硬编码 localhost:3000

处理方案：
- 改为从 wx.getAccountInfoSync() 环境判断，或使用全局变量
- 考虑到小程序上线需要配置合法域名，先保留但加注释标注

涉及文件：
- miniapp/app.js

工作量：极小

---

### T-009 checkLoginStatus 统一 request 封装

参考 Finding: F-026

现状：checkLoginStatus 直接使用 wx.request

处理方案：
- 改为调用 get('/auth/me')

涉及文件：
- miniapp/app.js

工作量：极小

---

## P3: 未实现功能（非迁移任务）

### T-010 微信授权登录

参考 Finding: F-001
Review 修正: RF-004（标为独立功能，非迁移任务）

现状：onWechatLogin 仅 Toast

处理方案：**不在此 Mission 中处理**，标记为独立功能需求

---

### T-011 创建课程

参考 Finding: F-006

现状：仅 Toast "功能开发中"

处理方案：**不在此 Mission 中处理**，标记为独立功能需求

---

### T-012 导航失败提示

参考 Finding: F-008/F-012
Review 修正: RF-003（后端 API 已存在，可能是路由问题）

现状：导航 fail 回调显示 "详情页开发中"

处理方案：**先保留提示文案**，等 P0/P1 修复后在真实环境中测试导航是否可用

---

## 执行顺序

- Step 1: T-001 + T-002（合并文件，同时清理夹带 Mock）
- Step 2: T-003 ~ T-006（关 Mock 开关）
- Step 3: T-007（后端缺字段修复）
- Step 4: T-008 + T-009（基础设施）

T-010 ~ T-012 不在此 Mission 中执行。

## 验证方式

每个 Step 执行后：
- 检查 app.json 路由注册无误
- 检查修改后的文件语法正确
- P0/P1 修复完成后，通过桌面自动化在 DevTools 中刷新确认页面可加载
