# 异常业务流程验证报告

Mission: M-EduOS-MVP-REAL-OPERATION-STABILITY-LONG-RUNNING-V1
Phase: 4
Batch: 4.1
验证日期: 2026-07-24
验证方法: 静态代码扫描（service/controller/enum 全量扫描）

---

## 场景 1: 调课 (Reschedule)

结论: ✅ 已实现

API 存在性:
  - POST /lessons/:id/change-requests (requestType=RESCHEDULE)
  - PATCH /change-requests/:id/approve
  - PATCH /change-requests/:id/execute
  - 文件: lesson-change-request.controller.ts (L17-L28 createRequest, L47-L51 approve, L63-L67 execute)

数据影响:
  - execute() 方法直接修改 Lesson 实体的 scheduledDate/startTime/endTime
  - 代码位置: lesson-change-request.service.ts L211-L219
  - 修改后通过 lessonRepo.save() 持久化

守卫规则:
  - MAX_RESCHEDULE_PER_LESSON = 3 (每节课最多调课3次)
  - MAX_RESCHEDULE_DAYS = 7 (最多调整7天)
  - 状态机: PENDING → APPROVED → EXECUTED (单向，不可逆)
  - 需要 reason 字段 (L73-L75)
  - 权限: SuperAdmin/Admin 可 approve/execute，Teacher 可提交

代码证据:
  - lesson-change-request.service.ts L80-L87: reschedule limit check
  - lesson-change-request.service.ts L211-L219: RESCHEDULE case in execute()
  - change-request-type.enum.ts: RESCHEDULE 枚举值存在

---

## 场景 2: 请假 (Leave)

结论: ✅ 已实现

API 存在性:
  - PATCH /lessons/:id/attendance/:studentCode (status=LEAVE)
  - POST /lessons/:id/attendance (batch roll call，可包含 LEAVE)
  - 文件: lesson-attendance.controller.ts (L55-L71 updateAttendance, L31-L47 batchRollCall)

数据影响:
  - recordAttendance() 更新 AttendanceStatus 为 LEAVE
  - LEAVE 不在 DEDUCTIBLE_STATUSES 中 → 不扣课时费
  - 代码位置: attendance-status.enum.ts L17-L20 (DEDUCTIBLE_STATUSES 不含 LEAVE)

守卫规则:
  - LEAVE 在 REASON_REQUIRED_STATUSES 中 → 必须提供 reason
  - 代码位置: lesson-attendance.service.ts L35-L38
  - 状态机: PENDING → CHECKED_IN → CONFIRMED → LOCKED (workflow)
  - 权限: SuperAdmin/Admin/Teacher 可操作

代码证据:
  - attendance-status.enum.ts L12: LEAVE 枚举值存在
  - lesson-attendance.service.ts L35-L38: REASON_REQUIRED_STATUSES 包含 LEAVE
  - attendance-status.enum.ts L17-L20: LEAVE 不在 DEDUCTIBLE_STATUSES (不扣费)

---

## 场景 3: 补课 (Makeup)

结论: ✅ 已实现

API 存在性:
  - POST /classes/:code/lessons/makeup
  - 文件: lesson.controller.ts (L131-L155 createMakeup)

数据影响:
  - 创建新 Lesson 记录，isMakeup=true, originLessonId=原课程ID
  - 代码位置: lesson.service.ts L150-L151 (create 方法中设置 isMakeup/originLessonId)
  - 新 Lesson 独立存在，与原课程关联

守卫规则:
  - 需要 classCode 和 courseCode
  - 需要 scheduledDate/startTime/endTime
  - 需要 teacherId
  - 权限: SuperAdmin/Admin/Teacher
  - AttendanceStatus.MAKEUP 存在 (不扣费)

代码证据:
  - lesson.controller.ts L131-L155: createMakeup endpoint
  - lesson.service.ts L41-L42: CreateLessonInput 包含 isMakeup/originLessonId
  - lesson.service.ts L150-L151: 赋值逻辑
  - attendance-status.enum.ts L11: MAKEUP 枚举值存在
  - create-makeup.dto.ts 文件存在

---

## 场景 4: 停课 (Suspend/Cancel)

结论: ✅ 已实现（两级：班级级 + 课时级）

API 存在性:
  - 班级级: PATCH /classes/:code/status (status=CANCELLED)
    - 文件: class.controller.ts (L82-L93 updateStatus)
  - 课时级: PATCH /classes/:code/lessons/:lessonNumber/cancel
    - 文件: lesson.controller.ts (L100-L115 cancelLesson)
  - 变更请求级: ChangeRequestType.CANCEL → execute()
    - 文件: lesson-change-request.service.ts L243-L250

数据影响:
  - 班级级: Class.status → CANCELLED，需 cancelledReason
  - 课时级: Lesson.status → CANCELLED，需 reason
  - 代码位置: class.service.ts L172-L178 (cancelledReason required)
  - 代码位置: lesson.service.ts (updateStatus → CANCELLED)

守卫规则:
  - 班级状态机: DRAFT → ACTIVE → COMPLETED/CANCELLED; CANCELLED → ACTIVE (可恢复)
  - 课时状态机: DRAFT/SCHEDULED/TEACHING → CANCELLED; CANCELLED → SCHEDULED (可恢复)
  - 班级 CANCELLED 必须有 cancelledReason (class.service.ts L172-L175)
  - 课时 CANCELLED 必须有 reason (CancelLessonDto)
  - 权限: SuperAdmin/Admin

代码证据:
  - class-status.enum.ts: CANCELLED 枚举值存在
  - lesson-status.enum.ts: CANCELLED 枚举值存在
  - class.service.ts L26-L29: 状态转换表包含 CANCELLED
  - lesson.service.ts L17-L22: 状态转换表包含 CANCELLED
  - class.service.ts L172-L178: cancelledReason 强制校验

---

## 场景 5: 学生转班 (Transfer)

结论: ❌ 无专用 API（当前通过 withdraw + enroll 两步手动操作）

API 存在性:
  - 无 transfer 专用 endpoint
  - 相关 API:
    - POST /enrollments/:id/withdraw (ACTIVE → WITHDRAWN)
    - POST /enrollments (新建 enrollment)
  - 文件: enrollment.controller.ts

数据影响:
  - withdraw: Enrollment.status → WITHDRAWN (终态，不可逆)
  - enroll: 创建新 Enrollment 记录
  - 代码位置: enrollment.service.ts (withdraw 方法)

守卫规则:
  - Enrollment 状态机: ACTIVE → WITHDRAWN (终态)
  - WITHDRAWN 不可恢复到 ACTIVE
  - 转班需要: 1) withdraw 旧 enrollment 2) enroll 新班级
  - 无原子性保证（两步操作，中间可能失败）
  - 权限: SuperAdmin/Admin

代码证据:
  - enrollment.service.ts L22-L26: VALID_ENROLLMENT_TRANSITIONS (ACTIVE → WITHDRAWN only)
  - enrollment.controller.ts: 无 transfer endpoint
  - grep "transfer" 在 enrollment 目录无结果

问题分析:
  - 转班是常见业务场景，当前无原子操作
  - withdraw 是终态，无法回滚
  - 如果 enroll 新班级失败，旧 enrollment 已 withdraw → 数据不一致
  - 建议: 未来增加 POST /enrollments/:id/transfer 原子操作

---

## 汇总

场景          状态    API 存在    守卫规则    数据完整性
调课          ✅      ✅          ✅          ✅
请假          ✅      ✅          ✅          ✅
补课          ✅      ✅          ✅          ✅
停课          ✅      ✅          ✅          ✅
学生转班      ❌      ❌          N/A         ⚠️ 非原子

发现问题:
  1. 学生转班无专用 API，需手动 withdraw + enroll，存在数据不一致风险
  2. withdraw 是终态操作，无法回滚
  3. 转班操作无原子性保证

建议修复 (P2):
  - 增加 POST /enrollments/:id/transfer 原子操作
  - 内部实现: 事务中完成 withdraw 旧 + enroll 新
  - 失败时自动回滚

---

验证完成。
生成时间: 2026-07-24
验证人: Claude Code (Executor)
