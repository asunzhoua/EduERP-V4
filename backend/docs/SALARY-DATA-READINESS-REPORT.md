# 薪酬数据准备报告

## 验证时间
2026-07-24

## 验证方法
静态代码审查：逐一读取 Entity 源文件，提取字段定义、枚举值、索引信息。
所有结论均来自实际代码证据，不依赖推测或记忆。

## 验证范围
- Teacher 数据（User Entity + TeacherAssignment Entity）
- Lesson 数据（Lesson Entity）
- Attendance 数据（LessonAttendance Entity）
- Contract 数据（Contract Entity）
- Course 数据（Course Entity）

---

## 验证结果

### 1. 教师完成课程数量可统计
- 数据来源: Lesson Entity (src/modules/teaching/lesson/lesson.entity.ts)
- 统计方式: COUNT WHERE teacherId = X AND status = 'FINISHED'
- 关键字段:
  - teacherId (bigint): ✅ 教师ID，有索引
  - status (enum LessonStatus): ✅ 包含 FINISHED 状态
  - LessonStatus 枚举值: DRAFT / SCHEDULED / TEACHING / FINISHED / ARCHIVED / CANCELLED
- 补充: 每条 Lesson 记录 = 1 课时（隐式），无需额外课时数字段
- Status: ✅ 可统计

### 2. 周期内授课次数可统计
- 数据来源: Lesson Entity (src/modules/teaching/lesson/lesson.entity.ts)
- 统计方式: COUNT WHERE teacherId = X AND scheduledDate BETWEEN start AND end AND status = 'FINISHED'
- 关键字段:
  - scheduledDate (date): ✅ 计划授课日期
  - actualStartTime (timestamp): ✅ 实际开始时间
  - actualEndTime (timestamp): ✅ 实际结束时间
- 现有能力: AnalyticsService 已支持 DAU/WAU/MAU 时间窗口查询
- 缺失: 无按教师+月份聚合的专用 Service 方法（底层数据齐全，需新增查询方法）
- Status: ✅ 可统计（数据层就绪，聚合层需开发）

### 3. 不同课程类型可区分
- 数据来源: Course Entity (src/modules/teaching/course/course.entity.ts)
- 区分方式: Course.type 字段（有索引）
- CourseType 枚举值:
  - INDIVIDUAL（1对1）
  - GROUP（大班）
  - TRIAL（试听课）
  - CAMP（营地）
- Subject 枚举值（11种）:
  - MATH / ENGLISH / CHINESE / PHYSICS / CHEMISTRY
  - ART / MUSIC / DANCE / SPORTS / CODING / OTHER
- 关联链路: Lesson.courseCode → Course.courseCode → Course.type
- Status: ✅ 可区分

---

## 薪酬模式支持验证

### 固定课时费
- 数据支持: ✅ 支持
- 计算方式: 授课次数 × 固定单价
- 所需数据:
  - teacherId: ✅ Lesson.teacherId
  - lessonCount: ✅ COUNT(status='FINISHED') 可统计
  - rate: ❌ 无教师课时费率表（需新建）
- 数据缺口: 需新建 teacher_salary_rate 表（teacherId + rate）
- 结论: 底层授课数据齐全，费率配置需新增

### 底薪+课时费
- 数据支持: ✅ 支持
- 计算方式: 底薪 + 授课次数 × 单价
- 所需数据:
  - baseSalary: ❌ User Entity 无底薪字段（需新建薪酬配置表）
  - lessonCount: ✅ 可统计
  - rate: ❌ 需新建
- 数据缺口: 同固定课时费，需新建薪酬配置
- 结论: 底层授课数据齐全，薪酬参数需新增

### 阶梯课时费
- 数据支持: ✅ 支持
- 计算方式: 根据授课次数区间，不同单价（如 0-20节×80元，21-40节×100元，41+×120元）
- 所需数据:
  - lessonCount: ✅ 可统计
  - tierRates: ❌ 需新建阶梯费率配置
- 额外支持:
  - Course.type 可用于区分不同课程类型的阶梯规则
  - TeacherAssignment.role (PRIMARY/SUBSTITUTE/ASSISTANT) 可用于区分教师角色的阶梯规则
- 结论: 底层授课数据齐全，阶梯规则配置需新增

---

## 数据关联完整性

```
User(role='Teacher')
  │
  ├── teacherId ──→ Lesson (teacherId + scheduledDate + status)
  │                    │
  │                    ├── courseCode ──→ Course (type + subject)
  │                    │
  │                    ├── classCode ──→ TeacherAssignment (teacherId + role)
  │                    │
  │                    └── id (lessonId) ──→ LessonAttendance (status + studentCode)
  │
  └── TeacherAssignment (classCode + teacherId + effectiveFrom/To)
```

关联状态:
- Teacher → Lesson: ✅ 直接关联（Lesson.teacherId = User.id）
- Lesson → Course: ✅ 直接关联（Lesson.courseCode = Course.courseCode）
- Lesson → Attendance: ✅ 直接关联（LessonAttendance.lessonId = Lesson.id）
- Teacher → Class: ✅ 通过 TeacherAssignment 多对多关联
- 完整链路: ✅ 无断裂

---

## 额外发现（可用于薪酬差异化）

1. TeacherAssignment.role: PRIMARY / SUBSTITUTE / ASSISTANT → 不同角色可设不同薪酬系数
2. Lesson.isMakeup: boolean → 补课可设额外薪酬规则
3. Lesson.confirmedBy / confirmedAt: 课时确认链路 → 已确认课时才计入薪酬
4. AttendanceStatus: DEDUCTIBLE_STATUSES (PRESENT/LATE/ONLINE/OFFLINE) → 有效出勤定义已明确
5. Contract.unitPrice: 学生侧课时单价 → 可作为教师薪酬定价参考

---

## 结论

- 教师完成课程数量: ✅ 可统计（Lesson.teacherId + status='FINISHED'）
- 周期内授课次数: ✅ 可统计（Lesson.scheduledDate 支持日期范围查询）
- 不同课程类型: ✅ 可区分（Course.type: INDIVIDUAL/GROUP/TRIAL/CAMP）
- 固定课时费: ✅ 支持（底层数据齐全，费率需新建）
- 底薪+课时费: ✅ 支持（底层数据齐全，薪酬参数需新建）
- 阶梯课时费: ✅ 支持（底层数据齐全，阶梯规则需新建）
- Overall: ✅ ALL READY（数据层100%就绪，薪酬配置层需后续开发）

---

## 缺失数据（薪酬配置层 — 非阻塞）

1. 教师薪酬费率表: 不存在（需新建 teacher_salary_rate 或 salary_config Entity）
2. 教师等级/职称: User Entity 无此字段（如需按等级定薪需新增）
3. 薪酬结算周期: 无显式 SettlementPeriod 概念（底层日期数据齐全）
4. 奖惩记录: 不存在（可作为后续扩展）

---

## 建议

1. 薪酬模块开发时，优先实现 findByTeacherAndDateRange 聚合查询（底层数据已齐全）
2. 新建 salary_config Entity 包含：teacherId + baseSalary + rate + tierRates + settlementPeriod
3. 利用 Course.type 实现差异化课时费率（INDIVIDUAL vs GROUP 不同单价）
4. 利用 TeacherAssignment.role 实现角色差异化薪酬（PRIMARY vs SUBSTITUTE vs ASSISTANT）
5. 利用 Lesson.confirmedBy/confirmedAt 实现"已确认课时才计入薪酬"的业务规则
