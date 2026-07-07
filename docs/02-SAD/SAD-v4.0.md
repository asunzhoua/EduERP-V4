# EduERP V4 — System Architecture Document

> 版本：v4.0
> 状态：架构冻结
> 最后更新：2026-07-06
> 文档编号：EDUOS-SAD-001

---

## 1. 文档目的（Purpose）

本文件用于定义EduOS的整体技术架构。

它不是开发说明，不是数据库设计，不是API设计。

**而是整个系统所有开发工作的最高技术依据。任何开发（包括AI开发）不得违反本文件。**

---

## 2. 系统目标

EduOS不是一个教培管理软件，而是一套教育运营操作系统。

它必须满足：

- 稳定
- 简单
- 易维护
- 可扩展
- 可追溯

未来支持：多校区、多品牌、AI、招生、财务、CRM、OA，而无需推翻现有架构。

---

## 3. 总体架构

采用经典四层架构。

```
                微信小程序
          家长端 教师端 管理端

                   │

          HTTPS REST API

                   │

────────────────────────────────

              API Service

────────────────────────────────

             Event Bus

────────────────────────────────

         Business Domain

────────────────────────────────

          MySQL Database
```

任何请求全部按照：用户 → API → 事件 → 业务模块 → 数据库。不得跨层调用。

---

## 4. 四层职责

### 第一层：Client Layer（客户端）

包括：微信小程序（家长端、教师端、管理员端）、网页后台。

职责：仅负责显示、输入、上传、下载。

**禁止：业务计算、工资计算、课时计算、积分计算、退款计算。**

客户端永远无状态。

### 第二层：API Layer

职责：统一入口。负责：登录、权限、参数校验、Token、调用业务、返回数据。

**禁止：写业务逻辑。**

例如：不能签到以后扣课，只能LessonFinished() → EventBus.publish()

### 第三层：Event Layer（事件中心）

这是EduOS的心脏。所有业务必须事件驱动。

例如：LessonFinished事件触发：扣课、工资、积分、通知、统计、日志。

**任何新增功能只能监听事件，不能修改已有模块。**

### 第四层：Domain Layer

真正业务。例如：Student、Teacher、Lesson、Finance、Salary、Points、Message、Rule、Exception、Approval、Audit。所有业务全部放这里。

---

## 5. 数据层

采用MySQL作为唯一数据源。

```
Single Source Of Truth
```

Redis以后可以增加，但绝不能直接展示业务数据。所有业务最终来自MySQL。

---

## 6. 模块架构

整个系统划分八个中心：

```
Foundation Center
↓
Operation Center
↓
Exception Center
↓
Approval Center
↓
Rule Center
↓
Insight Center
↓
Audit Center
↓
System Center
```

以后任何功能都必须归属一个中心，不得重复建设。

---

## 7. Event Bus（事件中心）

整个系统只有一个事件中心。

例如：LessonFinished可以触发：扣课、工资、积分、通知、统计、日志。

以后新增AI只需要监听LessonFinished，不用改任何旧代码。

---

## 8. 核心事件

目前第一版统一如下：

```
StudentCreated
StudentUpdated
LessonCreated
LessonStarted
LessonFinished
LeaveApplied
LeaveApproved
LeaveRejected
LeaveCancelled
LessonAdjusted
HoursAdjusted
SalaryCalculated
SalaryAdjusted
PointsAdded
PointsRedeemed
RenewCreated
RenewSuccess
PaymentCreated
RefundCreated
TeacherCheckedIn
TeacherCheckedOut
NotificationSent
```

以后新增事件必须遵循：业务+过去式。例如：LessonFinished，不能：FinishLessonNow。

---

## 9. 微信小程序运行约束（宪法级条款）

### Art.9.1 P0事件最小离线保障

仅对以下核心事件提供极简暂存：LessonFinished、LeaveApproved。

当网络异常时，仅保存：eventId、lessonId、teacherId、createTime。

**禁止保存任何计算结果。**

暂存队列固定名称：SYS_P0_RETRY_QUEUE

### Art.9.2 队列隔离原则

SYS_P0_RETRY_QUEUE为系统专用队列：

- 不得与用户缓存共用Key
- 不得由低代码平台读写
- 不得存放业务对象

仅允许保存事件最小信息。

### Art.9.3 重试机制

恢复网络自动重试，最多3次。

失败立即UI红色提示：同步失败，请联系管理员。

**禁止一直静默失败。**

### Art.9.4 Coze/低代码边界

任何低代码平台不得参与：离线队列、工资计算、扣课、财务、审计、数据修正。

仅允许：UI、AI聊天、普通业务流程。

---

## 10. Rule Engine（规则中心）

系统所有规则统一管理，包括：课时、工资、积分、请假、调课、退款、续费、通知。

以后老板修改规则，无需重新发版。

---

## 11. Exception Center（异常中心）

现实中的异常统一处理，包括：

- 课前请假
- 上课中请假（老师确认签到后，家长申请，管理员审核）
- 请假撤销
- 调课
- 补课
- 停课
- 延期
- 课时修正
- 工资修正
- 财务修正
- 积分修正
- 消息失败
- 老师补签到
- 老师补签退
- 系统恢复

**所有异常必须生成单据，禁止直接修改业务数据。**

---

## 12. 审计中心（Audit Center）

任何关键操作必须记录：

- 操作人
- 操作角色
- 操作时间
- 修改前
- 修改后
- 原因
- 来源端（家长端/教师端/管理端/Web）

**审计日志不可删除，只允许归档。**

---

## 13. AI开发红线（Claude/Qwen/元宝等必须遵守）

所有AI生成代码必须满足：

1. 不得直接操作数据库
2. 不得跨模块调用
3. 不得绕过事件总线
4. 不得硬编码业务规则
5. 不得修改历史记录
6. 所有业务变更必须通过事件或业务单据完成

---

## 14. 开发验收标准

任何新增功能必须同时满足：

- 功能正常
- 不破坏事件链
- 不违反规则中心
- 可审计
- 可回滚
- 有对应文档更新
