# EduERP V4 — API Specification

> 版本：v4.0
> 状态：架构冻结
> 最后更新：2026-07-06
> 文档编号：EDUOS-API-001

---

## 一、开发原则（必须遵守）

### 规则1：一个API只做一件事

例如：POST /lesson/checkin 只负责签到。不要签到以后顺便统计工资、发送通知、积分。这些全部事件完成，不是API完成。

### 规则2：API永远不计算业务

例如：老师签到，API只负责LessonFinished事件。真正计算工资、扣课、通知、积分由事件处理，不是API。

### 规则3：API永远返回统一格式

成功：

```json
{
  "success": true,
  "code": 0,
  "message": "success",
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "code": 4001,
  "message": "课时不足",
  "data": null
}
```

以后所有接口全部一样。

---

## 二、统一请求规则

请求统一HTTPS，编码UTF-8，Content-Type: application/json。

统一Bearer Token：

```
Authorization: Bearer xxxxxxxxx
```

---

## 三、接口命名规范

统一资源，不要动作。

正确：

```
POST /lesson/checkin
POST /lesson/checkout
POST /leave/apply
POST /leave/cancel
GET /student/detail
```

错误（禁止）：

```
/checkLesson
/getHours
/doLeave
/updateStudentHours
```

---

## 四、学生模块

### 获取学生详情

```
GET /student/detail
```

请求：

```json
{
  "studentId": 10001
}
```

返回：

```json
{
  "studentId": 10001,
  "name": "张三",
  "remainHours": 18,
  "points": 320
}
```

说明：只能查看有权限的学生。

---

## 五、课程模块

### 老师签到

```
POST /lesson/checkin
```

请求：

```json
{
  "lessonId": 1000,
  "teacherId": 200,
  "time": "2026-07-06 08:00"
}
```

成功返回签到成功，然后发送事件LessonFinished。API结束，不要继续计算。

---

## 六、请假模块

### 家长申请请假

```
POST /leave/apply
```

请求：

```json
{
  "lessonId": 1000,
  "studentId": 2000,
  "reason": "发烧",
  "image": "https://..."
}
```

服务器建立LeaveApplication，返回申请成功，发送事件LeaveApplied。

### 管理员审批

```
POST /leave/approve
```

请求：

```json
{
  "leaveId": 100,
  "approve": true,
  "remark": "同意"
}
```

审批成功，发送事件LeaveApproved。

---

## 七、课时模块

### 管理员修正课时

```
POST /hours/adjust
```

请求：

```json
{
  "studentId": 100,
  "hours": 2,
  "reason": "补课"
}
```

服务器建立HoursLedger，发送事件HoursAdjusted。禁止直接Update。

---

## 八、工资模块

### 查询工资

```
GET /salary/my
```

返回：

```json
{
  "month": "2026-07",
  "lessonCount": 95,
  "salary": 8600
}
```

老师只能查看自己的。

---

## 九、积分模块

### 查询积分

```
GET /points/my
```

### 兑换

```
POST /points/redeem
```

请求：

```json
{
  "giftId": 100
}
```

事件：GiftRedeemed

---

## 十、老板模块

### 今日经营

```
GET /dashboard/today
```

返回：

```json
{
  "income": 8600,
  "expense": 3200,
  "students": 182,
  "lessons": 61,
  "renew": 9,
  "leave": 3
}
```

老板打开首页就是这个接口。

---

## 十一、通知模块

### 发送通知

```
POST /message/send
```

禁止任何模块直接微信推送。必须消息中心统一处理。

---

## 十二、API开发铁律（AI必须遵守）

**Claude Code、千问、元宝必须遵守以下十二条：**

1. 一个API只能做一件事情。
2. 禁止一个API更新多个模块。
3. 禁止API直接Update余额，必须事件。
4. 所有修改必须记录AuditLog。
5. 任何失败立即返回，不要自动重试。
6. 所有业务必须验证权限。
7. 禁止前端计算，全部服务器。
8. 禁止API调用API，统一Service。
9. 禁止Service直接通知微信，统一MessageService。
10. 禁止Controller写业务，Controller只负责接收和返回。
11. 所有错误必须统一错误码，不要返回字符串。
12. AI开发禁止事项：写业务到Controller、SQL写到Controller、页面直接调用数据库、修改余额不写流水、修改数据不写审计日志、同一个接口完成多个业务、在前端计算工资/课时/积分、写死业务规则（所有规则必须来自配置）。
