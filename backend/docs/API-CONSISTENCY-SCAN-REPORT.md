# API Consistency Scan Report
# Batch 1.1 — 小程序前端API调用 vs 后端Controller定义

**扫描时间**: 2026-07-25
**扫描范围**: miniapp/pages/ (15个JS文件) + backend/src/modules/ (13个Controller)
**全局前缀**: `api/v1` (main.ts setGlobalPrefix)
**前端 baseUrl**: `http://localhost:3000/api/v1` (config.js)

---

## 扫描范围

### 前端文件列表 (15个)
```
miniapp/utils/request.js              (请求封装)
miniapp/pages/login/login.js           (登录)
miniapp/pages/index/index.js           (首页/仪表盘)
miniapp/pages/operation/dashboard.js   (运营仪表盘)
miniapp/pages/student/index.js         (学生首页)
miniapp/pages/student/classes.js       (我的班级)
miniapp/pages/student/class-detail.js  (班级详情)
miniapp/pages/student/lessons.js       (课时记录)
miniapp/pages/student/attendance.js    (出勤记录)
miniapp/pages/teacher/classes.js       (班级列表)
miniapp/pages/teacher/class-detail.js  (班级详情)
miniapp/pages/teacher/courses.js       (课程列表)
miniapp/pages/teacher/course-detail.js (课程详情)
miniapp/pages/teacher/students.js      (学生列表)
miniapp/pages/teacher/student-detail.js(学生详情)
miniapp/pages/teacher/lesson-record.js (课时录入)
```

### 后端Controller列表 (13个)
```
identity/auth/auth.controller.ts               → @Controller('auth')
teaching/teacher-dashboard/teacher-dashboard.controller.ts → @Controller('teacher')
teaching/class/class.controller.ts             → @Controller('classes')
teaching/course/course.controller.ts           → @Controller('courses')
teaching/lesson/lesson.controller.ts           → @Controller() (无前缀)
teaching/lesson-attendance/lesson-attendance.controller.ts → @Controller() (无前缀)
teaching/lesson-change-request/lesson-change-request.controller.ts → @Controller() (无前缀)
teaching/enrollment/enrollment.controller.ts   → @Controller('enrollments')
teaching/contract/contract.controller.ts       → @Controller('contracts')
teaching/teacher-assignment/teacher-assignment.controller.ts → @Controller('teacher-assignments')
student/student.controller.ts                  → @Controller('students')
analytics/analytics.controller.ts              → @Controller('analytics')
reminder/reminder.controller.ts                → @Controller('api/v1/reminders')
```

---

## 前端API调用清单 vs 后端路由匹配

### 登录模块
```
前端调用                              → 后端路由                              → 匹配
POST /auth/login                      → POST /api/v1/auth/login              → ✅
GET  /auth/me                         → GET  /api/v1/auth/me                 → ✅
```

### 教师仪表盘
```
GET  /teacher/dashboard               → GET  /api/v1/teacher/dashboard       → ✅
GET  /classes (pageSize:1)            → GET  /api/v1/classes                 → ✅
```

### 学生自服务
```
GET  /students/self                   → GET  /api/v1/students/self           → ✅
GET  /students/self/contracts         → GET  /api/v1/students/self/contracts → ✅
GET  /students/self/lessons           → GET  /api/v1/students/self/lessons   → ✅
GET  /students/self/attendance        → GET  /api/v1/students/self/attendance→ ✅
```

### 班级管理
```
GET  /classes                         → GET  /api/v1/classes                 → ✅
GET  /classes/:code                   → GET  /api/v1/classes/:code           → ✅
GET  /classes/:code/students          → GET  /api/v1/classes/:code/students  → ✅
GET  /classes/:code/lessons           → GET  /api/v1/classes/:code/lessons   → ✅
```

### 课程管理
```
GET  /courses                         → GET  /api/v1/courses                 → ✅
GET  /courses/:code                   → GET  /api/v1/courses/:code           → ✅
```

### 课时录入
```
POST /lessons                         → POST /api/v1/lessons                 → ✅
```

### 学生管理
```
GET  /students (studentCode)          → GET  /api/v1/students                → ✅
```

### 注册/选课
```
GET  /enrollments/students/:code/enrollments → GET /api/v1/enrollments/students/:studentCode/enrollments → ✅
```

### 运营分析
```
GET  /analytics/institution           → GET  /api/v1/analytics/institution   → ✅ (修复后)
GET  /analytics/institution/trend     → GET  /api/v1/analytics/institution/trend → ✅ (修复后)
```

---

## 发现的问题

### P0 — 路径不匹配 (404)

**ISSUE-001: operation/dashboard.js API路径双重前缀**
- 文件: `miniapp/pages/operation/dashboard.js`
- 行号: 68-69, 117
- 问题: 前端调用 `get('/api/v1/analytics/institution')` 和 `get('/api/v1/analytics/institution/trend')`
- 原因: `baseUrl` 已包含 `/api/v1`，实际请求变为 `/api/v1/api/v1/analytics/...` → 404
- 影响: 运营仪表盘页面完全无法加载数据
- 状态: ✅ 已修复 — 移除 `/api/v1` 前缀，改为 `/analytics/institution` 和 `/analytics/institution/trend`

### P1 — 参数不匹配 (数据丢失)
无

### P2 — 返回结构不匹配 (前端解析错误)
无

### P3 — 方法不匹配 (405)
无

---

## 响应结构验证

### request.js 响应处理逻辑
```
后端: ApiResponse.success(data) → { code: 0, message: 'ok', data: <payload> }
前端: resolve(res.data.data) → 前端拿到 <payload>
```

### 各接口响应结构匹配
```
接口                          → 后端返回payload          → 前端期望              → 匹配
/auth/login                   → {accessToken,user,...}   → data.accessToken      → ✅
/teacher/dashboard            → {todayLessons,...}       → data.todayLessons     → ✅
/classes                      → {items,total}            → data.items            → ✅
/classes/:code                → enriched class object    → classInfo             → ✅
/classes/:code/students       → student[]                → Array.isArray(data)   → ✅
/classes/:code/lessons        → LessonEntity[]           → Array.isArray(data)   → ✅
/courses                      → {items,total}            → data.items            → ✅
/courses/:code                → enriched course object   → course                → ✅
/students/self/contracts      → contract[]               → Array.isArray(c)      → ✅
/students/self/lessons        → lesson[]                 → Array.isArray(data)   → ✅
/students/self/attendance     → attendance[]             → Array.isArray(res)    → ✅
/students                     → {items,total}            → data.items            → ✅
/enrollments/students/:code   → enrollment[]             → enrollments || []     → ✅
/analytics/institution        → {metrics:MetricItem[]}   → metricsRes.metrics    → ✅
/analytics/institution/trend  → {lessonTrend,enrollmentTrend} → trendRes         → ✅
POST /lessons                 → {lesson,lessonNumber,...}→ result                → ✅
```

---

## 总结

- 扫描前端API调用: 24个
- 扫描后端路由: 60+个
- 匹配: 23/24 (95.8%)
- 不匹配: 1个 (P0)
- P0 已修复: 1个
- P1-P3: 0个

### 修复内容
1. `miniapp/pages/operation/dashboard.js` — 3处 `/api/v1/` 前缀移除

### 未修复（无需修复）
- 所有其他前端API调用与后端路由完全一致
- 响应结构全部匹配
- 参数传递全部匹配
