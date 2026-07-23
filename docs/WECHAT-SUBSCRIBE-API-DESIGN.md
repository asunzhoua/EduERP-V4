# 微信订阅消息接口设计文档

> 版本：v1.0
> 创建时间：2026-07-24
> Mission：M-2026-07-25-EOS-MINIAPP-OPERATION-EXPANSION-LONG-RUNNING-V1
> Phase：3 (WeChat Login)
> Batch：3.3
> 状态：Research Complete — Skeleton Design
> 前置文档：
>   - docs/WECHAT-ECOSYSTEM-READINESS.md（Batch 4.1 评估）
>   - docs/WECHAT-LOGIN-API-DESIGN.md（Batch 3.1）
>   - docs/WECHAT-USER-BINDING-DESIGN.md（Batch 3.2）

---

## 一、概述

### 1.1 设计目标

为 EduERP-V4 小程序设计微信订阅消息能力，实现以下业务场景的消息推送：

- 上课提醒（课前 N 小时提醒学生/家长）
- 作业提醒（作业布置后通知学生）
- 考勤通知（出勤状态变更后通知家长）
- 课程变更通知（调课/停课通知学生/家长）
- 合同到期提醒（合同到期前 N 天提醒家长）

### 1.2 微信订阅消息机制（关键约束）

微信小程序订阅消息与公众号模板消息有本质区别：

1. **用户必须主动授权**：每次推送需要用户在前端点击授权一次
2. **一次授权 = 一次发送**：用户点一次"允许"，后端只能发一条消息
3. **长期订阅需申请**：教育类小程序可申请长期订阅权限（需满足条件）
4. **模板需审核**：所有消息模板需在微信后台申请并审核通过

### 1.3 两种订阅模式

| 模式 | 说明 | 适用场景 | 申请难度 |
|:-----|:-----|:---------|:---------|
| 一次性订阅 | 用户每次授权发一条 | 通用场景 | 低（默认开放） |
| 长期订阅 | 授权一次可持续推送 | 教育/医疗等公共服务 | 高（需审核资质） |

**EduERP 策略**：
- 短期：使用一次性订阅 + 引导用户多次点击授权
- 中期：申请长期订阅资质（教育类目符合申请条件）
- 长期：长期订阅为主，一次性订阅为辅

---

## 二、接口定义

### 2.1 接口总览

| 接口 | 方法 | 路径 | 认证 | 用途 |
|:-----|:-----|:-----|:-----|:-----|
| 获取模板列表 | GET | /api/v1/wechat/subscribe/templates | JWT | 前端获取可用模板 ID |
| 记录订阅授权 | POST | /api/v1/wechat/subscribe | JWT | 前端授权后记录订阅关系 |
| 查询我的订阅 | GET | /api/v1/wechat/subscribe/my | JWT | 用户查看自己的订阅状态 |
| 发送订阅消息 | POST | /api/v1/wechat/subscribe/send | Internal | 内部服务调用发送消息 |

### 2.2 GET /api/v1/wechat/subscribe/templates

获取当前可用的订阅消息模板列表。

**请求参数**：无（从 JWT 获取 userId）

**响应体**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "templates": [
      {
        "templateId": "TEMPLATE_ID_001",
        "templateType": "CLASS_REMINDER",
        "templateName": "上课提醒",
        "templateTitle": "课程提醒",
        "fields": ["thing1", "thing2", "time3", "thing4"],
        "fieldDescriptions": {
          "thing1": "课程名称",
          "thing2": "上课地点",
          "time3": "上课时间",
          "thing4": "温馨提示"
        }
      },
      {
        "templateId": "TEMPLATE_ID_002",
        "templateType": "ATTENDANCE_NOTICE",
        "templateName": "考勤通知",
        "templateTitle": "考勤通知",
        "fields": ["thing1", "thing2", "phrase3", "time4"],
        "fieldDescriptions": {
          "thing1": "学生姓名",
          "thing2": "课程名称",
          "phrase3": "出勤状态",
          "time4": "上课时间"
        }
      }
    ]
  }
}
```

**说明**：
- templateId：微信后台审核通过的真实模板 ID（当前为占位符）
- templateType：业务类型标识，与后端枚举对应
- fields：微信模板中的字段 key 列表
- fieldDescriptions：字段含义说明，供前端展示

### 2.3 POST /api/v1/wechat/subscribe

记录用户订阅授权。前端调用 `wx.requestSubscribeMessage` 后，将授权结果发送到后端。

**请求体**：

```json
{
  "subscriptions": [
    {
      "templateId": "TEMPLATE_ID_001",
      "templateType": "CLASS_REMINDER",
      "status": "accept"
    },
    {
      "templateId": "TEMPLATE_ID_002",
      "templateType": "ATTENDANCE_NOTICE",
      "status": "accept"
    }
  ]
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|:-----|:-----|:-----|:-----|
| subscriptions | Array | 是 | 订阅授权列表 |
| subscriptions[].templateId | string | 是 | 微信模板 ID |
| subscriptions[].templateType | string | 是 | 业务类型枚举 |
| subscriptions[].status | string | 是 | 授权状态：accept / reject / ban |

**响应体**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "recorded": 2,
    "message": "已记录 2 条订阅授权"
  }
}
```

**后端逻辑**：

1. 从 JWT 获取 userId
2. 查询 User 表获取 openid（必须有 openid 才能发订阅消息）
3. 批量插入/更新 wechat_subscribe 表
4. 每条记录 quota +1（表示可以发送一次）

### 2.4 GET /api/v1/wechat/subscribe/my

查询当前用户的订阅状态和剩余配额。

**请求参数**：无（从 JWT 获取 userId）

**响应体**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "subscriptions": [
      {
        "templateType": "CLASS_REMINDER",
        "templateName": "上课提醒",
        "quota": 3,
        "lastSubscribedAt": "2026-07-24T10:30:00Z"
      },
      {
        "templateType": "ATTENDANCE_NOTICE",
        "templateName": "考勤通知",
        "quota": 5,
        "lastSubscribedAt": "2026-07-24T10:30:00Z"
      }
    ]
  }
}
```

**说明**：
- quota：剩余可发送次数（每次授权 +1，每次发送 -1）
- quota = 0 表示需要用户重新授权

### 2.5 POST /api/v1/wechat/subscribe/send（内部接口）

发送订阅消息。仅供内部服务调用，不对外暴露。

**请求体**：

```json
{
  "templateType": "CLASS_REMINDER",
  "targetUserId": 123,
  "data": {
    "thing1": { "value": "高中数学" },
    "thing2": { "value": "教室A301" },
    "time3": { "value": "2026-07-25 14:00" },
    "thing4": { "value": "请提前10分钟到达" }
  },
  "page": "pages/lesson/detail?id=456",
  "miniprogramState": "formal"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|:-----|:-----|:-----|:-----|
| templateType | string | 是 | 业务类型枚举 |
| targetUserId | number | 是 | 目标用户 ID |
| data | object | 是 | 模板字段数据 |
| data[key].value | string | 是 | 字段值 |
| page | string | 否 | 点击跳转的小程序页面 |
| miniprogramState | string | 否 | 小程序状态：developer / trial / formal |

**响应体**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": "MSG_20260724_001",
    "status": "sent",
    "sentAt": "2026-07-24T14:00:00Z"
  }
}
```

**错误响应**：

```json
{
  "code": 40001,
  "message": "用户未授权该模板",
  "data": null
}
```

```json
{
  "code": 40002,
  "message": "订阅配额不足，请用户重新授权",
  "data": null
}
```

---

## 三、模板消息设计

### 3.1 模板类型枚举

```typescript
export enum WechatTemplateType {
  CLASS_REMINDER = 'CLASS_REMINDER',           // 上课提醒
  HOMEWORK_NOTICE = 'HOMEWORK_NOTICE',         // 作业提醒
  ATTENDANCE_NOTICE = 'ATTENDANCE_NOTICE',     // 考勤通知
  COURSE_CHANGE = 'COURSE_CHANGE',             // 课程变更通知
  CONTRACT_EXPIRY = 'CONTRACT_EXPIRY',         // 合同到期提醒
}
```

### 3.2 上课提醒模板

**使用场景**：课前 N 小时提醒学生/家长即将上课

**建议字段**：

| 字段 Key | 含义 | 示例值 | 来源 |
|:---------|:-----|:-------|:-----|
| thing1 | 课程名称 | 高中数学 | Course.name |
| thing2 | 上课地点 | 教室A301 | Class.room |
| time3 | 上课时间 | 2026-07-25 14:00 | Lesson.startTime |
| thing4 | 温馨提示 | 请提前10分钟到达 | 固定文案 |

**触发条件**：
- 定时任务：课前 2 小时扫描即将开始的课程
- 目标用户：该课程所有已授权学生/家长

**触发逻辑**：

```
Cron Job (每 30 分钟执行)
  → 查询 2 小时内即将开始的 Lesson
  → 获取该 Lesson 关联的所有 Student
  → 查询 Student 对应的 User（通过 parent 关联）
  → 检查 wechat_subscribe 表 quota > 0
  → 组装消息内容
  → 调用微信 API 发送
  → 扣减 quota
  → 记录发送日志
```

### 3.3 作业提醒模板

**使用场景**：教师布置作业后通知学生

**建议字段**：

| 字段 Key | 含义 | 示例值 | 来源 |
|:---------|:-----|:-------|:-----|
| thing1 | 课程名称 | 高中数学 | Course.name |
| thing2 | 作业内容 | 完成课本P50练习1-5 | Homework.content |
| time3 | 截止时间 | 2026-07-26 18:00 | Homework.deadline |
| thing4 | 教师备注 | 注意解题步骤 | Homework.note |

**触发条件**：
- 事件触发：教师创建作业后
- 目标用户：该课程所有已授权学生

**触发逻辑**：

```
教师创建作业（POST /api/v1/homework）
  → 获取该课程所有 Student
  → 查询 Student 对应的 User
  → 检查 wechat_subscribe 表 quota > 0
  → 组装消息内容
  → 调用微信 API 发送
  → 扣减 quota
  → 记录发送日志
```

### 3.4 考勤通知模板

**使用场景**：学生出勤状态确认后通知家长

**建议字段**：

| 字段 Key | 含义 | 示例值 | 来源 |
|:---------|:-----|:-------|:-----|
| thing1 | 学生姓名 | 张三 | Student.name |
| thing2 | 课程名称 | 高中数学 | Course.name |
| phrase3 | 出勤状态 | 已到校 / 缺勤 / 迟到 | Attendance.status |
| time4 | 上课时间 | 2026-07-25 14:00 | Lesson.startTime |

**触发条件**：
- 事件触发：教师确认出勤后（Attendance 状态变为 CONFIRMED）
- 目标用户：该学生的家长

**触发逻辑**：

```
教师确认出勤（PATCH /api/v1/attendance/:id/confirm）
  → 获取 Attendance 关联的 Student
  → 查询 Student 的 Parent（student_parent 表）
  → 查询 Parent 对应的 User
  → 检查 wechat_subscribe 表 quota > 0
  → 组装消息内容
  → 调用微信 API 发送
  → 扣减 quota
  → 记录发送日志
```

### 3.5 课程变更通知模板

**使用场景**：调课/停课时通知学生/家长

**建议字段**：

| 字段 Key | 含义 | 示例值 | 来源 |
|:---------|:-----|:-------|:-----|
| thing1 | 课程名称 | 高中数学 | Course.name |
| thing2 | 变更类型 | 调课 / 停课 | LessonChangeRequest.type |
| thing3 | 变更说明 | 原7月25日调至7月28日 | LessonChangeRequest.reason |
| time4 | 新上课时间 | 2026-07-28 14:00 | LessonChangeRequest.newTime |

**触发条件**：
- 事件触发：课程变更申请审批通过后
- 目标用户：该课程所有受影响的学生/家长

**触发逻辑**：

```
课程变更审批通过（PATCH /api/v1/lesson-change/:id/approve）
  → 获取变更影响的 Lesson
  → 获取该 Lesson 关联的所有 Student
  → 查询 Student 对应的 User/Parent
  → 检查 wechat_subscribe 表 quota > 0
  → 组装消息内容
  → 调用微信 API 发送
  → 扣减 quota
  → 记录发送日志
```

### 3.6 合同到期提醒模板

**使用场景**：合同到期前 N 天提醒家长续费

**建议字段**：

| 字段 Key | 含义 | 示例值 | 来源 |
|:---------|:-----|:-------|:-----|
| thing1 | 学生姓名 | 张三 | Student.name |
| thing2 | 课程名称 | 高中数学 | Contract.subject |
| time3 | 到期时间 | 2026-08-31 | Contract.validTo |
| thing4 | 剩余课时 | 5次 | Contract.remainingLessons |

**触发条件**：
- 定时任务：每天扫描即将到期的合同（到期前 7 天、3 天、1 天）
- 目标用户：合同对应的家长

**触发逻辑**：

```
Cron Job (每天 09:00 执行)
  → 查询 validTo 在 7 天 / 3 天 / 1 天内的合同
  → 过滤 status = ACTIVE 的合同
  → 获取合同关联的 Student
  → 查询 Student 的 Parent
  → 查询 Parent 对应的 User
  → 检查 wechat_subscribe 表 quota > 0
  → 组装消息内容
  → 调用微信 API 发送
  → 扣减 quota
  → 记录发送日志
  → 避免重复发送（同一合同同一提醒节点只发一次）
```

---

## 四、发送逻辑设计

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    触发层（Trigger Layer）                    │
├─────────────────────────────────────────────────────────────┤
│  事件触发                    │  定时触发                      │
│  - 作业创建                  │  - 上课提醒（课前2h）          │
│  - 出勤确认                  │  - 合同到期（7d/3d/1d）        │
│  - 课程变更审批              │                               │
└──────────┬──────────────────────────────┬───────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  消息服务层（Message Service）                │
├─────────────────────────────────────────────────────────────┤
│  1. 确定模板类型（templateType）                              │
│  2. 查询目标用户（targetUserId → openid）                     │
│  3. 检查订阅配额（wechat_subscribe.quota > 0）               │
│  4. 组装消息内容（从业务数据填充模板字段）                      │
│  5. 调用微信 API 发送                                         │
│  6. 扣减配额 + 记录日志                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  微信 API 层（WeChat API Layer）              │
├─────────────────────────────────────────────────────────────┤
│  POST https://api.weixin.qq.com/cgi-bin/message/subscribe/send
│  Header: access_token                                        │
│  Body: { touser, template_id, data, page }                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 发送流程（详细）

```
Step 1: 确定模板类型
  → 根据触发事件映射到 WechatTemplateType

Step 2: 查询目标用户
  → 从业务数据获取 targetUserId
  → 查询 User 表获取 openid
  → 如果 openid 为空 → 跳过（用户未绑定微信）

Step 3: 检查订阅配额
  → 查询 wechat_subscribe 表
  → 条件：userId = targetUserId AND templateType = xxx AND quota > 0
  → 如果 quota = 0 → 跳过（用户未授权或配额用尽）
  → 记录日志：跳过原因

Step 4: 组装消息内容
  → 根据 templateType 选择字段映射规则
  → 从业务实体（Lesson/Course/Attendance/Contract）提取数据
  → 填充微信模板字段（thing1, time3 等）

Step 5: 调用微信 API
  → 获取 access_token（缓存机制，2h 有效期）
  → POST /cgi-bin/message/subscribe/send
  → 处理响应：
    - errcode = 0 → 发送成功
    - errcode = 43019 → 需要将发送方从订阅关系中移除
    - errcode = 其他 → 记录错误日志

Step 6: 更新状态
  → wechat_subscribe.quota -= 1
  → 插入 wechat_message_log 记录
  → 更新 reminder 表状态（如果关联了 reminder）
```

### 4.3 access_token 管理

微信 API 调用需要 access_token，获取方式：

```
GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=APPSECRET
```

**管理策略**：

1. access_token 有效期 2 小时
2. 缓存到 Redis 或数据库（避免频繁请求）
3. 过期前 5 分钟自动刷新
4. 失败重试机制（网络异常时重试 3 次）

**存储方案**：

```
Key: wechat:access_token
Value: { token: "xxx", expiresAt: "2026-07-24T16:00:00Z" }
TTL: 7200 秒（2 小时）
```

### 4.4 错误处理策略

| 错误码 | 含义 | 处理策略 |
|:-------|:-----|:---------|
| 0 | 成功 | 记录成功日志 |
| 40001 | access_token 无效 | 刷新 token 后重试 |
| 40003 | openid 无效 | 记录错误，跳过该用户 |
| 43019 | 用户未授权 | 将 quota 置为 0，记录日志 |
| 43007 | 需要授权 | 同 43019 |
| 其他 | 未知错误 | 记录完整错误信息，告警 |

### 4.5 发送限制

微信对订阅消息有以下限制：

1. **发送频率**：每个模板每个用户每天最多发送 N 条（具体限制以微信文档为准）
2. **内容规范**：不能包含诱导分享、营销内容
3. **时间窗口**：建议在 8:00-22:00 之间发送

**EduERP 策略**：

- 同一用户同一模板每天最多 3 条
- 仅在 8:00-22:00 发送
- 合同到期提醒按节点发送（7d/3d/1d），不重复

---

## 五、用户授权设计

### 5.1 授权流程（前端）

```
用户操作（如登录成功、查看课表、确认作业）
  ↓
调用 wx.requestSubscribeMessage({
  tmplIds: ['TEMPLATE_ID_001', 'TEMPLATE_ID_002'],
  success(res) {
    // res = { TEMPLATE_ID_001: 'accept', TEMPLATE_ID_002: 'reject' }
    // 将授权结果发送到后端
    wx.request({
      url: '/api/v1/wechat/subscribe',
      method: 'POST',
      data: {
        subscriptions: [
          { templateId: 'TEMPLATE_ID_001', templateType: 'CLASS_REMINDER', status: res['TEMPLATE_ID_001'] },
          { templateId: 'TEMPLATE_ID_002', templateType: 'ATTENDANCE_NOTICE', status: res['TEMPLATE_ID_002'] }
        ]
      }
    })
  }
})
```

### 5.2 授权时机设计

为了提高授权率，需要在合适的时机请求授权：

| 时机 | 请求的模板 | 理由 |
|:-----|:-----------|:-----|
| 登录成功后 | 上课提醒 + 考勤通知 | 用户刚进入小程序，心智开放 |
| 查看课表后 | 上课提醒 | 用户关注课程，提醒有价值 |
| 教师布置作业后 | 作业提醒 | 学生需要知道作业 |
| 出勤确认后 | 考勤通知 | 家长关心孩子出勤 |
| 合同即将到期 | 合同到期提醒 | 家长需要续费 |

### 5.3 授权引导策略

**策略 1：价值引导**

在请求授权前，先展示授权的价值：

```
"开启上课提醒，不再错过课程"
[开启提醒]  [稍后再说]
```

**策略 2：场景触发**

在用户操作完成后顺势请求：

```
用户查看课表 → "是否开启上课提醒？"
用户查看作业 → "是否接收作业提醒？"
```

**策略 3：多次积累**

一次性订阅可以多次积累配额：

```
每次用户进入小程序 → 请求一次授权 → quota +1
用户无感知，但后端有更多发送机会
```

### 5.4 后端授权记录逻辑

```
POST /api/v1/wechat/subscribe
  ↓
1. 从 JWT 获取 userId
2. 查询 User.openid（必须有 openid）
3. 遍历 subscriptions 数组
4. 对每个 subscription：
   - 查询 wechat_subscribe 表（userId + templateType）
   - 如果存在 → quota += 1（如果是 accept）
   - 如果不存在 → 插入新记录（quota = 1）
5. 返回记录数量
```

---

## 六、数据库设计

### 6.1 wechat_subscribe 表

记录用户订阅关系和配额。

```sql
CREATE TABLE wechat_subscribe (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  userId BIGINT NOT NULL COMMENT '用户ID',
  templateType VARCHAR(50) NOT NULL COMMENT '模板类型枚举',
  templateId VARCHAR(100) NOT NULL COMMENT '微信模板ID',
  quota INT NOT NULL DEFAULT 0 COMMENT '剩余可发送次数',
  lastSubscribedAt DATETIME COMMENT '最后授权时间',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_userId (userId),
  INDEX idx_templateType (templateType),
  UNIQUE KEY uk_user_template (userId, templateType)
) COMMENT='微信订阅关系表';
```

**字段说明**：

| 字段 | 类型 | 说明 |
|:-----|:-----|:-----|
| userId | bigint | 用户 ID（关联 User.id） |
| templateType | varchar(50) | 业务类型枚举（CLASS_REMINDER 等） |
| templateId | varchar(100) | 微信模板 ID（微信后台申请） |
| quota | int | 剩余可发送次数（授权 +1，发送 -1） |
| lastSubscribedAt | datetime | 最后一次授权时间 |

**唯一约束**：userId + templateType（一个用户一个模板只有一条记录）

### 6.2 wechat_message_log 表

记录消息发送历史。

```sql
CREATE TABLE wechat_message_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  messageId VARCHAR(50) NOT NULL COMMENT '消息ID（业务生成）',
  userId BIGINT NOT NULL COMMENT '目标用户ID',
  templateType VARCHAR(50) NOT NULL COMMENT '模板类型',
  templateId VARCHAR(100) NOT NULL COMMENT '微信模板ID',
  status VARCHAR(20) NOT NULL COMMENT '发送状态：sent/failed/skipped',
  data JSON COMMENT '发送的数据内容',
  page VARCHAR(200) COMMENT '跳转页面',
  wechatErrcode INT COMMENT '微信返回的错误码',
  wechatErrmsg VARCHAR(200) COMMENT '微信返回的错误信息',
  sentAt DATETIME COMMENT '发送时间',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_userId (userId),
  INDEX idx_templateType (templateType),
  INDEX idx_status (status),
  INDEX idx_sentAt (sentAt)
) COMMENT='微信消息发送日志表';
```

**字段说明**：

| 字段 | 类型 | 说明 |
|:-----|:-----|:-----|
| messageId | varchar(50) | 业务生成的消息 ID（格式：MSG_YYYYMMDD_SEQ） |
| userId | bigint | 目标用户 ID |
| templateType | varchar(50) | 模板类型 |
| templateId | varchar(100) | 微信模板 ID |
| status | varchar(20) | 发送状态：sent / failed / skipped |
| data | json | 发送的数据内容（用于审计和排查） |
| page | varchar(200) | 点击跳转的小程序页面 |
| wechatErrcode | int | 微信返回的错误码（成功为 0） |
| wechatErrmsg | varchar(200) | 微信返回的错误信息 |
| sentAt | datetime | 实际发送时间 |

---

## 七、安全考虑

### 7.1 接口安全

1. **JWT 认证**：所有用户端接口需要 JWT 认证
2. **权限控制**：
   - GET /templates：所有已登录用户可访问
   - POST /subscribe：所有已登录用户可访问（只能记录自己的订阅）
   - GET /subscribe/my：所有已登录用户可访问（只能查自己的）
   - POST /subscribe/send：仅内部服务调用（不暴露到网关）

### 7.2 数据安全

1. **openid 保护**：openid 不返回给前端，仅后端使用
2. **模板 ID 保护**：模板 ID 可以返回前端（用于授权），但不允许修改
3. **发送日志**：保留 90 天，用于审计和排查

### 7.3 防滥用

1. **频率限制**：同一用户同一模板每天最多请求 5 次授权
2. **发送限制**：同一用户同一模板每天最多发送 3 条消息
3. **时间窗口**：仅在 8:00-22:00 发送消息

---

## 八、实施计划

### 8.1 分阶段实施

**Phase 1：基础设施（1-2 天）**

1. 创建 wechat_subscribe 和 wechat_message_log 表
2. 实现 WechatSubscribeService（基础 CRUD）
3. 实现 access_token 管理（获取 + 缓存 + 刷新）
4. 实现微信 API 调用封装

**Phase 2：用户授权（1 天）**

1. 实现 POST /api/v1/wechat/subscribe（记录授权）
2. 实现 GET /api/v1/wechat/subscribe/my（查询订阅）
3. 实现 GET /api/v1/wechat/subscribe/templates（模板列表）
4. 前端集成 wx.requestSubscribeMessage

**Phase 3：消息发送（2-3 天）**

1. 实现 POST /api/v1/wechat/subscribe/send（内部接口）
2. 实现消息发送服务（模板选择 + 内容组装 + API 调用）
3. 实现错误处理和重试机制
4. 实现发送日志记录

**Phase 4：业务集成（2-3 天）**

1. 上课提醒：定时任务 + 消息发送
2. 考勤通知：事件触发 + 消息发送
3. 作业提醒：事件触发 + 消息发送
4. 课程变更：事件触发 + 消息发送
5. 合同到期：定时任务 + 消息发送

**Phase 5：测试优化（1-2 天）**

1. 单元测试（Service 层）
2. 集成测试（API 层）
3. 真机测试（小程序授权 + 接收消息）
4. 性能优化（批量发送、异步处理）

### 8.2 前置条件

1. **微信小程序 AppID + AppSecret**：用于获取 access_token
2. **订阅消息模板 ID**：需要在微信后台申请并审核通过
3. **用户 openid**：用户必须通过微信登录并绑定账号
4. **长期订阅资质**（可选）：教育类目可申请长期订阅

### 8.3 风险与应对

| 风险 | 影响 | 应对策略 |
|:-----|:-----|:---------|
| 模板审核不通过 | 无法发送该类消息 | 提前申请多个模板，准备备选方案 |
| 用户授权率低 | 消息发送失败率高 | 优化授权引导，选择合适时机 |
| access_token 失效 | 消息发送失败 | 缓存 + 自动刷新 + 失败重试 |
| 微信 API 限流 | 批量发送失败 | 限流控制 + 异步队列 + 分批发送 |
| 长期订阅申请失败 | 只能使用一次性订阅 | 优化一次性订阅体验，多次积累配额 |

---

## 九、与现有系统集成

### 9.1 与 Reminder 模块的关系

现有 Reminder 模块已经定义了提醒类型（CLASS_REMINDER, ATTENDANCE_REMINDER, CONTRACT_EXPIRY），可以作为订阅消息的触发源。

**集成方式**：

1. Reminder 创建时，同时检查用户是否有微信订阅配额
2. 如果有配额 → 触发微信订阅消息发送
3. 如果无配额 → 仅创建 Reminder 记录（应用内通知）

### 9.2 与 User 模块的关系

User 表已有 openid 字段，是发送订阅消息的前提。

**依赖关系**：

1. 用户必须通过微信登录（Batch 3.1）绑定 openid
2. 发送订阅消息时，从 User 表获取 openid
3. 如果 openid 为空 → 跳过发送

### 9.3 与 Teaching 模块的关系

教学模块的业务事件是订阅消息的主要触发源。

**事件映射**：

| 教学事件 | 订阅消息类型 | 触发方式 |
|:---------|:-------------|:---------|
| Lesson 即将开始 | CLASS_REMINDER | 定时任务 |
| Attendance 确认 | ATTENDANCE_NOTICE | 事件触发 |
| Homework 创建 | HOMEWORK_NOTICE | 事件触发 |
| LessonChange 审批通过 | COURSE_CHANGE | 事件触发 |
| Contract 即将到期 | CONTRACT_EXPIRY | 定时任务 |

---

## 十、附录

### 10.1 微信订阅消息官方文档

- 订阅消息介绍：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html
- 发送 API：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message/subscribe-message/sendMessage.html
- 模板申请：小程序后台 → 订阅消息 → 公共模板库 / 个人模板

### 10.2 模板申请注意事项

1. **选择公共模板**：微信提供公共模板库，优先选择与业务匹配的公共模板
2. **申请个人模板**：如果公共模板不满足，可以申请个人模板（需说明使用场景）
3. **字段类型限制**：
   - thing：字符串（最多 20 个字符）
   - time：时间（格式：2026-07-25 14:00）
   - phrase：短语（最多 10 个字符）
   - number：数字
   - character_string：字符串（仅限数字和字母）

### 10.3 错误码参考

| 错误码 | 含义 | 解决方案 |
|:-------|:-----|:---------|
| 0 | 成功 | - |
| 40001 | access_token 无效 | 刷新 access_token |
| 40003 | openid 无效 | 检查用户 openid |
| 40014 | access_token 过期 | 刷新 access_token |
| 43019 | 用户未授权 | 将 quota 置为 0 |
| 43007 | 需要授权 | 同 43019 |
| 43101 | 用户拒绝接受消息 | 不再发送，记录日志 |

---

## 十一、总结

本设计文档定义了微信订阅消息的完整接口体系，包括：

1. **4 个 API 接口**：模板列表、记录授权、查询订阅、发送消息
2. **5 种消息模板**：上课提醒、作业提醒、考勤通知、课程变更、合同到期
3. **2 张数据表**：wechat_subscribe（订阅关系）、wechat_message_log（发送日志）
4. **完整的发送流程**：触发 → 检查配额 → 组装内容 → 调用 API → 记录日志
5. **用户授权策略**：多时机引导、多次积累配额、价值引导

当前状态为 Skeleton Design，未实现任何代码。下一步需要：
- 在微信后台申请订阅消息模板
- 获取小程序 AppID + AppSecret
- 实现 Phase 1 基础设施