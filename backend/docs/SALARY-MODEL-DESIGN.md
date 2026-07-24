# 教师薪酬模型设计文档

## 设计时间
2026-07-24

## 设计原则
1. 支持多种教师合作模式（兼职/全职/外聘/平台型）
2. 可扩展，支持未来多机构
3. 基于现有 Lesson + LessonAttendance + TeacherAssignment 数据
4. 不绑定单一培训机构
5. 计算结果可审计、可追溯

## 依赖的数据源（已验证）

### 核心 Entity
- **UserEntity** (`identity/entities/user.entity.ts`)
  - 教师身份载体：id, name, role=Teacher, campusId, status
  - 无薪资字段（薪资规则独立存储）

- **TeacherAssignmentEntity** (`teaching/teacher-assignment/teacher-assignment.entity.ts`)
  - 教师-班级关联：classCode, teacherId, role(PRIMARY/SUBSTITUTE/ASSISTANT)
  - 生效时间：effectiveFrom, effectiveTo
  - 用途：确定教师在某班级的角色和时间范围

- **LessonEntity** (`teaching/lesson/lesson.entity.ts`)
  - 课时记录：classCode, courseCode, lessonNumber, teacherId
  - 状态：DRAFT / SCHEDULED / TEACHING / FINISHED / ARCHIVED / CANCELLED
  - 时间：scheduledDate, startTime, endTime, actualStartTime, actualEndTime
  - 薪酬计算只统计 status=FINISHED 的课时

- **LessonAttendanceEntity** (`teaching/lesson-attendance/lesson-attendance.entity.ts`)
  - 学生考勤：lessonId, studentCode, classCode, teacherId
  - 工作流：PENDING → CHECKED_IN → CONFIRMED → LOCKED
  - 状态：PRESENT / ABSENT / LATE / LEAVE / EXCUSED
  - 用途：满勤奖励/扣款的触发依据

### 辅助 Entity
- **ClassEntity**：班级信息（classCode, courseCode, status）
- **CourseEntity**：课程信息（courseCode, name, price）
- **EnrollmentEntity**：报名记录（studentCode, classCode, status）
- **ContractEntity**：合同记录（contractNo, teacherId, type）

### 关键数据链路
```
TeacherAssignment（教师分配 → 确定角色+时间）
  ↓
Lesson（课时记录 → 筛选 FINISHED 状态）
  ↓
LessonAttendance（学生考勤 → 统计出勤数据）
  ↓
SalaryRuleEngine（薪酬引擎 → 应用规则计算）
  ↓
SalaryRecord（工资记录 → 存储计算结果）
  ↓
Settlement（工资结算 → 确认+支付）
```

---

## 薪酬模式概览

| 模式 | 类型代码 | 适用场景 | 复杂度 | 实施优先级 |
|------|---------|---------|--------|-----------|
| 纯课时费 | LESSON_FIXED | 兼职/外聘 | 低 | P0 — 第一批 |
| 底薪+固定课时费 | BASE_PLUS_LESSON | 全职/长期 | 中 | P0 — 第二批 |
| 底薪+阶梯课时费 | BASE_PLUS_TIER | 激励型 | 高 | P1 — 第三批 |
| 自定义规则引擎 | CUSTOM_ENGINE | 多机构/复杂规则 | 极高 | P2 — 第四批 |

---

## 模式A：纯课时费模式（LESSON_FIXED）

### 适用场景
- 兼职老师
- 外聘老师
- 小型工作室
- 按次结算的临时合作

### 计算公式
```
工资 = 完成课时数 × 单节课费用

其中：
- 完成课时数 = COUNT(Lesson WHERE teacherId = X AND status = FINISHED AND scheduledDate IN 结算周期)
- 单节课费用 = SalaryRule.ruleConfig.lessonPrice
```

### 数据来源映射
- **课时来源**: LessonEntity（status = FINISHED，scheduledDate 在结算周期内）
- **教师关联**: LessonEntity.teacherId = UserEntity.id
- **课时费**: SalaryRuleEntity.ruleConfig.lessonPrice
- **角色过滤**: 可选 — 通过 TeacherAssignment.role 区分 PRIMARY/SUBSTITUTE/ASSISTANT 不同单价

### 计算示例
```
教师A（张三），LESSON_FIXED 模式
课时费规则：300元/节（PRIMARY角色）
结算周期：2026年7月

完成课时统计：
- Lesson #1: 2026-07-03, FINISHED ✓
- Lesson #2: 2026-07-05, FINISHED ✓
- Lesson #3: 2026-07-10, FINISHED ✓
- Lesson #4: 2026-07-12, CANCELLED ✗（不计入）
- Lesson #5: 2026-07-15, FINISHED ✓
- ... 共20节 FINISHED

工资 = 20 × 300 = 6000元
```

### 数据结构
```typescript
interface LessonFixedRule {
  salaryType: 'LESSON_FIXED';
  ruleConfig: {
    lessonPrice: number;           // 单节课费用（元）
    rolePriceMap?: {               // 可选：按角色区分单价
      PRIMARY: number;             // 主讲单价
      SUBSTITUTE: number;          // 代课单价
      ASSISTANT: number;           // 助教单价
    };
  };
}
```

### 优势
- 简单明了，易于理解和计算
- 无需底薪管理
- 适合短期/灵活合作

### 劣势
- 无底薪保障，教师流动性可能较高
- 无激励机制，无法鼓励多授课
- 不同课程类型可能需要不同单价（当前设计未覆盖）

---

## 模式B：底薪 + 固定课时费（BASE_PLUS_LESSON）

### 适用场景
- 全职教师
- 长期合作教师
- 需要基本收入保障的场景

### 计算公式
```
工资 = 底薪 + 完成课时数 × 固定课时费

其中：
- 底薪 = SalaryRule.ruleConfig.baseSalary
- 完成课时数 = COUNT(Lesson WHERE teacherId = X AND status = FINISHED AND scheduledDate IN 结算周期)
- 固定课时费 = SalaryRule.ruleConfig.lessonPrice
```

### 数据来源映射
- **底薪**: SalaryRuleEntity.ruleConfig.baseSalary
- **课时来源**: LessonEntity（status = FINISHED）
- **课时费**: SalaryRuleEntity.ruleConfig.lessonPrice
- **教师关联**: LessonEntity.teacherId = UserEntity.id

### 计算示例
```
教师B（李四），BASE_PLUS_LESSON 模式
底薪：5000元/月
课时费：100元/节
结算周期：2026年7月

完成课时：20节

工资 = 5000 + 20 × 100 = 7000元
```

### 数据结构
```typescript
interface BasePlusLessonRule {
  salaryType: 'BASE_PLUS_LESSON';
  ruleConfig: {
    baseSalary: number;            // 底薪（元/月）
    lessonPrice: number;           // 单节课费用（元）
    rolePriceMap?: {               // 可选：按角色区分单价
      PRIMARY: number;
      SUBSTITUTE: number;
      ASSISTANT: number;
    };
    minLessonForBase?: number;     // 可选：最低课时要求才发底薪
  };
}
```

### 优势
- 有底薪保障，教师稳定性高
- 计算简单，易于理解
- 适合长期合作关系

### 劣势
- 无阶梯激励，教师可能满足于固定课时量
- 底薪与课时费比例需要合理设定
- 如果课时量过低，底薪成本可能偏高

---

## 模式C：底薪 + 阶梯课时费（BASE_PLUS_TIER）

### 适用场景
- 鼓励教师增加授课量
- 激励型薪酬体系
- 中大型机构的薪酬方案

### 计算公式
```
工资 = 底薪 + Σ(各阶梯课时数 × 该阶梯单价)

阶梯计算逻辑：
- 第1阶梯（0 ~ tier1.maxLessons）: 课时数 × tier1.pricePerLesson
- 第2阶梯（tier1.maxLessons+1 ~ tier2.maxLessons）: 课时数 × tier2.pricePerLesson
- 第N阶梯（tierN-1.maxLessons+1 ~ ∞）: 课时数 × tierN.pricePerLesson

其中：
- 底薪 = SalaryRule.ruleConfig.baseSalary
- 阶梯规则 = SalaryRule.ruleConfig.tiers[]
- 完成课时数 = COUNT(Lesson WHERE teacherId = X AND status = FINISHED AND scheduledDate IN 结算周期)
```

### 数据来源映射
- **底薪**: SalaryRuleEntity.ruleConfig.baseSalary
- **课时来源**: LessonEntity（status = FINISHED）
- **阶梯规则**: SalaryRuleEntity.ruleConfig.tiers（数组，按 minLessons 排序）
- **教师关联**: LessonEntity.teacherId = UserEntity.id

### 计算示例
```
教师C（王五），BASE_PLUS_TIER 模式
底薪：3000元/月
阶梯规则：
  0-20节:   30元/节
  21-50节:  35元/节
  51节以上: 40元/节

结算周期：2026年7月
完成课时：60节

阶梯计算：
  第1阶梯（0-20节）:  20 × 30 = 600元
  第2阶梯（21-50节）: 30 × 35 = 1050元
  第3阶梯（51-60节）: 10 × 40 = 400元
  课时费小计: 600 + 1050 + 400 = 2050元

工资 = 3000 + 2050 = 5050元
```

### 阶梯计算算法（伪代码）
```typescript
function calculateTieredLessonFee(
  totalLessons: number,
  tiers: TierRule[]
): number {
  let fee = 0;
  let remaining = totalLessons;
  
  // tiers 按 minLessons 升序排列
  for (const tier of tiers) {
    if (remaining <= 0) break;
    
    const tierCapacity = tier.maxLessons 
      ? (tier.maxLessons - tier.minLessons + 1) 
      : remaining; // 最后一档无上限
    
    const lessonsInTier = Math.min(remaining, tierCapacity);
    fee += lessonsInTier * tier.pricePerLesson;
    remaining -= lessonsInTier;
  }
  
  return fee;
}
```

### 数据结构
```typescript
interface BasePlusTierRule {
  salaryType: 'BASE_PLUS_TIER';
  ruleConfig: {
    baseSalary: number;            // 底薪（元/月）
    tiers: Array<{
      minLessons: number;          // 本阶梯最小课时（含）
      maxLessons: number | null;   // 本阶梯最大课时（含），null=无上限
      pricePerLesson: number;      // 本阶梯单价（元/节）
    }>;
  };
}
```

### 优势
- 有底薪保障
- 阶梯激励，鼓励多授课
- 课时越多，单价越高，教师积极性强
- 阶梯规则灵活可配

### 劣势
- 计算逻辑较复杂
- 阶梯边界需要合理设计（避免"差一节课"的争议）
- 规则配置相对复杂

---

## 模式D：自定义规则引擎（CUSTOM_ENGINE）

### 适用场景
- 未来支持多机构的核心
- 复杂薪酬规则（百分比+阶梯+奖励+扣款组合）
- 需要灵活配置的特殊合作模式
- SaaS 平台型部署

### 设计目标
- 支持固定金额计算
- 支持阶梯计算
- 支持百分比计算（如：机构收入的 X%）
- 支持奖励项（满勤/优秀评价/超额）
- 支持扣款项（迟到/请假/旷工）
- 规则可组合、可扩展

### 计算公式
```
工资 = 基础工资 + 奖励总额 - 扣款总额

基础工资 = f(课时数, 规则类型)
  - FIXED: 固定金额
  - PERCENTAGE: 收入基数 × 百分比
  - TIER: 阶梯计算（同模式C）

奖励总额 = Σ(奖励项)
  - 满勤奖励：当月所有课时学生出勤率100%
  - 优秀评价：学生/家长评价达到阈值
  - 超额奖励：课时数超过目标

扣款总额 = Σ(扣款项)
  - 迟到扣款：基于 LessonAttendance 数据
  - 请假扣款：基于 Lesson 取消记录
  - 旷工扣款：未提前通知的缺课
```

### 数据来源映射
- **基础工资**: 根据 baseCalculation.type 决定计算方式
- **收入基数**: CourseEntity.price × EnrollmentEntity（PERCENTAGE 模式需要）
- **奖励触发**:
  - 满勤: LessonAttendanceEntity（所有学生 status = PRESENT）
  - 评价: 未来评价系统（当前预留接口）
- **扣款触发**:
  - 迟到: LessonAttendanceEntity（teacherId 维度的迟到记录）
  - 取消: LessonEntity（status = CANCELLED 且 teacherId 匹配）

### 计算示例
```
教师D（赵六），CUSTOM_ENGINE 模式
结算周期：2026年7月

基础工资计算（PERCENTAGE 模式）：
  机构收入（该教师相关课程学费总额）：25000元
  教师比例：40%
  基础工资 = 25000 × 40% = 10000元

奖励项：
  - 满勤奖励：500元（条件：所有课时学生出勤率100%）
  - 超额奖励：300元（条件：课时数 > 目标20节，实际25节）
  奖励总额 = 500 + 300 = 800元

扣款项：
  - 迟到扣款：100元（1次迟到 × 100元/次）
  - 取消课程扣款：200元（1次取消 × 200元/次）
  扣款总额 = 100 + 200 = 300元

工资 = 10000 + 800 - 300 = 10500元
```

### 数据结构
```typescript
interface CustomEngineRule {
  salaryType: 'CUSTOM_ENGINE';
  ruleConfig: {
    // 基础工资计算
    baseCalculation: {
      type: 'FIXED' | 'PERCENTAGE' | 'TIER';
      
      // FIXED 模式
      fixedAmount?: number;
      
      // PERCENTAGE 模式
      percentage?: number;         // 百分比（0-100）
      revenueSource?: 'TUITION' | 'LESSON_FEE'; // 收入来源
      
      // TIER 模式
      tiers?: Array<{
        minLessons: number;
        maxLessons: number | null;
        pricePerLesson: number;
      }>;
    };
    
    // 奖励项
    bonuses: Array<{
      name: string;                // 奖励名称
      type: 'FIXED';               // 当前仅支持固定金额
      amount: number;              // 奖励金额
      condition: BonusCondition;   // 触发条件
    }>;
    
    // 扣款项
    deductions: Array<{
      name: string;                // 扣款名称
      type: 'FIXED';               // 当前仅支持固定金额
      amount: number;              // 每次扣款金额
      condition: DeductionCondition; // 触发条件
    }>;
  };
}

// 奖励条件
interface BonusCondition {
  type: 'FULL_ATTENDANCE' | 'LESSON_TARGET' | 'RATING';
  // FULL_ATTENDANCE: 满勤（所有学生出勤率100%）
  // LESSON_TARGET: 达到课时目标
  // RATING: 评价达标
  
  threshold?: number;              // 阈值（课时目标数/评分阈值）
}

// 扣款条件
interface DeductionCondition {
  type: 'LATE' | 'CANCEL' | 'ABSENT';
  // LATE: 迟到（基于考勤记录）
  // CANCEL: 取消课程（基于 Lesson CANCELLED）
  // ABSENT: 旷工（未通知的缺课）
  
  perOccurrence: boolean;          // 是否按次扣款
}
```

### 优势
- 极度灵活，支持任意薪酬规则组合
- 支持多机构不同规则
- 可扩展新规则类型
- 支持 SaaS 平台化部署

### 劣势
- 实现复杂度高
- 规则配置需要专业知识
- 需要规则引擎框架支持
- 测试覆盖难度大

---

## 薪酬模式选择指南

### 小型工作室（1-5个教师）
推荐：模式A（纯课时费）
理由：简单明了，易于管理，无需底薪计算

### 中型机构（5-20个教师）
推荐：模式B（底薪+固定课时费）
理由：有底薪保障，计算简单，教师稳定性好

### 大型机构（20+个教师）
推荐：模式C（底薪+阶梯课时费）
理由：阶梯激励，鼓励多授课，提升机构产能

### 多机构平台
推荐：模式D（自定义规则引擎）
理由：极度灵活，支持不同机构不同规则，SaaS 化核心

---

## 与现有系统的关联

### 数据流
```
TeacherAssignment（教师分配）
  → 确定 teacherId + classCode + role + effectiveFrom/To
  ↓
Lesson（课时记录）
  → 筛选 status=FINISHED + teacherId + scheduledDate 在结算周期
  ↓
LessonAttendance（学生考勤）
  → 统计出勤率（用于满勤奖励/扣款）
  ↓
SalaryRule（薪酬规则）
  → 提供 salaryType + ruleConfig
  ↓
SalaryRuleEngine（薪酬引擎）
  → 根据 salaryType 选择计算策略
  → 输出 SalaryRecord
  ↓
SalaryRecord（工资记录）
  → 存储计算结果（明细+总额）
  ↓
Settlement（工资结算）
  → 确认 + 支付 + 归档
```

### 关键关联字段
- **教师**: UserEntity.id → LessonEntity.teacherId → TeacherAssignmentEntity.teacherId
- **课时**: LessonEntity.status = FINISHED（唯一计入薪酬的状态）
- **考勤**: LessonAttendanceEntity.lessonId → LessonEntity.id
- **角色**: TeacherAssignmentEntity.role（PRIMARY/SUBSTITUTE/ASSISTANT）
- **时间**: LessonEntity.scheduledDate 在结算周期内

### 需要新建的 Entity
1. **SalaryRuleEntity** — 薪酬规则配置
   - teacherId / salaryType / ruleConfig(JSON) / effectiveFrom / effectiveTo
   
2. **SalaryRecordEntity** — 工资计算记录
   - teacherId / periodStart / periodEnd / salaryType / detail(JSON) / totalAmount / status
   
3. **SettlementEntity** — 工资结算
   - salaryRecordId / settledAt / settledBy / paymentMethod / note

---

## 薪酬模式对比总结

| 维度 | 模式A | 模式B | 模式C | 模式D |
|------|-------|-------|-------|-------|
| 计算复杂度 | 低 | 中 | 高 | 极高 |
| 教师保障 | 无 | 有（底薪） | 有（底薪） | 取决于规则 |
| 激励效果 | 无 | 无 | 强（阶梯） | 取决于规则 |
| 配置复杂度 | 低 | 低 | 中 | 高 |
| 多机构支持 | 否 | 否 | 否 | 是 |
| 实施优先级 | P0-1 | P0-2 | P1 | P2 |
| 适用教师类型 | 兼职/外聘 | 全职/长期 | 全职/激励 | 平台型 |

---

## 实施路线图

### Phase 1: 模式A（纯课时费）
- 新建 SalaryRuleEntity（salaryType=LESSON_FIXED）
- 实现 SalaryCalculatorService.calculateLessonFixed()
- 新建 SalaryRecordEntity 存储结果
- 验证：从现有 Lesson 数据计算工资

### Phase 2: 模式B（底薪+固定课时费）
- 扩展 SalaryRuleEntity（salaryType=BASE_PLUS_LESSON）
- 实现 SalaryCalculatorService.calculateBasePlusLesson()
- 验证：底薪+课时费计算正确

### Phase 3: 模式C（底薪+阶梯课时费）
- 扩展 SalaryRuleEntity（salaryType=BASE_PLUS_TIER）
- 实现 SalaryCalculatorService.calculateBasePlusTier()
- 验证：阶梯计算逻辑正确（边界测试）

### Phase 4: 模式D（自定义规则引擎）
- 设计 SalaryRuleEngine 框架
- 实现基础计算策略（FIXED/PERCENTAGE/TIER）
- 实现奖励/扣款引擎
- 验证：组合规则计算正确

---

## 结论

### 设计完整性
- ✅ 4种薪酬模式完整设计
- ✅ 每种模式有明确的适用场景
- ✅ 每种模式有清晰的计算公式
- ✅ 每种模式有详细的 TypeScript 数据结构
- ✅ 每种模式有具体的计算示例
- ✅ 与现有系统（Lesson/Attendance/TeacherAssignment）关联清晰
- ✅ 缺失字段已识别（SalaryRule/SalaryRecord/Settlement）

### 可扩展性
- ✅ 支持多种教师合作模式（兼职/全职/外聘/平台）
- ✅ 支持未来多机构（模式D）
- ✅ 支持复杂薪酬规则（奖励/扣款/百分比）
- ✅ 支持灵活配置（ruleConfig JSON 结构）
- ✅ 支持按角色差异化（PRIMARY/SUBSTITUTE/ASSISTANT 不同单价）

### 下一步
- Phase 3 Batch 3.1: 数据模型设计（SalaryRule / SalaryRecord / Settlement Entity 定义）
- Phase 4 Batch 4.1: 计算规则设计（SalaryRuleEngine 策略模式）
