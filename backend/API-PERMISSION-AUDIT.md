# API 权限审计报告

## 审计信息
- 审计日期: 2026-07-25
- 审计范围: EduERP-V4 backend 全部 Controller + Service
- 审计方法: 逐文件扫描 @Roles 声明 + Service 层数据过滤逻辑

---

## 审计结果概览

总 Controller 数: 13
已审计 Endpoint: 72
Gaps 发现: 6

---

## 一、Controller 层 @Roles 审计

### 1. ClassController ✅
路径: src/modules/teaching/class/class.controller.ts
- @UseGuards(JwtAuthGuard, RolesGuard) — 全局生效
- CREATE → SuperAdmin, Admin
- LIST → SuperAdmin, Admin, Teacher
- GET by code → SuperAdmin, Admin, Teacher, Student, Parent
- UPDATE → SuperAdmin, Admin
- STATUS CHANGE → SuperAdmin, Admin
- DELETE → SuperAdmin
- Teacher assign → SuperAdmin, Admin
- 结论: 角色控制完整

### 2. StudentController ✅
路径: src/modules/student/student.controller.ts
- CREATE → SuperAdmin, Admin
- self/* → Student, Parent（含 userId 归属校验）
- LIST → SuperAdmin, Admin, Teacher
- GET by id → SuperAdmin, Admin, Teacher
- UPDATE → SuperAdmin, Admin
- STATUS → SuperAdmin, Admin
- DELETE → SuperAdmin
- Parent relation → SuperAdmin, Admin
- IMPORT → SuperAdmin, Admin
- 结论: 角色控制完整，self 端点有 userId 绑定

### 3. ContractController ✅
路径: src/modules/teaching/contract/contract.controller.ts
- CREATE → SuperAdmin, Admin
- LIST → SuperAdmin, Admin, Teacher
- GET by studentCode → SuperAdmin, Admin, Teacher, Student, Parent
- FREEZE/UNFREEZE → SuperAdmin, Admin
- GET by code → SuperAdmin, Admin, Teacher
- 结论: 角色控制完整

### 4. CourseController ✅
路径: src/modules/teaching/course/course.controller.ts
- CREATE → SuperAdmin, Admin
- LIST → SuperAdmin, Admin, Teacher
- GET by code → SuperAdmin, Admin, Teacher
- UPDATE → SuperAdmin, Admin
- STATUS → SuperAdmin, Admin
- DELETE → SuperAdmin
- 结论: 角色控制完整

### 5. EnrollmentController ✅
路径: src/modules/teaching/enrollment/enrollment.controller.ts
- ENROLL → SuperAdmin, Admin
- LIST → SuperAdmin, Admin, Teacher
- GET by id → SuperAdmin, Admin, Teacher
- WITHDRAW → SuperAdmin, Admin
- GET by classCode → SuperAdmin, Admin, Teacher
- GET by studentCode → SuperAdmin, Admin, Teacher, Student, Parent
- 结论: 角色控制完整

### 6. LessonController ✅
路径: src/modules/teaching/lesson/lesson.controller.ts
- LIST by class → SuperAdmin, Admin, Teacher
- GET by code+num → SuperAdmin, Admin, Teacher, Student, Parent
- START/COMPLETE/CONFIRM/CANCEL → SuperAdmin, Admin, Teacher
- CREATE makeup → SuperAdmin, Admin, Teacher
- CREATE with attendance → SuperAdmin, Admin, Teacher
- 结论: 角色控制完整

### 7. LessonAttendanceController ✅
路径: src/modules/teaching/lesson-attendance/lesson-attendance.controller.ts
- BATCH roll call → SuperAdmin, Admin, Teacher
- CONFIRM all → SuperAdmin, Admin, Teacher
- UPDATE single → SuperAdmin, Admin, Teacher
- GET by lesson → SuperAdmin, Admin, Teacher, Student, Parent
- GET by student → SuperAdmin, Admin, Teacher, Student, Parent
- 结论: 角色控制完整

### 8. LessonChangeRequestController ✅
路径: src/modules/teaching/lesson-change-request/lesson-change-request.controller.ts
- CREATE → SuperAdmin, Admin, Teacher
- LIST → SuperAdmin, Admin, Teacher
- APPROVE → SuperAdmin, Admin
- REJECT → SuperAdmin, Admin
- EXECUTE → SuperAdmin, Admin
- 结论: 角色控制完整

### 9. TeacherAssignmentController ✅
路径: src/modules/teaching/teacher-assignment/teacher-assignment.controller.ts
- CREATE → SuperAdmin, Admin
- LIST → SuperAdmin, Admin, Teacher
- GET by id → SuperAdmin, Admin, Teacher
- DELETE → SuperAdmin, Admin
- 结论: 角色控制完整

### 10. TeacherDashboardController ✅
路径: src/modules/teaching/teacher-dashboard/teacher-dashboard.controller.ts
- DASHBOARD → SuperAdmin, Admin, Teacher
- Service 层有 teacherId 过滤（根据 req.user.sub 查 assignment）
- 结论: 角色控制完整，数据隔离有效

### 11. AnalyticsController ✅
路径: src/modules/analytics/analytics.controller.ts
- Student metrics → SuperAdmin, Admin, Teacher, Parent, Student（含 verifyStudentAccess）
- Teacher metrics → SuperAdmin, Admin, Teacher（含 verifyTeacherAccess）
- Institution metrics → SuperAdmin, Admin
- Attendance statistics → SuperAdmin, Admin, Teacher
- Trends → 同以上对应角色
- 结论: 角色控制完整，有显式数据归属验证逻辑

### 12. ReminderController ✅
路径: src/modules/reminder/reminder.controller.ts
- CREATE → SuperAdmin, Admin, Teacher
- LIST/MARK READ → 全部角色
- 结论: 角色控制完整，数据按 userId 过滤

### 13. AuthController ✅
路径: src/modules/identity/auth/auth.controller.ts
- LOGIN/REFRESH → @Public()
- 结论: 公开端点，无需角色控制

---

## 二、Service 层数据隔离审计

### 2.1 缺少 organizationId / campusId 过滤（GAP-01）
Service 层 findAll / findMany 均无 organizationId 或 campusId 过滤条件。
影响模块: ClassService, StudentService, CourseService, ContractService, EnrollmentService, TeacherAssignmentService

当前: User 实体有 campusId，但各业务实体（Class, Student, Course 等）无 campusId 字段。
建议: 若系统需支持多校区/多机构，需先在实体层增加 campusId/organizationId 字段，再在 Service 查询中加入过滤。

### 2.2 TeacherDashboardController — 数据隔离已实现 ✅
教师控制面板通过 teacherAssignmentRepository.find({ where: { teacherId: userId } }) 限定可见班级范围。
这是目前最完整的数据隔离实现。

### 2.3 AnalyticsController — 数据访问验证已实现 ✅
- verifyStudentAccess(): Student/Parent 只能查自己的数据
- verifyTeacherAccess(): Teacher 只能查自己的数据
- SuperAdmin/Admin 不受限
- 但 getInstitutionMetrics/getAttendanceStatistics/getConsumptionStatistics 返回全局数据，无论当前 Admin 属于哪个 campus（GAP-02）

### 2.4 StudentController self/* — 已实现 ✅
Student/Parent 端点通过 userId → studentCode 映射隔离数据。

### 2.5 ReminderController — 已实现 ✅
全部按 req.user.sub (userId) 过滤。

### 2.6 AttendanceStatistics — 全局无过滤（GAP-03）
getAttendanceStatistics() 不区分 Teacher 只能看自己班级的数据。
当前 @Roles('SuperAdmin', 'Admin', 'Teacher') 允许 Teacher 访问全局出勤统计。
建议: Teacher 访问时应过滤到仅包含其任教班级的出勤数据。

---

## 三、隐患汇总

| # | 严重度 | 类型 | 描述 | 位置 |
|---|--------|------|------|------|
| GAP-01 | 中 | 数据隔离 | 全系 findAll 无 org/campus 过滤 | ClassService, StudentService, CourseService, ContractService, EnrollmentService, TeacherAssignmentService |
| GAP-02 | 低 | 数据隔离 | Institution 级分析返回全局数据，不支持多校区 | AnalyticsService.getInstitutionMetrics, getAttendanceStatistics, getConsumptionStatistics |
| GAP-03 | 中 | 权限越界 | Teacher 角色可访问全局出勤统计，含非其班级数据 | AnalyticsService.getAttendanceStatistics |
| GAP-04 | 低 | 角色定义 | Controller 使用 @Roles('Student') 但 UserRole 枚举无 Student 值 | student.controller.ts / user.entity.ts |
| GAP-05 | 低 | 枚举一致性 | 'SuperAdmin' vs 'Admin' 与 UserRole 枚举中的 'SUPER_ADMIN' 大小写格式不一致 | roles.decorator 使用字符串字面量 |
| GAP-06 | 低 | 写入审计 | Contract 的创建和状态变更缺少 operatorId 写入审计日志 | ContractService.create/freeze/unfreeze |

---

## 四、结论

Controller 层的 @Roles 声明覆盖完整，无裸露的无权限端点。
Service 层的数据隔离存在以下主要问题:
1. 系统级缺少多校区/多机构数据隔离架构（实体层无 campusId）
2. Teacher 可以查看全局出勤统计（本应仅限其班级）
3. Contract 缺少操作审计日志

建议按 Phase 6 优先修复 GAP-03 和 GAP-06（低成本高收益），GAP-01 需架构决策。
