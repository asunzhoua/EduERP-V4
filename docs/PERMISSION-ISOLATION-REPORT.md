# Permission Isolation Verification Report

## 验证时间
2026-07-24

## 验证范围
- Student Service: 4 files (student.service.ts, contract.service.ts, lesson.service.ts, lesson-attendance.service.ts)
- Teacher Service: 4 files (class.service.ts, lesson.service.ts, lesson-attendance.service.ts, teacher-assignment.service.ts)
- Admin Service: 3 files (student.service.ts, class.service.ts, lesson.service.ts)
- Controller: 7 files (student, class, lesson, lesson-attendance, contract, enrollment, teacher-assignment, teacher-dashboard)
- Guard/Decorator: 2 files (roles.guard.ts, roles.decorator.ts)

## 权限架构概述

权限系统由三层组成：
1. JwtAuthGuard — JWT token 验证，提取 user.sub (userId) 和 user.role
2. RolesGuard — 基于 @Roles() 装饰器的角色检查
3. Service 层数据过滤 — 在 Service 方法中根据 userId/teacherId 过滤数据

RolesGuard 实现正确：从 ROLES_KEY metadata 读取角色列表，检查 user.role 是否在列表中。

---

## Student 权限验证

### Self-Service 端点（/students/self/*）

StudentController 提供了 4 个 self-service 端点，全部使用 @Roles('Student', 'Parent')：

1. GET /students/self
   - 过滤逻辑: req.user.sub → findByUserId(userId) → 只返回自己的学生信息
   - 状态: ✅ PASS — 正确的 userId 过滤

2. GET /students/self/contracts
   - 过滤逻辑: req.user.sub → findByUserId → student.studentCode → contractRepository.findByStudentCode
   - 状态: ✅ PASS — 通过 userId → studentCode 链路，只返回自己的合同

3. GET /students/self/lessons
   - 过滤逻辑: req.user.sub → findByUserId → student.studentCode → lessonAttendanceRepository.findByStudentCode
   - 状态: ✅ PASS — 通过 userId → studentCode 链路，只返回自己的课时记录

4. GET /students/self/attendance
   - 过滤逻辑: req.user.sub → findByUserId → student.studentCode → lessonAttendanceRepository.findByStudentCode
   - 状态: ✅ PASS — 通过 userId → studentCode 链路，只返回自己的出勤记录

### 共享端点（Student/Parent 可访问）

5. GET /contracts/students/:studentCode/contracts
   - 角色: SuperAdmin, Admin, Teacher, Student, Parent
   - 过滤逻辑: 无 — 接受 URL 参数 studentCode，不验证是否匹配当前用户
   - 状态: ❌ FAIL — Student 可通过替换 studentCode 访问其他学生的合同
   - 位置: contract.controller.ts:67

6. GET /enrollments/students/:studentCode/enrollments
   - 角色: SuperAdmin, Admin, Teacher, Student, Parent
   - 过滤逻辑: 无 — 接受 URL 参数 studentCode，不验证是否匹配当前用户
   - 状态: ❌ FAIL — Student 可通过替换 studentCode 访问其他学生的报名记录
   - 位置: enrollment.controller.ts:82

7. GET /students/:studentCode/attendance
   - 角色: SuperAdmin, Admin, Teacher, Student, Parent
   - 过滤逻辑: 无 — 接受 URL 参数 studentCode，不验证是否匹配当前用户
   - 状态: ❌ FAIL — Student 可通过替换 studentCode 访问其他学生的出勤记录
   - 位置: lesson-attendance.controller.ts:107

8. GET /lessons/:id/attendance
   - 角色: SuperAdmin, Admin, Teacher, Student, Parent
   - 过滤逻辑: 无 — 返回该课时所有学生的出勤记录
   - 状态: ❌ FAIL — Student 可看到同课时其他学生的出勤数据
   - 位置: lesson-attendance.controller.ts:93

9. GET /classes/:code
   - 角色: SuperAdmin, Admin, Teacher, Student, Parent
   - 过滤逻辑: 无 — 返回任意班级详情
   - 状态: ⚠️ ACCEPTABLE — 班级基本信息（不含学生名单）泄露风险低

### Student 权限结论
- Self-Service 数据隔离: ✅ PASS（4/4 端点正确过滤）
- 共享端点验证: ❌ FAIL（4 个端点存在跨学生数据访问漏洞）
- 核心问题: 共享端点接受 URL 参数 studentCode 但不验证与当前登录用户的关系

---

## Teacher 权限验证

### Teacher Dashboard（唯一有数据隔离的端点）

1. GET /teacher/dashboard
   - 过滤逻辑: req.user.sub → teacherAssignmentRepository.find({ teacherId: userId }) → 只查询自己的班级
   - 状态: ✅ PASS — 正确的 teacherId 过滤

### Teacher 可访问的列表端点（全部缺少 teacherId 过滤）

2. GET /classes（ClassController.findAll）
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — ClassService.findAll(query) 只按 name/courseCode/status 过滤，不按 teacherId
   - 状态: ❌ FAIL — Teacher 可看到所有班级，包括其他教师的班级
   - 位置: class.controller.ts:56, class.service.ts:85-96

3. GET /contracts（ContractController.findAll）
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — ContractService.findAll() 只按 studentCode/subject/status 过滤
   - 状态: ❌ FAIL — Teacher 可看到所有合同
   - 位置: contract.controller.ts:55

4. GET /classes/:code/lessons（LessonController.findByClass）
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — 按 classCode 查询，不验证该 Teacher 是否负责该班级
   - 状态: ❌ FAIL — Teacher 可查询任意班级的课时
   - 位置: lesson.controller.ts:48

5. GET /enrollments（EnrollmentController.findAll）
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — 返回所有报名记录
   - 状态: ❌ FAIL — Teacher 可看到所有学生的报名记录
   - 位置: enrollment.controller.ts:44

6. GET /enrollments/classes/:code/enrollments
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — 按 classCode 查询，不验证 Teacher 是否负责该班级
   - 状态: ❌ FAIL — Teacher 可查询任意班级的学生名单
   - 位置: enrollment.controller.ts:72

7. GET /teacher-assignments（TeacherAssignmentController.findAll）
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — 返回所有教师分配记录
   - 状态: ❌ FAIL — Teacher 可看到所有教师的分配信息
   - 位置: teacher-assignment.controller.ts:49

### Teacher 写操作端点（同样缺少 teacherId 验证）

8. POST/PATCH /lessons/* 系列（LessonController）
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — 任何 Teacher 可操作任意班级的课时
   - 状态: ❌ FAIL — Teacher 可开始/完成/取消非自己班级的课时
   - 位置: lesson.controller.ts:63-155

9. POST /lessons/:id/attendance（LessonAttendanceController）
   - 角色: SuperAdmin, Admin, Teacher
   - 过滤逻辑: 无 — 任何 Teacher 可记录任意班级的出勤
   - 状态: ❌ FAIL — Teacher 可操作非自己班级的出勤记录
   - 位置: lesson-attendance.controller.ts:36

### Teacher 权限结论
- Teacher 数据隔离: ❌ FAIL（仅 Dashboard 有 teacherId 过滤，其余 9 个端点全部缺失）
- 核心问题: Teacher 角色可访问和操作全部数据，等同于 Admin 权限范围
- 确认: ISSUE-002（Batch 1.2 发现）确认存在，且范围比预期更广

---

## Admin 权限验证

### 全局访问检查

1. Student CRUD — @Roles('SuperAdmin', 'Admin')
   - 状态: ✅ PASS — 正确的全局访问权限

2. Class CRUD — @Roles('SuperAdmin', 'Admin')
   - 状态: ✅ PASS — 正确的全局访问权限

3. Contract CRUD — @Roles('SuperAdmin', 'Admin')（写操作）
   - 状态: ✅ PASS — 正确的全局访问权限

4. Lesson 操作 — @Roles('SuperAdmin', 'Admin', 'Teacher')
   - 状态: ✅ PASS — Admin 包含在角色列表中

5. Enrollment 操作 — @Roles('SuperAdmin', 'Admin')（写操作）
   - 状态: ✅ PASS — 正确的全局访问权限

6. Teacher Assignment — @Roles('SuperAdmin', 'Admin')
   - 状态: ✅ PASS — 正确的全局访问权限

### Admin 权限结论
- Admin 全局访问: ✅ PASS — 所有端点均可访问，无不必要限制
- 问题: 无

---

## 发现的问题

### ISSUE-PERM-001: Teacher 数据隔离全面缺失（读操作）
- Severity: P1
- Location: class.controller.ts:56, contract.controller.ts:55, lesson.controller.ts:48, enrollment.controller.ts:44, teacher-assignment.controller.ts:49
- Impact: 任何 Teacher 可查看所有班级、合同、课时、报名记录、教师分配信息
- Root Cause: Controller 不传递 req.user.sub 给 Service，Service 无 teacherId 过滤参数
- Recommendation: 当 role=Teacher 时，Controller 应传递 teacherId=req.user.sub，Service 应先查询 teacher 的 classCodes，再按 classCodes 过滤数据

### ISSUE-PERM-002: Teacher 数据隔离全面缺失（写操作）
- Severity: P1
- Location: lesson.controller.ts:63-155, lesson-attendance.controller.ts:36
- Impact: 任何 Teacher 可开始/完成/取消任意班级的课时，可记录任意班级的出勤
- Root Cause: 写操作端点不验证当前 Teacher 是否有权操作目标班级
- Recommendation: 添加 verifyTeacherClassAccess(teacherId, classCode) 中间件或 Service 方法

### ISSUE-PERM-003: Student 共享端点缺少 studentCode 所有权验证
- Severity: P1
- Location: contract.controller.ts:67, enrollment.controller.ts:82, lesson-attendance.controller.ts:107
- Impact: Student 可通过修改 URL 中的 studentCode 参数访问其他学生的合同、报名、出勤数据
- Root Cause: 端点接受 studentCode 参数但不验证是否属于当前登录用户
- Recommendation: 当 role=Student/Parent 时，忽略 URL 参数，强制使用 req.user.sub → findByUserId → studentCode

### ISSUE-PERM-004: Student 可查看课时全部出勤记录
- Severity: P2
- Location: lesson-attendance.controller.ts:93
- Impact: Student 可通过 GET /lessons/:id/attendance 查看同课时所有学生的出勤状态
- Root Cause: 端点返回该课时的全部出勤记录，不区分角色
- Recommendation: 当 role=Student/Parent 时，只返回自己的出勤记录；或限制此端点仅 Teacher/Admin 可用

---

## 总结

- Total Checks: 19
- Passed: 8（Student self-service 4 + Admin 全局 4 类）
- Failed: 11（Teacher 读隔离 5 + Teacher 写隔离 2 + Student 共享端点 3 + Student 出勤泄露 1）
- Status: ❌ HAS ISSUES

### 按角色统计
- Student Self-Service Isolation: ✅ PASS（核心自服务端点隔离正确）
- Student Shared Endpoint Validation: ❌ FAIL（3 个端点可跨学生访问）
- Teacher Data Isolation: ❌ FAIL（仅 Dashboard 有隔离，其余全部缺失）
- Admin Global Access: ✅ PASS（无不必要限制）

### 优先级建议
- P1: ISSUE-PERM-001/002/003 — Teacher 隔离 + Student 所有权验证（影响数据安全）
- P2: ISSUE-PERM-004 — Student 出勤记录泄露（影响隐私但风险较低）
