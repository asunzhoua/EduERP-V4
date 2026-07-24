# 薪酬数据来源确认报告

## 确认时间
2026-07-24

## 检查方法
逐一读取 backend/src/ 下所有相关 Entity 文件，基于实际代码证据判断。
不使用推测，不使用记忆，全部来自文件内容。

---

## 数据确认

### 1. Teacher（教师身份）
- 专用 Teacher Entity: ❌ 不存在独立 Teacher Entity
- 替代方案: User Entity（role='Teacher' 即为教师）
- 文件位置: src/modules/identity/entities/user.entity.ts
- 必要字段:
  - id (bigint, PK): ✅
  - name (varchar 50): ✅
  - mobile (varchar 20, unique): ✅
  - role (varchar 50, indexed): ✅ — 枚举值包含 Teacher
  - status (tinyint, indexed): ✅ — ACTIVE/INACTIVE/DISABLED
  - campusId (bigint): ✅ — 校区归属
- 可查询: ✅ — 通过 UserRepository 按 role='Teacher' 过滤
- 教师角色细分: ❌ User Entity 无教师等级/职称字段
- Status: ✅ READY（基础身份数据充足，缺少薪酬等级字段需后续新增）

### 2. Lesson（课时记录）
- Entity 存在: ✅
- 文件位置: src/modules/teaching/lesson/lesson.entity.ts
- 教师ID: ✅ teacherId (bigint)
- 班级编码: ✅ classCode (varchar 20, indexed)
- 课程编码: ✅ courseCode (varchar 20, indexed)
- 时间信息:
  - scheduledDate (date): ✅ 计划日期
  - startTime (varchar 5): ✅ 计划开始
  - endTime (varchar 5): ✅ 计划结束
  - actualStartTime (timestamp): ✅ 实际开始
  - actualEndTime (timestamp): ✅ 实际结束
- 课时编号: ✅ lessonNumber (int)
- 课时状态: ✅ status (enum: DRAFT/SCHEDULED/TEACHING/FINISHED/ARCHIVED/CANCELLED)
- 是否补课: ✅ isMakeup (boolean)
- 确认信息: ✅ confirmedBy + confirmedAt
- 显式"课时数"字段: ❌ 无 — 但每条 Lesson 记录 = 1 课时（隐式）
- Status: ✅ READY

### 3. Class（班级关系）
- Entity 存在: ✅
- 文件位置: src/modules/teaching/class/class.entity.ts
- 班级编码: ✅ classCode (varchar 20, unique)
- 课程编码: ✅ courseCode (varchar 20, indexed)
- 教师直接分配: ❌ Class Entity 无 teacherId 字段
- 教师分配方式: ✅ 通过 TeacherAssignmentEntity 实现（多对多）
  - 文件: src/modules/teaching/teacher-assignment/teacher-assignment.entity.ts
  - classCode + teacherId + role (PRIMARY/SUBSTITUTE/ASSISTANT)
  - effectiveFrom / effectiveTo（有效期）
- 班级状态: ✅ status (enum: DRAFT/...等)
- 排期信息: ✅ startDate, totalLessons, dayOfWeek, startTime, endTime
- 容量: ✅ maxStudents
- Status: ✅ READY

### 4. Course（课程关系）
- Entity 存在: ✅
- 文件位置: src/modules/teaching/course/course.entity.ts
- 课程编码: ✅ courseCode (varchar 20, unique)
- 课程名称: ✅ name (varchar 100)
- 学科: ✅ subject (enum: MATH/ENGLISH/CHINESE/PHYSICS/CHEMISTRY/ART/MUSIC/DANCE/SPORTS/CODING/OTHER)
- 课程类型: ✅ type (enum: INDIVIDUAL/GROUP/TRIAL/CAMP)
- 内容度量:
  - totalHours (decimal 6,1): ✅
  - totalLessons (int): ✅
  - defaultDuration (int): ✅
- 定价信息:
  - Course Entity 内: ❌ 无价格字段
  - Contract Entity 内: ✅ unitPrice (decimal 10,2) + totalAmount (decimal 10,2)
  - 注意: Contract 定价是学生侧（课时单价），非教师薪酬单价
- Status: ✅ READY（课程类型可用于差异化薪酬规则）

### 5. Attendance（出勤数据）
- Entity 存在: ✅
- 文件位置: src/modules/teaching/lesson-attendance/lesson-attendance.entity.ts
- 课时ID: ✅ lessonId (bigint, indexed)
- 学生编码: ✅ studentCode (varchar 20, indexed)
- 班级编码: ✅ classCode (varchar 20, indexed)
- 教师ID: ✅ teacherId (bigint)
- 出勤状态: ✅ status (enum: PRESENT/ABSENT/LATE/LEAVE/MAKEUP/ONLINE/OFFLINE)
- 工作流状态: ✅ workflowState (enum: PENDING/CHECKED_IN/CONFIRMED/LOCKED)
- 签到时间: ✅ checkInTime (timestamp)
- 可扣费状态集: ✅ DEDUCTIBLE_STATUSES = {PRESENT, LATE, ONLINE, OFFLINE}
- 时间: ✅ createdAt + updatedAt
- Status: ✅ READY

### 6. 数据关联
- Teacher→Lesson: ✅ Lesson.teacherId 直接关联 User.id
- Lesson→Attendance: ✅ LessonAttendance.lessonId 直接关联 Lesson.id
- Class→Teacher: ✅ TeacherAssignment(classCode, teacherId, role) 多对多关联
- Course→Class: ✅ Class.courseCode 直接关联 Course.courseCode
- Contract→Enrollment→Class: ✅ 完整财务链路
  - Contract(studentCode, subject, unitPrice, totalAmount)
  - Enrollment(classCode, studentCode, contractCode)
  - Class(classCode, courseCode)
- 额外发现:
  - TeacherAssignment.role 区分 PRIMARY/SUBSTITUTE/ASSISTANT → 可用于差异化薪酬
  - Lesson.isMakeup 标记补课 → 补课可能有不同薪酬规则
  - Lesson.confirmedBy/confirmedAt → 课时确认链路完整
- Status: ✅ READY

---

## 结论

逐项状态:
- Teacher 身份数据: ✅ READY（User Entity role='Teacher'）
- Lesson 课时数据: ✅ READY（完整时间+教师+状态）
- Class 班级数据: ✅ READY（通过 TeacherAssignment 关联教师）
- Course 课程数据: ✅ READY（类型+学科可用于规则分类）
- Attendance 出勤数据: ✅ READY（完整出勤状态+教师ID）
- 数据关联链路: ✅ READY（所有实体间关联完整）

- Overall: ✅ ALL DATA READY

---

## 可用于工资计算的数据

1. 教师实际授课记录: Lesson Entity（teacherId + scheduledDate + actualStartTime/EndTime + status）
2. 教师班级分配: TeacherAssignment Entity（classCode + teacherId + role + effectiveFrom/To）
3. 学生出勤统计: LessonAttendance Entity（lessonId + status + teacherId）
4. 有效课时计数: 按 teacherId + 时间范围筛选 Lesson，status=FINISHED 即为有效课时
5. 课程类型区分: Course.type（INDIVIDUAL/GROUP/TRIAL/CAMP）→ 可设不同课时费率
6. 教师角色区分: TeacherAssignment.role（PRIMARY/SUBSTITUTE/ASSISTANT）→ 可设不同薪酬系数
7. 补课标记: Lesson.isMakeup → 补课可设额外薪酬规则
8. 课时确认链路: Lesson.confirmedBy/confirmedAt → 已确认课时才计入薪酬

---

## 缺失的数据（需后续新增）

1. 教师薪酬费率表: ❌ 不存在
   - 当前系统无 teacher_salary_rate 或类似 Entity
   - 需新建：teacherId + courseType + teacherRole → hourlyRate
   - 或：teacherId + baseRate + coefficient

2. 薪酬计算规则配置: ❌ 不存在
   - 底薪/课时费比例/绩效系数等
   - 建议新建 salary_config Entity 或 JSON 配置

3. 教师等级/职称: ❌ User Entity 无此字段
   - 如需按等级定薪，需在 User 或独立 teacher_profile 表新增字段

4. 薪酬结算周期: ❌ 不存在
   - 月度/半月/周结算配置
   - 可在 salary_config 中包含

5. 奖惩记录: ❌ 不存在
   - 迟到/缺勤扣款、额外奖励等
   - 可作为 Phase 3+ 扩展

---

## 数据关联图（文本描述）

User(Teacher) ←── teacherId ──── Lesson
     │                              │
     │                              ├── lessonId ──→ LessonAttendance
     │                              │                    │
     │                              │                    └── studentCode ──→ Student
     │                              │
     │                              ├── classCode ──→ Class ──→ courseCode ──→ Course
     │                              │                    │
     │                              │                    └── classCode ──→ TeacherAssignment
     │                              │                                        │
     │                              │                                        └── teacherId (回指 User)
     │                              │
     │                              └── courseCode ──→ Course (type, subject)
     │
     └── role='Teacher'

Contract(unitPrice, totalAmount) ←── contractCode ──→ Enrollment(classCode, studentCode)

---

## 下一步建议

Phase 2 Batch 2.2 可基于以上已确认的数据源，开始设计薪酬计算核心逻辑：
1. 按 teacherId + 时间范围查询 FINISHED 状态的 Lesson
2. 关联 TeacherAssignment 获取角色（PRIMARY/SUBSTITUTE/ASSISTANT）
3. 关联 Course 获取类型（INDIVIDUAL/GROUP 等）
4. 统计有效课时数（考虑 Attendance 出勤率）
5. 应用薪酬费率计算（需新建 salary_rate 配置）
