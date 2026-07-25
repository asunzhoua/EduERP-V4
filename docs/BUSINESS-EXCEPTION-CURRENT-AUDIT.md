# 业务异常流程审计报告

## 审计时间
2026-07-25

## 审计范围
Attendance / Lesson / Contract / Enrollment / LessonChangeRequest / Student 模块的异常业务状态支持

---

## 审计结果

### Attendance 状态

**来源**: `attendance-status.enum.ts`

当前状态: PRESENT, ABSENT, LATE, LEAVE, MAKEUP, ONLINE, OFFLINE

扣课状态 (DEDUCTIBLE_STATUSES): PRESENT, LATE, ONLINE, OFFLINE

不扣课状态: ABSENT, LEAVE, MAKEUP

Workflow 状态: PENDING → CHECKED_IN → CONFIRMED → LOCKED

理由要求 (REASON_REQUIRED_STATUSES): LATE, LEAVE, ABSENT

缺失状态: 无。AttendanceStatus 已覆盖正常上课、缺勤、请假、补课、在线/线下等场景。

### Lesson 状态

**来源**: `lesson-status.enum.ts`

当前状态: DRAFT, SCHEDULED, TEACHING, FINISHED, ARCHIVED, CANCELLED

取消逻辑: 存在。updateStatus() 含完整状态机校验，CANCELLED 需 reason，含取消事件发布等。

补课支持:
- Lesson 实体有 isMakeup (boolean) 和 originLessonId (bigint) 字段
- LessonController 有 `POST classes/:code/lessons/makeup` 创建补课接口
- CreateMakeupDto 含 originLessonId 字段，可追溯原课次
- 允许 CANCELLED 状态的课次复用 lessonNumber 重新创建

### Contract 扣课逻辑

**来源**: `lesson-attendance.service.ts` / `contract.service.ts`

扣课触发: 签到时 status 属于 DEDUCTIBLE_STATUSES (PRESENT/LATE/ONLINE/OFFLINE)

异常处理:
- LEAVE: 不扣课（不在 DEDUCTIBLE_STATUSES 中）
- MAKEUP: 不扣课
- ABSENT: 不扣课
- 取消课次时自动回滚扣课 (cancelByLessonId → rollbackLessonDeduction)
- 合同消耗完自动转为 EXHAUSTED 状态

合同状态: ACTIVE, EXHAUSTED, EXPIRED, REFUNDED, FROZEN

### Enrollment 状态

**来源**: `enrollment-status.enum.ts`

当前状态: ACTIVE, WITHDRAWN, COMPLETED (未激活)

缺失: 无 SUSPEND（停课）状态。当前只有退课机制，没有临时停课/复课机制。

### Lesson Change Request

**来源**: `lesson-change-request.service.ts` / `change-request-type.enum.ts`

已有请求类型:
- RESCHEDULE — 调课
- TEACHER_CHANGE — 换老师
- CANCEL — 取消课次
- REOPEN — 重开课次

生命周期: PENDING → APPROVED → EXECUTED / PENDING → REJECTED / APPROVED → REJECTED

缺失类型:
- LEAVE（请假）— 无专用请假申请类型
- SUSPEND（停课）— 无停课申请类型

### 家长端（Student 端 API）

**来源**: `student.controller.ts`

现有功能:
- GET self — 查看个人信息
- GET self/contracts — 查看合同和剩余课时
- GET self/lessons — 查看课程记录
- GET self/attendance — 查看出勤记录（含 LEAVE 状态显示）

缺失功能:
- 无请假申请提交接口
- 无补课查看接口
- 无停课申请接口
- 无停课/请假记录查看接口

### 教师端签到 UI

**来源**: `miniapp/pages/teacher/lesson-record.js`

签到选项: PRESENT, ABSENT, LATE （三点轮换制）

缺失:
- LEAVE 签到选项 — 教师无法在签到时标记学生为"请假"
- MAKEUP 签到选项 — 教师无法在签到时标记学生为"补课"
- SICK 签到选项 — 无病假专用选项

### 家长端页面

**来源**: `miniapp/pages/student/`

现有页面:
- attendance.wxml — 出勤记录查看，已正确显示 LEAVE 标签文字
- classes / class-detail / lessons — 选班和查看课表

缺失页面:
- 无请假申请页
- 无补课查看页
- 无停课申请页

---

## 发现的缺口

1. **[Frontend] 教师签到 UI 缺少 LEAVE / MAKEUP 选项** — 教师端 lesson-record 页面只有 PRESENT/ABSENT/LATE 三态轮换，无法标记学生"请假"或"补课"。后端 AttendanceStatus 已定义 LEAVE 和 MAKEUP，但前端未使用。

2. **[API] 无学生/家长请假提交接口** — 后端无 POST 接口供学生/家长主动提交请假申请。目前 ABSENT 和 LEAVE 只能由教师签到记录，家长无法提前报备。

3. **[Model] 无停课(SUSPEND)概念** — Enrollment 状态机只有 ACTIVE → WITHDRAWN，缺少 SUSPEND（临时停课）及其反向 UNPAUSE（复课）。无法实现"停课N周"的场景。

4. **[Model] ChangeRequestType 缺少 LEAVE / SUSPEND** — 现有 RESCHEDULE/TEACHER_CHANGE/CANCEL/REOPEN 四种变更类型不支持请假和停课场景。

5. **[Process] 停课和合同冻结无自动化联动** — Contract 可手动 FROZEN，但 Enrollment 停课不会自动触发 Contract freeze，反之亦然。缺少跨聚合的自动化关联。

6. **[Frontend] 无补课排课界面** — 后端已有 CreateMakeupDto 和补课创建逻辑，但教师端前端无补课排课入口。缺席/请假后无法方便地安排补课。

7. **[Frontend] 无停课/请假记录查看页** — 家长端可看出勤记录，但缺少专门查看请假/停课历史的功能入口。

---

## 建议

1. 教师签到页补全 LEAVE / MAKEUP 签到选项：在后端签到 API 已支持的情况下，只需补全前端三态轮换逻辑即可快速覆盖。

2. 新增家长请假提交接口 + 前端页面：提供 POST /self/leaves 接口，关联到 LessonChangeRequest，走审批流程。

3. Enrollment 新增 SUSPEND/ACTIVE 状态转换：实现临时停课和复课机制，支持"停课X天/周"的场景。

4. ChangeRequestType 新增 LEAVE 类型：让请假也能走审批流程，与现有 LessonChangeRequest 审批框架一致。

5. 停课-合同冻结联动：当 Enrollment 停课时自动冻结关联 Contract；复课时自动解冻。

6. 教师端补课排课 UI：基于现有 CreateMakeupDto，实现教师排补课课时的前端流程。

7. 家长端请假/停课记录页：新增显示请假审批状态和停课期间的功能页面。
