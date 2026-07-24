# 教师薪酬 API 设计文档

## 设计时间
2026-07-24

## 设计依据
- SALARY-DATA-SOURCE-ANALYSIS.md（数据源分析）
- SALARY-MODEL-DESIGN.md（模型设计 — 4种薪酬模式）
- SALARY-DATABASE-DESIGN.md（数据库设计 — 3个 Entity）
- SALARY-CALCULATION-DESIGN.md（计算规则设计 — 4种策略）

## 设计原则
1. RESTful 风格，与现有 API 保持一致
2. 使用现有 ApiResponse 统一响应格式（code=0 表示成功）
3. 使用现有 JwtAuthGuard + RolesGuard 权限体系
4. 支持 Teacher（查自己）/ Admin+SuperAdmin（查所有、管理）权限分层
5. 仅设计，不实现

## 依赖的 Entity（已设计，未实现）
- SalaryRuleEntity（salary_rule 表）— 薪酬规则配置
- SalaryRecordEntity（salary_record 表）— 工资记录明细
- SettlementEntity（settlement 表）— 工资结算

## 依赖的现有模块
- JwtAuthGuard（identity/auth/jwt-auth.guard）— JWT 认证
- RolesGuard（common/guards/roles.guard）— 角色鉴权
- Roles 装饰器（common/decorators/roles.decorator）— 角色标注
- ApiResponse（common/dto/api-response）— 统一响应格式

---

## API 概览

```
方法      路径                                        说明              权限
GET       /salary/my                                  查询我的工资汇总    Teacher/Admin
GET       /salary/records                             查询工资记录明细    Teacher/Admin
GET       /salary/settlements                         查询工资结算列表    Teacher/Admin
GET       /salary/settlements/:id                     查询结算详情        Teacher/Admin
POST      /salary/calculate                           计算教师工资        Admin/SuperAdmin
POST      /salary/settlement                          生成工资结算        Admin/SuperAdmin
PUT       /salary/settlement/:id/confirm              确认结算            Admin/SuperAdmin
PUT       /salary/settlement/:id/pay                  标记支付            Admin/SuperAdmin
GET       /salary/rules                               查询规则列表        Admin/SuperAdmin
POST      /salary/rules                               创建规则            Admin/SuperAdmin
PUT       /salary/rules/:id                           更新规则            Admin/SuperAdmin
DELETE    /salary/rules/:id                           删除规则            Admin/SuperAdmin
```

共 12 个 API 端点。

---

## 1. 教师工资查询 API

### 1.1 查询我的工资汇总

```
GET /salary/my?month=2026-07
```

**权限**：Teacher（只能查自己）、Admin/SuperAdmin（可查所有，通过 teacherId 参数指定）

**设计说明**：
- 教师登录后默认查自己的工资汇总
- Admin 可通过 teacherId 参数查指定教师的工资
- 返回当月汇总数据 + 明细记录列表

**请求参数（Query）**：

```
month        string    可选    结算月份，格式 YYYY-MM，默认当前月
teacherId    number    可选    教师ID（仅 Admin/SuperAdmin 可用，Teacher 自动填充为自身 ID）
```

**响应**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "teacherId": 1,
    "teacherName": "张老师",
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {
      "baseAmount": 5000,
      "lessonAmount": 2000,
      "bonusAmount": 0,
      "deductionAmount": 0,
      "totalLessons": 20
    },
    "records": [
      {
        "id": 1,
        "amount": 5000,
        "source": "BASE",
        "calculateDate": "2026-07-15",
        "detail": {
          "salaryType": "BASE_PLUS_LESSON",
          "baseSalary": 5000
        }
      },
      {
        "id": 2,
        "amount": 300,
        "source": "LESSON",
        "lessonId": 101,
        "calculateDate": "2026-07-03",
        "detail": {
          "salaryType": "BASE_PLUS_LESSON",
          "lessonPrice": 100,
          "role": "PRIMARY",
          "classCode": "CLS-001",
          "lessonNumber": 3
        }
      }
    ],
    "settlement": {
      "id": 1,
      "status": "PENDING",
      "confirmedAt": null,
      "paidAt": null
    }
  }
}
```

**特殊情况**：
- 如果该月无工资记录 → data = null，message = "该月暂无工资记录"
- Teacher 角色传 teacherId 且不是自己的 ID → 返回 403

**Controller 伪代码**：

```typescript
@Get('my')
@Roles('Teacher', 'Admin', 'SuperAdmin')
@ApiOperation({ summary: '查询我的工资汇总' })
async getMySalary(@Req() req: any, @Query() query: GetMySalaryDto) {
  const teacherId = req.user.role === 'Teacher'
    ? req.user.sub
    : (query.teacherId || req.user.sub);
  const month = query.month || dayjs().format('YYYY-MM');
  const result = await this.salaryService.getMySalary(teacherId, month);
  return ApiResponse.success(result);
}
```

---

### 1.2 查询工资记录明细

```
GET /salary/records
```

**权限**：Teacher（只能查自己的）、Admin/SuperAdmin（可查所有）

**设计说明**：
- 返回 SalaryRecord 列表，支持多维度筛选
- Teacher 角色自动注入 teacherId，只能看自己的记录
- 支持分页

**请求参数（Query）**：

```
teacherId     number    可选    教师ID（Admin 可指定，Teacher 自动填充）
month         string    可选    月份筛选，格式 YYYY-MM
source        string    可选    来源筛选：LESSON / BONUS / DEDUCTION
status        string    可选    状态筛选：PENDING / CONFIRMED / PAID
startDate     string    可选    起始日期，格式 YYYY-MM-DD
endDate       string    可选    结束日期，格式 YYYY-MM-DD
page          number    可选    页码，默认 1
pageSize      number    可选    每页条数，默认 20，最大 100
```

**响应**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 25,
    "page": 1,
    "pageSize": 20,
    "records": [
      {
        "id": 1,
        "teacherId": 1,
        "teacherName": "张老师",
        "lessonId": 101,
        "amount": 300,
        "calculateDate": "2026-07-03",
        "source": "LESSON",
        "status": "PENDING",
        "detail": {
          "salaryType": "BASE_PLUS_LESSON",
          "lessonPrice": 100,
          "role": "PRIMARY",
          "classCode": "CLS-001",
          "lessonNumber": 3
        },
        "createdAt": "2026-07-24T10:00:00.000Z"
      },
      {
        "id": 2,
        "teacherId": 1,
        "teacherName": "张老师",
        "lessonId": null,
        "amount": 500,
        "calculateDate": "2026-07-31",
        "source": "BONUS",
        "status": "PENDING",
        "detail": {
          "bonusName": "满勤奖励",
          "condition": "FULL_ATTENDANCE",
          "month": "2026-07"
        },
        "createdAt": "2026-07-24T10:00:00.000Z"
      }
    ]
  }
}
```

**Controller 伪代码**：

```typescript
@Get('records')
@Roles('Teacher', 'Admin', 'SuperAdmin')
@ApiOperation({ summary: '查询工资记录明细（分页）' })
async getRecords(@Req() req: any, @Query() query: GetRecordsDto) {
  const teacherId = req.user.role === 'Teacher' ? req.user.sub : query.teacherId;
  const result = await this.salaryService.getRecords({ ...query, teacherId });
  return ApiResponse.success(result);
}
```

---

### 1.3 查询工资结算列表

```
GET /salary/settlements
```

**权限**：Teacher（只能查自己的）、Admin/SuperAdmin（可查所有）

**设计说明**：
- 返回 Settlement 列表，按月汇总
- Teacher 角色自动注入 teacherId
- 支持按年份、状态筛选
- 支持分页

**请求参数（Query）**：

```
teacherId     number    可选    教师ID（Admin 可指定，Teacher 自动填充）
year          number    可选    年份筛选，如 2026
month         string    可选    月份筛选，格式 YYYY-MM
status        string    可选    状态筛选：PENDING / CONFIRMED / PAID
page          number    可选    页码，默认 1
pageSize      number    可选    每页条数，默认 20，最大 100
```

**响应**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 7,
    "page": 1,
    "pageSize": 20,
    "settlements": [
      {
        "id": 1,
        "teacherId": 1,
        "teacherName": "张老师",
        "month": "2026-07",
        "totalAmount": 7000,
        "status": "PENDING",
        "breakdown": {
          "salaryType": "BASE_PLUS_LESSON",
          "lessonCount": 20,
          "baseSalary": 5000,
          "lessonFee": 2000,
          "bonuses": [],
          "deductions": [],
          "totalAmount": 7000
        },
        "confirmedAt": null,
        "confirmedBy": null,
        "paidAt": null,
        "paidBy": null,
        "note": null,
        "createdAt": "2026-07-24T10:00:00.000Z"
      }
    ]
  }
}
```

**Controller 伪代码**：

```typescript
@Get('settlements')
@Roles('Teacher', 'Admin', 'SuperAdmin')
@ApiOperation({ summary: '查询工资结算列表（分页）' })
async getSettlements(@Req() req: any, @Query() query: GetSettlementsDto) {
  const teacherId = req.user.role === 'Teacher' ? req.user.sub : query.teacherId;
  const result = await this.salaryService.getSettlements({ ...query, teacherId });
  return ApiResponse.success(result);
}
```

---

### 1.4 查询结算详情

```
GET /salary/settlements/:id
```

**权限**：Teacher（只能查自己的）、Admin/SuperAdmin（可查所有）

**设计说明**：
- 返回单条 Settlement 的完整信息
- 包含关联的 SalaryRecord 明细列表
- Teacher 角色如果查非自己的结算 → 403

**请求参数（Path）**：

```
id    number    必填    结算ID
```

**响应**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "teacherId": 1,
    "teacherName": "张老师",
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {
      "salaryType": "BASE_PLUS_LESSON",
      "periodStart": "2026-07-01",
      "periodEnd": "2026-07-31",
      "lessonCount": 20,
      "baseSalary": 5000,
      "lessonFee": 2000,
      "bonuses": [
        {"name": "满勤奖励", "amount": 500}
      ],
      "deductions": [
        {"name": "迟到扣款", "amount": -100}
      ],
      "totalAmount": 7000
    },
    "records": [
      {
        "id": 1,
        "lessonId": 101,
        "amount": 300,
        "calculateDate": "2026-07-03",
        "source": "LESSON",
        "detail": {
          "salaryType": "BASE_PLUS_LESSON",
          "lessonPrice": 100,
          "role": "PRIMARY",
          "classCode": "CLS-001",
          "lessonNumber": 3
        }
      }
    ],
    "confirmedAt": null,
    "confirmedBy": null,
    "paidAt": null,
    "paidBy": null,
    "note": null,
    "createdAt": "2026-07-24T10:00:00.000Z",
    "updatedAt": "2026-07-24T10:00:00.000Z"
  }
}
```

**错误响应**：
- 404：结算不存在
- 403：无权查看（Teacher 查非自己的结算）

**Controller 伪代码**：

```typescript
@Get('settlements/:id')
@Roles('Teacher', 'Admin', 'SuperAdmin')
@ApiOperation({ summary: '查询结算详情' })
async getSettlementDetail(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
  const result = await this.salaryService.getSettlementDetail(id, req.user);
  return ApiResponse.success(result);
}
```

---

## 2. 工资计算 API

### 2.1 计算教师工资

```
POST /salary/calculate
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 调用 SalaryRuleEngine 计算指定教师在指定时间段的工资
- 计算结果生成 SalaryRecord 记录（持久化）
- 如果该教师该时间段已有计算记录，需先清除或返回错误
- 计算前会校验：教师存在、有 ACTIVE 规则、有 FINISHED 课时

**请求体（Body）**：

```json
{
  "teacherId": 1,
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "overwrite": false
}
```

**字段说明**：

```
teacherId     number    必填    教师ID
startDate     string    必填    计算起始日期，格式 YYYY-MM-DD
endDate       string    必填    计算结束日期，格式 YYYY-MM-DD
overwrite     boolean   可选    是否覆盖已有记录，默认 false
```

**成功响应**：

```json
{
  "code": 0,
  "message": "工资计算成功",
  "data": {
    "teacherId": 1,
    "teacherName": "张老师",
    "salaryType": "BASE_PLUS_LESSON",
    "startDate": "2026-07-01",
    "endDate": "2026-07-31",
    "totalAmount": 7000,
    "summary": {
      "totalLessons": 20,
      "baseAmount": 5000,
      "lessonAmount": 2000,
      "bonusAmount": 500,
      "deductionAmount": 0
    },
    "records": [
      {
        "id": 1,
        "amount": 5000,
        "source": "BASE",
        "calculateDate": "2026-07-15"
      },
      {
        "id": 2,
        "amount": 300,
        "source": "LESSON",
        "lessonId": 101,
        "calculateDate": "2026-07-03"
      },
      {
        "id": 22,
        "amount": 500,
        "source": "BONUS",
        "calculateDate": "2026-07-31"
      }
    ],
    "recordCount": 22
  }
}
```

**错误响应**：

```json
// 教师不存在
{
  "code": 400,
  "message": "教师不存在",
  "data": null
}

// 无薪酬规则
{
  "code": 400,
  "message": "该教师没有生效的薪酬规则",
  "data": null
}

// 已有计算记录且 overwrite=false
{
  "code": 400,
  "message": "该时间段已计算过工资，如需重新计算请设置 overwrite=true",
  "data": null
}

// 无完成课时
{
  "code": 400,
  "message": "该教师在指定时间段内无已完成课时",
  "data": null
}

// 日期范围无效
{
  "code": 400,
  "message": "日期范围无效，startDate 必须早于 endDate",
  "data": null
}
```

**Controller 伪代码**：

```typescript
@Post('calculate')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '计算教师工资' })
async calculateSalary(@Body() dto: CalculateSalaryDto) {
  const result = await this.salaryService.calculateSalary(dto);
  return ApiResponse.success(result, '工资计算成功');
}
```

---

## 3. 工资结算 API

### 3.1 生成工资结算

```
POST /salary/settlement
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 汇总指定教师指定月份的所有 SalaryRecord，生成 Settlement
- 同一教师同一月份只能有一条 Settlement（唯一约束）
- 如果已有 Settlement，返回错误或要求先删除
- Settlement 的 breakdown 字段存储汇总明细

**请求体（Body）**：

```json
{
  "teacherId": 1,
  "month": "2026-07",
  "note": "7月工资结算"
}
```

**字段说明**：

```
teacherId     number    必填    教师ID
month         string    必填    结算月份，格式 YYYY-MM
note          string    可选    备注
```

**成功响应**：

```json
{
  "code": 0,
  "message": "结算生成成功",
  "data": {
    "id": 1,
    "teacherId": 1,
    "teacherName": "张老师",
    "month": "2026-07",
    "totalAmount": 7000,
    "status": "PENDING",
    "breakdown": {
      "salaryType": "BASE_PLUS_LESSON",
      "periodStart": "2026-07-01",
      "periodEnd": "2026-07-31",
      "lessonCount": 20,
      "baseSalary": 5000,
      "lessonFee": 2000,
      "bonuses": [],
      "deductions": [],
      "totalAmount": 7000
    },
    "recordCount": 22,
    "note": "7月工资结算",
    "createdAt": "2026-07-24T10:00:00.000Z"
  }
}
```

**错误响应**：

```json
// 该月已有结算
{
  "code": 400,
  "message": "该教师2026-07月已有结算记录，请勿重复生成",
  "data": null
}

// 无工资记录可汇总
{
  "code": 400,
  "message": "该教师该月无工资记录，请先执行工资计算",
  "data": null
}
```

**Controller 伪代码**：

```typescript
@Post('settlement')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '生成工资结算' })
async createSettlement(@Body() dto: CreateSettlementDto) {
  const result = await this.salaryService.createSettlement(dto);
  return ApiResponse.success(result, '结算生成成功');
}
```

---

### 3.2 确认结算

```
PUT /salary/settlement/:id/confirm
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 将 Settlement 状态从 PENDING 改为 CONFIRMED
- 记录确认时间和确认人（confirmedAt, confirmedBy）
- 只有 PENDING 状态的结算可以确认
- 同时更新关联的 SalaryRecord 状态为 CONFIRMED

**请求参数（Path）**：

```
id    number    必填    结算ID
```

**成功响应**：

```json
{
  "code": 0,
  "message": "结算确认成功",
  "data": {
    "id": 1,
    "status": "CONFIRMED",
    "confirmedAt": "2026-07-24T11:00:00.000Z",
    "confirmedBy": 1,
    "confirmedByName": "管理员"
  }
}
```

**错误响应**：

```json
// 结算不存在
{
  "code": 404,
  "message": "结算不存在",
  "data": null
}

// 已确认或已支付
{
  "code": 400,
  "message": "该结算已确认，不可重复确认",
  "data": null
}
```

**Controller 伪代码**：

```typescript
@Put('settlement/:id/confirm')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '确认结算' })
async confirmSettlement(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
  const result = await this.salaryService.confirmSettlement(id, req.user.sub);
  return ApiResponse.success(result, '结算确认成功');
}
```

---

### 3.3 标记支付

```
PUT /salary/settlement/:id/pay
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 将 Settlement 状态从 CONFIRMED 改为 PAID
- 记录支付时间和操作人（paidAt, paidBy）
- 只有 CONFIRMED 状态的结算可以标记支付
- 同时更新关联的 SalaryRecord 状态为 PAID

**请求参数（Path）**：

```
id    number    必填    结算ID
```

**请求体（Body，可选）**：

```json
{
  "note": "已通过银行转账支付"
}
```

**成功响应**：

```json
{
  "code": 0,
  "message": "支付标记成功",
  "data": {
    "id": 1,
    "status": "PAID",
    "paidAt": "2026-07-24T12:00:00.000Z",
    "paidBy": 1,
    "paidByName": "管理员"
  }
}
```

**错误响应**：

```json
// 结算不存在
{
  "code": 404,
  "message": "结算不存在",
  "data": null
}

// 未确认
{
  "code": 400,
  "message": "该结算尚未确认，请先确认后再标记支付",
  "data": null
}

// 已支付
{
  "code": 400,
  "message": "该结算已支付，不可重复操作",
  "data": null
}
```

**Controller 伪代码**：

```typescript
@Put('settlement/:id/pay')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '标记支付' })
async paySettlement(
  @Req() req: any,
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: PaySettlementDto,
) {
  const result = await this.salaryService.paySettlement(id, req.user.sub, dto.note);
  return ApiResponse.success(result, '支付标记成功');
}
```

---

## 4. 工资规则管理 API

### 4.1 查询规则列表

```
GET /salary/rules
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 返回 SalaryRule 列表
- 支持按教师、薪酬类型、状态筛选
- 支持分页

**请求参数（Query）**：

```
teacherId      number    可选    教师ID
salaryType     string    可选    薪酬类型：LESSON_FIXED / BASE_PLUS_LESSON / BASE_PLUS_TIER / CUSTOM_ENGINE
status         string    可选    状态：ACTIVE / INACTIVE
page           number    可选    页码，默认 1
pageSize       number    可选    每页条数，默认 20，最大 100
```

**响应**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "rules": [
      {
        "id": 1,
        "organizationId": 0,
        "teacherId": 1,
        "teacherName": "张老师",
        "salaryType": "BASE_PLUS_LESSON",
        "ruleConfig": {
          "baseSalary": 5000,
          "lessonPrice": 100,
          "rolePriceMap": {
            "PRIMARY": 100,
            "SUBSTITUTE": 80,
            "ASSISTANT": 60
          }
        },
        "effectiveDate": "2026-01-01",
        "status": "ACTIVE",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      },
      {
        "id": 2,
        "organizationId": 0,
        "teacherId": 2,
        "teacherName": "李老师",
        "salaryType": "LESSON_FIXED",
        "ruleConfig": {
          "lessonPrice": 300,
          "rolePriceMap": {
            "PRIMARY": 300,
            "SUBSTITUTE": 200,
            "ASSISTANT": 150
          }
        },
        "effectiveDate": "2026-03-01",
        "status": "ACTIVE",
        "createdAt": "2026-03-01T00:00:00.000Z",
        "updatedAt": "2026-03-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Controller 伪代码**：

```typescript
@Get('rules')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '查询薪酬规则列表（分页）' })
async getRules(@Query() query: GetRulesDto) {
  const result = await this.salaryService.getRules(query);
  return ApiResponse.success(result);
}
```

---

### 4.2 创建规则

```
POST /salary/rules
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 创建新的薪酬规则
- 如果该教师已有 ACTIVE 规则，新规则创建后旧规则自动变为 INACTIVE
- 也可以创建 teacherId=null 的全局规则（机构级默认）

**请求体（Body）**：

```json
{
  "organizationId": 0,
  "teacherId": 1,
  "salaryType": "BASE_PLUS_LESSON",
  "ruleConfig": {
    "baseSalary": 5000,
    "lessonPrice": 100,
    "rolePriceMap": {
      "PRIMARY": 100,
      "SUBSTITUTE": 80,
      "ASSISTANT": 60
    }
  },
  "effectiveDate": "2026-01-01"
}
```

**字段说明**：

```
organizationId    number                  必填    机构ID（0=全局）
teacherId         number | null           必填    教师ID（null=全局规则）
salaryType        string                  必填    薪酬类型枚举
ruleConfig        Record<string, any>     必填    规则配置（JSON 结构，按 salaryType 不同而不同）
effectiveDate     string                  必填    生效日期，格式 YYYY-MM-DD
```

**ruleConfig 结构参考**（按 salaryType 区分）：

LESSON_FIXED:
```json
{
  "lessonPrice": 300,
  "rolePriceMap": {"PRIMARY": 300, "SUBSTITUTE": 200, "ASSISTANT": 150}
}
```

BASE_PLUS_LESSON:
```json
{
  "baseSalary": 5000,
  "lessonPrice": 100,
  "rolePriceMap": {"PRIMARY": 100, "SUBSTITUTE": 80, "ASSISTANT": 60},
  "minLessonForBase": null
}
```

BASE_PLUS_TIER:
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

CUSTOM_ENGINE:
```json
{
  "baseCalculation": {"type": "FIXED", "value": 5000},
  "bonuses": [
    {"name": "满勤奖励", "type": "FIXED", "amount": 500, "condition": {"type": "FULL_ATTENDANCE"}}
  ],
  "deductions": [
    {"name": "迟到扣款", "type": "FIXED", "amount": 100, "condition": {"type": "LATE", "perOccurrence": true}}
  ]
}
```

**成功响应**：

```json
{
  "code": 0,
  "message": "规则创建成功",
  "data": {
    "id": 1,
    "organizationId": 0,
    "teacherId": 1,
    "salaryType": "BASE_PLUS_LESSON",
    "ruleConfig": {
      "baseSalary": 5000,
      "lessonPrice": 100,
      "rolePriceMap": {
        "PRIMARY": 100,
        "SUBSTITUTE": 80,
        "ASSISTANT": 60
      }
    },
    "effectiveDate": "2026-01-01",
    "status": "ACTIVE",
    "createdAt": "2026-07-24T10:00:00.000Z"
  }
}
```

**错误响应**：

```json
// 教师不存在
{
  "code": 400,
  "message": "教师不存在",
  "data": null
}

// salaryType 无效
{
  "code": 400,
  "message": "无效的薪酬类型",
  "data": null
}

// ruleConfig 结构不匹配
{
  "code": 400,
  "message": "ruleConfig 结构与 salaryType 不匹配",
  "data": null
}
```

**Controller 伪代码**：

```typescript
@Post('rules')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '创建薪酬规则' })
async createRule(@Body() dto: CreateRuleDto) {
  const result = await this.salaryService.createRule(dto);
  return ApiResponse.success(result, '规则创建成功');
}
```

---

### 4.3 更新规则

```
PUT /salary/rules/:id
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 更新已有规则的配置
- 可以修改 ruleConfig 和 effectiveDate
- 不允许修改 teacherId 和 salaryType（需删除重建）
- 修改后不影响已计算的 SalaryRecord（历史数据不变）

**请求参数（Path）**：

```
id    number    必填    规则ID
```

**请求体（Body）**：

```json
{
  "ruleConfig": {
    "baseSalary": 6000,
    "lessonPrice": 120,
    "rolePriceMap": {
      "PRIMARY": 120,
      "SUBSTITUTE": 100,
      "ASSISTANT": 80
    }
  },
  "effectiveDate": "2026-08-01",
  "status": "ACTIVE"
}
```

**字段说明**：

```
ruleConfig       Record<string, any>     可选    规则配置（结构同创建）
effectiveDate    string                  可选    生效日期
status           string                  可选    状态：ACTIVE / INACTIVE
```

**成功响应**：

```json
{
  "code": 0,
  "message": "规则更新成功",
  "data": {
    "id": 1,
    "ruleConfig": {
      "baseSalary": 6000,
      "lessonPrice": 120,
      "rolePriceMap": {
        "PRIMARY": 120,
        "SUBSTITUTE": 100,
        "ASSISTANT": 80
      }
    },
    "effectiveDate": "2026-08-01",
    "status": "ACTIVE",
    "updatedAt": "2026-07-24T11:00:00.000Z"
  }
}
```

**错误响应**：

```json
// 规则不存在
{
  "code": 404,
  "message": "规则不存在",
  "data": null
}
```

**Controller 伪代码**：

```typescript
@Put('rules/:id')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '更新薪酬规则' })
async updateRule(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdateRuleDto,
) {
  const result = await this.salaryService.updateRule(id, dto);
  return ApiResponse.success(result, '规则更新成功');
}
```

---

### 4.4 删除规则

```
DELETE /salary/rules/:id
```

**权限**：Admin / SuperAdmin

**设计说明**：
- 软删除或硬删除（建议硬删除，因为规则是配置数据）
- 如果有已计算的 SalaryRecord 引用了该规则，建议改为 INACTIVE 而非删除
- 删除前检查：如果有 PENDING 状态的 SalaryRecord/Settlement 引用 → 拒绝删除

**请求参数（Path）**：

```
id    number    必填    规则ID
```

**成功响应**：

```json
{
  "code": 0,
  "message": "规则删除成功",
  "data": null
}
```

**错误响应**：

```json
// 规则不存在
{
  "code": 404,
  "message": "规则不存在",
  "data": null
}

// 有关联的待处理记录
{
  "code": 400,
  "message": "该规则有关联的待处理工资记录，请先处理后再删除",
  "data": null
}
```

**Controller 伪代码**：

```typescript
@Delete('rules/:id')
@Roles('Admin', 'SuperAdmin')
@ApiOperation({ summary: '删除薪酬规则' })
async deleteRule(@Param('id', ParseIntPipe) id: number) {
  await this.salaryService.deleteRule(id);
  return ApiResponse.success(null, '规则删除成功');
}
```

---

## 5. DTO 设计

### 5.1 GetMySalaryDto

```typescript
export class GetMySalaryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @IsNumber()
  teacherId?: number;
}
```

### 5.2 GetRecordsDto

```typescript
export class GetRecordsDto {
  @IsOptional()
  @IsNumber()
  teacherId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @IsEnum(SalaryRecordSource)
  source?: SalaryRecordSource;

  @IsOptional()
  @IsEnum(SalaryRecordStatus)
  status?: SalaryRecordStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
```

### 5.3 GetSettlementsDto

```typescript
export class GetSettlementsDto {
  @IsOptional()
  @IsNumber()
  teacherId?: number;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
```

### 5.4 CalculateSalaryDto

```typescript
export class CalculateSalaryDto {
  @IsNumber()
  teacherId: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
```

### 5.5 CreateSettlementDto

```typescript
export class CreateSettlementDto {
  @IsNumber()
  teacherId: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month: string;

  @IsOptional()
  @IsString()
  note?: string;
}
```

### 5.6 PaySettlementDto

```typescript
export class PaySettlementDto {
  @IsOptional()
  @IsString()
  note?: string;
}
```

### 5.7 GetRulesDto

```typescript
export class GetRulesDto {
  @IsOptional()
  @IsNumber()
  teacherId?: number;

  @IsOptional()
  @IsEnum(SalaryType)
  salaryType?: SalaryType;

  @IsOptional()
  @IsEnum(SalaryRuleStatus)
  status?: SalaryRuleStatus;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;
}
```

### 5.8 CreateRuleDto

```typescript
export class CreateRuleDto {
  @IsOptional()
  @IsNumber()
  organizationId?: number;

  @IsOptional()
  @IsNumber()
  teacherId?: number | null;

  @IsEnum(SalaryType)
  salaryType: SalaryType;

  @IsObject()
  ruleConfig: Record<string, any>;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate: string;
}
```

### 5.9 UpdateRuleDto

```typescript
export class UpdateRuleDto {
  @IsOptional()
  @IsObject()
  ruleConfig?: Record<string, any>;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate?: string;

  @IsOptional()
  @IsEnum(SalaryRuleStatus)
  status?: SalaryRuleStatus;
}
```

---

## 6. 权限设计

### 角色权限矩阵

```
API                                  Teacher    Admin    SuperAdmin
GET  /salary/my                      ✅ 自己     ✅ 所有   ✅ 所有
GET  /salary/records                 ✅ 自己     ✅ 所有   ✅ 所有
GET  /salary/settlements             ✅ 自己     ✅ 所有   ✅ 所有
GET  /salary/settlements/:id         ✅ 自己     ✅ 所有   ✅ 所有
POST /salary/calculate               ❌         ✅        ✅
POST /salary/settlement              ❌         ✅        ✅
PUT  /salary/settlement/:id/confirm  ❌         ✅        ✅
PUT  /salary/settlement/:id/pay      ❌         ✅        ✅
GET  /salary/rules                   ❌         ✅        ✅
POST /salary/rules                   ❌         ✅        ✅
PUT  /salary/rules/:id               ❌         ✅        ✅
DELETE /salary/rules/:id             ❌         ✅        ✅
```

### 权限守卫使用

```typescript
@ApiTags('Salary')
@ApiBearerAuth()
@Controller('salary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  // Teacher 查询自动注入 teacherId
  // Admin/SuperAdmin 可指定任意 teacherId
  private resolveTeacherId(req: any, queryTeacherId?: number): number {
    if (req.user.role === 'Teacher') {
      return req.user.sub;
    }
    return queryTeacherId || req.user.sub;
  }

  // Teacher 查非自己的数据 → 在 Service 层校验
  private assertOwnership(req: any, targetTeacherId: number): void {
    if (req.user.role === 'Teacher' && req.user.sub !== targetTeacherId) {
      throw new ForbiddenException('无权查看他人工资信息');
    }
  }
}
```

---

## 7. 状态流转设计

### Settlement 状态流转

```
PENDING  →  CONFIRMED  →  PAID
   ↓
（不可回退）
```

- PENDING → CONFIRMED：管理员确认（confirmSettlement）
- CONFIRMED → PAID：管理员标记支付（paySettlement）
- 不可回退：一旦确认/支付，不可逆操作
- 如需修改：删除重建（仅 PENDING 状态可删除）

### SalaryRecord 状态跟随 Settlement

```
Settlement.confirm()  →  所有关联 SalaryRecord.status = CONFIRMED
Settlement.pay()      →  所有关联 SalaryRecord.status = PAID
```

关联方式：通过 teacherId + month 匹配（SalaryRecord.calculateDate 在该月内）

---

## 8. 错误码设计

```
错误码                      HTTP状态码    说明
TEACHER_NOT_FOUND           400          教师不存在
SALARY_RULE_NOT_FOUND       400          该教师没有生效的薪酬规则
ALREADY_CALCULATED          400          该时间段已计算过工资
INVALID_DATE_RANGE          400          日期范围无效
NO_FINISHED_LESSONS         400          该教师在指定时间段内无已完成课时
SETTLEMENT_NOT_FOUND        404          结算不存在
SETTLEMENT_ALREADY_EXISTS   400          该月已有结算记录
SETTLEMENT_ALREADY_CONFIRMED 400         结算已确认，不可重复确认
SETTLEMENT_NOT_CONFIRMED    400          结算尚未确认
SETTLEMENT_ALREADY_PAID     400          结算已支付
NO_SALARY_RECORDS           400          该教师该月无工资记录
RULE_NOT_FOUND              404          规则不存在
RULE_HAS_PENDING_RECORDS    400          规则有关联的待处理记录
INVALID_SALARY_TYPE         400          无效的薪酬类型
RULE_CONFIG_MISMATCH        400          ruleConfig 结构与 salaryType 不匹配
FORBIDDEN                   403          无权查看他人工资信息
```

---

## 9. Controller 完整结构

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Req,
  ParseIntPipe, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponse } from '@common/dto/api-response';
import { SalaryService } from './salary.service';
// DTOs...

@ApiTags('Salary')
@ApiBearerAuth()
@Controller('salary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  // ─── 查询 API ───

  @Get('my')
  @Roles('Teacher', 'Admin', 'SuperAdmin')
  @ApiOperation({ summary: '查询我的工资汇总' })
  async getMySalary(@Req() req: any, @Query() query: GetMySalaryDto) { /* ... */ }

  @Get('records')
  @Roles('Teacher', 'Admin', 'SuperAdmin')
  @ApiOperation({ summary: '查询工资记录明细（分页）' })
  async getRecords(@Req() req: any, @Query() query: GetRecordsDto) { /* ... */ }

  @Get('settlements')
  @Roles('Teacher', 'Admin', 'SuperAdmin')
  @ApiOperation({ summary: '查询工资结算列表（分页）' })
  async getSettlements(@Req() req: any, @Query() query: GetSettlementsDto) { /* ... */ }

  @Get('settlements/:id')
  @Roles('Teacher', 'Admin', 'SuperAdmin')
  @ApiOperation({ summary: '查询结算详情' })
  async getSettlementDetail(@Req() req: any, @Param('id', ParseIntPipe) id: number) { /* ... */ }

  // ─── 计算 API ───

  @Post('calculate')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '计算教师工资' })
  async calculateSalary(@Body() dto: CalculateSalaryDto) { /* ... */ }

  // ─── 结算 API ───

  @Post('settlement')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '生成工资结算' })
  async createSettlement(@Body() dto: CreateSettlementDto) { /* ... */ }

  @Put('settlement/:id/confirm')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '确认结算' })
  async confirmSettlement(@Req() req: any, @Param('id', ParseIntPipe) id: number) { /* ... */ }

  @Put('settlement/:id/pay')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '标记支付' })
  async paySettlement(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: PaySettlementDto) { /* ... */ }

  // ─── 规则管理 API ───

  @Get('rules')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '查询薪酬规则列表（分页）' })
  async getRules(@Query() query: GetRulesDto) { /* ... */ }

  @Post('rules')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '创建薪酬规则' })
  async createRule(@Body() dto: CreateRuleDto) { /* ... */ }

  @Put('rules/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '更新薪酬规则' })
  async updateRule(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRuleDto) { /* ... */ }

  @Delete('rules/:id')
  @Roles('Admin', 'SuperAdmin')
  @ApiOperation({ summary: '删除薪酬规则' })
  async deleteRule(@Param('id', ParseIntPipe) id: number) { /* ... */ }
}
```

---

## 10. 与现有系统的集成

### API 路径前缀
- 现有 API 无统一前缀（如 /students, /classes/:code/lessons）
- 薪酬 API 使用 /salary 前缀
- 如果未来需要版本化，可改为 /v1/salary

### 响应格式一致性
- 使用 ApiResponse.success(data, message) → { code: 0, message, data }
- 错误使用 ApiResponse.error(code, message) → { code: N, message, data: null }
- 与现有 LessonController / StudentController 保持一致

### 权限体系一致性
- 使用 JwtAuthGuard + RolesGuard
- 角色枚举：SuperAdmin / Admin / Teacher / Student / Parent
- 薪酬模块只涉及 Teacher / Admin / SuperAdmin

### 分页方式一致性
- 使用 page + pageSize 参数
- 返回 { total, page, pageSize, items/records/settlements }
- 默认 page=1, pageSize=20, 最大 pageSize=100

---

## 11. 实施建议

### 实施顺序
1. 先实现查询 API（GET /salary/my, /records, /settlements, /settlements/:id）
2. 再实现计算 API（POST /salary/calculate）
3. 然后实现结算 API（POST /salary/settlement, PUT confirm, PUT pay）
4. 最后实现规则管理 API（CRUD /salary/rules）

### 文件结构建议
```
src/modules/salary/
├── salary.controller.ts          # 12 个 API 端点
├── salary.service.ts             # 业务逻辑
├── salary.module.ts              # 模块定义
├── entities/
│   ├── salary-rule.entity.ts     # SalaryRuleEntity
│   ├── salary-record.entity.ts   # SalaryRecordEntity
│   └── settlement.entity.ts      # SettlementEntity
├── dto/
│   ├── get-my-salary.dto.ts
│   ├── get-records.dto.ts
│   ├── get-settlements.dto.ts
│   ├── calculate-salary.dto.ts
│   ├── create-settlement.dto.ts
│   ├── pay-settlement.dto.ts
│   ├── get-rules.dto.ts
│   ├── create-rule.dto.ts
│   └── update-rule.dto.ts
├── strategies/
│   ├── salary-strategy.interface.ts
│   ├── lesson-fixed.strategy.ts
│   ├── base-plus-lesson.strategy.ts
│   ├── base-plus-tier.strategy.ts
│   └── custom-engine.strategy.ts
├── salary-rule-engine.ts         # 策略选择器
└── enums/
    ├── salary-type.enum.ts
    ├── salary-record-source.enum.ts
    ├── salary-record-status.enum.ts
    └── settlement-status.enum.ts
```

---

## 12. 设计完整性总结

### API 完整度
- ✅ 12 个 API 端点完整设计
- ✅ 每个 API 有清晰的请求参数/响应格式
- ✅ 每个 API 有明确的权限控制
- ✅ 每个 API 有 Controller 伪代码
- ✅ 每个 API 有错误响应设计

### DTO 完整度
- ✅ 9 个 DTO 完整设计（含 class-validator 装饰器）

### 权限设计
- ✅ Teacher / Admin / SuperAdmin 三级权限矩阵
- ✅ Teacher 自动注入 teacherId（只能查自己）
- ✅ Admin/SuperAdmin 可查所有 + 管理操作

### 状态流转
- ✅ Settlement: PENDING → CONFIRMED → PAID（不可回退）
- ✅ SalaryRecord 状态跟随 Settlement

### 错误码
- ✅ 16 个错误码完整覆盖

### 与现有系统一致性
- ✅ 使用 ApiResponse 统一响应
- ✅ 使用 JwtAuthGuard + RolesGuard
- ✅ 使用 page + pageSize 分页
- ✅ Controller 结构与现有模块一致

### 下一步
- Phase 6: 与现有系统关联验证
