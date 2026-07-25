# 工资模块权限设计

## 设计时间
2026-07-25

## 背景
当前系统中不存在工资（Salary）模块。本文档为该模块的权限体系设计，作为后续开发实施的前置约束。

## 角色依赖
参考现有 UserRole 枚举:
- SUPER_ADMIN — 超管，跨机构可见
- ADMIN — 机构管理员，本机构可见
- TEACHER — 教师，仅自己可见
- PARENT — 家长，仅关联学生可见（工资模块不涉及）

Controller 层复用现有 @Roles 装饰器 + RolesGuard 机制。

---

## 权限矩阵

| 操作 | SUPER_ADMIN | ADMIN | TEACHER | 说明 |
|------|-------------|-------|---------|------|
| 创建工资规则 | ✅ | ✅ | ❌ | 含基础工资、课时单价、绩效系数等 |
| 修改工资规则 | ✅ | ✅ | ❌ | 仅 EDITABLE 状态的规则 |
| 删除工资规则 | ✅ | ❌ | ❌ | 仅 DRAFT 状态的规则 |
| 查看工资规则 | ✅ | ✅ | ✅ | 教师仅查看，不可编辑 |
| 设置教师工资模式 | ✅ | ✅ | ❌ | 固定/阶梯/绩效组合 |
| 触发工资计算 | ✅ | ✅ | ❌ | 按周期手动触发或自动调度 |
| 查看教师工资结果 | ✅ | ✅ | ✅ | 教师仅自己的，Admin 看全部 |
| 导出工资报表 | ✅ | ✅ | ❌ | 含明细和汇总 |
| 工资确认/审批 | ✅ | ✅ | ❌ | 确认后不可修改（LOCKED） |
| 查看授课数量 | ✅ | ✅ | ✅ | 教师仅自己的课时统计 |

---

## 数据隔离规则

### Teacher 视角
- 查询工资结果 → where teacherId = currentUser.id
- 查询授课数量 → where teacherId = currentUser.id
- 查询有效课时 → where teacherId = currentUser.id
- 查询工资规则 → 全量只读

### Admin 视角
- 查询工资结果 → where organizationId = currentUser.organizationId
- 查询教师工资模式 → where organizationId = currentUser.organizationId
- 修改/删除 → 限本机构

### SUPER_ADMIN 视角
- 全机构可见可操作

---

## 工资规则实体建议字段

```
SalaryRule
  - id: number
  - name: string (规则名称)
  - type: enum (BASE_RATE / HOURLY_RATE / PERFORMANCE_COEFFICIENT / ...)
  - value: decimal
  - effectiveFrom: date
  - effectiveTo: date (nullable)
  - applicableRole: enum (TEACHER / SUB_TEACHER / ALL)
  - status: enum (DRAFT / ACTIVE / ARCHIVED)
  - organizationId: number (数据隔离)
  - createdBy: number
  - createdAt: datetime
  - updatedBy: number
  - updatedAt: datetime
```

## 教师工资记录实体建议字段

```
SalaryRecord
  - id: number
  - teacherId: number
  - periodStart: date (周期开始)
  - periodEnd: date (周期结束)
  - baseSalary: decimal (基本工资)
  - lessonCount: number (授课数量)
  - effectiveHours: number (有效课时)
  - hourlyRate: decimal (课时单价)
  - performanceBonus: decimal (绩效奖金)
  - deductions: decimal (扣款)
  - grossPay: decimal (应发)
  - netPay: decimal (实发)
  - status: enum (DRAFT / CALCULATED / CONFIRMED / LOCKED / PAID)
  - organizationId: number (数据隔离)
  - confirmedBy: number (nullable)
  - confirmedAt: datetime (nullable)
  - note: string (nullable)
```

---

## 状态机

### SalaryRule 状态
```
DRAFT → ACTIVE
ACTIVE → ARCHIVED
DRAFT → DELETED (仅 SuperAdmin)
```

### SalaryRecord 状态
```
DRAFT → CALCULATED (系统/手动触发计算)
CALCULATED → CONFIRMED (Admin 确认)
CONFIRMED → LOCKED (确认后锁定，不可修改)
LOCKED → PAID (财务标记已发放)
LOCKED → CALCULATED (SuperAdmin 回退，需审核)
```

---

## API 端点设计建议

```
# 工资规则管理
POST   /salary/rules              → SuperAdmin, Admin
GET    /salary/rules              → SuperAdmin, Admin, Teacher
GET    /salary/rules/:id          → SuperAdmin, Admin, Teacher
PUT    /salary/rules/:id          → SuperAdmin, Admin
DELETE /salary/rules/:id          → SuperAdmin

# 教师工资模式
POST   /salary/teacher-modes      → SuperAdmin, Admin
GET    /salary/teacher-modes      → SuperAdmin, Admin, Teacher
GET    /salary/teacher-modes/:teacherId → SuperAdmin, Admin, Teacher
PUT    /salary/teacher-modes/:teacherId → SuperAdmin, Admin

# 工资计算与查询
POST   /salary/calculate          → SuperAdmin, Admin (触发计算)
GET    /salary/records            → SuperAdmin, Admin, Teacher (Teacher过滤)
GET    /salary/records/:id        → SuperAdmin, Admin, Teacher
PUT    /salary/records/:id/confirm → SuperAdmin, Admin
PUT    /salary/records/:id/lock   → SuperAdmin, Admin

# 教师自助查询
GET    /salary/my-lesson-count    → Teacher
GET    /salary/my-effective-hours → Teacher
GET    /salary/my-records         → Teacher

# 报表
GET    /salary/reports/export     → SuperAdmin, Admin
```

## 备注

1. 需要先建立 SalaryModule 目录结构，参考现有模块（如 teaching/class）
2. 数据隔离依赖 organizationId，需确保 User 实体和 Salary 实体均有该字段
3. Controller 层统一用 @UseGuards(JwtAuthGuard, RolesGuard) 装饰
4. Service 层 findAll 必须按角色过滤数据（Teacher → teacherId，Admin → orgId）
5. 建议与 Phase 6 的 GAP-01（数据隔离）统一修复
