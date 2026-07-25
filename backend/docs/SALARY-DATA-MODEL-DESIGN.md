# 工资数据模型设计文档

## M-TEACHER-SALARY-CAPABILITY-V1 · Phase 1

- **设计日期**: 2026-07-25
- **状态**: ✅ Phase 1 完成
- **关联文档**:
  - [SALARY-MODEL-DESIGN.md](./SALARY-MODEL-DESIGN.md) — 教师薪酬模型设计（4种模式）
  - [SALARY-DATABASE-DESIGN.md](./SALARY-DATABASE-DESIGN.md) — 完整数据库设计（含 Settlement）
  - [SALARY-CALCULATION-DESIGN.md](./SALARY-CALCULATION-DESIGN.md) — 薪酬计算引擎设计（策略模式）

---

## 1. 设计原则

1. **工资不是输入数据** — 工资是 Lesson Finished 事件产生的业务结果，而非手动录入
2. **可追溯** — 每条工资记录都关联具体课时（Lesson）、考勤（Attendance）、规则（SalaryRule）及规则版本号
3. **可扩展** — Phase 1 支持基础计费模式，后续 Phase 引入阶梯课时费、底薪+课时费、自定义规则引擎
4. **与现有系统兼容** — 复用 User / Lesson / LessonAttendance 实体，不破坏现有业务
5. **审计完备** — 所有实体包含 createdBy / updatedBy 审计字段

---

## 2. ER 图（文字描述）

```
User (Teacher)
  │
  ├──< SalaryRule（薪酬规则）
  │      1 个教师可有 N 条规则（历史版本），同一时间多条规则可通过 courseType + teacherLevel 组合筛选
  │      规则中定义了：计费类型(PER_LESSON/HOURLY/MONTHLY)、基础金额、系数、适用范围
  │
  └──< SalaryRecord（工资记录）
          N 条记录 / 教师，每次 Lesson Finished 事件产生 1 条
          关联：Lesson（课时）、LessonAttendance（考勤）、SalaryRule（使用的规则）
```

### 核心数据流

```
TeacherAssignment（教师分配 → 确定角色+时间）
  ↓
Lesson（课时记录 → status=FINISHED 触发薪酬计算）
  ↓
LessonAttendance（考勤确认 → 用于奖励/扣款，后续 Phase）
  ↓
SalaryRule（薪酬规则 → 提供 type + baseAmount + multiplier）
  ↓
[SalaryCalculator]（计算引擎 → 根据规则计算金额）
  ↓
SalaryRecord（工资记录 → 存储计算结果）
  ↓
Settlement（工资结算 → 月度汇总，后续 Phase）
```

---

## 3. 实体字段说明

### 3.1 SalaryRuleEntity (salary_rule)

| 字段 | 类型 | 说明 | 必填 | 默认值 |
|------|------|------|------|--------|
| id | bigint PK | 主键，自增 | ✅ | AUTO |
| name | varchar(100) | 规则名称，如"标准课时费"、"高级教师课时费" | ✅ | - |
| type | enum(SalaryRuleType) | 计费类型：PER_LESSON / HOURLY / MONTHLY | ✅ | - |
| baseAmount | decimal(10,2) | 基础金额，如 300.00（元/课时） | ✅ | - |
| multiplier | decimal(5,2) | 系数，默认 1.0，如高级教师 1.2 倍 | ✅ | 1.0 |
| courseType | varchar(50) | 关联课程类型，null=适用于所有课程 | ❌ | null |
| teacherLevel | varchar(50) | 教师等级，null=适用于所有等级 | ❌ | null |
| isActive | boolean | 是否启用 | ✅ | true |
| note | text | 备注 | ❌ | null |
| createdBy | bigint | 创建人 User.id | ✅ | - |
| createTime | datetime | 创建时间 | ✅ | CURRENT_TIMESTAMP |
| updatedBy | bigint | 最后修改人 User.id | ❌ | null |
| updateTime | datetime | 最后修改时间 | ✅ | CURRENT_TIMESTAMP |

**规则匹配优先级**:
1. 同时匹配 courseType + teacherLevel 的规则（最精确）
2. 只匹配 courseType 的规则
3. 只匹配 teacherLevel 的规则
4. 无限制规则（courseType=null, teacherLevel=null）
5. 同优先级下取 isActive=true 且 id 最大的规则

### 3.2 SalaryRecordEntity (salary_record)

| 字段 | 类型 | 说明 | 必填 | 默认值 |
|------|------|------|------|--------|
| id | bigint PK | 主键，自增 | ✅ | AUTO |
| teacherId | bigint | 教师 User.id | ✅ | - |
| lessonId | bigint | 关联课时 Lesson.id | ✅ | - |
| attendanceId | bigint | 关联考勤 LessonAttendance.id，null=不使用考勤数据 | ❌ | null |
| salaryRuleId | bigint | 使用的规则 SalaryRule.id | ✅ | - |
| ruleVersion | varchar(20) | 规则版本号（用于追溯历史规则） | ✅ | - |
| amount | decimal(10,2) | 工资金额（元） | ✅ | - |
| lessonDate | date | 课程日期（Lesson.scheduledDate） | ✅ | - |
| duration | int | 课时时长（分钟） | ✅ | - |
| status | enum(SalaryRecordStatus) | 状态：PENDING / CONFIRMED / PAID | ✅ | PENDING |
| notes | text | 备注 | ❌ | null |
| createdBy | bigint | 创建人 User.id（通常是系统触发） | ✅ | - |
| createTime | datetime | 创建时间 | ✅ | CURRENT_TIMESTAMP |
| updatedBy | bigint | 最后修改人 User.id | ❌ | null |
| updateTime | datetime | 最后修改时间 | ✅ | CURRENT_TIMESTAMP |

---

## 4. 枚举定义

### SalaryRuleType

```typescript
export enum SalaryRuleType {
  PER_LESSON = 'PER_LESSON',   // 按课时计费
  HOURLY     = 'HOURLY',       // 按小时计费
  MONTHLY    = 'MONTHLY',      // 按月固定薪资
}
```

### SalaryRecordStatus

```typescript
export enum SalaryRecordStatus {
  PENDING   = 'PENDING',    // 待确认 — 计算引擎生成后默认
  CONFIRMED = 'CONFIRMED',  // 已确认 — 管理员审核确认
  PAID      = 'PAID',       // 已支付 — 财务完成支付
}
```

---

## 5. 关系说明

| 关系 | 类型 | 说明 |
|------|------|------|
| User → SalaryRule | 1:N | 一个教师有多条规则，通过 courseType + teacherLevel 匹配当前生效规则 |
| SalaryRule → SalaryRecord | 1:N | 一条规则可用于多条工资记录 |
| User → SalaryRecord | 1:N | 一个教师有多条工资记录 |
| Lesson → SalaryRecord | 1:1 | 一个课时触发一条工资记录（后续可扩展为拆单/合并） |
| LessonAttendance → SalaryRecord | 1:1 | 一条考勤记录对应一条工资记录（可选关联） |

**注**: 当前不使用 `@ManyToOne` / `@JoinColumn` ORM 关联装饰器，统一通过外键字段 + 业务层 Service 做关联查询，与现有代码风格保持一致。

---

## 6. 事件触发设计

### 触发点：Lesson Finished 事件

```
Lesson.status → FINISHED
  │
  ├── 1. 查找教师的 ACTIVE SalaryRule
  │      SELECT * FROM salary_rule
  │      WHERE isActive = true
  │        AND (courseType IS NULL OR courseType = lesson.courseType)
  │        AND (teacherLevel IS NULL OR teacherLevel = user.level)
  │      ORDER BY
  │        CASE WHEN courseType IS NOT NULL AND teacherLevel IS NOT NULL THEN 0
  │             WHEN courseType IS NOT NULL THEN 1
  │             WHEN teacherLevel IS NOT NULL THEN 2
  │             ELSE 3 END,
  │        id DESC
  │      LIMIT 1
  │
  ├── 2. 计算金额
  │      amount = baseAmount × multiplier
  │      (Phase 1 简化计算，后续 Phase 引入阶梯/底薪/引擎)
  │
  └── 3. 创建 SalaryRecord
         INSERT INTO salary_record (teacherId, lessonId, salaryRuleId, ...)
```

### 状态流转

```
[Lesson Finished]
    ↓
SalaryRecord.status = PENDING
    ↓ (管理员确认)
SalaryRecord.status = CONFIRMED
    ↓ (财务支付)
SalaryRecord.status = PAID
```

### 重算场景

- 当 SalaryRule 配置变更后，可选择重新计算指定时间段内的工资
- 重算时保留历史规则版本号（ruleVersion 字段），确保审计可追溯
- 重算不会删除旧记录，而是创建新记录 + 标记旧记录为 superseded（后续 Phase）

---

## 7. 权限设计

| 操作 | 角色 | 说明 |
|------|------|------|
| 创建/编辑 SalaryRule | Admin / SuperAdmin | 薪酬规则配置权限 |
| 查看 SalaryRule | Admin / Teacher | 教师可查看自己的薪酬规则 |
| 查看 SalaryRecord | Admin / Teacher / Finance | 教师可查看自己的工资记录 |
| 确认 SalaryRecord (PENDING→CONFIRMED) | Admin / Finance | 审核确认工资 |
| 支付 SalaryRecord (CONFIRMED→PAID) | Finance | 财务支付权限 |
| 触发 SalaryRecord 生成 | 系统自动 | Lesson Finished 事件自动触发 |

### API 权限映射（后续 Phase）

| 接口 | 方法 | 权限 |
|------|------|------|
| /api/v1/salary/rules | GET | Admin / Teacher (自己的) |
| /api/v1/salary/rules | POST | Admin |
| /api/v1/salary/rules/:id | PUT | Admin |
| /api/v1/salary/records | GET | Admin / Teacher (自己的) / Finance |
| /api/v1/salary/records/:id/confirm | PATCH | Admin / Finance |
| /api/v1/salary/records/:id/pay | PATCH | Finance |

---

## 8. 索引设计

### SalaryRule

```sql
CREATE INDEX idx_salary_rule_type ON salary_rule(type);
CREATE INDEX idx_salary_rule_active ON salary_rule(is_active);
```

### SalaryRecord

```sql
CREATE INDEX idx_salary_record_teacher ON salary_record(teacher_id);
CREATE INDEX idx_salary_record_lesson ON salary_record(lesson_id);
CREATE INDEX idx_salary_record_rule ON salary_record(salary_rule_id);
CREATE INDEX idx_salary_record_date ON salary_record(lesson_date);
CREATE INDEX idx_salary_record_status ON salary_record(status);
```

---

## 9. 与现有系统的集成

### 依赖的现有 Entity

| Entity | 文件路径 | 用途 |
|--------|---------|------|
| UserEntity | identity/entities/user.entity.ts | 教师身份载体 |
| LessonEntity | teaching/lesson/lesson.entity.ts | 课时记录（status=FINISHED 触发） |
| LessonAttendanceEntity | teaching/lesson-attendance/lesson-attendance.entity.ts | 考勤数据（可选关联） |
| TeacherAssignmentEntity | teaching/teacher-assignment/teacher-assignment.entity.ts | 教师角色（后续 Phase 使用） |

### 数据一致性保证

1. SalaryRecord.lessonId 必须引用已存在的 Lesson（外键约束）
2. SalaryRecord.teacherId 必须引用已存在的 User（外键约束）
3. 同一 Lesson 最多生成一条 SalaryRecord（unique 约束，后续 Phase 添加）
4. SalaryRecord 生成后不可修改金额（仅可流转状态），确保审计完整性

---

## 10. 文件清单

| 文件 | 路径 | 状态 |
|------|------|------|
| salary.enums.ts | src/modules/salary/enums/salary.enums.ts | ✅ Created |
| salary-rule.entity.ts | src/modules/salary/entities/salary-rule.entity.ts | ✅ Created |
| salary-record.entity.ts | src/modules/salary/entities/salary-record.entity.ts | ✅ Created |
| SALARY-DATA-MODEL-DESIGN.md | docs/SALARY-DATA-MODEL-DESIGN.md | ✅ Created |

---

## 11. 后续 Phase 计划

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 数据模型设计（SalaryRule + SalaryRecord + enums） | ✅ 完成 |
| Phase 2 | 工资计算 Service（SalaryCalculatorService） | ⏳ 待开始 |
| Phase 3 | 规则匹配引擎（多条件匹配 + 历史版本） | 📅 计划中 |
| Phase 4 | 结算模块（SettlementEntity + 月度汇总） | 📅 计划中 |
| Phase 5 | API 接口层（CRUD + 计算触发） | 📅 计划中 |
| Phase 6 | 前端管理界面（规则配置 + 工资查看） | 📅 计划中 |

---

*本设计已与现有 SALARY-MODEL-DESIGN.md / SALARY-DATABASE-DESIGN.md / SALARY-CALCULATION-DESIGN.md 对齐，Phase 1 为基础数据模型，后续 Phase 将逐步引入完整的薪酬模式。*
