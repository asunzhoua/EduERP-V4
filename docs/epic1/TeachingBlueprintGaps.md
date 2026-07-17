# Teaching Capability — Blueprint Gap Log

**日期：** 2026-07-16
**阶段：** Phase 2e — Blueprint Gap 记录
**原则：** 所有 Gap 仅记录，不自行补充业务规则

---

## Gap 列表

### G1: Enrollment 创建流程未定义

- **严重度：** HIGH
- **Blueprint 现状：** Enrollment 聚合已定义（ACTIVE→WITHDRAWN/COMPLETED），但没有定义谁触发创建
- **Epic 1 处理：** 内部创建接口，不绑定业务来源
- **需要 Founder 决策：** 是 Student 主动报名、Admin 创建、还是 Contract 自动生成？

### G2: Enrollment COMPLETED 触发条件未定义

- **严重度：** HIGH
- **Blueprint 现状：** ENROLL-004 定义 COMPLETED 是终态，但没有定义 ACTIVE→COMPLETED 的转换条件
- **Epic 1 处理：** 保留状态枚举，不激活 transition
- **需要 Founder 决策：** COMPLETED 代表"课程全部完成"还是"学习关系结束"？

### G3: Lesson→Attendance→Finance 完整链路

- **严重度：** HIGH
- **Blueprint 现状：** lesson.finished 事件的 payload 和 Finance 消费算法已定义，但 Finance Context 未实现
- **Epic 1 处理：** Event 发布后无 Consumer，不影响 Teaching 流程
- **需要 Founder 决策：** Finance Context 何时实现？

### G4: Contract 创建流程属于 Finance Context

- **严重度：** MEDIUM
- **Blueprint 现状：** Contract 聚合在 Teaching Context 中定义，但创建流程涉及付款，属于 Finance
- **Epic 1 处理：** Memory 模式下直接构造 Contract
- **需要 Founder 决策：** Contract 创建应在 Finance 还是 Teaching Context？

### G5: Contract.remainingLessons 扣减触发者

- **严重度：** MEDIUM
- **Blueprint 现状：** CONTRACT-002 明确"仅 Finance 扣减 remainingLessons"
- **Epic 1 处理：** 不修改 remainingLessons
- **需要 Founder 决策：** Finance 实现后如何对接？

### G6: Student→Enrollment 桥接

- **严重度：** MEDIUM
- **Blueprint 现状：** Student Context 冻结，Teaching Context 有 Enrollment，但"Student 被 Enrollment"这个动作未定义
- **Epic 1 处理：** 不处理
- **需要 Founder 决策：** 是否需要 Student Context 发出事件通知 Teaching？

### G7: Attendance Review Window

- **严重度：** LOW
- **Blueprint 现状：** UbiquitousLanguage.md 定义 Review Window 默认 24h
- **Epic 1 处理：** 不实现时间窗口，采用人工确认
- **需要 Founder 决策：** 是否需要自动 Review Window？

### G8: ChangeRequest 业务流程

- **严重度：** LOW
- **Blueprint 现状：** LessonChangeRequest 聚合已定义（RESCHEDULE/TEACHER_CHANGE/CANCEL/REOPEN），但没有定义业务流程
- **Epic 1 处理：** 不实现（骨架保持 NotImplemented）
- **需要 Founder 决策：** 谁发起变更请求？谁审批？

### G9: Teacher Assignment 分配规则

- **严重度：** LOW
- **Blueprint 现状：** CLASS-001 定义 ACTIVE 需要恰好 1 个 PRIMARY 教师，但没有定义分配规则
- **Epic 1 处理：** 已有 assignTeacher() 方法，但规则不完整
- **需要 Founder 决策：** PRIMARY/SUBSTITUTE 的分配权限和规则？

### G10: Course PUBLISHED 条件

- **严重度：** LOW
- **Blueprint 现状：** Course 状态机定义 DRAFT→PUBLISHED，但没有定义 PUBLISHED 的前置条件
- **Epic 1 处理：** 简单状态转换，不做前置检查
- **需要 Founder 决策：** Course 需要满足什么条件才能发布？

### G11: Class DRAFT→ACTIVE 详细条件

- **严重度：** LOW
- **Blueprint 现状：** CLASS-002 定义"需要教师+课表"，但"课表"的具体结构（dayOfWeek, startTime, endTime）的业务含义未定义
- **Epic 1 处理：** 已有 guardActivation() 验证字段非空
- **需要 Founder 决策：** 课表的具体业务规则？

---

## 总结

| 严重度 | 数量 | 需要 Founder 决策 |
|--------|------|------------------|
| HIGH | 3 | G1, G2, G3 |
| MEDIUM | 3 | G4, G5, G6 |
| LOW | 5 | G7, G8, G9, G10, G11 |
| **Total** | **11** | |

**关键：** 所有 Gap 均未在 Epic 1 中自行补充。等待 Founder 逐个确认后，作为后续 Epic 的 Blueprint 扩展输入。
