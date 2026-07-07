# EduERP V4 — Event Bus Specification

> 版本：v4.0
> 状态：架构冻结
> 最后更新：2026-07-06
> 文档编号：EDUOS-EVENT-001

---

## 一、目的

整个系统：

只有一种通信方式。

事件(Event)。

任何模块：

不要：

直接：

调用：

其它模块。

必须：

发送事件。

例如：

老师签到。

不要：

直接：

扣课。

不要：

直接：

工资。

不要：

直接：

通知。

不要：

直接：

积分。

只发送：

```
LessonFinished
```

剩下：

其它模块：

自己处理。

---

## 二、事件原则

所有事件：

必须：

遵守：

下面规则。

### Rule 1

一个事件：

只表达：

一个事实。

例如：

正确：

```
LessonFinished
```

表示：

课程结束。

错误：

```
LessonFinishedAndSalaryCalculated
```

禁止。

事件：

不能：

表达：

结果。

---

### Rule 2

事件：

不能：

计算业务。

例如：

LessonFinished

里面：

不要：

计算：

工资。

不要：

计算：

积分。

不要：

计算：

课时。

只告诉系统：

发生了。

---

### Rule 3

事件：

不能：

互相调用。

例如：

错误：

```
LessonFinished

↓

HoursFinished

↓

SalaryFinished

↓

MessageFinished
```

禁止。

所有模块：

监听：

LessonFinished。

各自：

完成：

自己事情。

---

## 三、事件命名规范

统一：

过去式。

例如：

```
LessonFinished

LeaveApplied

LeaveApproved

HoursAdjusted

SalaryAdjusted

PointAdded

GiftRedeemed

PaymentCompleted

TeacherCreated

StudentCreated
```

禁止：

```
DoLesson

StartLesson

UpdateHours

CalculateSalary

SendMessage
```

事件：

不是：

命令。

事件：

表示：

已经发生。

---

## 四、事件数据规范

所有事件：

统一：

JSON。

例如：

```json
{
  "eventId": "202607060001",
  "eventName": "LessonFinished",
  "time": "2026-07-06 09:30",
  "lessonId": 1001,
  "teacherId": 20,
  "campusId": 1
}
```

必须：

只有：

基础数据。

不要：

放：

工资。

不要：

放：

课时余额。

不要：

放：

积分。

这些：

其它模块：

自己查。

---

## 五、LessonFinished

这是：

整个系统：

第一核心事件。

触发：

老师：

正常：

完成签到。

发送：

```
LessonFinished
```

监听模块：

- HoursService
- SalaryService
- PointService
- MessageService
- StatisticsService
- AuditService
- DashboardService

所有：

同时：

工作。

互不影响。

---

## 六、LeaveApproved

请假：

审批通过。

发送：

```
LeaveApproved
```

监听：

- HoursService（恢复课时）
- SalaryService（修正工资）
- MessageService（通知家长）
- Statistics（更新统计）
- Audit（记录日志）

---

## 七、HoursAdjusted

管理员：

修改课时。

发送：

```
HoursAdjusted
```

监听：

- Statistics
- Audit
- Notification

不要：

修改：

工资。

因为：

课时修正：

不一定：

影响工资。

业务：

自己判断。

---

## 八、PaymentCompleted

缴费完成。

发送：

```
PaymentCompleted
```

监听：

- Finance
- Statistics
- Dashboard
- Message
- RenewService

以后：

AI推荐。

也可以：

监听。

无需：

修改：

代码。

---

## 九、PointAdded

积分增加。

发送：

```
PointAdded
```

监听：

- GiftCenter
- Statistics
- ParentMessage
- Dashboard

---

## 十、事件处理失败

如果：

某模块：

失败。

例如：

工资：

失败。

不能：

影响：

扣课。

不能：

影响：

签到。

LessonFinished：

已经：

发生。

不能：

回滚。

失败：

记录：

日志。

管理员：

处理。

---

## 十一、事件执行顺序

默认：

全部：

并行。

只有：

下面：

两个：

必须：

顺序。

第一：

```
LessonFinished
    ↓
HoursLedger
```

因为：

必须：

先：

流水。

第二：

```
HoursLedger
    ↓
RemainHours
```

因为：

余额：

来自：

流水。

其它：

全部：

并行。

---

## 十二、禁止事项

AI：

生成代码：

必须：

遵守。

- 禁止Controller调用Salary
- 禁止Controller调用Point
- 禁止Controller调用Message
- 禁止Lesson直接修改Student
- 禁止任何模块Update余额
- 必须HoursLedger

---

## 十三、新增模块规范

以后：

增加：

CRM。

增加：

销售。

增加：

AI助手。

增加：

财务。

全部：

只能：

监听：

事件。

例如：

以后：

增加：

AI分析。

只需要：

监听：

```
LessonFinished
```

即可。

不要：

修改：

Lesson。

---

## 十四、系统事件（第一版）

第一版：

只允许：

下面事件。

```
StudentCreated
TeacherCreated
EnrollmentCreated
LessonCreated
LessonFinished
LessonCancelled
LeaveApplied
LeaveApproved
LeaveRejected
HoursAdjusted
PaymentCompleted
RefundCompleted
PointAdded
GiftRedeemed
SalaryCalculated
SalaryAdjusted
NoticeSent
DashboardUpdated
```

禁止：

AI：

自己：

发明：

事件。

新增：

必须：

写：

文档。

---

## 十五、AI开发执行规则（必须遵守）

Claude Code

千问

元宝

Cursor

全部：

必须：

遵守。

### Rule 1

收到：

LessonFinished

不要：

修改：

Lesson。

### Rule 2

收到：

LessonFinished

自己：

完成：

自己：

工作。

### Rule 3

失败：

记录：

日志。

不要：

影响：

其它模块。

### Rule 4

不要：

等待：

其它：

事件。

### Rule 5

禁止：

循环：

发送。

例如：

```
LessonFinished
    ↓
HoursAdjusted
    ↓
LessonFinished
```

禁止。

### Rule 6

所有事件：

必须：

唯一。

使用：

```
eventId
```

保证：

幂等。

重复：

收到：

直接：

忽略。

### Rule 7（P0事件离线保障）

对于 **P0核心事件**：

```
LessonFinished
LeaveApproved
```

如果：

发送失败。

允许：

保存：

到：

```
SYS_P0_RETRY_QUEUE
```

等待：

网络恢复。

重试：

最多：

3次。

三次：

失败。

老师：

看到：

```
同步失败
请联系管理员
```

其它：

普通事件：

例如：

PointAdded

DashboardUpdated

MessageSent

允许：

直接：

失败。

不用：

重试。

---

## 十六、AI最终执行协议（System Prompt）

以后：

所有AI。

开发：

事件。

先：

读：

这一段。

```
你是EduOS开发AI。

整个系统只有事件通信。

不要直接调用其它模块。

不要修改余额。

不要计算工资。

不要发送通知。

Controller只发送事件。

Service监听事件。

所有余额来自流水。

所有修改写AuditLog。

所有事件唯一(eventId)。

P0事件失败进入SYS_P0_RETRY_QUEUE。

禁止新增未定义事件。

违反以上规则，立即停止生成代码。
```
