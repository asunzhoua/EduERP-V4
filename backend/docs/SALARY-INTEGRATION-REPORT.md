# 教师薪酬系统集成验证报告

## 验证时间
2026-07-24

## 验证范围
- API 设计与现有 Entity 的字段映射
- 权限设计与现有 RolesGuard 的集成
- 数据流是否与现有 Lesson / TeacherAssignment / LessonAttendance 一致
- 是否需要调整设计以适配现有系统

## 验证方法
- 逐一读取现有 Entity 源码，对比设计文档中的字段定义
- 逐一读取权限系统源码（JwtAuthGuard / RolesGuard / Roles decorator）
- 追踪数据流链路，验证每个环节的字段类型和关联关系
- 检查枚举值一致性

---

## 1. 字段映射验证

### 1.1 SalaryRule Entity

| 设计字段 | 类型 | 现有系统对应 | 现有类型 | 映射状态 |
|---------|------|-------------|---------|---------|
| id | bigint | — (新增) | — | ✅ 新增 |
| organizationId | bigint, default 0 | User.campusId | bigint, default 0 | ✅ 类型一致，语义对齐 |
| teacherId | bigint, nullable | User.id | bigint | ✅ 类型一致 |
| salaryType | enum(4值) | — (新增) | — | ✅ 新增枚举 |
| ruleConfig | json | — (新增) | — | ✅ 新增JSON |
| effectiveDate | date | — (新增) | — | ✅ 新增 |
| status | enum(ACTIVE/INACTIVE) | — (新增) | — | ✅ 新增枚举 |
| createdAt | datetime | — (新增) | — | ✅ 新增 |
| updatedAt | datetime | — (新增) | — | ✅ 新增 |

**结论**: ✅ PASS — 所有字段类型与现有系统兼容，无冲突。

### 1.2 SalaryRecord Entity

| 设计字段 | 类型 | 现有系统对应 | 现有类型 | 映射状态 |
|---------|------|-------------|---------|---------|
| id | bigint | — (新增) | — | ✅ 新增 |
| teacherId | bigint | User.id | bigint | ✅ 类型一致 |
| lessonId | bigint | LessonEntity.id | bigint | ✅ 类型一致 |
| amount | decimal(10,2) | — (新增) | — | ✅ 新增 |
| calculateDate | date | LessonEntity.scheduledDate | date | ✅ 类型一致 |
| source | enum(LESSON/BONUS/DEDUCTION) | — (新增) | — | ✅ 新增枚举 |
| status | enum(PENDING/CONFIRMED/PAID) | — (新增) | — | ✅ 新增枚举 |
| detail | json, nullable | — (新增) | — | ✅ 新增JSON |
| createdAt | datetime | — (新增) | — | ✅ 新增 |
| updatedAt | datetime | — (新增) | — | ✅ 新增 |

**结论**: ✅ PASS — 所有字段类型与现有系统兼容。

### 1.3 Settlement Entity

| 设计字段 | 类型 | 现有系统对应 | 现有类型 | 映射状态 |
|---------|------|-------------|---------|---------|
| id | bigint | — (新增) | — | ✅ 新增 |
| teacherId | bigint | User.id | bigint | ✅ 类型一致 |
| month | varchar(7) | — (新增) | — | ✅ 新增 |
| totalAmount | decimal(10,2) | — (新增) | — | ✅ 新增 |
| breakdown | json, nullable | — (新增) | — | ✅ 新增JSON |
| status | enum(PENDING/CONFIRMED/PAID) | — (新增) | — | ✅ 新增枚举 |
| confirmedAt | timestamp, nullable | — (新增) | — | ✅ 新增 |
| confirmedBy | bigint, nullable | User.id | bigint | ✅ 类型一致 |
| paidAt | timestamp, nullable | — (新增) | — | ✅ 新增 |
| paidBy | bigint, nullable | User.id | bigint | ✅ 类型一致 |
| note | text, nullable | — (新增) | — | ✅ 新增 |
| createdAt | datetime | — (新增) | — | ✅ 新增 |
| updatedAt | datetime | — (新增) | — | ✅ 新增 |

**结论**: ✅ PASS — 所有字段类型与现有系统兼容。

### 1.4 外键关联验证

| 关联 | 设计 | 实际字段 | 类型匹配 | 状态 |
|------|------|---------|---------|------|
| SalaryRule.teacherId → User.id | FK | bigint → bigint | ✅ | PASS |
| SalaryRecord.teacherId → User.id | FK | bigint → bigint | ✅ | PASS |
| SalaryRecord.lessonId → Lesson.id | FK | bigint → bigint | ✅ | PASS |
| Settlement.teacherId → User.id | FK | bigint → bigint | ✅ | PASS |
| Settlement.confirmedBy → User.id | 逻辑关联 | bigint → bigint | ✅ | PASS |
| Settlement.paidBy → User.id | 逻辑关联 | bigint → bigint | ✅ | PASS |
| SalaryRule.organizationId → User.campusId | 逻辑关联 | bigint → bigint | ✅ | PASS |

**结论**: ✅ PASS — 所有外键/逻辑关联字段类型一致。

---

## 2. 权限设计验证

### 2.1 角色验证

| 设计中使用角色 | 现有 UserRole 枚举 | 匹配 | 状态 |
|--------------|-------------------|------|------|
| Teacher | UserRole.TEACHER = 'Teacher' | ✅ 字符串匹配 | PASS |
| Admin | UserRole.ADMIN = 'Admin' | ✅ 字符串匹配 | PASS |
| SuperAdmin | UserRole.SUPER_ADMIN = 'SuperAdmin' | ✅ 字符串匹配 | PASS |

**源码验证**:
- User.entity.ts: `role: string`（varchar(50)，存储 UserRole 枚举值）
- RolesGuard: `requiredRoles.includes(user.role)` — 字符串比较
- Roles decorator: `@Roles(...roles: string[])` — 接受字符串数组
- 设计使用 `@Roles('Teacher', 'Admin', 'SuperAdmin')` — 与现有枚举值完全一致

**结论**: ✅ PASS — 角色定义完全一致。

### 2.2 权限守卫验证

| 设计使用守卫 | 现有系统 | 路径 | 状态 |
|-------------|---------|------|------|
| JwtAuthGuard | ✅ 存在 | identity/auth/jwt-auth.guard.ts | PASS |
| RolesGuard | ✅ 存在 | common/guards/roles.guard.ts | PASS |
| @Roles decorator | ✅ 存在 | common/decorators/roles.decorator.ts | PASS |

**源码验证**:
- JwtAuthGuard: 继承 AuthGuard('jwt')，支持 isPublic 跳过
- RolesGuard: 通过 Reflector 读取 ROLES_KEY，检查 user.role
- 设计使用 `@UseGuards(JwtAuthGuard, RolesGuard)` — 与现有 Controller 模式一致

**结论**: ✅ PASS — 权限守卫完全兼容。

### 2.3 API 响应格式验证

| 设计使用 | 现有系统 | 匹配 | 状态 |
|---------|---------|------|------|
| ApiResponse.success(data, msg) | ✅ 存在 | code=0, message, data | PASS |
| ApiResponse.error(code, msg) | ✅ 存在 | code=N, message, data=null | PASS |
| ApiResponse.forbidden(msg) | ✅ 存在 | code=403 | PASS |
| ApiResponse.notFound(msg) | ✅ 存在 | code=404 | PASS |

**源码验证**:
- api-response.ts: `ApiResponse.success<T>(data?: T, message: string = 'success')` → `{ code: 0, message, data }`
- 设计文档中所有 API 响应均使用此格式

**结论**: ✅ PASS — 响应格式完全一致。

### 2.4 权限矩阵验证

| API 端点 | Teacher | Admin | SuperAdmin | 实现方式 | 状态 |
|---------|---------|-------|------------|---------|------|
| GET /salary/my | ✅ 自己 | ✅ 所有 | ✅ 所有 | @Roles + req.user.sub 注入 | PASS |
| GET /salary/records | ✅ 自己 | ✅ 所有 | ✅ 所有 | @Roles + teacherId 过滤 | PASS |
| GET /salary/settlements | ✅ 自己 | ✅ 所有 | ✅ 所有 | @Roles + teacherId 过滤 | PASS |
| GET /salary/settlements/:id | ✅ 自己 | ✅ 所有 | ✅ 所有 | @Roles + ownership 检查 | PASS |
| POST /salary/calculate | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |
| POST /salary/settlement | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |
| PUT /salary/settlement/:id/confirm | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |
| PUT /salary/settlement/:id/pay | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |
| GET /salary/rules | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |
| POST /salary/rules | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |
| PUT /salary/rules/:id | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |
| DELETE /salary/rules/:id | ❌ | ✅ | ✅ | @Roles('Admin','SuperAdmin') | PASS |

**结论**: ✅ PASS — 权限矩阵设计合理，与现有守卫体系兼容。

---

## 3. 数据流验证

### 3.1 TeacherAssignment → Lesson 数据流

```
TeacherAssignmentEntity
  ├── classCode: varchar(20)
  ├── teacherId: bigint
  ├── role: TeacherRole (PRIMARY/SUBSTITUTE/ASSISTANT)
  ├── effectiveFrom: date
  └── effectiveTo: date | null
        │
        │ teacherId + role
        ↓
LessonEntity
  ├── classCode: varchar(20)      ← 与 TeacherAssignment.classCode 匹配
  ├── teacherId: bigint            ← 与 TeacherAssignment.teacherId 匹配
  ├── status: LessonStatus         ← 筛选 FINISHED
  └── scheduledDate: date          ← 筛选结算周期
```

**验证结果**:
- TeacherAssignment.teacherId (bigint) = Lesson.teacherId (bigint) ✅
- TeacherAssignment.role (TeacherRole) 用于 ruleConfig.rolePriceMap 匹配 ✅
- Lesson.status = FINISHED 是唯一计入薪酬的状态 ✅
- Lesson.scheduledDate 用于结算周期筛选 ✅

**状态**: ✅ PASS

### 3.2 Lesson → SalaryRecord 数据流

```
LessonEntity
  ├── id: bigint                   ← SalaryRecord.lessonId
  ├── teacherId: bigint            ← SalaryRecord.teacherId
  ├── scheduledDate: date          ← SalaryRecord.calculateDate
  ├── status: LessonStatus         ← 只处理 FINISHED
  ├── classCode: varchar(20)       ← 存入 detail JSON
  └── lessonNumber: int            ← 存入 detail JSON
        │
        │ 薪酬引擎计算
        ↓
SalaryRecordEntity
  ├── lessonId: bigint             ← Lesson.id
  ├── teacherId: bigint            ← Lesson.teacherId
  ├── calculateDate: date          ← Lesson.scheduledDate
  ├── amount: decimal(10,2)        ← 计算结果
  ├── source: LESSON               ← 课时工资
  └── detail: JSON                 ← {salaryType, lessonPrice, role, classCode, lessonNumber}
```

**验证结果**:
- Lesson.id (bigint) = SalaryRecord.lessonId (bigint) ✅
- Lesson.teacherId (bigint) = SalaryRecord.teacherId (bigint) ✅
- Lesson.scheduledDate (date) = SalaryRecord.calculateDate (date) ✅
- detail JSON 存储计算明细，包含 classCode/lessonNumber 等上下文 ✅

**状态**: ✅ PASS

### 3.3 LessonAttendance → 奖励/扣款 数据流

```
LessonAttendanceEntity
  ├── lessonId: bigint             ← 关联 Lesson
  ├── teacherId: bigint            ← 关联教师
  ├── status: AttendanceStatus     ← PRESENT/ABSENT/LATE/LEAVE/MAKEUP/ONLINE/OFFLINE
  └── workflowState: AttendanceWorkflowState ← PENDING/CHECKED_IN/CONFIRMED/LOCKED
        │
        │ 条件检查引擎
        ↓
SalaryRecordEntity (source=BONUS/DEDUCTION)
  ├── 满勤奖励: 所有学生 status=PRESENT → BONUS
  ├── 迟到扣款: teacherId 维度 LATE 记录 → DEDUCTION
  └── 取消扣款: Lesson.status=CANCELLED → DEDUCTION
```

**验证结果**:
- LessonAttendance.lessonId (bigint) → Lesson.id (bigint) ✅
- LessonAttendance.teacherId (bigint) → User.id (bigint) ✅
- AttendanceStatus 枚举值完整: PRESENT/ABSENT/LATE/LEAVE/MAKEUP/ONLINE/OFFLINE ✅
- 满勤奖励条件：所有关联 Attendance 的 status = PRESENT ✅
- 迟到扣款条件：Attendance.status = LATE ✅

**状态**: ✅ PASS

### 3.4 完整数据链路

```
TeacherAssignment (教师分配 → 确定角色+时间)
  ↓ teacherId + role
Lesson (课时记录 → 筛选 FINISHED 状态)
  ↓ lessonId + teacherId + scheduledDate
LessonAttendance (考勤确认 → 统计出勤数据)
  ↓ status (PRESENT/LATE/...)
SalaryRule (薪酬规则 → 提供 salaryType + ruleConfig)
  ↓ salaryType 选择策略
SalaryRuleEngine (薪酬引擎 → 计算)
  ↓ 输出 SalaryRecord[]
SalaryRecord (工资记录 → 存储计算结果)
  ↓ teacherId + month 汇总
Settlement (工资结算 → 确认+支付)
```

**状态**: ✅ PASS — 完整数据链路无断裂。

---

## 4. 设计调整建议

### 4.1 需要调整的设计

#### 调整1: SalaryRecord.lessonId 应改为 nullable (P1)

- **问题**: 当前设计 `lessonId BIGINT NOT NULL`，但 BONUS/DEDUCTION 类型的记录可能不对应具体课时（如月度满勤奖励、迟到汇总扣款）
- **原因**: 满勤奖励是月度汇总触发，不对应单一课时；迟到扣款可能汇总多次迟到
- **影响**: 如果不改，BONUS/DEDUCTION 记录无法存储（违反 NOT NULL 约束）
- **建议**: 将 `lessonId` 改为 `bigint NULLABLE`，LESSON 类型必填，BONUS/DEDUCTION 类型可空或关联触发课时

#### 调整2: AttendanceStatus 枚举值文档修正 (P2)

- **问题**: SALARY-MODEL-DESIGN.md 中提到 `EXCUSED` 状态，但实际 AttendanceStatus 枚举无此值
- **实际枚举**: PRESENT / ABSENT / LATE / LEAVE / MAKEUP / ONLINE / OFFLINE
- **原因**: 设计文档笔误
- **影响**: 低，不影响实现（SALARY-CALCULATION-DESIGN.md 中已正确使用实际枚举值）
- **建议**: 修正 SALARY-MODEL-DESIGN.md 中的枚举引用

#### 调整3: API 响应示例中 source 值修正 (P2)

- **问题**: SALARY-API-DESIGN.md 的 GET /salary/my 响应示例中出现 `"source": "BASE"`
- **实际枚举**: SalaryRecordSource 只有 LESSON / BONUS / DEDUCTION
- **原因**: 底薪应作为单独的 SalaryRecord（source=LESSON 或 source=BONUS），不是独立的 source 类型
- **影响**: 低，仅文档示例问题
- **建议**: 修正示例，底薪用 source=LESSON + detail 中标注 baseSalary

### 4.2 不需要调整的设计

1. **SalaryRule.organizationId 对应 User.campusId 体系**
   - 原因: 类型一致（bigint），语义对齐（0=全局），无外键约束（当前无 Organization 表）
   
2. **@Roles('Teacher', 'Admin', 'SuperAdmin') 角色字符串**
   - 原因: 与 UserRole 枚举值完全一致（'Teacher'/'Admin'/'SuperAdmin'）

3. **ApiResponse 统一响应格式**
   - 原因: 与现有 Controller 使用方式完全一致

4. **分页方式（page + pageSize）**
   - 原因: 与现有 API 保持一致

5. **Settlement 唯一约束 (teacherId, month)**
   - 原因: 业务合理，同一教师同一月份只能有一条结算

6. **Settlement 状态流转（PENDING → CONFIRMED → PAID，不可回退）**
   - 原因: 符合薪酬审计要求

---

## 5. 发现的问题

### P0 问题（必须修复）
无。

### P1 问题（建议修复）

1. **SalaryRecord.lessonId NOT NULL 约束过严**
   - 描述: BONUS/DEDUCTION 类型记录可能不对应具体课时，NOT NULL 约束会导致插入失败
   - 影响: 无法存储月度奖励/汇总扣款记录
   - 修复方案: 将 lessonId 改为 `bigint NULLABLE`，在 Service 层校验 LESSON 类型必须提供 lessonId

### P2 问题（可选修复）

1. **SALARY-MODEL-DESIGN.md 中 AttendanceStatus 枚举引用错误**
   - 描述: 文档提到 `EXCUSED` 状态，实际枚举无此值（应为 MAKEUP）
   - 影响: 文档误导，不影响实现
   - 修复方案: 修正文档中的枚举引用

2. **SALARY-API-DESIGN.md 响应示例中 source 值不存在**
   - 描述: 示例中出现 `"source": "BASE"`，实际枚举无此值
   - 影响: 文档误导，不影响实现
   - 修复方案: 修正示例，使用正确的枚举值

---

## 6. 现有系统修改需求

### 需要修改的现有 Entity
**无。** 薪酬系统完全通过新建 Entity 实现，不需要修改任何现有 Entity。

### 需要修改的现有 API
**无。** 薪酬 API 使用独立的 /salary 路径前缀，不影响现有 API。

### 需要修改的现有权限
**无。** 薪酬模块复用现有 JwtAuthGuard + RolesGuard + @Roles，使用已有角色（Teacher/Admin/SuperAdmin）。

### 需要新增的数据库表
1. salary_rule — 薪酬规则配置
2. salary_record — 工资记录明细
3. settlement — 工资结算

### 需要新增的模块
1. src/modules/salary/ — 薪酬模块（独立模块）

---

## 7. 结论

### 集成可行性

- ✅ 字段映射正确 — 所有新增 Entity 的关联字段类型与现有系统完全一致（bigint ↔ bigint）
- ✅ 权限设计兼容 — 复用 JwtAuthGuard + RolesGuard + @Roles，角色字符串完全匹配
- ✅ 数据流正确 — TeacherAssignment → Lesson → LessonAttendance → SalaryRule → SalaryRecord → Settlement 链路完整无断裂
- ✅ 无需修改现有系统 — 不修改任何现有 Entity / API / 权限，完全通过新建模块实现
- ✅ 响应格式一致 — 使用 ApiResponse.success/error，与现有 Controller 保持一致
- ✅ 分页方式一致 — 使用 page + pageSize，与现有 API 保持一致

### 实施建议

1. 修复 P1 问题：SalaryRecord.lessonId 改为 nullable（影响 DB 迁移脚本）
2. 修正 P2 问题：文档中的枚举引用和示例值
3. 按设计文档的实施顺序开发：SalaryRule → SalaryRecord → Settlement → Engine → Controller

### 下一步

- 等待 Owner 审核本报告
- 审核通过后，修复 P1/P2 问题
- 进入开发 Mission（实现薪酬模块代码）
