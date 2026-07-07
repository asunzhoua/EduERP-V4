# EduERP V4 — Data Dictionary

> 版本：v4.0
> 状态：架构冻结
> 最后更新：2026-07-06
> 文档编号：EDUOS-DDD-001

---

## 一、设计目标

Data Dictionary不是数据库，不是ER图。它是整个系统所有数据的唯一标准。

**以后任何数据库、任何接口、任何页面、任何AI，全部必须遵循本文件。**

---

## 二、字段命名规范

统一使用PascalCase。

```
StudentID
TeacherID
LessonID
CreateTime
UpdateTime
Status
Remark
```

**禁止使用：studentid、teacher_id、teacherid、teacherID。统一一种。**

---

## 三、统一字段规范

以后所有表必须拥有以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ID | bigint | √ | 雪花ID |
| CreateTime | datetime | √ | 创建时间 |
| UpdateTime | datetime | √ | 更新时间 |
| CreateUser | bigint | √ | 创建人 |
| UpdateUser | bigint | √ | 更新人 |
| Status | tinyint | √ | 状态 |
| Version | int | √ | 乐观锁 |
| Deleted | tinyint | √ | 逻辑删除 |

任何业务表全部一致。

---

## 四、Student（学生表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| StudentID | bigint | √ | 学生ID |
| StudentNo | varchar(30) | √ | 学号 |
| Name | varchar(50) | √ | 姓名 |
| Gender | tinyint | √ | 性别 |
| Birthday | date | √ | 出生日期 |
| Grade | varchar(20) | √ | 年级 |
| School | varchar(100) | √ | 学校 |
| CampusID | bigint | √ | 所属校区 |
| ParentID | bigint | √ | 默认家长 |
| Avatar | varchar(255) | × | 头像 |
| Remark | varchar(500) | × | 备注 |

索引：StudentNo、ParentID、CampusID

---

## 五、Parent（家长表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| ParentID | bigint | √ | 家长ID |
| OpenID | varchar(100) | √ | 微信OpenID |
| UnionID | varchar(100) | × | 微信UnionID |
| Name | varchar(50) | √ | 姓名 |
| Mobile | varchar(20) | √ | 手机号 |
| Relation | varchar(20) | √ | 与孩子关系 |

支持多个家长。

---

## 六、Teacher（老师表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| TeacherID | bigint | √ | 老师ID |
| Name | varchar(50) | √ | 姓名 |
| Mobile | varchar(20) | √ | 手机号 |
| SalaryRuleID | bigint | √ | 工资规则ID |
| CampusID | bigint | √ | 所属校区 |
| Status | tinyint | √ | 状态 |

以后工资全部关联SalaryRule。

---

## 七、Enrollment（报名表）

最重要。一个学生一次报名就是一条Enrollment。

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| EnrollmentID | bigint | √ | 报名ID |
| StudentID | bigint | √ | 学生ID |
| CourseID | bigint | √ | 课程ID |
| TeacherID | bigint | √ | 老师ID |
| HoursPackageID | bigint | √ | 课时包ID |
| StartDate | date | √ | 开始日期 |
| EndDate | date | √ | 结束日期 |
| RemainHours | decimal(6,2) | √ | 剩余课时（缓存值） |
| Status | tinyint | √ | 状态 |

> 设计优化：采用双轨模式。RemainHours为实时余额（缓存值，用于快速查询）；HoursLedger为唯一真实流水（用于审计）。所有余额修改都必须来源于流水，然后同步更新RemainHours。这样既保证性能，又保证可追溯性。

---

## 八、Lesson（课程表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| LessonID | bigint | √ | 课程ID |
| CourseID | bigint | √ | 课程ID |
| TeacherID | bigint | √ | 老师ID |
| CampusID | bigint | √ | 校区ID |
| ClassroomID | bigint | × | 教室ID |
| LessonDate | date | √ | 上课日期 |
| StartTime | time | √ | 开始时间 |
| EndTime | time | √ | 结束时间 |
| Status | tinyint | √ | 状态 |

---

## 九、LessonStudent（课程学生关系表）

一节课多个学生。

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| ID | bigint | √ | 主键 |
| LessonID | bigint | √ | 课程ID |
| StudentID | bigint | √ | 学生ID |
| EnrollmentID | bigint | √ | 报名ID |

---

## 十、Attendance（签到表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| AttendanceID | bigint | √ | 签到ID |
| LessonID | bigint | √ | 课程ID |
| StudentID | bigint | √ | 学生ID |
| TeacherCheckTime | datetime | × | 老师签到时间 |
| TeacherCheckoutTime | datetime | × | 老师签退时间 |
| AttendanceStatus | tinyint | √ | 签到状态 |

状态枚举：未签到、已签到、已完成、请假、中途请假、补课、缺席、撤销

---

## 十一、LeaveApplication（请假表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| LeaveID | bigint | √ | 请假ID |
| StudentID | bigint | √ | 学生ID |
| LessonID | bigint | √ | 课程ID |
| ApplyUser | bigint | √ | 申请人 |
| ApplyTime | datetime | √ | 申请时间 |
| Reason | varchar(500) | √ | 请假原因 |
| ImageURL | varchar(255) | × | 证明材料 |
| TeacherOpinion | varchar(500) | × | 老师意见 |
| AdminOpinion | varchar(500) | × | 管理员意见 |
| Status | tinyint | √ | 状态 |

状态枚举：申请中、老师确认、管理员通过、管理员拒绝、已撤销、已失效

> 老师负责确认事实（是否已签到、是否中途离开），管理员负责最终审批。

---

## 十二、HoursLedger（课时流水表）

**整个ERP第一重要表。**

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| LedgerID | bigint | √ | 流水ID |
| StudentID | bigint | √ | 学生ID |
| EnrollmentID | bigint | √ | 报名ID |
| LessonID | bigint | √ | 课程ID |
| Hours | decimal(6,2) | √ | 课时变动（正/负） |
| BusinessType | varchar(50) | √ | 业务类型 |
| BusinessID | bigint | √ | 业务单据ID |
| BeforeHours | decimal(6,2) | √ | 变动前余额 |
| AfterHours | decimal(6,2) | √ | 变动后余额 |
| Operator | bigint | √ | 操作人 |
| Reason | varchar(500) | √ | 原因 |
| CreateTime | datetime | √ | 创建时间 |

BusinessType枚举：报名、扣课、补课、退课、修正、调课、请假恢复、管理员调整

**禁止直接UPDATE。必须新增流水。**

---

## 十三、TeacherSalaryLedger（老师工资流水表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| SalaryID | bigint | √ | 工资ID |
| TeacherID | bigint | √ | 老师ID |
| LessonID | bigint | √ | 课程ID |
| SalaryRuleID | bigint | √ | 工资规则ID |
| Amount | decimal(18,2) | √ | 金额 |
| BusinessType | varchar(50) | √ | 业务类型 |
| Remark | varchar(500) | × | 备注 |

BusinessType枚举：正常课、补课、修正、退回、管理员调整

---

## 十四、PointsLedger（积分流水表）

积分唯一来源：LessonFinished。

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| PointID | bigint | √ | 积分ID |
| StudentID | bigint | √ | 学生ID |
| LessonID | bigint | √ | 课程ID |
| Point | int | √ | 积分变动 |
| BusinessType | varchar(50) | √ | 业务类型 |
| Remark | varchar(500) | × | 备注 |

BusinessType枚举：上课奖励、管理员奖励、兑换礼品、活动奖励、修正

---

## 十五、Gift（礼品表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| GiftID | bigint | √ | 礼品ID |
| Name | varchar(100) | √ | 礼品名称 |
| Picture | varchar(255) | × | 图片 |
| NeedPoints | int | √ | 所需积分 |
| Stock | int | √ | 库存 |
| Status | tinyint | √ | 状态 |

---

## 十六、RedeemOrder（兑换订单表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| RedeemID | bigint | √ | 兑换ID |
| StudentID | bigint | √ | 学生ID |
| GiftID | bigint | √ | 礼品ID |
| Point | int | √ | 消耗积分 |
| Status | tinyint | √ | 状态 |
| ReceiveTime | datetime | × | 领取时间 |

---

## 十七、Payment（收费表）

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| PaymentID | bigint | √ | 收费ID |
| StudentID | bigint | √ | 学生ID |
| EnrollmentID | bigint | √ | 报名ID |
| Amount | decimal(18,2) | √ | 金额 |
| PayType | tinyint | √ | 支付方式 |
| PayTime | datetime | √ | 支付时间 |
| Status | tinyint | √ | 状态 |

---

## 十八、SalaryRule（工资方案表）

这一张表以后老板经常修改，所以必须配置化。

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| RuleID | bigint | √ | 规则ID |
| RuleName | varchar(100) | √ | 规则名称 |
| RuleType | tinyint | √ | 规则类型 |
| BasePrice | decimal(18,2) | √ | 基础单价 |
| StepConfig | json | × | 阶梯配置(JSON) |
| Status | tinyint | √ | 状态 |

支持：固定课时费、阶梯课时费、固定月薪、混合模式。无需修改代码。

---

## 十九、AuditLog（审计日志表）

任何修改全部记录。

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| AuditID | bigint | √ | 审计ID |
| UserID | bigint | √ | 操作人ID |
| Role | varchar(50) | √ | 操作角色 |
| Module | varchar(50) | √ | 操作模块 |
| BusinessID | bigint | √ | 业务ID |
| BeforeData | json | × | 修改前数据 |
| AfterData | json | × | 修改后数据 |
| Reason | varchar(500) | √ | 操作原因 |
| IP | varchar(50) | × | IP地址 |
| Device | varchar(100) | × | 设备信息 |
| CreateTime | datetime | √ | 创建时间 |

**不可删除。**

---

## 二十、SystemConfig（系统配置表）

以后所有配置全部这里。

| 字段 | 类型 | 必填 | 备注 |
|------|------|------|------|
| ConfigID | bigint | √ | 配置ID |
| ConfigKey | varchar(100) | √ | 配置键 |
| ConfigValue | text | √ | 配置值 |
| ConfigGroup | varchar(50) | √ | 配置分组 |
| Remark | varchar(500) | × | 说明 |

配置项包括：签到积分、默认课时、短信模板、微信模板、通知时间、积分比例、请假规则等。

老板修改，立即生效，无需发版。

---

## 二十一、字段设计铁律（必须写入宪法）

**八条字段设计原则：**

### 第一条：ID永远不复用

所有主键使用雪花ID，删除后永不重复。

### 第二条：状态永远枚举

禁止使用字符串描述状态，统一使用枚举值。

### 第三条：金额统一Decimal(18,2)

避免浮点误差。

### 第四条：课时统一Decimal(6,2)

支持0.5课时、1.5课时等业务。

### 第五条：所有业务必须保留BusinessType

方便统计和追溯。

### 第六条：所有修改必须填写Reason

没有原因，不允许修改。

### 第七条：所有关键业务必须关联AuditLog

保证系统可审计。

### 第八条：所有字段必须有中文说明

AI生成代码、接口文档、后台页面都从字段说明自动生成，禁止出现未知字段。
