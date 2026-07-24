# 教师薪酬数据源分析报告

## 分析时间
2026-07-24

## 分析范围
- User Entity（教师身份载体）
- TeacherAssignment Entity（教师-班级关联）
- Class Entity（班级）
- Course Entity（课程）
- Lesson Entity（课时）
- LessonAttendance Entity（考勤）
- Contract Entity（合同）
- Enrollment Entity（报名）
- Student Entity（学生，辅助参考）

---

## 数据源分析

### 1. User Entity（教师身份）
**文件路径**: `src/modules/identity/entities/user.entity.ts`

**字段清单**:
- id: bigint（主键）
- username: varchar(50)，唯一
- password: varchar(255)，select: false
- mobile: varchar(20)，唯一
- openid: varchar(100)，可空
- unionid: varchar(100)，可空
- name: varchar(50)
- role: enum（SuperAdmin / Admin / Teacher / Parent）
- status: tinyint（ACTIVE=1 / INACTIVE=0 / DISABLED=-1）
- campusId: bigint，默认 0
- avatar: varchar(255)，可空
- lastLoginAt: timestamp，可空
- refreshToken: varchar(255)，可空
- refreshTokenExpiresAt: timestamp，可空
- createTime / updateTime / version / deleted

**薪资相关字段**: 无
- 无底薪字段
- 无课时单价字段
- 无薪资等级字段
- 无银行账号字段

**关联关系**:
- 与 TeacherAssignment: User.id = TeacherAssignment.teacherId
- 与 Lesson: User.id = Lesson.teacherId
- 与 LessonAttendance: User.id = LessonAttendance.teacherId / operator

**薪酬计算用途**:
- 提供教师身份标识（id, name）
- role=Teacher 筛选教师用户
- 作为薪酬归属的主体（教师 ID 贯穿所有薪酬相关实体）

---

### 2. TeacherAssignment Entity（教师-班级分配）
**文件路径**: `src/modules/teaching/teacher-assignment/teacher-assignment.entity.ts`

**字段清单**:
- id: bigint（主键）
- classCode: varchar(20)
- teacherId: bigint
- role: enum（PRIMARY / SUBSTITUTE / ASSISTANT）
- effectiveFrom: date
- effectiveTo: date，可空
- assignedBy: bigint
- reason: varchar(200)，可空
- createTime: timestamp
- 唯一约束: (classCode, teacherId, role)

**薪资相关字段**: 无

**关联关系**:
- 与 Class: TeacherAssignment.classCode = Class.classCode
- 与 User（教师）: TeacherAssignment.teacherId = User.id

**薪酬计算用途**:
- 确定教师在班级中的角色（主讲/代课/助教）
- 不同角色可能对应不同薪酬标准
- effectiveFrom/effectiveTo 确定薪酬生效时间范围
- 是"某教师在某班级教课"的权威数据源

---

### 3. Class Entity（班级）
**文件路径**: `src/modules/teaching/class/class.entity.ts`

**字段清单**:
- id: bigint（主键）
- classCode: varchar(20)，唯一
- courseCode: varchar(20)
- name: varchar(100)
- status: enum（DRAFT / ACTIVE / COMPLETED / CANCELLED）
- startDate: date
- totalLessons: int
- defaultDuration: int，默认 60（分钟）
- dayOfWeek: simple-json（number[]）
- startTime: varchar(5)
- endTime: varchar(5)
- maxStudents: int，默认 20
- room: varchar(100)，可空
- tags: simple-json，可空
- note: text，可空
- cancelledReason: text，可空
- createdBy / updatedBy / createTime / updateTime / version / deleted

**薪资相关字段**: 无
- 无班级课时费字段
- 无教师薪酬配置

**关联关系**:
- 与 Course: Class.courseCode = Course.courseCode
- 与 TeacherAssignment: Class.classCode = TeacherAssignment.classCode
- 与 Lesson: Lesson.classCode = Class.classCode
- 与 Enrollment: Enrollment.classCode = Class.classCode

**薪酬计算用途**:
- 班级是课时（Lesson）的容器，间接关联薪酬
- Class.status 可过滤有效班级的课时
- Class.totalLessons 可用于核算预期课时量

---

### 4. Course Entity（课程）
**文件路径**: `src/modules/teaching/course/course.entity.ts`

**字段清单**:
- id: bigint（主键）
- courseCode: varchar(20)，唯一
- name: varchar(100)
- subject: enum（Subject）
- type: enum（CourseType）
- description: text，可空
- totalHours: decimal(6,1)
- totalLessons: int
- defaultDuration: int
- status: enum（DRAFT / ...）
- tags: simple-json，可空
- coverImage: varchar(500)，可空
- note: text，可空
- createdBy / updatedBy / createTime / updateTime / version / deleted

**价格相关字段**: 无
- Course 没有价格字段
- 价格信息在 Contract 层（unitPrice / totalAmount）

**关联关系**:
- 与 Class: Course.courseCode = Class.courseCode
- 与 Lesson: Lesson.courseCode = Course.courseCode

**薪酬计算用途**:
- Course.type 可能影响薪酬标准（如一对一 vs 班课）
- Course.subject 可能影响薪酬系数
- Course 本身不直接提供薪酬计算数据

---

### 5. Lesson Entity（课时）⭐ 核心
**文件路径**: `src/modules/teaching/lesson/lesson.entity.ts`

**字段清单**:
- id: bigint（主键）
- classCode: varchar(20)
- courseCode: varchar(20)
- lessonNumber: int
- status: enum（DRAFT / SCHEDULED / TEACHING / FINISHED / ARCHIVED / CANCELLED）
- scheduledDate: date
- startTime: varchar(5)
- endTime: varchar(5)
- teacherId: bigint
- actualStartTime: timestamp，可空
- actualEndTime: timestamp，可空
- note: text，可空
- cancelledReason: text，可空
- isMakeup: boolean，默认 false
- originLessonId: bigint，可空
- changeRequestId: bigint，可空
- confirmedBy: bigint，可空
- confirmedAt: timestamp，可空
- createdBy: bigint
- createdAt: timestamp
- 唯一约束: (classCode, lessonNumber)

**课时费相关字段**: 无
- 无课时单价字段
- 无课时费总额字段
- 无薪酬计算字段

**状态字段**:
- DRAFT: 草稿
- SCHEDULED: 已排课
- TEACHING: 授课中
- FINISHED: 已完成
- ARCHIVED: 已归档
- CANCELLED: 已取消

**关联关系**:
- 与 User（教师）: Lesson.teacherId = User.id
- 与 Class: Lesson.classCode = Class.classCode
- 与 Course: Lesson.courseCode = Course.courseCode
- 与 LessonAttendance: LessonAttendance.lessonId = Lesson.id

**薪酬计算用途**:
- **课时是薪酬计算的核心驱动实体**
- 每条 Lesson 代表教师的一次授课记录
- Lesson.teacherId 确定薪酬归属
- Lesson.status = FINISHED 的课时可作为薪酬计算依据
- Lesson.scheduledDate 确定薪酬所属周期
- Lesson.actualStartTime/actualEndTime 可计算实际授课时长
- Lesson.isMakeup 标记补课（可能影响薪酬规则）

---

### 6. LessonAttendance Entity（考勤）⭐ 核心
**文件路径**: `src/modules/teaching/lesson-attendance/lesson-attendance.entity.ts`

**字段清单**:
- id: bigint（主键）
- lessonId: bigint
- studentCode: varchar(20)
- classCode: varchar(20)
- teacherId: bigint
- workflowState: enum（PENDING / CHECKED_IN / CONFIRMED / LOCKED）
- status: enum，可空（PRESENT / ABSENT / LATE / LEAVE / MAKEUP / ONLINE / OFFLINE）
- checkInTime: timestamp，可空
- reason: text，可空
- operator: bigint
- source: enum（MANUAL / SELF_CHECK_IN / API / IMPORT）
- note: text，可空
- createdBy: bigint
- createdAt / updatedAt: timestamp
- 唯一约束: (lessonId, studentCode)

**状态字段（二维设计）**:

**生命周期维度（workflowState）**:
- PENDING: 待处理
- CHECKED_IN: 已签到
- CONFIRMED: 已确认
- LOCKED: 已锁定

**数据维度（status）**:
- PRESENT: 到课（扣课时）
- ABSENT: 缺勤（不扣课时）
- LATE: 迟到（扣课时）
- LEAVE: 请假（不扣课时）
- MAKEUP: 补课（不扣课时）
- ONLINE: 线上课（扣课时）
- OFFLINE: 线下课（扣课时）

**可扣课时状态（DEDUCTIBLE_STATUSES）**:
- PRESENT, LATE, ONLINE, OFFLINE

**关联关系**:
- 与 Lesson: LessonAttendance.lessonId = Lesson.id
- 与 Student: LessonAttendance.studentCode = Student.studentCode
- 与 User（教师）: LessonAttendance.teacherId = User.id

**薪酬计算用途**:
- 考勤是薪酬计算的关键验证数据
- workflowState = LOCKED 的考勤记录可作为最终薪酬依据
- 到课学生数（PRESENT/LATE/ONLINE/OFFLINE）可验证教师实际工作量
- 如果薪酬按"到课学生数 × 单价"计算，Attendance 是核心数据源
- 如果薪酬按"课时数 × 单价"计算，Attendance 是辅助验证

---

### 7. Contract Entity（合同）
**文件路径**: `src/modules/teaching/contract/contract.entity.ts`

**字段清单**:
- id: bigint（主键）
- contractCode: varchar(20)，唯一
- studentCode: varchar(20)
- subject: enum（Subject）
- totalLessons: int
- remainingLessons: int
- status: enum（ACTIVE / EXHAUSTED / EXPIRED / REFUNDED / FROZEN）
- validFrom: date
- validTo: date，可空
- unitPrice: decimal(10,2)，可空
- totalAmount: decimal(10,2)，可空
- note: text，可空
- tags: simple-json，可空
- createdBy: bigint
- createdAt: timestamp

**金额相关字段**:
- unitPrice: decimal(10,2) — 单课时价格（学生侧，非教师薪酬）
- totalAmount: decimal(10,2) — 合同总金额（学生侧，非教师薪酬）

**关联关系**:
- 与 Student: Contract.studentCode = Student.studentCode
- 与 Enrollment: Enrollment.contractCode = Contract.contractCode

**薪酬计算用途**:
- Contract 的金额字段是学生侧收费，不是教师薪酬
- 但 Contract.unitPrice 可作为薪酬计算的参考（如教师课时费 = 学生单价 × 比例）
- Contract.totalLessons / remainingLessons 可推算已消耗课时
- Contract.status 可过滤有效合同

---

### 8. Enrollment Entity（报名）
**文件路径**: `src/modules/teaching/enrollment/enrollment.entity.ts`

**字段清单**:
- id: bigint（主键）
- classCode: varchar(20)
- studentCode: varchar(20)
- contractCode: varchar(20)
- status: enum（ACTIVE / WITHDRAWN / COMPLETED）
- withdrawReason: text，可空
- enrolledBy: bigint
- enrolledAt: timestamp
- 唯一约束: (classCode, studentCode)

**薪资相关字段**: 无

**关联关系**:
- 与 Class: Enrollment.classCode = Class.classCode
- 与 Student: Enrollment.studentCode = Student.studentCode
- 与 Contract: Enrollment.contractCode = Contract.contractCode

**薪酬计算用途**:
- Enrollment 是"学生-班级-合同"的桥接表
- 可用于计算某教师某班级的实际学生数
- Enrollment.status = ACTIVE 的记录可确认班级实际人数
- 如果薪酬与班级人数挂钩，Enrollment 是数据来源

---

## 薪酬计算数据链路

### 数据来源链路
```
TeacherAssignment（教师-班级-角色分配）
  ↓
Lesson（课时记录：教师 + 班级 + 日期 + 状态）
  ↓
LessonAttendance（考勤确认：学生到课情况）
  ↓
[薪酬计算引擎 — 待建设]
  ↓
[薪酬结算记录 — 待建设]
```

### 辅助数据链路
```
Contract（学生合同：单价/总额）→ 可作薪酬参考
Enrollment（报名记录：班级人数）→ 可算实际学生数
Course（课程信息：类型/科目）→ 可影响薪酬系数
```

### 现有系统可直接使用的薪酬数据
1. **教师授课课时数**: Lesson 表，status = FINISHED，按 teacherId 分组计数
2. **教师授课时长**: Lesson 表，actualStartTime → actualEndTime 差值
3. **教师班级分配**: TeacherAssignment 表，role 区分主讲/代课/助教
4. **到课学生数**: LessonAttendance 表，workflowState = LOCKED，status ∈ DEDUCTIBLE_STATUSES
5. **补课课时数**: Lesson 表，isMakeup = true
6. **课时所属周期**: Lesson.scheduledDate

---

## 缺失字段分析

### 薪酬计算需要但现有系统缺失的字段

#### Teacher/User 层面
1. ❌ 教师底薪（baseSalary）
2. ❌ 教师课时单价（hourlyRate）— 按角色/科目/课程类型可能不同
3. ❌ 教师薪资等级（salaryLevel）
4. ❌ 教师银行账户信息
5. ❌ 教师薪酬计算规则（固定/提成/混合）

#### Lesson 层面
6. ❌ 课时费金额（lessonFee）— 可在计算时动态生成，但无存储
7. ❌ 薪酬结算状态（settled/unsettled）
8. ❌ 薪酬结算批次号（settlementBatchId）

#### TeacherAssignment 层面
9. ❌ 该分配对应的课时单价（可能不同班级不同单价）
10. ❌ 薪酬生效规则

#### Course 层面
11. ❌ 课程教师成本价（teacherCost）
12. ❌ 课程类型对应的薪酬系数

#### 新增实体需求
13. ❌ SalaryRule Entity — 薪酬规则配置
14. ❌ SalaryRecord Entity — 薪酬计算记录
15. ❌ Settlement Entity — 薪酬结算单
16. ❌ SettlementDetail Entity — 结算明细

---

## 结论

### 现有系统支持情况
- ✅ **教师身份识别**: User(role=Teacher) + TeacherAssignment 完整
- ✅ **课时记录**: Lesson 完整记录了教师、班级、日期、状态
- ✅ **考勤数据**: LessonAttendance 二维状态设计完善，可精确统计到课情况
- ✅ **课时状态管理**: LessonStatus 六状态流转清晰（FINISHED 可作为薪酬计算触发点）
- ✅ **班级-教师关联**: TeacherAssignment 含角色（PRIMARY/SUBSTITUTE/ASSISTANT）和有效期
- ✅ **班级学生数**: Enrollment + LessonAttendance 可计算实际到课人数
- ⚠️ **课程价格**: Contract 有 unitPrice/totalAmount，但这是学生侧收费，非教师薪酬
- ⚠️ **课程类型**: Course.type 存在，但未与薪酬系数关联
- ❌ **教师薪酬标准**: 完全缺失，无任何薪资相关字段
- ❌ **薪酬计算规则**: 完全缺失，无薪酬规则实体
- ❌ **薪酬结算记录**: 完全缺失，无结算实体
- ❌ **薪酬历史追溯**: 完全缺失

### 薪酬计算可行性
- **现有系统可支持"课时统计"**：可以精确统计某教师某周期内的 FINISHED 课时数、到课学生数、补课次数
- **现有系统不可支持"薪酬计算"**：缺少薪酬标准、薪酬规则、结算记录
- **需要新建的实体**: SalaryRule（薪酬规则）、SalaryRecord（薪酬记录）、Settlement（结算单）
- **需要扩展的字段**: User/TeacherAssignment 需增加薪酬相关字段

### 建议
1. **Phase 1 优先建设薪酬规则模型（SalaryRule）**: 支持多种薪酬模式（固定课时费 / 到课人数提成 / 混合模式），与 TeacherAssignment 关联
2. **Phase 2 建设薪酬计算引擎**: 基于 Lesson(FINISHED) + LessonAttendance(LOCKED) 自动计算薪酬，生成 SalaryRecord
3. **Phase 3 建设薪酬结算流程**: Settlement 实体 + 审批流程 + 历史记录
4. **数据迁移策略**: 现有 Lesson + Attendance 数据可直接复用，无需迁移；只需在计算层新增规则即可回溯历史课时

---

## 附录：实体关系图（文本）
```
User (Teacher)
  │
  ├──< TeacherAssignment (classCode, teacherId, role)
  │       │
  │       └──> Class (classCode, courseCode)
  │               │
  │               ├──< Lesson (classCode, teacherId, status)
  │               │       │
  │               │       └──< LessonAttendance (lessonId, studentCode, status, workflowState)
  │               │
  │               └──< Enrollment (classCode, studentCode, contractCode)
  │                       │
  │                       └──> Contract (contractCode, studentCode, unitPrice, totalAmount)
  │
  └──< Course (courseCode) — via Class.courseCode or Lesson.courseCode
```
