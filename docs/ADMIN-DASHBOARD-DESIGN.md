# Admin Dashboard Design

## 概述
管理员经营视角 Dashboard，展示机构运行状态。Dashboard **只展示业务事实**，数据直接来源于现有业务模块表结构，禁止前端自行计算、创建独立统计真值、绕过业务模块。

**核心原则**：
- 所有指标必须标注数据来源表和字段
- 严禁创建中间统计表
- 数据以业务模块现有表为准，不做二次聚合持久化
- 查询使用聚合函数，避免全表扫描

---

## 指标定义

### 1. 今日运营

#### 1.1 今日课程数量
- **数据来源**: `lesson` 表
- **查询条件**: `scheduledDate = CURDATE()`
- **说明**: 统计当天已排课的所有课程数量，无论状态（DRAFT / SCHEDULED / TEACHING / FINISHED / CANCELLED 等），反映当日排课总量。
- **SQL 示例**:
  ```sql
  SELECT COUNT(*) AS totalLessons
  FROM lesson
  WHERE scheduledDate = CURDATE();
  ```
- **索引建议**: 在 `lesson.scheduledDate` 上已有 `@Index()` 注解，无需额外索引。

#### 1.2 完成课程数量
- **数据来源**: `lesson` 表
- **查询条件**: `status = 'FINISHED'`, `scheduledDate = CURDATE()`
- **说明**: 统计当天已完成（教师确认结课）的课程数量。
- **SQL 示例**:
  ```sql
  SELECT COUNT(*) AS completedLessons
  FROM lesson
  WHERE status = 'FINISHED'
    AND scheduledDate = CURDATE();
  ```
- **索引建议**: `lesson` 表已对 `status` 和 `scheduledDate` 分别建索引；联合查询可考虑复合索引 `(scheduledDate, status)`。

#### 1.3 请假数量
- **数据来源**: `lesson_exceptions` 表
- **查询条件**: `exceptionType IN ('LEAVE_SICK', 'LEAVE_PERSONAL')`, `DATE(startTime) = CURDATE()`, `status = 'APPROVED'`
- **说明**: 统计当天已审批通过的病假（LEAVE_SICK）和事假（LEAVE_PERSONAL）总数。仅统计已审批的记录，避免未审批数据干扰运营视图。
- **SQL 示例**:
  ```sql
  SELECT COUNT(*) AS leaveCount
  FROM lesson_exceptions
  WHERE exceptionType IN ('LEAVE_SICK', 'LEAVE_PERSONAL')
    AND DATE(startTime) = CURDATE()
    AND status = 'APPROVED';
  ```
- **索引建议**: `lesson_exceptions` 表已有 `idx_exception_type`、`idx_status`、`idx_created_at` 单列索引；建议增加复合索引 `(exceptionType, status, startTime)` 以覆盖查询。

#### 1.4 消耗课时
- **数据来源**: `contract` 表
- **查询条件**: `status = 'ACTIVE'`
- **计算方式**: `SUM(totalLessons - remainingLessons)`，即所有有效合同中已消耗的课时总和。
- **说明**: 差值代表机构已交付的课时总量（扣课总数）。**不在前端计算差值**，由后端聚合后返回。
- **SQL 示例**:
  ```sql
  SELECT SUM(totalLessons - remainingLessons) AS consumedLessons
  FROM contract
  WHERE status = 'ACTIVE';
  ```
- **索引建议**: 在 `contract.status` 上已有 `@Index()` 注解。
- **注意**: 精确的单个课时消耗应通过 `HoursLedger`（课时流水表）追溯，此指标作为运营层面宏观参考值。

---

### 2. 学员情况

#### 2.1 学员总数
- **数据来源**: `student` 表
- **查询条件**: `status = 'ACTIVE'`
- **说明**: 当前状态为"在读（ACTIVE）"的学员总数。已毕业（GRADUATED）、暂停（PAUSED）、停用（INACTIVE）不纳入。
- **SQL 示例**:
  ```sql
  SELECT COUNT(*) AS totalStudents
  FROM student
  WHERE status = 'ACTIVE';
  ```
- **索引建议**: `student.status` 已有 `@Index()` 注解。

#### 2.2 新增学生
- **数据来源**: `student` 表
- **查询条件**: `DATE(createTime) = CURDATE()`
- **说明**: 统计今天新注册/创建的学员数量，按创建时间（createTime）计算，不受 status 过滤。
- **SQL 示例**:
  ```sql
  SELECT COUNT(*) AS newToday
  FROM student
  WHERE DATE(createTime) = CURDATE();
  ```
- **索引建议**: `student.createTime` 无自动索引，建议新增索引以优化按日统计查询。

#### 2.3 剩余课时
- **数据来源**: `contract` 表
- **查询条件**: `status = 'ACTIVE'`
- **计算方式**: `SUM(remainingLessons)`
- **说明**: 所有有效合同（ACTIVE）的剩余课时总和，反映机构未交付课时总量。
- **SQL 示例**:
  ```sql
  SELECT SUM(remainingLessons) AS remainingLessons
  FROM contract
  WHERE status = 'ACTIVE';
  ```
- **索引建议**: 在 `contract.status` 上已有 `@Index()` 注解。

---

### 3. 教师情况

#### 3.1 授课数量
- **数据来源**: `lesson` 表
- **查询条件**: `status = 'FINISHED'`, `scheduledDate = CURDATE()`
- **计算方式**: 按 `teacherId` 分组统计完成的课程数量。
- **说明**: 统计当天每位教师完成的课程数，反映当日教师工作量。也可聚合为数组/列表供前端展示 Top 教师。
- **SQL 示例**:
  ```sql
  SELECT teacherId, COUNT(*) AS teachingCount
  FROM lesson
  WHERE status = 'FINISHED'
    AND scheduledDate = CURDATE()
  GROUP BY teacherId;
  ```
- **索引建议**: 推荐复合索引 `(scheduledDate, status, teacherId)`。

#### 3.2 工资统计
- **数据来源**: `salary_record` 表
- **查询条件**: `lessonDate` 属于当月，`status` 为已确认/已支付（CONFIRMED / PAID）
- **计算方式**: `SUM(amount)`
- **说明**: 统计当月（按 lessonDate 归属）所有已确认的教师工资总额。
- **SQL 示例**:
  ```sql
  SELECT SUM(amount) AS monthlySalary
  FROM salary_record
  WHERE DATE_FORMAT(lessonDate, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    AND status IN ('CONFIRMED', 'PAID');
  ```
- **索引建议**: `salary_record` 表已有 `lessonDate` 和 `status` 索引；建议复合索引 `(lessonDate, status)`。

---

### 4. 财务情况

#### 4.1 收入
- **数据来源**: `payment` 表
- **查询条件**: `DATE(PayTime) = CURDATE()` (依据 Data Dictionary Payment 表 PayTime 字段)
- **计算方式**: `SUM(Amount)`（所有状态为已支付/成功的记录）
- **说明**: 统计当天所有已支付的收费记录总额。
- **SQL 示例**:
  ```sql
  SELECT SUM(Amount) AS todayIncome
  FROM payment
  WHERE DATE(PayTime) = CURDATE()
    AND Status = 1;  -- 1 = 已支付
  ```
- **索引建议**: `payment` 表建议在 `PayTime`、`Status` 上建索引。
- **说明**: 实际项目中若 `payment` 实体的状态枚举不同，请根据业务调整 Status 过滤条件。

#### 4.2 课时消耗价值
- **数据来源**: `contract` 表
- **计算方式**: `SUM((totalLessons - remainingLessons) * unitPrice)`
- **说明**: 基于有效合同（ACTIVE）计算已消耗课时对应的货币价值（已消耗课时 × 单价）。反映机构已交付但可能尚未确认收入的课时价值。
- **SQL 示例**:
  ```sql
  SELECT SUM((totalLessons - remainingLessons) * unitPrice) AS consumedValue
  FROM contract
  WHERE status = 'ACTIVE';
  ```
- **索引建议**: 在 `contract.status` 上已有 `@Index()` 注解。
- **注意**: 该值为参考性运营指标，实际收入确认以 `payment` 表流水为准。

---

## API 设计

### GET /dashboard/overview
**权限**: `ADMIN`
**URL**: `/dashboard/overview`
**说明**: 总览接口，聚合所有模块的核心指标一次返回。
**响应**:
```json
{
  "today": {
    "totalLessons": 10,
    "completedLessons": 8,
    "leaveCount": 2,
    "consumedLessons": 15
  },
  "students": {
    "total": 100,
    "newToday": 3,
    "remainingLessons": 500
  },
  "teachers": {
    "teachingCount": 5,
    "monthlySalary": 50000.00
  },
  "finance": {
    "todayIncome": 10000.00,
    "consumedValue": 15000.00
  }
}
```

### GET /dashboard/lessons
**权限**: `ADMIN`
**URL**: `/dashboard/lessons`
**说明**: 课程统计接口，仅返回今日运营相关指标。
**响应**:
```json
{
  "totalLessons": 10,
  "completedLessons": 8,
  "leaveCount": 2,
  "consumedLessons": 15
}
```

### GET /dashboard/students
**权限**: `ADMIN`
**URL**: `/dashboard/students`
**说明**: 学员统计接口，仅返回学员相关指标。
**响应**:
```json
{
  "total": 100,
  "newToday": 3,
  "remainingLessons": 500
}
```

### GET /dashboard/teachers
**权限**: `ADMIN`
**URL**: `/dashboard/teachers`
**说明**: 教师统计接口。返回当日每位教师的授课数列表及当月工资总额。
**响应**:
```json
{
  "teacherLessonCounts": [
    { "teacherId": 1, "teachingCount": 3 },
    { "teacherId": 2, "teachingCount": 2 }
  ],
  "monthlySalary": 50000.00
}
```

### GET /dashboard/finance
**权限**: `ADMIN`
**URL**: `/dashboard/finance`
**说明**: 财务统计接口，仅返回财务相关指标。
**响应**:
```json
{
  "todayIncome": 10000.00,
  "consumedValue": 15000.00
}
```

---

## 权限控制

- 所有 `/dashboard/*` 接口均使用 `@Roles('ADMIN')` 装饰器
- 非 ADMIN 角色（如教师、家长）禁止访问，返回 `403 Forbidden`
- 实现上应用 NestJS 的 `RolesGuard` 配合 `@SetMetadata('roles', ['ADMIN'])` 或自定义装饰器
- 参考现有 `roles.decorator.ts` 实现：

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// src/common/guards/roles.guard.ts 中检查 user.role 是否在允许列表中
```

---

## 性能考虑

### 索引设计总结

| 表 | 推荐索引 | 说明 |
|------|---------|------|
| `lesson` | `(scheduledDate, status)` 复合索引 | 覆盖今日课程 & 完成课程查询 |
| `lesson` | `(scheduledDate, status, teacherId)` 复合索引 | 覆盖教师授课统计 |
| `lesson_exceptions` | `(exceptionType, status, startTime)` 复合索引 | 覆盖请假统计 |
| `student` | `(createTime)` 索引 | 优化新增学生按日统计 |
| `payment` | `(PayTime, Status)` 复合索引 | 优化当日收入统计 |

### 查询优化
- 所有统计使用 `COUNT(*)`、`SUM()` 等聚合函数，避免逐行读取
- 避免复杂 JOIN，每个指标独立查询
- 对于高频访问场景，可考虑使用 Redis 缓存（过期时间 5-10 分钟），但需确保缓存与业务数据一致性

### 缓存策略（可选）
```
Key: dashboard:overview
TTL: 300s（5分钟）
说明：5分钟内多次请求命中缓存，减少数据库压力
```

---

## 数据来源汇总

| 模块 | 表名 | 实体 | 使用指标 |
|------|------|------|---------|
| 课程 | `lesson` | `LessonEntity` | 今日课程数、完成课程数、授课数量 |
| 请假 | `lesson_exceptions` | `LessonExceptionEntity` | 请假数量 |
| 合同 | `contract` | `ContractEntity` | 消耗课时、剩余课时、课时消耗价值 |
| 学员 | `student` | `Student` | 学员总数、新增学生 |
| 工资 | `salary_record` | `SalaryRecordEntity` | 工资统计 |
| 收费 | `payment` | （待创建） | 收入 |

---

## 后续扩展

- **时间范围筛选**: 在 API 中增加 `startDate`、`endDate` 参数，支持按日/周/月/自定义范围查询
- **导出报表**: 提供 CSV/Excel 导出接口，支持定时邮件推送
- **图表展示**: 前端使用 ECharts / Chart.js 等库展示趋势图（折线图、柱状图）
- **数据对比**: 增加环比（昨日/上周同期）维度，辅助运营决策
- **实时推送**: 通过 WebSocket 推送关键指标更新（如今日收入变化）
- **多校区**: 若系统支持多校区，增加 `campusId` 维度筛选
