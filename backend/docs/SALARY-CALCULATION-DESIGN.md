# 教师薪酬计算规则设计文档

## 设计时间
2026-07-24

## 设计原则
1. 策略模式，支持扩展
2. 基于现有 Lesson + LessonAttendance + TeacherAssignment 数据
3. 支持4种薪酬模式
4. 支持奖励/扣款条件
5. 计算结果可审计、可追溯

## 依赖的现有 Entity（已验证）

### 核心数据源
- UserEntity (identity/entities/user.entity.ts)
  - 教师身份：id, name, role=Teacher, campusId, status
  - 薪酬计算用途：提供教师身份标识

- TeacherAssignmentEntity (teaching/teacher-assignment/teacher-assignment.entity.ts)
  - 教师-班级关联：classCode, teacherId, role(PRIMARY/SUBSTITUTE/ASSISTANT)
  - 生效时间：effectiveFrom, effectiveTo
  - 薪酬计算用途：确定教师角色，影响单价选择

- LessonEntity (teaching/lesson/lesson.entity.ts)
  - 课时记录：classCode, courseCode, lessonNumber, teacherId
  - 状态：DRAFT / SCHEDULED / TEACHING / FINISHED / ARCHIVED / CANCELLED
  - 时间：scheduledDate, startTime, endTime, actualStartTime, actualEndTime
  - 薪酬计算用途：status=FINISHED 的课时是薪酬计算核心驱动

- LessonAttendanceEntity (teaching/lesson-attendance/lesson-attendance.entity.ts)
  - 学生考勤：lessonId, studentCode, classCode, teacherId
  - 工作流：PENDING -> CHECKED_IN -> CONFIRMED -> LOCKED
  - 状态枚举：PRESENT / ABSENT / LATE / LEAVE / MAKEUP / ONLINE / OFFLINE
  - 可扣课时状态：PRESENT, LATE, ONLINE, OFFLINE (DEDUCTIBLE_STATUSES)
  - 薪酬计算用途：满勤奖励/迟到扣款的触发依据

### 新建 Entity（Phase 3 Batch 3.1 已设计）
- SalaryRuleEntity — 薪酬规则配置（salaryType + ruleConfig JSON）
- SalaryRecordEntity — 工资记录（每节课一条明细）
- SettlementEntity — 工资结算（按月汇总）

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）

## 架构设计

### 策略模式
```
SalaryRuleEngine (入口)
  |
  +-- LessonFixedStrategy（纯课时费）
  |     适用：兼职/外聘
  |     公式：工资 = 课时数 x 单价
  |
  +-- BasePlusLessonStrategy（底薪+固定课时费）
  |     适用：全职/长期
  |     公式：工资 = 底薪 + 课时数 x 单价
  |
  +-- BasePlusTierStrategy（底薪+阶梯课时费）
  |     适用：激励型
  |     公式：工资 = 底薪 + SUM(阶梯课时 x 阶梯单价)
  |
  +-- CustomEngineStrategy（自定义规则引擎）
        适用：多机构/复杂规则
        公式：工资 = 基础工资 + 奖励 - 扣款
```

### 计算流程
```
输入：
  - Teacher (User, role=Teacher)
  - Lesson[] (status = FINISHED, scheduledDate 在结算周期内)
  - Attendance[] (关联到上述 Lesson 的考勤记录)
  - SalaryRule (salaryType + ruleConfig)
  - TeacherAssignment[] (确定角色 PRIMARY/SUBSTITUTE/ASSISTANT)

处理：
  1. 根据 SalaryRule.salaryType 选择策略
  2. 执行策略计算
  3. 生成 SalaryRecord[]

输出：
  - SalaryRecord[] (工资记录数组)
```

### 策略接口定义
```typescript
interface SalaryCalculationInput {
  teacher: UserEntity;
  lessons: LessonEntity[];           // status = FINISHED
  attendances: LessonAttendanceEntity[];  // 关联到上述 Lesson
  rule: SalaryRuleEntity;
  assignments: TeacherAssignmentEntity[];  // 确定角色
}

interface SalaryCalculationResult {
  records: SalaryRecordOutput[];
  totalAmount: number;
  summary: CalculationSummary;
}

interface SalaryRecordOutput {
  teacherId: number;
  lessonId: number | null;     // null = 汇总记录（底薪/奖励/扣款）
  amount: number;
  calculateDate: string;
  source: 'BASE' | 'LESSON' | 'BONUS' | 'DEDUCTION';
  status: 'PENDING';
  detail: Record<string, any>;
}

interface CalculationSummary {
  salaryType: string;
  periodStart: string;
  periodEnd: string;
  totalLessons: number;
  baseAmount: number;
  lessonAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  totalAmount: number;
}

interface SalaryStrategy {
  calculate(input: SalaryCalculationInput): SalaryRecordOutput[];
}
```

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）

## 策略详细设计

### 1. LessonFixedStrategy（纯课时费）

#### 适用场景
- 兼职老师
- 外聘老师
- 小型工作室
- 按次结算的临时合作

#### 计算公式
```
工资 = 完成课时数 x 单节课费用

其中：
  完成课时数 = lessons.length (已筛选 status=FINISHED)
  单节课费用 = rule.ruleConfig.lessonPrice
  如果有 rolePriceMap 且匹配到角色，使用角色单价
```

#### 输入
```typescript
interface LessonFixedInput {
  teacher: UserEntity;
  lessons: LessonEntity[];
  rule: SalaryRuleEntity;  // ruleConfig.lessonPrice, ruleConfig.rolePriceMap?
  assignments: TeacherAssignmentEntity[];
}
```

#### 计算逻辑
```typescript
function calculate(input: LessonFixedInput): SalaryRecordOutput[] {
  const totalLessons = input.lessons.length;
  if (totalLessons === 0) return [];

  // 确定单价：优先使用 rolePriceMap
  let lessonPrice = input.rule.ruleConfig.lessonPrice;
  const rolePriceMap = input.rule.ruleConfig.rolePriceMap;

  if (rolePriceMap && input.assignments.length > 0) {
    // 取教师的主要角色（PRIMARY 优先）
    const primaryRole = input.assignments.find(a => a.role === 'PRIMARY')?.role
      || input.assignments[0]?.role;
    if (primaryRole && rolePriceMap[primaryRole]) {
      lessonPrice = rolePriceMap[primaryRole];
    }
  }

  const amount = totalLessons * lessonPrice;

  return [
    {
      teacherId: input.teacher.id,
      lessonId: null,  // 汇总记录
      amount: amount,
      calculateDate: new Date().toISOString().split('T')[0],
      source: 'LESSON',
      status: 'PENDING',
      detail: {
        salaryType: 'LESSON_FIXED',
        totalLessons: totalLessons,
        lessonPrice: lessonPrice,
        role: input.assignments[0]?.role || null,
        calculation: totalLessons + ' x ' + lessonPrice + ' = ' + amount
      }
    }
  ];
}
```

#### 输出示例
```
// 教师A（张三），LESSON_FIXED 模式
// 课时费：300元/节
// 完成课时：20节

SalaryRecordOutput[] = [
  {
    teacherId: 1,
    lessonId: null,
    amount: 6000,
    calculateDate: '2026-07-24',
    source: 'LESSON',
    status: 'PENDING',
    detail: {
      salaryType: 'LESSON_FIXED',
      totalLessons: 20,
      lessonPrice: 300,
      role: 'PRIMARY',
      calculation: '20 x 300 = 6000'
    }
  }
]
```

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）

### 2. BasePlusLessonStrategy（底薪+固定课时费）

#### 适用场景
- 全职教师
- 长期合作教师
- 需要基本收入保障的场景

#### 计算公式
```
工资 = 底薪 + 课时数量 x 固定课时费

其中：
  底薪 = rule.ruleConfig.baseSalary
  课时数量 = lessons.length
  固定课时费 = rule.ruleConfig.lessonPrice
  如果有 rolePriceMap 且匹配到角色，使用角色单价
  如果有 minLessonForBase 且课时不足，底薪为 0
```

#### 输入
```typescript
interface BasePlusLessonInput {
  teacher: UserEntity;
  lessons: LessonEntity[];
  rule: SalaryRuleEntity;  // ruleConfig.baseSalary, ruleConfig.lessonPrice
  assignments: TeacherAssignmentEntity[];
}
```

#### 计算逻辑
```typescript
function calculate(input: BasePlusLessonInput): SalaryRecordOutput[] {
  const totalLessons = input.lessons.length;
  const baseSalary = input.rule.ruleConfig.baseSalary;
  const lessonPrice = input.rule.ruleConfig.lessonPrice;
  const minLessonForBase = input.rule.ruleConfig.minLessonForBase || null;
  const rolePriceMap = input.rule.ruleConfig.rolePriceMap;

  // 确定课时单价
  let effectiveLessonPrice = lessonPrice;
  if (rolePriceMap && input.assignments.length > 0) {
    const primaryRole = input.assignments.find(a => a.role === 'PRIMARY')?.role
      || input.assignments[0]?.role;
    if (primaryRole && rolePriceMap[primaryRole]) {
      effectiveLessonPrice = rolePriceMap[primaryRole];
    }
  }

  // 检查最低课时要求
  let effectiveBaseSalary = baseSalary;
  if (minLessonForBase !== null && totalLessons < minLessonForBase) {
    effectiveBaseSalary = 0;  // 课时不足，不发底薪
  }

  const lessonAmount = totalLessons * effectiveLessonPrice;

  const records = [];

  // 底薪记录
  if (effectiveBaseSalary > 0) {
    records.push({
      teacherId: input.teacher.id,
      lessonId: null,
      amount: effectiveBaseSalary,
      calculateDate: new Date().toISOString().split('T')[0],
      source: 'BASE',
      status: 'PENDING',
      detail: {
        salaryType: 'BASE_PLUS_LESSON',
        type: 'BASE_SALARY',
        baseSalary: effectiveBaseSalary,
        minLessonForBase: minLessonForBase,
        actualLessons: totalLessons,
        baseEligible: true
      }
    });
  }

  // 课时费记录
  records.push({
    teacherId: input.teacher.id,
    lessonId: null,
    amount: lessonAmount,
    calculateDate: new Date().toISOString().split('T')[0],
    source: 'LESSON',
    status: 'PENDING',
    detail: {
      salaryType: 'BASE_PLUS_LESSON',
      totalLessons: totalLessons,
      lessonPrice: effectiveLessonPrice,
      role: input.assignments[0]?.role || null,
      calculation: totalLessons + ' x ' + effectiveLessonPrice + ' = ' + lessonAmount
    }
  });

  return records;
}
```

#### 输出示例
```
// 教师B（李四），BASE_PLUS_LESSON 模式
// 底薪：5000元/月
// 课时费：100元/节
// 完成课时：20节

SalaryRecordOutput[] = [
  {
    teacherId: 2,
    lessonId: null,
    amount: 5000,
    calculateDate: '2026-07-24',
    source: 'BASE',
    status: 'PENDING',
    detail: {
      salaryType: 'BASE_PLUS_LESSON',
      type: 'BASE_SALARY',
      baseSalary: 5000,
      minLessonForBase: null,
      actualLessons: 20,
      baseEligible: true
    }
  },
  {
    teacherId: 2,
    lessonId: null,
    amount: 2000,
    calculateDate: '2026-07-24',
    source: 'LESSON',
    status: 'PENDING',
    detail: {
      salaryType: 'BASE_PLUS_LESSON',
      totalLessons: 20,
      lessonPrice: 100,
      role: 'PRIMARY',
      calculation: '20 x 100 = 2000'
    }
  }
]

// 总工资 = 5000 + 2000 = 7000元
```

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）

### 3. BasePlusTierStrategy（底薪+阶梯课时费）

#### 适用场景
- 鼓励教师增加授课量
- 激励型薪酬体系
- 中大型机构的薪酬方案

#### 计算公式
```
工资 = 底薪 + SUM(各阶梯课时数 x 该阶梯单价)

阶梯计算逻辑：
  第1阶梯（0 ~ tier1.maxLessons）: 课时数 x tier1.pricePerLesson
  第2阶梯（tier1.maxLessons+1 ~ tier2.maxLessons）: 课时数 x tier2.pricePerLesson
  第N阶梯（tierN-1.maxLessons+1 ~ 无上限）: 课时数 x tierN.pricePerLesson
```

#### 输入
```typescript
interface BasePlusTierInput {
  teacher: UserEntity;
  lessons: LessonEntity[];
  rule: SalaryRuleEntity;  // ruleConfig.baseSalary, ruleConfig.tiers[]
}
```

#### 计算逻辑
```typescript
function calculate(input: BasePlusTierInput): SalaryRecordOutput[] {
  const totalLessons = input.lessons.length;
  const baseSalary = input.rule.ruleConfig.baseSalary;
  const tiers = input.rule.ruleConfig.tiers;  // 按 minLessons 升序排列

  let tierAmount = 0;
  const tierDetails = [];
  let remaining = totalLessons;

  for (const tier of tiers) {
    if (remaining <= 0) break;

    const tierCapacity = tier.maxLessons !== null
      ? (tier.maxLessons - tier.minLessons + 1)
      : remaining;  // 最后一档无上限

    const lessonsInTier = Math.min(remaining, tierCapacity);
    const tierTotal = lessonsInTier * tier.pricePerLesson;
    tierAmount += tierTotal;
    remaining -= lessonsInTier;

    tierDetails.push({
      minLessons: tier.minLessons,
      maxLessons: tier.maxLessons,
      pricePerLesson: tier.pricePerLesson,
      tierLessons: lessonsInTier,
      tierTotal: tierTotal,
      calculation: lessonsInTier + ' x ' + tier.pricePerLesson + ' = ' + tierTotal
    });
  }

  const totalAmount = baseSalary + tierAmount;

  return [
    {
      teacherId: input.teacher.id,
      lessonId: null,
      amount: baseSalary,
      calculateDate: new Date().toISOString().split('T')[0],
      source: 'BASE',
      status: 'PENDING',
      detail: {
        salaryType: 'BASE_PLUS_TIER',
        type: 'BASE_SALARY',
        baseSalary: baseSalary
      }
    },
    {
      teacherId: input.teacher.id,
      lessonId: null,
      amount: tierAmount,
      calculateDate: new Date().toISOString().split('T')[0],
      source: 'LESSON',
      status: 'PENDING',
      detail: {
        salaryType: 'BASE_PLUS_TIER',
        totalLessons: totalLessons,
        tiers: tierDetails,
        calculation: tierDetails.map(d => d.calculation).join(' + ')
          + ' = ' + tierAmount
      }
    }
  ];
}
```

#### 输出示例
```
// 教师C（王五），BASE_PLUS_TIER 模式
// 底薪：3000元/月
// 阶梯规则：
//   0-20节:  30元/节
//   21-50节: 35元/节
//   51节以上: 40元/节
// 完成课时：60节

SalaryRecordOutput[] = [
  {
    teacherId: 3,
    lessonId: null,
    amount: 3000,
    calculateDate: '2026-07-24',
    source: 'BASE',
    status: 'PENDING',
    detail: {
      salaryType: 'BASE_PLUS_TIER',
      type: 'BASE_SALARY',
      baseSalary: 3000
    }
  },
  {
    teacherId: 3,
    lessonId: null,
    amount: 2050,
    calculateDate: '2026-07-24',
    source: 'LESSON',
    status: 'PENDING',
    detail: {
      salaryType: 'BASE_PLUS_TIER',
      totalLessons: 60,
      tiers: [
        {
          minLessons: 0,
          maxLessons: 20,
          pricePerLesson: 30,
          tierLessons: 20,
          tierTotal: 600,
          calculation: '20 x 30 = 600'
        },
        {
          minLessons: 21,
          maxLessons: 50,
          pricePerLesson: 35,
          tierLessons: 30,
          tierTotal: 1050,
          calculation: '30 x 35 = 1050'
        },
        {
          minLessons: 51,
          maxLessons: null,
          pricePerLesson: 40,
          tierLessons: 10,
          tierTotal: 400,
          calculation: '10 x 40 = 400'
        }
      ],
      calculation: '600 + 1050 + 400 = 2050'
    }
  }
]

// 总工资 = 3000 + 2050 = 5050元
```

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）

### 4. CustomEngineStrategy（自定义规则引擎）

#### 适用场景
- 未来支持多机构的核心
- 复杂薪酬规则（百分比+阶梯+奖励+扣款组合）
- 需要灵活配置的特殊合作模式
- SaaS 平台型部署

#### 计算公式
```
工资 = 基础工资 + 奖励总额 - 扣款总额

基础工资 = f(课时数, 规则类型)
  FIXED: 固定金额
  PERCENTAGE: 收入基数 x 百分比
  TIER: 阶梯计算（同 BasePlusTierStrategy）

奖励总额 = SUM(触发的奖励项)
扣款总额 = SUM(触发的扣款项)
```

#### 输入
```typescript
interface CustomEngineInput {
  teacher: UserEntity;
  lessons: LessonEntity[];
  attendances: LessonAttendanceEntity[];
  rule: SalaryRuleEntity;
  // ruleConfig 结构：
  //   baseCalculation: { type, value?, revenueSource?, tiers? }
  //   bonuses: [{ name, type, amount, condition }]
  //   deductions: [{ name, type, amount, condition }]
}
```

#### 计算逻辑
```typescript
function calculate(input: CustomEngineInput): SalaryRecordOutput[] {
  const records = [];

  // 1. 计算基础工资
  const baseAmount = calculateBase(
    input.lessons,
    input.rule.ruleConfig.baseCalculation
  );
  records.push({
    teacherId: input.teacher.id,
    lessonId: null,
    amount: baseAmount,
    calculateDate: new Date().toISOString().split('T')[0],
    source: 'BASE',
    status: 'PENDING',
    detail: {
      salaryType: 'CUSTOM_ENGINE',
      type: 'BASE_CALCULATION',
      calculation: input.rule.ruleConfig.baseCalculation
    }
  });

  // 2. 计算奖励
  let totalBonus = 0;
  const bonusDetails = [];
  for (const bonus of input.rule.ruleConfig.bonuses) {
    if (checkCondition(bonus.condition, input.lessons, input.attendances)) {
      totalBonus += bonus.amount;
      bonusDetails.push({
        name: bonus.name,
        value: bonus.amount,
        condition: bonus.condition,
        triggered: true
      });
    }
  }
  if (totalBonus > 0) {
    records.push({
      teacherId: input.teacher.id,
      lessonId: null,
      amount: totalBonus,
      calculateDate: new Date().toISOString().split('T')[0],
      source: 'BONUS',
      status: 'PENDING',
      detail: {
        salaryType: 'CUSTOM_ENGINE',
        bonuses: bonusDetails
      }
    });
  }

  // 3. 计算扣款
  let totalDeduction = 0;
  const deductionDetails = [];
  for (const deduction of input.rule.ruleConfig.deductions) {
    const result = checkDeductionCondition(
      deduction.condition,
      input.lessons,
      input.attendances,
      deduction.amount
    );
    if (result.triggered) {
      totalDeduction += result.amount;
      deductionDetails.push({
        name: deduction.name,
        value: result.amount,
        condition: deduction.condition,
        occurrenceCount: result.count,
        triggered: true
      });
    }
  }
  if (totalDeduction > 0) {
    records.push({
      teacherId: input.teacher.id,
      lessonId: null,
      amount: totalDeduction,
      calculateDate: new Date().toISOString().split('T')[0],
      source: 'DEDUCTION',
      status: 'PENDING',
      detail: {
        salaryType: 'CUSTOM_ENGINE',
        deductions: deductionDetails
      }
    });
  }

  return records;
}

// 基础工资计算
function calculateBase(lessons: LessonEntity[], config: any): number {
  switch (config.type) {
    case 'FIXED':
      return config.value;

    case 'PERCENTAGE':
      // 基于课程收入计算
      // revenueSource = 'TUITION' 时，需要从 Contract 获取学费总额
      // 当前简化：使用 lessons 关联的 Contract.unitPrice 估算
      const totalRevenue = lessons.reduce((sum, l) => {
        // TODO: 需要从 Contract 获取实际学费收入
        // 当前占位：假设 Lesson 有 price 字段或从关联 Contract 计算
        return sum + (l as any).estimatedRevenue || 0;
      }, 0);
      return totalRevenue * (config.value / 100);

    case 'TIER':
      return calculateTierAmount(lessons.length, config.tiers);

    default:
      return 0;
  }
}

// 阶梯计算（复用 BasePlusTierStrategy 逻辑）
function calculateTierAmount(totalLessons: number, tiers: any[]): number {
  let amount = 0;
  let remaining = totalLessons;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierCapacity = tier.maxLessons !== null
      ? (tier.maxLessons - tier.minLessons + 1)
      : remaining;
    const lessonsInTier = Math.min(remaining, tierCapacity);
    amount += lessonsInTier * tier.pricePerLesson;
    remaining -= lessonsInTier;
  }

  return amount;
}
```

#### 输出示例
```
// 教师D（赵六），CUSTOM_ENGINE 模式
// 基础工资：PERCENTAGE 模式，40%
// 机构收入（该教师相关课程学费总额）：25000元
// 基础工资 = 25000 x 40% = 10000元
// 奖励：满勤500 + 超额300
// 扣款：迟到100

SalaryRecordOutput[] = [
  {
    teacherId: 4,
    lessonId: null,
    amount: 10000,
    calculateDate: '2026-07-24',
    source: 'BASE',
    status: 'PENDING',
    detail: {
      salaryType: 'CUSTOM_ENGINE',
      type: 'BASE_CALCULATION',
      calculation: {
        type: 'PERCENTAGE',
        value: 40,
        revenueSource: 'TUITION'
      }
    }
  },
  {
    teacherId: 4,
    lessonId: null,
    amount: 800,
    calculateDate: '2026-07-24',
    source: 'BONUS',
    status: 'PENDING',
    detail: {
      salaryType: 'CUSTOM_ENGINE',
      bonuses: [
        {
          name: '满勤奖励',
          value: 500,
          condition: { type: 'FULL_ATTENDANCE' },
          triggered: true
        },
        {
          name: '超额奖励',
          value: 300,
          condition: { type: 'LESSON_TARGET', threshold: 20 },
          triggered: true
        }
      ]
    }
  },
  {
    teacherId: 4,
    lessonId: null,
    amount: 100,
    calculateDate: '2026-07-24',
    source: 'DEDUCTION',
    status: 'PENDING',
    detail: {
      salaryType: 'CUSTOM_ENGINE',
      deductions: [
        {
          name: '迟到扣款',
          value: 100,
          condition: { type: 'LATE', perOccurrence: true },
          occurrenceCount: 1,
          triggered: true
        }
      ]
    }
  }
]

// 总工资 = 10000 + 800 - 100 = 10700元
```

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）

## 条件检查详细设计

### 奖励条件

#### FULL_ATTENDANCE（满勤）
```typescript
function checkFullAttendance(
  lessons: LessonEntity[],
  attendances: LessonAttendanceEntity[]
): boolean {
  // 所有课时、所有学生都到课
  if (attendances.length === 0) return false;

  // 按 Lesson 分组检查
  const lessonIds = new Set(lessons.map(l => l.id));
  const relevantAttendances = attendances.filter(
    a => lessonIds.has(a.lessonId)
  );

  if (relevantAttendances.length === 0) return false;

  // 所有考勤记录都必须是可扣课时状态（PRESENT/LATE/ONLINE/OFFLINE）
  // 即没有 ABSENT 或 LEAVE
  return relevantAttendances.every(a =>
    a.status === AttendanceStatus.PRESENT ||
    a.status === AttendanceStatus.LATE ||
    a.status === AttendanceStatus.ONLINE ||
    a.status === AttendanceStatus.OFFLINE
  );
}
```

#### LESSON_TARGET（课时目标）
```typescript
function checkLessonTarget(
  lessons: LessonEntity[],
  threshold: number
): boolean {
  // 完成课时数 >= 目标阈值
  return lessons.length >= threshold;
}
```

#### RATING（评价达标）
```typescript
function checkRating(
  lessons: LessonEntity[],
  threshold: number
): boolean {
  // TODO: 需要评分系统支持
  // 当前返回 false，预留接口
  // 未来实现：
  //   const ratings = await getLessonRatings(lessons.map(l => l.id));
  //   const avgRating = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  //   return avgRating >= threshold;
  return false;
}
```

### 扣款条件

#### LATE（迟到）
```typescript
function checkLateDeduction(
  attendances: LessonAttendanceEntity[],
  perOccurrence: boolean,
  amountPerOccurrence: number
): { triggered: boolean; amount: number; count: number } {
  // 统计迟到次数
  const lateCount = attendances.filter(
    a => a.status === AttendanceStatus.LATE
  ).length;

  if (lateCount === 0) {
    return { triggered: false, amount: 0, count: 0 };
  }

  if (perOccurrence) {
    return {
      triggered: true,
      amount: lateCount * amountPerOccurrence,
      count: lateCount
    };
  } else {
    // 只要迟到就扣固定金额
    return {
      triggered: true,
      amount: amountPerOccurrence,
      count: lateCount
    };
  }
}
```

#### CANCEL（取消课程）
```typescript
function checkCancelDeduction(
  lessons: LessonEntity[],
  perOccurrence: boolean,
  amountPerOccurrence: number
): { triggered: boolean; amount: number; count: number } {
  // 统计取消课时数（status = CANCELLED）
  // 注意：输入 lessons 已筛选 status=FINISHED，这里需要额外查询
  // 实际实现时，需要传入所有 lessons（包括 CANCELLED）
  const cancelCount = lessons.filter(
    l => l.status === 'CANCELLED'
  ).length;

  if (cancelCount === 0) {
    return { triggered: false, amount: 0, count: 0 };
  }

  if (perOccurrence) {
    return {
      triggered: true,
      amount: cancelCount * amountPerOccurrence,
      count: cancelCount
    };
  } else {
    return {
      triggered: true,
      amount: amountPerOccurrence,
      count: cancelCount
    };
  }
}
```

#### ABSENT（旷工）
```typescript
function checkAbsentDeduction(
  attendances: LessonAttendanceEntity[],
  perOccurrence: boolean,
  amountPerOccurrence: number
): { triggered: boolean; amount: number; count: number } {
  // 统计旷工次数（学生 ABSENT 且教师未提前通知）
  // 简化逻辑：统计 ABSENT 状态的数量
  const absentCount = attendances.filter(
    a => a.status === AttendanceStatus.ABSENT
  ).length;

  if (absentCount === 0) {
    return { triggered: false, amount: 0, count: 0 };
  }

  if (perOccurrence) {
    return {
      triggered: true,
      amount: absentCount * amountPerOccurrence,
      count: absentCount
    };
  } else {
    return {
      triggered: true,
      amount: amountPerOccurrence,
      count: absentCount
    };
  }
}
```

### 条件检查统一入口
```typescript
function checkCondition(
  condition: any,
  lessons: LessonEntity[],
  attendances: LessonAttendanceEntity[]
): boolean {
  switch (condition.type) {
    case 'FULL_ATTENDANCE':
      return checkFullAttendance(lessons, attendances);

    case 'LESSON_TARGET':
      return checkLessonTarget(lessons, condition.threshold);

    case 'RATING':
      return checkRating(lessons, condition.threshold);

    default:
      return false;
  }
}

function checkDeductionCondition(
  condition: any,
  lessons: LessonEntity[],
  attendances: LessonAttendanceEntity[],
  amountPerOccurrence: number
): { triggered: boolean; amount: number; count: number } {
  switch (condition.type) {
    case 'LATE':
      return checkLateDeduction(
        attendances, condition.perOccurrence, amountPerOccurrence
      );

    case 'CANCEL':
      return checkCancelDeduction(
        lessons, condition.perOccurrence, amountPerOccurrence
      );

    case 'ABSENT':
      return checkAbsentDeduction(
        attendances, condition.perOccurrence, amountPerOccurrence
      );

    default:
      return { triggered: false, amount: 0, count: 0 };
  }
}
```

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）

## SalaryRuleEngine 入口设计

### 引擎主类
```typescript
class SalaryRuleEngine {
  private strategies: Map<string, SalaryStrategy>;

  constructor() {
    this.strategies = new Map();
    this.strategies.set('LESSON_FIXED', new LessonFixedStrategy());
    this.strategies.set('BASE_PLUS_LESSON', new BasePlusLessonStrategy());
    this.strategies.set('BASE_PLUS_TIER', new BasePlusTierStrategy());
    this.strategies.set('CUSTOM_ENGINE', new CustomEngineStrategy());
  }

  async calculate(input: SalaryCalculationInput): Promise<SalaryCalculationResult> {
    const salaryType = input.rule.salaryType;
    const strategy = this.strategies.get(salaryType);

    if (!strategy) {
      throw new Error('Unknown salary type: ' + salaryType);
    }

    const records = strategy.calculate(input);
    const totalAmount = records.reduce((sum, r) => {
      if (r.source === 'DEDUCTION') {
        return sum - r.amount;
      }
      return sum + r.amount;
    }, 0);

    const summary = this.buildSummary(input, records, totalAmount);

    return { records, totalAmount, summary };
  }

  private buildSummary(
    input: SalaryCalculationInput,
    records: SalaryRecordOutput[],
    totalAmount: number
  ): CalculationSummary {
    const baseAmount = records
      .filter(r => r.source === 'BASE')
      .reduce((sum, r) => sum + r.amount, 0);
    const lessonAmount = records
      .filter(r => r.source === 'LESSON')
      .reduce((sum, r) => sum + r.amount, 0);
    const bonusAmount = records
      .filter(r => r.source === 'BONUS')
      .reduce((sum, r) => sum + r.amount, 0);
    const deductionAmount = records
      .filter(r => r.source === 'DEDUCTION')
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      salaryType: input.rule.salaryType,
      periodStart: this.getPeriodStart(input.lessons),
      periodEnd: this.getPeriodEnd(input.lessons),
      totalLessons: input.lessons.length,
      baseAmount,
      lessonAmount,
      bonusAmount,
      deductionAmount,
      totalAmount
    };
  }
}
```

## 与现有系统的集成

### 数据流
```
TeacherAssignment（教师分配）
  -> 确定 teacherId + classCode + role + effectiveFrom/To
  |
Lesson（课时记录，status = FINISHED）
  -> 筛选 teacherId + scheduledDate 在结算周期
  |
LessonAttendance（考勤确认）
  -> 统计出勤率（用于满勤奖励/迟到扣款）
  |
SalaryRule（薪酬规则）
  -> 提供 salaryType + ruleConfig
  |
SalaryRuleEngine（薪酬引擎）
  -> 根据 salaryType 选择策略
  -> 执行策略计算
  -> 输出 SalaryRecord[]
  |
SalaryRecord（工资记录）
  -> 存储计算结果（明细+总额）
  |
Settlement（工资结算）
  -> 按月汇总 + 确认 + 支付
```

### 集成点
1. TeacherAssignment: 确定教师与班级的关系，role 影响单价选择
2. Lesson: 提供课时数据（status = FINISHED），是薪酬计算核心驱动
3. LessonAttendance: 提供考勤数据（AttendanceStatus 枚举），用于奖励/扣款条件触发
4. SalaryRule: 提供薪酬规则（salaryType + ruleConfig JSON）
5. SalaryRecord: 存储计算结果（每节课一条明细）
6. Settlement: 按月汇总，确认+支付

### 关键数据映射
- Teacher -> teacherId（贯穿 SalaryRule / SalaryRecord / Settlement）
- Lesson -> lessonId（SalaryRecord.lessonId -> Lesson.id）
- TeacherAssignment.role -> ruleConfig.rolePriceMap（按角色差异化单价）
- LessonAttendance.status -> 奖励/扣款触发条件（PRESENT/LATE/ABSENT/LEAVE）
- User.campusId -> SalaryRule.organizationId（机构归属）

### 数据查询策略
```
Step 1: 查找教师的 ACTIVE SalaryRule
  SELECT * FROM salary_rule
  WHERE teacher_id = ? AND status = 'ACTIVE'
  ORDER BY effective_date DESC LIMIT 1

Step 2: 查询结算周期内的 FINISHED 课时
  SELECT * FROM lesson
  WHERE teacher_id = ? AND status = 'FINISHED'
  AND scheduled_date BETWEEN ? AND ?

Step 3: 查询相关考勤记录
  SELECT * FROM lesson_attendance
  WHERE lesson_id IN (Step 2 的 lesson IDs)

Step 4: 查询教师分配记录（确定角色）
  SELECT * FROM teacher_assignment
  WHERE teacher_id = ? AND effective_from <= ?
  AND (effective_to IS NULL OR effective_to >= ?)

Step 5: 执行 SalaryRuleEngine.calculate()
  输入: teacher + lessons + attendances + rule + assignments
  输出: SalaryRecord[] + totalAmount + summary
```

---

## API 设计（仅设计，不实现）

### 计算教师工资
```
POST /api/v1/salary/calculate

Request:
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}

Response:
{
  "records": [...],
  "totalAmount": 7000,
  "summary": {
    "salaryType": "BASE_PLUS_LESSON",
    "totalLessons": 20,
    "baseAmount": 5000,
    "lessonAmount": 2000,
    "bonusAmount": 0,
    "deductionAmount": 0,
    "totalAmount": 7000
  }
}
```

### 查询工资记录
```
GET /api/v1/salary/records?teacherId=1&month=2026-07

Response:
{
  "records": [...],
  "total": 2,
  "totalAmount": 7000
}
```

### 生成工资结算
```
POST /api/v1/salary/settlement

Request:
{
  "teacherId": 1,
  "month": "2026-07"
}

Response:
{
  "settlement": {
    "id": 1,
    "teacherId": 1,
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {...}
  }
}
```

---

## 实施建议

### 实施顺序
1. 先实现 LessonFixedStrategy（最简单，纯乘法）
2. 再实现 BasePlusLessonStrategy（加一个底薪）
3. 然后实现 BasePlusTierStrategy（阶梯循环）
4. 最后实现 CustomEngineStrategy（最复杂，条件检查）

### 测试策略
- 每种策略至少 3 个测试用例（正常/边界/异常）
- 阶梯计算需要测试边界值（刚好在阶梯边界、超过最大阶梯）
- 条件检查需要测试各种 AttendanceStatus 组合
- 金额计算使用 decimal 类型，避免浮点精度问题

### 注意事项
- 金额计算必须使用 decimal（TypeScript 中用 number 但数据库用 decimal(10,2)）
- 阶梯计算时 tiers 数组必须按 minLessons 升序排列
- 底薪最低课时要求（minLessonForBase）需要明确处理
- PERCENTAGE 模式需要关联 Contract 数据获取学费收入
- RATING 条件当前无数据源，返回 false（预留接口）

---

## 结论

### 设计完整性
- 4种策略完整设计（LessonFixed / BasePlusLesson / BasePlusTier / CustomEngine）
- 每种策略有清晰的计算公式
- 每种策略有详细的计算逻辑（TypeScript 伪代码）
- 每种策略有完整的输出示例
- 条件检查逻辑完整（3种奖励条件 + 3种扣款条件）
- 与现有系统集成点明确（6个集成点）
- API 设计完整（3个核心接口）

### 可扩展性
- 策略模式，新增薪酬类型只需添加新 Strategy 类
- 支持自定义条件（奖励/扣款可扩展新 condition type）
- 支持按角色差异化单价（rolePriceMap）
- 支持多机构（organizationId 对应 campusId 体系）
- 支持审计追溯（detail JSON 存储完整计算过程）

### 下一步
- Phase 5: API 设计（详细接口规格）
