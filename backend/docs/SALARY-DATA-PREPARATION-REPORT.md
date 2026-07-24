# 薪酬数据准备确认报告

## 确认时间
2026-07-24

## 确认方法
静态代码审查：逐一检查 Entity 定义、Service 查询能力、Controller 暴露接口。
不涉及运行时验证，仅确认数据模型层面是否具备薪酬计算所需字段。

---

## 数据确认

### 1. 教师数据
- Entity 存在: ✅ User Entity (src/modules/identity/entities/user.entity.ts)
- 角色区分: ✅ UserRole.TEACHER 枚举值存在
- 教师信息: ✅ name(姓名) + mobile(联系方式) + role(角色) + status(状态)
- 班级分配: ✅ TeacherAssignmentEntity 关联 teacherId ↔ classCode，含 TeacherRole(PRIMARY/SUBSTITUTE/ASSISTANT)
- 有效期管理: ✅ TeacherAssignment 有 effectiveFrom / effectiveTo
- 可查询: ✅ AnalyticsService.getTeacherMetrics(teacherId) 已实现
- Status: ✅ READY

### 2. 授课记录
- Entity 存在: ✅ LessonEntity (src/modules/teaching/lesson/lesson.entity.ts)
- 教师关联: ✅ teacherId 字段
- 班级关联: ✅ classCode 字段
- 课程关联: ✅ courseCode 字段
- 时间信息: ✅ scheduledDate + startTime + endTime + actualStartTime + actualEndTime
- 课时数: ✅ lessonNumber 字段（每节课一条记录）
- 状态管理: ✅ LessonStatus (DRAFT/SCHEDULED/TEACHING/FINISHED/ARCHIVED/CANCELLED)
- 可查询: ✅ findByClassCode() 已实现
- Status: ✅ READY

### 3. 有效考勤
- Entity 存在: ✅ LessonAttendanceEntity (src/modules/teaching/lesson-attendance/lesson-attendance.entity.ts)
- 学生关联: ✅ studentCode 字段
- 课时关联: ✅ lessonId 字段
- 教师关联: ✅ teacherId 字段
- 考勤状态: ✅ AttendanceStatus (PRESENT/ABSENT/LATE/LEAVE/MAKEUP/ONLINE/OFFLINE)
- 有效考勤定义: ✅ DEDUCTIBLE_STATUSES 已定义 (PRESENT/LATE/ONLINE/OFFLINE → 扣课时)
- 工作流状态: ✅ AttendanceWorkflowState (PENDING → CHECKED_IN → CONFIRMED → LOCKED)
- 可统计: ✅ AnalyticsService 已统计 attendanceRate/absenceRate/lateRate
- Status: ✅ READY

### 4. 课程类型
- Entity 存在: ✅ CourseEntity (src/modules/teaching/course/course.entity.ts)
- 类型信息: ✅ CourseType (INDIVIDUAL/GROUP/TRIAL/CAMP)
- 学科信息: ✅ Subject (MATH/ENGLISH/CHINESE/PHYSICS/CHEMISTRY/ART/MUSIC/DANCE/SPORTS/CODING/OTHER)
- 课时总量: ✅ totalHours + totalLessons + defaultDuration
- 可区分: ✅ type 字段有 @Index，支持按类型查询
- 定价参考: ✅ ContractEntity 有 unitPrice + totalAmount
- Status: ✅ READY

### 5. 结算周期
- 周期支持: ⚠️ PARTIAL — 无显式"结算周期"概念
- 数据基础: ✅ Lesson.scheduledDate 支持按日期范围查询（需新增 Service 方法）
- 考勤日期: ✅ LessonAttendance.createdAt 提供时间戳
- 现有周期查询: ✅ Analytics 支持 DAU/WAU/MAU（日/周/月窗口）
- Trend API: ✅ getStudentTrend / getTeacherTrend / getInstitutionTrend 支持 days 参数
- 可自定义: ❌ 无自定义周期接口（需新增）
- 可统计: ⚠️ 底层数据齐全，但缺少按教师+月份聚合的 Service/Controller 方法
- Status: ⚠️ PARTIAL READY（数据层就绪，聚合层需开发）

---

## 结论

- 教师数据: ✅ READY — User(role=Teacher) + TeacherAssignment 完整
- 授课记录: ✅ READY — LessonEntity 含教师/班级/课程/时间/状态
- 有效考勤: ✅ READY — LessonAttendance 含状态枚举 + DEDUCTIBLE_STATUSES 定义
- 课程类型: ✅ READY — CourseType 4种 + Subject 11种 + Contract 定价
- 结算周期: ⚠️ PARTIAL READY — 底层日期数据齐全，缺少按教师+月份的聚合查询接口

- Overall: ⚠️ 4/5 READY, 1/5 PARTIAL

---

## 薪酬计算可行性分析

### 已具备的能力
1. 按教师查询授课记录：通过 Lesson.teacherId + Lesson.scheduledDate 可筛选
2. 按教师查询考勤统计：通过 LessonAttendance.teacherId 可关联
3. 课程类型区分：CourseType 支持差异化定价（1对1 vs 大班 vs 试听课 vs 营地）
4. 合同定价参考：Contract.unitPrice 可作为课时单价来源

### 需补充的能力（未来薪酬模块开发时）
1. **按教师+日期范围聚合授课数**：需新增 `LessonService.findByTeacherAndDateRange(teacherId, start, end)`
2. **按教师+月份统计有效课时**：需新增聚合查询 `COUNT lessons WHERE teacherId = X AND scheduledDate BETWEEN start AND end AND status = FINISHED`
3. **结算周期接口**：需定义 `SettlementPeriod` 概念（月度/周度/自定义）
4. **薪酬规则引擎**：不同课程类型对应不同课时单价（需业务定义）

### 数据链路完整性
```
教师(User.role=Teacher)
  → 班级分配(TeacherAssignment.teacherId ↔ classCode)
    → 授课记录(Lesson.teacherId + classCode + scheduledDate)
      → 考勤记录(LessonAttendance.lessonId + studentCode + status)
        → 有效课时统计(DEDUCTIBLE_STATUSES: PRESENT/LATE/ONLINE/OFFLINE)
          → 课程类型(Course.type: INDIVIDUAL/GROUP/TRIAL/CAMP)
            → 单价参考(Contract.unitPrice)
              → 薪酬计算(待开发)
```

数据链路完整，无断裂。薪酬模块开发时只需新增聚合层和规则层。

---

## 建议
1. 薪酬模块开发时，优先实现 `findByTeacherAndDateRange` 聚合查询（底层数据已齐全）
2. 定义 SettlementPeriod Entity 或至少定义 period 类型（MONTHLY/WEEKLY/CUSTOM）
3. 课程类型与课时单价的映射关系需业务侧确认（INDIVIDUAL vs GROUP 单价差异）
4. 考虑 TeacherRole 对薪酬的影响（PRIMARY vs SUBSTITUTE vs ASSISTANT 是否不同单价）
5. Contract.unitPrice 当前 nullable，需确认是否所有合同都有定价信息
