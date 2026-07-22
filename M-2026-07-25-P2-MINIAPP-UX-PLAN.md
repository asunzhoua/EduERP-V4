# Mission: M-2026-07-25-P2-MINIAPP-UX-PLAN

## Mission Type

Planning / Review

## Objective

规划 Priority 2：小程序用户体验改善。基于 Research 事实（18/18 API 全部匹配，零路由 Gap），确认 P2 方向为前端体验优化而非 API 补全。

## Status

WAITING REVIEW

---

## Research 结论

经 Research Agent 审计 9 个目标页面 + 2 个外围页面，共 18 个 API 调用路径：

**全部匹配。零 Reality Gap。**

前端调用的所有 GET/POST/PATCH 路径在后端 Controller 中都有对应的 @Get/@Post/@Patch 装饰器。HTTP 方法完全一致。

详情见 Research Agent Report（F-001~F-012）。

---

## 页面结构校正（基于实际目录扫描）

| 角色 | 页面 | 实际路径 | API 调用 |
|------|------|----------|----------|
| 共用 | 首页 | pages/index/index | GET /teacher/dashboard |
| 登录 | 登录页 | pages/login/login | POST /auth/login |
| 教师 | 课程列表 | pages/teacher/courses | GET /courses |
| 教师 | 课程详情 | pages/teacher/course-detail | GET /courses/:code |
| 教师 | 班级列表 | pages/teacher/classes | GET /classes |
| 教师 | 班级详情 | pages/teacher/class-detail | GET /classes/:code, GET /classes/:code/students |
| 教师 | 学生列表 | pages/teacher/students | GET /classes/:code/students, GET /students |
| 教师 | 学生详情 | pages/teacher/student-detail | GET /students, GET /enrollments/students/:code/enrollments |
| 教师 | 课时录入 | pages/teacher/lesson-record | GET /classes, GET /classes/:code/students, POST /lessons |
| 学生 | 首页 | pages/student/index | GET /students/self, GET /students/self/contracts, GET /students/self/lessons |
| 学生 | 我的班级 | pages/student/classes | GET /students/self/contracts |
| 学生 | 班级详情 | pages/student/class-detail | GET /classes/:code |

---

## 发现的问题

### 问题 1：教师端首页不是 teacher/index.js，是 index/index.js

当前教师打开小程序后看到的是 index/index.js，它通过角色判断决定展示内容。如果未登录，直接跳转到 login 页。这个页面使用 GET /teacher/dashboard 获取仪表盘数据。路径已确认存在：teacher-dashboard/teacher-dashboard.controller.ts。

影响：无功能风险。但页面路径与预期不一致，开发时容易混淆。

### 问题 2：学生端首页 GET /students/self/lessons 使用情况

student/index.js 调用了 GET /students/self/lessons 获取最近课时。需要确认该接口在后端的实现是否完整返回学生关联的课时数据（通过 enrollment → class → lesson 链）。

影响：若返回数据格式不对，学生首页课时列表为空。

### 问题 3：部分查询 DTO 的过滤字段未验证

前端在调 GET /classes 时传了 { status: 'ACTIVE' }，但 QueryClassDto 中 status 字段的定义方式未审计。如果 DTO 用 whitelist: true 但未声明 status 字段，请求参数会被 class-validator 静默丢弃。

同样的问题适用于 GET /courses 的 page/pageSize 参数。

影响：低。class-validator 的 whitelist 模式会丢弃未声明字段，可能导致查询返回所有状态的数据而非过滤后的。如果实际使用中发现过滤不生效，优先检查 DTO。

### 问题 4：前端缺乏统一错误处理

从 request.js 看，统一的响应拦截逻辑是检查 code === 0。但页面级别的错误处理各异——有的页面做了 try-catch 并展示错误信息，有的直接静默失败。需要逐个页面审核。

### 问题 5：前端缺乏加载状态

多数页面没有 loading 状态（wx.showLoading / wx.showToast），用户在数据返回前看到的是空白页。

---

## 真实 UX 改进方向（按优先级）

根据 Research 事实，P2 的核心方向不是补 API（因为不缺），而是：

### Batch 1 — 页面数据展示完善（P0）

验证学生端首页的 GET /students/self/lessons 返回格式，确保最近课时数据能正确展示。

### Batch 2 — 空状态和加载状态（P1）

- 每个列表页添加 loading 状态
- 数据为空时显示友好提示（"暂无课程"、"暂无班级"等）
- 网络错误时显示重试按钮

### Batch 3 — 错误反馈（P1）

- 课时提交成功后显示成功提示
- 操作失败时显示错误原因
- 表单校验前端的即时反馈

### Batch 4 — Mock 和临时代码清理（P2）

- 检查是否有残留的 ENABLE_MOCK
- 清理 TODO 注释和临时代码

---

## 执行要求

此 Mission 仅用于规划，禁止：
- 修改代码
- 派 CC 执行
- 扩展需求
- 创建新页面

完成 Plan Review 后，等 Owner 确认 Batch 优先级和执行顺序后再进入执行阶段。
