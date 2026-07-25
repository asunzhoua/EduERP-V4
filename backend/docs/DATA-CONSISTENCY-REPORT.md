# 数据一致性验证报告

## 验证时间
2026-07-25

## 验证方法
静态代码扫描（service/controller/enum/repository 全量扫描）+ 业务流程链路分析

---

## 验证链路

### 链路 1: 请假流程
家长提交请假 -> LeaveRequest PENDING -> 管理员 approve -> LeaveRequest APPROVED -> 教师签到 LEAVE -> Attendance LEAVE -> 不扣课

代码证据:
- LeaveRequestService.createRequest() 创建 PENDING 记录
- LeaveRequestService.approve() PENDING -> APPROVED
- LessonAttendanceService.recordAttendance() 记录 LEAVE 状态
- DEDUCTIBLE_STATUSES 不含 LEAVE (attendance-status.enum.ts L17-L20)
- 扣课: 不扣 ✅

### 链路 2: 停课流程
家长提交停课 -> SuspendRequest PENDING -> 管理员 approve -> SuspendRequest APPROVED -> Enrollment SUSPEND

代码证据:
- SuspendRequestService.createRequest() 创建 PENDING 记录
- SuspendRequestService.approve() PENDING -> APPROVED, 同时 enrollment.status -> SUSPEND
- EnrollmentStatus.SUSPEND 存在于 enrollment-status.enum.ts

合同冻结: 存在 GAP
- SuspendRequestService.approve() 未调用 ContractService.freeze()
- Contract 状态仍保持 ACTIVE
- Enrollment 设为 SUSPEND 后，如果教师仍然签到，AttendanceService 中的 findOneActiveByStudentCode() 仍能找到 ACTIVE 的 contract 并扣课
- 合同课时冻结: 未实现 ❌ (需在 SuspendRequestService.approve() 中补充 freezeContract 逻辑)

### 链路 3: 教师签到 LEAVE/SICK
教师签到 LEAVE -> AttendanceStatus.LEAVE -> 不在 DEDUCTIBLE_STATUSES -> 不扣课
教师签到 SICK -> AttendanceStatus.SICK -> 不在 DEDUCTIBLE_STATUSES -> 不扣课

代码证据:
- DEDUCTIBLE_STATUSES = {PRESENT, LATE, ONLINE, OFFLINE}
- LEAVE, SICK 均不在 DEDUCTIBLE_STATUSES
- REASON_REQUIRED_STATUSES 包含 LEAVE (需要 reason)
- 扣课: 不扣 ✅

### 链路 4: 教师签到 MAKEUP
教师签到 MAKEUP -> AttendanceStatus.MAKEUP -> 不在 DEDUCTIBLE_STATUSES -> 不扣课

代码证据:
- DEDUCTIBLE_STATUSES 不含 MAKEUP
- 补课通过 Lesson 的 isMakeup 标识区分原课程
- 补课用独立 Lesson 记录，与原课程通过 originLessonId 关联
- 扣课: 不扣 ✅ 不重复扣课 ✅

### 链路 5: 取消课程回滚
管理员取消课程 -> Lesson.status -> CANCELLED -> AttendanceService.cancelByLessonId() -> rollback DEDUCTIBLE_STATUSES 的扣课 -> 删除 Attendance 记录

代码证据:
- LessonController.cancel() 同时调用 updateStatus(CANCELLED) + cancelByLessonId()
- cancelByLessonId() 遍历所有 attendance 记录，对 deducible 状态调用 rollbackLessonDeduction()
- rollbackLessonDeduction() 中 contract.remainingLessons += 1
- 若合同为 EXHAUSTED 则恢复为 ACTIVE
- 取消回滚: ✅ 完整

---

## 汇总

| 业务场景 | 链路完整 | 数据一致 | 代码证据 | 备注 |
|----------|----------|----------|----------|------|
| 请假不扣课 | ✅ | ✅ | DEDUCTIBLE_STATUSES 不含 LEAVE | |
| 停课冻结课时 | ✅ | ❌ GAP | Suspend 未 freeze contract | 合同仍 ACTIVE，可以被继续扣课 |
| 签到异常(LEAVE/SICK) | ✅ | ✅ | 不在 DEDUCTIBLE_STATUSES | LEAVE 需 reason |
| 补课(MAKEUP) | ✅ | ✅ | 不在 DEDUCTIBLE_STATUSES | 独立 Lesson 记录 |
| 取消回滚 | ✅ | ✅ | cancelByLessonId + rollbackLessonDeduction | 含 EXHAUSTED 恢复 |

---

## 发现的问题

### P1: 停课流程未冻结合同

问题描述:
SuspendRequestService.approve() 将 Enrollment 设为 SUSPEND，但未将对应 Contract 设为 FROZEN。
这导致停课期间如果教师签到，deductLessonFromContract() 仍能找到 ACTIVE 合同并扣课。

影响范围:
- 停课期间学生可能被不正常扣课
- 合同剩余课时不准确

建议修复:
1. SuspendRequestService 注入 ContractService
2. approve() 中增加 contractService.freeze() 调用
3. 对应的取消停课/恢复时调用 contractService.unfreeze()
4. 新增 SuspendRequest.resume() 恢复 Enrollment 为 ACTIVE + Contract 为 ACTIVE

### P2: SICK 状态未在 REASON_REQUIRED_STATUSES 中验证

虽然枚举中存在 AttendanceStatus.SICK，但当前 REASON_REQUIRED_STATUSES 不含 SICK。
SICK 作为类似 LEAVE 的不可扣课状态，建议也要求提供原因。

---

## 结论

数据一致性整体良好（请假/签到/补课/取消回滚均正确实现）。
停课流程的合同冻结存在 P1 级别 gap，需要补充实现。

---

验证完成。
生成时间: 2026-07-25
验证人: Claude Code (Executor)
