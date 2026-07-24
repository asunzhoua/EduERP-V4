# 教师薪酬数据库设计文档

## 设计时间
2026-07-24

## 设计原则
1. 支持多机构（基于现有 User.campusId 体系）
2. 支持多种薪酬模式（4种：LESSON_FIXED / BASE_PLUS_LESSON / BASE_PLUS_TIER / CUSTOM_ENGINE）
3. 与现有系统兼容（Lesson / LessonAttendance / TeacherAssignment）
4. 可扩展（JSON ruleConfig 支持未来任意规则）
5. 计算结果可审计、可追溯

## 依赖的现有 Entity（已验证）
- UserEntity（identity/entities/user.entity.ts）— 教师身份载体，campusId 作为机构标识
- TeacherAssignmentEntity（teaching/teacher-assignment/teacher-assignment.entity.ts）— 教师角色（PRIMARY/SUBSTITUTE/ASSISTANT）
- LessonEntity（teaching/lesson/lesson.entity.ts）— 课时记录，status=FINISHED 为薪酬计算依据
- LessonAttendanceEntity（teaching/lesson-attendance/lesson-attendance.entity.ts）— 考勤数据，用于奖励/扣款触发

## Entity 关系图

```
User (Teacher, campusId=机构标识)
  │
  ├──< SalaryRule（薪酬规则：1:N，同一时间只有一个 ACTIVE）
  │       │
  │       └── ruleConfig (JSON) 存储具体薪酬配置
  │
  ├──< SalaryRecord（工资记录：1:N，每节课一条明细）
  │       │
  │       └──> Lesson（关联课时：lesson_id）
  │
  └──< Settlement（工资结算：1:N，按月汇总）
```

数据流：
```
TeacherAssignment（教师分配 → 确定角色+时间）
  ↓
Lesson（课时记录 → 筛选 FINISHED 状态）
  ↓
LessonAttendance（考勤确认 → 统计出勤数据）
  ↓
SalaryRule（薪酬规则 → 提供 salaryType + ruleConfig）
  ↓
SalaryRuleEngine（薪酬引擎 → 根据 salaryType 选择策略计算）
  ↓
SalaryRecord（工资记录 → 存储每节课计算结果）
  ↓
Settlement（工资结算 → 月末汇总 + 确认 + 支付）
```

---

## 1. SalaryRule Entity（薪酬规则）

### 用途
定义教师的薪酬规则。一个教师可以有多条规则（历史变更），但同一时间只有一条 ACTIVE 状态的规则生效。

### TypeORM Entity 设计

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SalaryType {
  LESSON_FIXED = 'LESSON_FIXED',             // 纯课时费
  BASE_PLUS_LESSON = 'BASE_PLUS_LESSON',     // 底薪+固定课时费
  BASE_PLUS_TIER = 'BASE_PLUS_TIER',         // 底薪+阶梯课时费
  CUSTOM_ENGINE = 'CUSTOM_ENGINE',           // 自定义规则引擎
}

export enum SalaryRuleStatus {
  ACTIVE = 'ACTIVE',       // 生效中
  INACTIVE = 'INACTIVE',   // 已停用
}

@Entity('salary_rule')
export class SalaryRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Organization ───

  @Column({ type: 'bigint', default: 0 })
  @Index()
  organizationId: number;  // 机构ID，对应 User.campusId 体系，0=全局

  // ─── Teacher ───

  @Column({ type: 'bigint', nullable: true })
  @Index()
  teacherId: number | null;  // null=全局规则（机构级默认规则）

  // ─── Salary Config ───

  @Column({ type: 'enum', enum: SalaryType })
  salaryType: SalaryType;

  @Column({ type: 'json' })
  ruleConfig: Record<string, any>;  // JSON 存储具体规则配置

  @Column({ type: 'date' })
  @Index()
  effectiveDate: string;  // 生效日期

  @Column({ type: 'enum', enum: SalaryRuleStatus, default: SalaryRuleStatus.ACTIVE })
  @Index()
  status: SalaryRuleStatus;

  // ─── Audit ───

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 字段说明

| 字段 | 数据库类型 | TypeScript 类型 | 说明 | 必填 |
|------|-----------|----------------|------|------|
| id | bigint AUTO_INCREMENT | number | 主键 | ✅ |
| organizationId | bigint DEFAULT 0 | number | 机构ID（对应 User.campusId 体系） | ✅ |
| teacherId | bigint NULLABLE | number \| null | 教师ID，null=全局规则 | ❌ |
| salaryType | ENUM | SalaryType | 薪酬类型 | ✅ |
| ruleConfig | JSON | Record<string, any> | 规则配置（JSON 结构） | ✅ |
| effectiveDate | DATE | string | 生效日期 | ✅ |
| status | ENUM | SalaryRuleStatus | 状态（ACTIVE/INACTIVE） | ✅ |
| createdAt | DATETIME | Date | 创建时间 | ✅ |
| updatedAt | DATETIME | Date | 更新时间 | ✅ |

### salaryType 枚举说明

| 值 | 说明 | 适用场景 | 实施优先级 |
|----|------|---------|-----------|
| LESSON_FIXED | 纯课时费 | 兼职/外聘 | P0 — 第一批 |
| BASE_PLUS_LESSON | 底薪+固定课时费 | 全职/长期 | P0 — 第二批 |
| BASE_PLUS_TIER | 底薪+阶梯课时费 | 激励型 | P1 — 第三批 |
| CUSTOM_ENGINE | 自定义规则引擎 | 多机构/复杂规则 | P2 — 第四批 |

### ruleConfig 结构定义

#### LESSON_FIXED（纯课时费）
```json
{
  "lessonPrice": 300,
  "rolePriceMap": {
    "PRIMARY": 300,
    "SUBSTITUTE": 200,
    "ASSISTANT": 150
  }
}
```
- lessonPrice: 默认单节课费用（元）
- rolePriceMap: 可选，按教师角色区分单价（优先级高于 lessonPrice）

#### BASE_PLUS_LESSON（底薪+固定课时费）
```json
{
  "baseSalary": 5000,
  "lessonPrice": 100,
  "rolePriceMap": {
    "PRIMARY": 100,
    "SUBSTITUTE": 80,
    "ASSISTANT": 60
  },
  "minLessonForBase": null
}
```
- baseSalary: 底薪（元/月）
- lessonPrice: 单节课费用（元）
- rolePriceMap: 可选，按角色区分课时单价
- minLessonForBase: 可选，最低课时要求才发底薪（null=无要求）

#### BASE_PLUS_TIER（底薪+阶梯课时费）
```json
{
  "baseSalary": 3000,
  "tiers": [
    {"minLessons": 0, "maxLessons": 20, "pricePerLesson": 30},
    {"minLessons": 21, "maxLessons": 50, "pricePerLesson": 35},
    {"minLessons": 51, "maxLessons": null, "pricePerLesson": 40}
  ]
}
```
- baseSalary: 底薪（元/月）
- tiers: 阶梯规则数组，按 minLessons 升序排列
  - minLessons: 本阶梯最小课时（含）
  - maxLessons: 本阶梯最大课时（含），null=无上限
  - pricePerLesson: 本阶梯单价（元/节）

#### CUSTOM_ENGINE（自定义规则引擎）
```json
{
  "baseCalculation": {
    "type": "PERCENTAGE",
    "value": 40,
    "revenueSource": "TUITION"
  },
  "bonuses": [
    {"name": "满勤奖励", "type": "FIXED", "amount": 500, "condition": {"type": "FULL_ATTENDANCE"}},
    {"name": "超额奖励", "type": "FIXED", "amount": 300, "condition": {"type": "LESSON_TARGET", "threshold": 20}}
  ],
  "deductions": [
    {"name": "迟到扣款", "type": "FIXED", "amount": 100, "condition": {"type": "LATE", "perOccurrence": true}},
    {"name": "取消课程扣款", "type": "FIXED", "amount": 200, "condition": {"type": "CANCEL", "perOccurrence": true}}
  ]
}
```
- baseCalculation: 基础工资计算
  - type: FIXED（固定金额）/ PERCENTAGE（百分比）/ TIER（阶梯）
  - value: 百分比值（0-100）或固定金额
  - revenueSource: 收入来源（TUITION=学费 / LESSON_FEE=课时费）
- bonuses: 奖励项数组
  - condition.type: FULL_ATTENDANCE / LESSON_TARGET / RATING
- deductions: 扣款项数组
  - condition.type: LATE / CANCEL / ABSENT
  - condition.perOccurrence: 是否按次扣款

### 关联关系
- User (Teacher): 1:N — 一个教师可以有多条规则（历史变更），同一时间只有一个 ACTIVE
- Organization (campusId): N:1 — 一个机构可以有多个规则
- 全局规则: teacherId=null 表示机构级默认规则

### 索引设计
```sql
INDEX idx_salary_rule_teacher (teacher_id)        -- 按教师查询
INDEX idx_salary_rule_org (organization_id)        -- 按机构查询
INDEX idx_salary_rule_status (status)              -- 按状态筛选
INDEX idx_salary_rule_effective (effective_date)   -- 按生效日期查询
```

---

## 2. SalaryRecord Entity（工资记录）

### 用途
记录每节课的工资明细。每条记录对应一个已完成的课时（Lesson status=FINISHED），是薪酬计算的最小粒度。

### TypeORM Entity 设计

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SalaryRecordSource {
  LESSON = 'LESSON',             // 课时工资
  BONUS = 'BONUS',               // 奖励
  DEDUCTION = 'DEDUCTION',       // 扣款
}

export enum SalaryRecordStatus {
  PENDING = 'PENDING',           // 待确认
  CONFIRMED = 'CONFIRMED',       // 已确认
  PAID = 'PAID',                 // 已支付
}

@Entity('salary_record')
export class SalaryRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Teacher ───

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;

  // ─── Lesson Link ───

  @Column({ type: 'bigint' })
  @Index()
  lessonId: number;

  // ─── Amount ───

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  @Index()
  calculateDate: string;  // 计算日期（通常 = Lesson.scheduledDate）

  // ─── Classification ───

  @Column({ type: 'enum', enum: SalaryRecordSource })
  source: SalaryRecordSource;

  @Column({ type: 'enum', enum: SalaryRecordStatus, default: SalaryRecordStatus.PENDING })
  @Index()
  status: SalaryRecordStatus;

  // ─── Detail ───

  @Column({ type: 'json', nullable: true })
  detail: Record<string, any> | null;  // 计算明细（可选，用于审计追溯）

  // ─── Audit ───

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 字段说明

| 字段 | 数据库类型 | TypeScript 类型 | 说明 | 必填 |
|------|-----------|----------------|------|------|
| id | bigint AUTO_INCREMENT | number | 主键 | ✅ |
| teacherId | bigint | number | 教师ID | ✅ |
| lessonId | bigint | number | 课时ID（关联 Lesson.id） | ✅ |
| amount | decimal(10,2) | number | 工资金额（元） | ✅ |
| calculateDate | DATE | string | 计算日期（= Lesson.scheduledDate） | ✅ |
| source | ENUM | SalaryRecordSource | 来源（LESSON/BONUS/DEDUCTION） | ✅ |
| status | ENUM | SalaryRecordStatus | 状态（PENDING/CONFIRMED/PAID） | ✅ |
| detail | JSON NULLABLE | Record<string, any> \| null | 计算明细（审计用） | ❌ |
| createdAt | DATETIME | Date | 创建时间 | ✅ |
| updatedAt | DATETIME | Date | 更新时间 | ✅ |

### source 枚举说明

| 值 | 说明 | 示例 |
|----|------|------|
| LESSON | 课时工资 | 某节课的课时费 = 300元 |
| BONUS | 奖励 | 满勤奖励 = 500元 |
| DEDUCTION | 扣款 | 迟到扣款 = -100元 |

### status 枚举说明

| 值 | 说明 | 流转 |
|----|------|------|
| PENDING | 待确认 | 初始状态，计算引擎生成后默认 |
| CONFIRMED | 已确认 | 管理员确认后流转 |
| PAID | 已支付 | 结算支付后流转 |

### detail 字段示例
```json
// LESSON 类型
{
  "salaryType": "LESSON_FIXED",
  "lessonPrice": 300,
  "role": "PRIMARY",
  "classCode": "CLS-001",
  "lessonNumber": 5
}

// BONUS 类型
{
  "bonusName": "满勤奖励",
  "condition": "FULL_ATTENDANCE",
  "month": "2026-07"
}

// DEDUCTION 类型
{
  "deductionName": "迟到扣款",
  "condition": "LATE",
  "occurrenceCount": 1,
  "month": "2026-07"
}
```

### 关联关系
- User (Teacher): N:1 — 一个教师可以有多条记录
- Lesson: N:1 — 一条记录对应一个课时（lesson_id → Lesson.id）
- 注意：BONUS 和 DEDUCTION 类型的记录，lessonId 可以关联到触发该奖励/扣款的课时

### 索引设计
```sql
INDEX idx_salary_record_teacher (teacher_id)         -- 按教师查询
INDEX idx_salary_record_lesson (lesson_id)            -- 按课时查询
INDEX idx_salary_record_date (calculate_date)         -- 按日期查询
INDEX idx_salary_record_status (status)               -- 按状态筛选
```

---

## 3. Settlement Entity（工资结算）

### 用途
按月结算教师工资。每月每位教师生成一条结算记录，汇总该月所有 SalaryRecord 的总金额。

### TypeORM Entity 设计

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum SettlementStatus {
  PENDING = 'PENDING',           // 待确认
  CONFIRMED = 'CONFIRMED',       // 已确认
  PAID = 'PAID',                 // 已支付
}

@Entity('settlement')
@Unique(['teacherId', 'month'])
export class SettlementEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Teacher ───

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;

  // ─── Period ───

  @Column({ type: 'varchar', length: 7 })
  @Index()
  month: string;  // 结算月份，格式 YYYY-MM

  // ─── Amount ───

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  // ─── Breakdown (审计用) ───

  @Column({ type: 'json', nullable: true })
  breakdown: Record<string, any> | null;  // 汇总明细

  // ─── Status ───

  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.PENDING })
  @Index()
  status: SettlementStatus;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'bigint', nullable: true })
  confirmedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'bigint', nullable: true })
  paidBy: number | null;

  // ─── Note ───

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // ─── Audit ───

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 字段说明

| 字段 | 数据库类型 | TypeScript 类型 | 说明 | 必填 |
|------|-----------|----------------|------|------|
| id | bigint AUTO_INCREMENT | number | 主键 | ✅ |
| teacherId | bigint | number | 教师ID | ✅ |
| month | varchar(7) | string | 结算月份（YYYY-MM） | ✅ |
| totalAmount | decimal(10,2) | number | 总金额（元） | ✅ |
| breakdown | JSON NULLABLE | Record<string, any> \| null | 汇总明细（审计用） | ❌ |
| status | ENUM | SettlementStatus | 状态 | ✅ |
| confirmedAt | timestamp NULLABLE | Date \| null | 确认时间 | ❌ |
| confirmedBy | bigint NULLABLE | number \| null | 确认人 | ❌ |
| paidAt | timestamp NULLABLE | Date \| null | 支付时间 | ❌ |
| paidBy | bigint NULLABLE | number \| null | 支付操作人 | ❌ |
| note | text NULLABLE | string \| null | 备注 | ❌ |
| createdAt | DATETIME | Date | 创建时间 | ✅ |
| updatedAt | DATETIME | Date | 更新时间 | ✅ |

### 唯一约束
```sql
UNIQUE INDEX idx_settlement_teacher_month (teacher_id, month)
```
同一教师同一月份只能有一条结算记录。重复生成时需合并/覆盖。

### breakdown 字段示例
```json
{
  "periodStart": "2026-07-01",
  "periodEnd": "2026-07-31",
  "salaryType": "BASE_PLUS_TIER",
  "lessonCount": 60,
  "baseSalary": 3000,
  "tieredLessonFee": {
    "tier1": {"count": 20, "price": 30, "subtotal": 600},
    "tier2": {"count": 30, "price": 35, "subtotal": 1050},
    "tier3": {"count": 10, "price": 40, "subtotal": 400},
    "total": 2050
  },
  "bonuses": [
    {"name": "满勤奖励", "amount": 500}
  ],
  "deductions": [
    {"name": "迟到扣款", "amount": -100}
  ],
  "totalAmount": 5450
}
```

### 关联关系
- User (Teacher): N:1 — 一个教师可以有多条月度结算
- SalaryRecord: 1:N — 一条结算汇总多条记录（通过 teacherId + month 关联）

### 索引设计
```sql
INDEX idx_settlement_teacher (teacher_id)            -- 按教师查询
INDEX idx_settlement_month (month)                    -- 按月份查询
INDEX idx_settlement_status (status)                  -- 按状态筛选
UNIQUE INDEX idx_settlement_teacher_month (teacher_id, month)  -- 唯一约束
```

---

## 数据库迁移脚本

### 创建 SalaryRule 表
```sql
CREATE TABLE salary_rule (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT NOT NULL DEFAULT 0,
  teacher_id BIGINT NULL,
  salary_type ENUM('LESSON_FIXED', 'BASE_PLUS_LESSON', 'BASE_PLUS_TIER', 'CUSTOM_ENGINE') NOT NULL,
  rule_config JSON NOT NULL,
  effective_date DATE NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_salary_rule_teacher (teacher_id),
  INDEX idx_salary_rule_org (organization_id),
  INDEX idx_salary_rule_status (status),
  INDEX idx_salary_rule_effective (effective_date),

  FOREIGN KEY (teacher_id) REFERENCES user(id)
);
```

注意：organization_id 不对应外键，因为当前系统无 Organization 表。它对应 User.campusId 体系，0=全局规则。

### 创建 SalaryRecord 表
```sql
CREATE TABLE salary_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  teacher_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  calculate_date DATE NOT NULL,
  source ENUM('LESSON', 'BONUS', 'DEDUCTION') NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'PAID') NOT NULL DEFAULT 'PENDING',
  detail JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_salary_record_teacher (teacher_id),
  INDEX idx_salary_record_lesson (lesson_id),
  INDEX idx_salary_record_date (calculate_date),
  INDEX idx_salary_record_status (status),

  FOREIGN KEY (teacher_id) REFERENCES user(id),
  FOREIGN KEY (lesson_id) REFERENCES lesson(id)
);
```

### 创建 Settlement 表
```sql
CREATE TABLE settlement (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  teacher_id BIGINT NOT NULL,
  month VARCHAR(7) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  breakdown JSON NULL,
  status ENUM('PENDING', 'CONFIRMED', 'PAID') NOT NULL DEFAULT 'PENDING',
  confirmed_at DATETIME NULL,
  confirmed_by BIGINT NULL,
  paid_at DATETIME NULL,
  paid_by BIGINT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_settlement_teacher (teacher_id),
  INDEX idx_settlement_month (month),
  INDEX idx_settlement_status (status),
  UNIQUE INDEX idx_settlement_teacher_month (teacher_id, month),

  FOREIGN KEY (teacher_id) REFERENCES user(id)
);
```

---

## 与现有系统的关联

### 数据来源链路
```
TeacherAssignment（教师分配 → 确定 teacherId + classCode + role + effectiveFrom/To）
  ↓
Lesson（课时记录 → 筛选 status=FINISHED + teacherId + scheduledDate 在结算周期）
  ↓
LessonAttendance（考勤确认 → 统计出勤率，用于满勤奖励/迟到扣款）
  ↓
SalaryRule（薪酬规则 → 提供 salaryType + ruleConfig）
  ↓
SalaryRuleEngine（薪酬引擎 → 根据 salaryType 选择策略计算）
  ↓
SalaryRecord（工资记录 → 存储每节课计算结果）
  ↓
Settlement（工资结算 → 月末汇总 + 确认 + 支付）
```

### 关键字段映射
- Teacher → teacher_id（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson → lesson_id（SalaryRecord.lesson_id → Lesson.id）
- TeacherAssignment.role → ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status → 奖励/扣款触发条件
- User.campusId → SalaryRule.organizationId（机构归属）

### 数据流详述
1. 教师完成课时（Lesson status → FINISHED）
2. 系统查找该教师的 ACTIVE SalaryRule（按 effectiveDate 取最新）
3. SalaryRuleEngine 根据 salaryType 选择计算策略
4. 计算每节课工资 → 生成 SalaryRecord（source=LESSON）
5. 统计考勤数据 → 生成奖励/扣款 SalaryRecord（source=BONUS/DEDUCTION）
6. 月末汇总所有 SalaryRecord → 生成 Settlement
7. 管理员确认 Settlement（status → CONFIRMED）
8. 财务支付（status → PAID）

---

## 设计决策记录

### Decision 1: organizationId 不使用外键
- 原因：当前系统无 Organization 表，User 通过 campusId 字段标识机构归属
- 方案：SalaryRule.organizationId 对应 User.campusId 体系，0=全局规则
- 未来：如果建设多机构模块，可添加 Organization 表后补外键

### Decision 2: SalaryRecord 粒度为每节课
- 原因：任务规格要求每节课一条记录，便于精确追溯
- 替代方案：按月汇总（已在 SALARY-MODEL-DESIGN.md 中讨论）
- 选择：每节课一条记录 + detail JSON 存储计算明细

### Decision 3: Settlement 唯一约束 (teacherId, month)
- 原因：同一教师同一月份只能有一条结算，避免重复
- 处理：重新生成时需先删除/覆盖旧记录

### Decision 4: breakdown JSON 字段
- 原因：Settlement 需要存储汇总明细用于审计
- 内容：包含薪资类型、课时数、底薪、阶梯计算明细、奖励/扣款列表

### Decision 5: confirmedBy / paidBy 操作人追踪
- 原因：薪酬结算需要审计追踪，记录谁确认、谁支付
- 关联：confirmedBy / paidBy → User.id

---

## 实施顺序

1. 先创建 SalaryRule 表 — 定义薪酬规则
2. 再创建 SalaryRecord 表 — 记录每节课工资
3. 最后创建 Settlement 表 — 按月结算

---

## 结论

### 设计完整性
- ✅ 3个 Entity 完整设计（SalaryRule / SalaryRecord / Settlement）
- ✅ TypeORM Entity 代码完整
- ✅ 字段设计清晰（含类型、说明、必填）
- ✅ 关联关系明确（Teacher / Lesson / Organization）
- ✅ 索引设计合理（4+4+4 个索引 + 1 个唯一约束）
- ✅ 迁移脚本完整（3 个 CREATE TABLE）
- ✅ ruleConfig JSON 结构完整（4 种薪酬模式）
- ✅ 设计决策记录（5 个关键决策）

### 可扩展性
- ✅ 支持多机构（organizationId 对应 campusId 体系）
- ✅ 支持多种薪酬模式（salaryType 4 种枚举）
- ✅ 支持灵活配置（ruleConfig JSON 支持任意规则）
- ✅ 支持历史记录（effectiveDate + status 管理规则变更）
- ✅ 支持审计追溯（detail / breakdown JSON + confirmedBy / paidBy）

### 下一步
- Phase 4 Batch 4.1: 计算规则设计（SalaryRuleEngine 策略模式）
