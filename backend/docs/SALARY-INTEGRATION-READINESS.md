# 薪酬计算前置接口评估报告

## 评估时间
2026-07-24

## 评估范围
- 课时统计接口
- 教师授课统计接口
- 结算周期查询接口

## 评估原则
没有真实需求不新增。只确认未来 SalaryRuleEngine 所需数据是否可从现有接口获取。

---

## 现有接口清单

### Analytics 模块 (`/analytics`)
- `GET /analytics/teacher/:teacherId` — 教师指标（teachingCount/classCount/studentCount）
- `GET /analytics/teacher/:teacherId/trend?days=N` — 教师趋势（每日课时数 + 出勤率，最近 N 天）
- `GET /analytics/student/:studentCode` — 学生指标
- `GET /analytics/institution` — 机构指标

### Teacher Dashboard 模块 (`/teacher`)
- `GET /teacher/dashboard` — 教师仪表盘（todayLessons/pendingAttendance/totalStudents/activeClasses）

### Lesson 模块 (`/classes/:code/lessons`)
- `GET /classes/:code/lessons` — 班级课时列表（分页，含 status 字段）
- `GET /classes/:code/lessons/:lessonNumber` — 单个课时详情

### Lesson Attendance 模块
- `GET /lessons/:id/attendance` — 课时出勤记录
- `GET /students/:studentCode/attendance` — 学生出勤记录

---

## 评估结果

### 1. 课时统计接口

**现有能力：**
- 按教师查询课时总数: ✅ `GET /analytics/teacher/:teacherId` → `teachingCount`
- 按时间范围查询: ⚠️ 部分支持 — `trend?days=N` 支持最近 N 天，但不支持绝对日期范围（如 2026-07-01 ~ 2026-07-31）
- 按状态过滤: ❌ 不支持 — `teachingCount` 统计所有状态（DRAFT/SCHEDULED/TEACHING/FINISHED/ARCHIVED/CANCELLED），无法只统计 FINISHED

**薪酬计算需求：**
- 需要统计"某教师在某结算周期内已完成的课时数"
- 只有 FINISHED 或 ARCHIVED 状态的课时才应计入薪酬
- 需要精确日期范围（如月度结算：2026-07-01 ~ 2026-07-31）

**Gap 分析：**
- `teachingCount` 是全局总数，无日期过滤 → 不可用于薪酬
- `trend?days=N` 有日期过滤但无状态过滤 → 不可用于薪酬
- 两者组合也无法满足需求（trend 返回的是每日数组，需客户端聚合，且包含所有状态）

**Status: ❌ NEEDS NEW API**

---

### 2. 教师授课统计接口

**现有能力：**
- 教师总授课次数: ✅ `GET /analytics/teacher/:teacherId` → `teachingCount`
- 教师总班级数: ✅ `GET /analytics/teacher/:teacherId` → `classCount`
- 教师总学生数: ✅ `GET /analytics/teacher/:teacherId` → `studentCount`
- 按班级统计: ⚠️ 间接支持 — `GET /classes/:code/lessons` 可获取某班级课时列表，但需先知道 classCode
- 按课程统计: ❌ 不支持 — 无接口直接按 courseCode 聚合教师课时
- 按角色统计: ❌ 不支持 — 无接口按 TeacherRole 聚合

**薪酬计算需求：**
- 可能需要按班级/课程维度统计（不同班级/课程可能有不同课时单价）
- 需要区分主讲/助教（不同角色不同薪酬标准）

**Gap 分析：**
- 现有接口提供教师级聚合数据，不提供班级/课程级明细
- 如需按班级统计薪酬，需遍历教师所有班级的课时列表，客户端聚合
- 理论上可通过组合现有接口实现（先获取教师分配的班级 → 逐班查询课时 → 客户端过滤状态 + 聚合），但效率极低

**Status: ⚠️ CONDITIONALLY SUFFICIENT**
- MVP 阶段：如果薪酬按"总课时数 × 统一单价"计算，现有接口组合可满足（需新增状态过滤）
- 进阶阶段：如果薪酬按"不同班级/课程/角色 × 不同单价"计算，需要新增明细统计接口

---

### 3. 结算周期查询接口

**现有能力：**
- 按月统计: ⚠️ 间接支持 — `trend?days=30` 可近似月度，但不精确（是"最近30天"而非"本月"）
- 按周统计: ⚠️ 间接支持 — `trend?days=7` 可近似周度
- 自定义周期: ❌ 不支持 — 无 `startDate`/`endDate` 参数

**薪酬计算需求：**
- 需要定义结算周期（月度/周度/自定义）
- 需要查询某周期内的课时统计数据
- 需要支持"结算周期"概念（开始日期、结束日期、状态）

**Gap 分析：**
- 现有 `trend` API 使用相对天数（days=N），不支持绝对日期范围
- 无结算周期实体（SettlementPeriod）
- 薪酬计算需要精确的日期范围查询

**Status: ❌ NEEDS NEW API**

---

## 结论

- 课时统计接口: ❌ NEEDS NEW API（缺少状态过滤 + 精确日期范围）
- 教师授课统计接口: ⚠️ CONDITIONALLY SUFFICIENT（MVP 统一单价可接受，进阶需新增）
- 结算周期查询接口: ❌ NEEDS NEW API（缺少绝对日期范围查询）
- Overall: ❌ NEEDS NEW APIS

---

## 需要新增的接口（最小集）

### 1. 教师课时统计接口（薪酬专用）

**用途:** 统计某教师在指定日期范围内已完成（FINISHED/ARCHIVED）的课时数

**设计建议:**
```
GET /analytics/teacher/:teacherId/lesson-stats?startDate=2026-07-01&endDate=2026-07-31

Response:
{
  "teacherId": 1,
  "period": { "start": "2026-07-01", "end": "2026-07-31" },
  "completedLessons": 24,      // FINISHED + ARCHIVED 状态
  "cancelledLessons": 2,       // CANCELLED 状态
  "totalStudents": 156,        // 这些课时的出勤学生总数
  "byClass": [                 // 按班级分组
    { "classCode": "MATH-101", "completedLessons": 12, "totalStudents": 80 },
    { "classCode": "MATH-102", "completedLessons": 12, "totalStudents": 76 }
  ]
}
```

**实现复杂度:** 低（基于现有 LessonRepository + LessonAttendanceRepository 查询）

**优先级:** P1（薪酬计算核心依赖）

### 2. 结算周期查询接口（可选，MVP 后可实现）

**用途:** 定义和查询结算周期

**设计建议:**
```
GET /analytics/settlement-periods?teacherId=1&year=2026&month=7

Response:
{
  "periods": [
    {
      "id": 1,
      "name": "2026年7月",
      "startDate": "2026-07-01",
      "endDate": "2026-07-31",
      "status": "OPEN"  // OPEN / CLOSED / SETTLED
    }
  ]
}
```

**实现复杂度:** 中（需要新增 SettlementPeriod 实体 + CRUD）

**优先级:** P2（MVP 阶段可用固定月度周期，无需实体化）

---

## 不需要新增的接口

1. **教师总览统计** — 现有 `GET /analytics/teacher/:teacherId` 已满足（teachingCount/classCount/studentCount）
2. **课时列表查询** — 现有 `GET /classes/:code/lessons` 已满足（分页 + 状态字段）
3. **出勤记录查询** — 现有 `GET /lessons/:id/attendance` 和 `GET /students/:studentCode/attendance` 已满足

---

## 实施建议

### MVP 阶段（当前）
- 不开发完整工资系统
- 不新增结算周期实体
- 只新增 1 个接口：`GET /analytics/teacher/:teacherId/lesson-stats`
- 该接口可被未来 SalaryRuleEngine 直接调用

### 进阶阶段（真实需求出现后）
- 新增 SettlementPeriod 实体
- 新增结算周期 CRUD 接口
- 新增按课程/角色维度的薪酬明细统计

---

## 验证方法

未来开发 `GET /analytics/teacher/:teacherId/lesson-stats` 时，验证标准：
1. 返回的 `completedLessons` 只统计 FINISHED + ARCHIVED 状态
2. 支持绝对日期范围（startDate/endDate）
3. `byClass` 分组与数据库实际记录一致
4. 接口响应时间 < 200ms（1000 条课时数据）
