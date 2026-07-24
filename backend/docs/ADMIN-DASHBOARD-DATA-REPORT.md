# 管理后台数据一致性报告

## 验证时间
2026-07-24

## 验证范围
- 学员数量
- 班级数量
- 课程数量
- 出勤统计
- 课时消耗

## 验证方法
- 静态代码审查（前端 dashboard.js + 后端 analytics.service.ts）
- API 链路追踪（前端 API 调用 → 后端 Controller → Service → Repository → DB 表）
- 数据源验证（确认每个指标来自哪个数据库表）

## 验证结果

### 1. 学员数量
- 显示位置: pages/operation/dashboard.js — 学员概览 Tab
- API: GET /analytics/institution → AnalyticsController.getInstitutionMetrics()
- 数据来源: Student 表 ✅
  - totalStudents = studentRepository.count({ where: { deleted: false } })
  - activeStudents = COUNT(DISTINCT enrollment.studentCode) WHERE status = ACTIVE (Enrollment 表)
- 前端处理: processMetrics() 正确映射 metric.name → data 字段 ✅
- activeRate: 前端计算 activeStudents/totalStudents*100 ✅（基于后端真实数据）
- 新增后更新: ✅ 每次 onLoad/onPullDownRefresh 直接查询 DB
- Status: ✅ PASS

### 2. 班级数量
- 显示位置: pages/operation/dashboard.js — 学员概览 Tab
- API: GET /analytics/institution → AnalyticsController.getInstitutionMetrics()
- 数据来源: Class 表 ✅
  - totalClasses = classRepository.count({ where: { deleted: false } })
- 前端处理: processMetrics() 正确映射 ✅
- 新增后更新: ✅ 每次加载直接查询 DB
- Status: ✅ PASS

### 3. 课程数量
- 显示位置: pages/operation/dashboard.js — 学员概览 Tab
- API: GET /analytics/institution → AnalyticsController.getInstitutionMetrics()
- 数据来源: Course 表 ✅
  - totalCourses = courseRepository.count({ where: { deleted: false } })
- 前端处理: processMetrics() 正确映射 ✅
- 新增后更新: ✅ 每次加载直接查询 DB
- Status: ✅ PASS

### 4. 出勤统计
- 显示位置: Dashboard 无出勤统计展示 ❌
- API: GET /analytics/institution 不返回出勤数据
- 数据来源: 不存在（机构级别）
- 签到后更新: N/A
- 备注: 出勤数据存在于 Student/Teacher 级别的 analytics 中（getStudentMetrics/getTeacherMetrics），但 getInstitutionMetrics 不包含出勤统计
- Status: ❌ GAP（功能缺失，非 Bug）

### 5. 课时消耗
- 显示位置: Dashboard 无课时消耗展示 ❌
- API: GET /analytics/institution 不返回课时消耗数据
- 数据来源: 不存在（机构级别）
- 签到后更新: N/A
- 备注: lessonTrend 存在于 getInstitutionTrend（每日课时数），但这是"课时数量趋势"而非"课时消耗统计"（如剩余课时/已消耗课时）
- Status: ❌ GAP（功能缺失，非 Bug）

## 趋势数据验证

### 招生趋势 (enrollmentTrend)
- API: GET /analytics/institution/trend
- 数据来源: Student 表（按 createTime 分组统计每日新学员数）✅
- 前端处理: processTrendData() 正确计算 heightPercent ✅
- Status: ✅ PASS

### 课时趋势 (lessonTrend)
- API: GET /analytics/institution/trend
- 数据来源: Lesson 表（按 scheduledDate 分组统计每日课时数）✅
- 前端处理: processTrendData() 正确计算 heightPercent ✅
- Status: ✅ PASS

## 前端数据完整性检查

### 无 Mock 数据 ✅
- dashboard.js 所有数据来自 get('/analytics/institution') 和 get('/analytics/institution/trend')
- 无硬编码数据、无 Math.random()、无模拟数据

### 错误处理 ✅
- API 失败时 catch(() => null) 设置默认值
- loading/error 状态正确管理
- 空状态 isEmpty 正确判断

### 权限控制 ✅
- 仅 Admin/SuperAdmin 可访问（前端 role 检查 + 后端 @Roles 装饰器）

## 发现的问题

### ISSUE-001: Dashboard 缺少机构级出勤统计
- Severity: P2
- Location: backend/src/modules/analytics/analytics.service.ts — getInstitutionMetrics()
- Impact: 管理员无法在 Dashboard 查看整体出勤情况
- Fix: 可在 getInstitutionMetrics 中新增 totalAttendance/attendanceRate 指标（查询 LessonAttendanceEntity 表）
- Decision: 暂不修复（任务要求"禁止增加新的统计体系"）

### ISSUE-002: Dashboard 缺少课时消耗统计
- Severity: P2
- Location: backend/src/modules/analytics/analytics.service.ts — getInstitutionMetrics()
- Impact: 管理员无法在 Dashboard 查看课时消耗情况
- Fix: 需要 Contract/Enrollment 课时余额数据 + 签到消耗计算
- Decision: 暂不修复（任务要求"禁止增加新的统计体系"）

## 修复记录
无修复（所有已存在的指标均正确，GAP 为功能缺失非 Bug）

## 数据链路总结

```
前端 Dashboard
  → GET /analytics/institution
    → AnalyticsController.getInstitutionMetrics()
      → studentRepository.count()          → Student 表 ✅
      → enrollmentRepository (COUNT DISTINCT) → Enrollment 表 ✅
      → courseRepository.count()           → Course 表 ✅
      → classRepository.count()            → Class 表 ✅
  → GET /analytics/institution/trend
    → AnalyticsController.getInstitutionTrend()
      → lessonRepository (GROUP BY date)   → Lesson 表 ✅
      → studentRepository (GROUP BY date)  → Student 表 ✅
```

## 结论
- Total Checks: 5
- Passed: 3（学员数量、班级数量、课程数量）
- Gap: 2（出勤统计、课时消耗 — 功能缺失，非 Bug）
- Fixed: 0
- 趋势数据: 2/2 PASS
- 前端数据完整性: ✅ 无 Mock、无硬编码、权限正确
- Status: ✅ 已存在的指标全部 PASS（数据来源正确、实时更新）
