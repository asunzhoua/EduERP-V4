# Epic 1: Teaching Capability — CTO Review 响应

**日期：** 2026-07-16
**阶段：** Phase 1 — CTO Review Response（进入 Phase 2 前的补充审计）
**角色：** Developer Agent
**硬规则：** 本阶段禁止写代码、禁止设计新业务规则

---

## 1. Aggregate 实现状态矩阵

对每个 Aggregate 的9 项能力逐一验证。数据来自对实际源码的逐行审计。

### T1: Course（课程）

| # | 能力 | 状态 | 证据 |
|---|------|------|------|
| 1 | Domain Model（聚合根） | ❌ 不存在 | `course.entity.ts:15` — 纯 TypeORM 实体，不继承 `AggregateRoot`，无业务行为方法 |
| 2 | Command/Handler | ❌ 不存在 | 整个 course 目录无 `ICommand` 或 `ICommandHandler` 实现 |
| 3 | Event | ❌ 不存在 | `EventEmitter2` 已注入 `CourseService` 但从未调用 `emit()` |
| 4 | Repository | ⚠️ 数据层 | `course.repository.ts` 包装 TypeORM，非领域仓储 |
| 5 | Service | ✅ CRUD | `course.service.ts` — create/update/updateStatus/remove，状态机内联 |
| 6 | Controller | ✅ REST | 5 个端点 |
| 7 | Tests | ✅ 10 个 | `course.service.spec.ts` — 覆盖 CRUD + 状态转换 |
| 8 | State Machine | ✅ 内联 | `VALID_TRANSITIONS`：DRAFT→PUBLISHED→ARCHIVED，ARCHIVED 可回退 |
| 9 | Invariants | ⚠️ 部分 | COURSE-001（仅 DRAFT 可删）✅，COURSE-002（ARCHIVED 非终态）✅，使用 `BadRequestException` 而非 `InvariantViolationException` |

### T2: Class（班级）

| # | 能力 | 状态 | 证据 |
|---|------|------|------|
| 1 | Domain Model | ❌ 不存在 | `class.entity.ts:13` — 纯 TypeORM 实体，不继承 `AggregateRoot` |
| 2 | Command/Handler | ❌ 不存在 | 无命令模式 |
| 3 | Event | ❌ 不存在 | `EventEmitterModule` 已导入但 Service 未注入 EventBus |
| 4 | Repository | ⚠️ 数据层 | 包装 TypeORM |
| 5 | Service | ✅ CRUD | `class.service.ts` — 含 guardActivation() 激活守卫 |
| 6 | Controller | ✅ REST | 9 个端点（含教师分配） |
| 7 | Tests | ✅ 26 个 | `class.service.spec.ts`(20) + `teacher-assignment.service.spec.ts`(6) |
| 8 | State Machine | ✅ 内联 | DRAFT→ACTIVE→COMPLETED/CANCELLED，CANCELLED 可回退 |
| 9 | Invariants | ⚠️ 部分 | CLASS-001/002/003 全部在 `guardActivation()` 中执行，使用 `BadRequestException` |

### T3: Contract（合同）

| # | 能力 | 状态 | 证据 |
|---|------|------|------|
| 1 | Domain Model | ⚠️ 贫血 | `contract.entity.ts:14` — 17 个声明性列，无行为方法（无 freeze/unfreeze/deduct） |
| 2 | Command/Handler | ❌ 不存在 | |
| 3 | Event | ❌ 不存在 | 财务事件类已定义但 Contract 从不发布 |
| 4 | Repository | ✅ | `findOneById/ByCode/ByStudentCode`, `countByStudentCode` |
| 5 | Service | ✅ | `create/findOne/freeze/unfreeze/updateStatus` |
| 6 | Controller | ⚠️ 骨架 | 6 个路由全部抛 `NotImplementedException`，DTO 为空 |
| 7 | Tests | ✅ 14 个 | 覆盖 create/freeze/unfreeze/状态转换 |
| 8 | State Machine | ✅ 内联 | ACTIVE→FROZEN/REFUNDED, EXHAUSTED→REFUNDED 等 |
| 9 | Invariants | ⚠️ 缺失关键项 | `remainingLessons ≥ 0` 未验证，`EXHAUSTED` 转换无代码触发，`remainingLessons` 扣减逻辑不存在（Blueprint 说仅 Finance 扣减） |

### T4: Lesson（课程节）

| # | 能力 | 状态 | 证据 |
|---|------|------|------|
| 1 | Domain Model | ⚠️ 贫血 | `lesson.entity.ts:13` — 23 个列，无行为方法 |
| 2 | Command/Handler | ❌ 不存在 | |
| 3 | Event | ✅ 已发布 | `lesson.completed`（TEACHING→FINISHED）+ `lesson.finished`（FINISHED→ARCHIVED） |
| 4 | Repository | ✅ | `save/saveAll/findOneById/findByClassCode/countByClassCode` |
| 5 | Service | ✅ 全面 | `updateStatus()` 处理全部 6 态 + reopen 守卫 + 时间戳自动填充 |
| 6 | Controller | ⚠️ 骨架 | 13 个路由全部 `NotImplementedException` |
| 7 | Tests | ✅ 30+ 个 | `lesson.service.spec.ts`(25+) + `lesson-event.subscriber.spec.ts`(5) |
| 8 | State Machine | ✅ 内联 | 6 态 + 3 条 reopen 路径 + 专用守卫 |
| 9 | Invariants | ⚠️ 部分 | 状态转换 ✅，时间戳自动填充 ✅，日期/时间验证 ❌，唯一性检查 ❌ |
| 10 | Attendance | ⚠️ 骨架 | 实体+仓储+状态机定义存在，**所有 Service 方法抛 `NotImplementedException`** |
| 11 | ChangeRequest | ⚠️ 骨架 | 实体+仓储+状态机定义存在，**所有 Service 方法抛 `NotImplementedException`** |
| 12 | 两阶段事件 | ✅ | lesson.completed 和 lesson.finished 分别在不同状态转换时发布，payload 区分明确 |

### T5: Enrollment（报名）

| # | 能力 | 状态 | 证据 |
|---|------|------|------|
| 1 | Domain Model | ⚠️ 贫血 | `enrollment.entity.ts:14` — 10 个列，无行为方法 |
| 2 | Command/Handler | ❌ 不存在 | |
| 3 | Event | ❌ 不存在 | |
| 4 | Repository | ✅ | 含 `findByClassAndStudent`, `countActiveByClassCode` |
| 5 | Service | ✅ | `enroll/withdraw`，含合同验证+重复检查 |
| 6 | Controller | ⚠️ 骨架 | 6 个路由全部 `NotImplementedException` |
| 7 | Tests | ✅ 13 个 | 覆盖 enroll（含合同验证）+ withdraw |
| 8 | State Machine | ⚠️ 隐式 | 无正式 `VALID_TRANSITIONS` 表，仅 `withdraw()` 方法中有守卫。`COMPLETED` 状态从未被使用 |
| 9 | Invariants | ⚠️ 部分 | 合同 ACTIVE 检查 ✅，重复注册检查 ✅，合同归属验证 ❌，COMPLETED 转换 ❌ |

---

### 汇总矩阵

| 能力 | T1 Course | T2 Class | T3 Contract | T4 Lesson | T5 Enrollment |
|------|-----------|----------|-------------|-----------|---------------|
| Domain Model | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| Command/Handler | ❌ | ❌ | ❌ | ❌ | ❌ |
| Event | ❌ | ❌ | ❌ | ✅ | ❌ |
| Repository | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| Service | ✅ | ✅ | ✅ | ✅ | ✅ |
| Controller | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Tests | ✅ 10 | ✅ 26 | ✅ 14 | ✅ 30+ | ✅ 13 |
| State Machine | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Invariants | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

**图例：** ✅ 完整存在 | ⚠️ 部分存在/骨架 | ❌ 不存在

---

## 2. Gap 影响分析

### 2.1 阻塞 Epic 1 的 Gap

| Gap | 影响模块 | 是否阻塞 | 说明 |
|-----|---------|---------|------|
| **G-贫血模型** | T1~T5 全部 | **是** | 所有 Aggregate 都是贫血 TypeORM 实体。要实现 Blueprint 定义的业务行为，必须创建真正的聚合根（继承 `AggregateRoot`，包含行为方法）。 |
| **G-Attendance 骨架** | T4 Lesson | **是** | Attendance 是 E2E 流程的关键环节。所有方法抛 `NotImplementedException`。没有可执行的考勤流程。 |
| **G-COMPLETED 状态不可达** | T5 Enrollment | **是** | Blueprint 定义了 ACTIVE→COMPLETED 转换，但代码中无任何路径可达 COMPLETED。E2E 流程需要 enrollment 能进入 COMPLETED。 |

### 2.2 不阻塞但需记录的 Gap

| Gap | 影响模块 | 是否阻塞 | 说明 |
|-----|---------|---------|------|
| G1: Enrollment 创建流程 | T5 | 否（Memory 模式可绕过） | Blueprint 未定义创建触发条件。Memory 模式下直接构造。 |
| G2: Lesson→Finance 链路 | T4→Finance | 否（Finance 未实现） | lesson.finished 事件被发布但无消费者。 |
| G4: Contract 创建流程 | T3 | 否（Memory 模式可绕过） | Blueprint 定义了聚合但创建流程属于 Finance。 |
| G-Controller 骨架 | T3/T4/T5 | 否（Command 模式不依赖 Controller） | Controller 全部 NotImplemented。Epic 1 走 Command 路径，不走 REST。 |
| G-Command 不存在 | T1~T5 全部 | 否（可在实现时创建） | Blueprint 定义了 Use Case，Kernel 有 ICommandHandler 基础设施。 |

### 2.3 需要 Founder 决策的 Gap

| Gap | 问题 | 需要决策 |
|-----|------|---------|
| G1 | Enrollment 由谁创建？ | Blueprint 未定义。Memory 模式下直接构造，但如果未来需要完整流程，需要业务确认。 |
| G2 | Finance Context 何时实现？ | lesson.finished 发布但无消费。Epic 1 范围是否包含 Finance Consumer？ |
| G-remainingLessons | Contract 扣减由谁触发？ | Blueprint CONTRACT-002 说"仅 Finance 扣减"。但 Finance 未实现。Memory 模式下是否允许 Teaching 直接扣减？ |

---

## 3. Domain 边界确认

### 3.1 Teaching Context 数据流

```
输入（来自其他 Context）：
  Identity → 认证（JWT，同步）
  Student  → student.deactivated 事件（异步）

Teaching Context 内部数据流：
  Course(PUBLISHED)
    ↓ courseCode
  Class(DRAFT→ACTIVE, TeacherAssignment[])
    ↓ classCode
  Enrollment(ACTIVE) ← Contract(ACTIVE) ← Student(studentCode)
    ↓ classCode + studentCode
  Lesson(SCHEDULED→TEACHING→FINISHED→ARCHIVED)
    ↓ lessonId
  Attendance(PENDING→CHECKED_IN→CONFIRMED→LOCKED)

输出（到其他 Context）：
  Teaching → Finance:     lesson.finished 事件
  Teaching → Points:      attendance.confirmed, lesson.finished 事件
  Teaching → Notification: lesson.completed 等（FUTURE）
  Teaching → Dashboard:   lesson.completed, lesson.finished 事件
```

### 3.2 跨 Context 边界确认

| 边界 | 规则 | 当前状态 |
|------|------|---------|
| Teaching → Finance | 仅通过 EventBus，不直接访问 Contract | ✅ 符合（Finance 未实现，但 Teaching 不直接修改 Contract） |
| Teaching → Student | 仅消费 student.deactivated 事件 | ✅ 符合 |
| Teaching → Identity | 仅 JWT 认证 | ✅ 符合 |
| Finance → Contract | 仅 Finance 修改 remainingLessons | ⚠️ 当前无 Finance，Contract 无扣减代码 |

### 3.3 Teaching Context 内部 Aggregate 边界

| 聚合 | 拥有 | 不拥有 | 引用方式 |
|------|------|--------|---------|
| T1 Course | Course 实体 | Class | 无引用 |
| T2 Class | Class + TeacherAssignment[] | Enrollment, Lesson | 通过 classCode 被引用 |
| T3 Contract | Contract 实体 | Student, Enrollment | 通过 contractCode 被 Enrollment 引用 |
| T4 Lesson | Lesson + Attendance[] + ChangeRequest[] | Student | Attendance 中引用 studentCode |
| T5 Enrollment | Enrollment 实体 | Class, Student, Contract | 通过 classCode/studentCode/contractCode 引用 |

**关键：** Enrollment 是桥梁聚合，连接 Class、Student、Contract。Blueprint AggregateDependencyReview 已标记为"中风险"。

---

## 4. 证据验证

本报告所有数据均来自对实际源码的逐行审计。验证方法：

| 审计项 | 验证方式 |
|--------|---------|
| 实体贫血 | 逐行读取每个 entity.ts，确认无业务方法 |
| Event 不存在 | grep `eventBus\|EventEmitter\|addEvent` 整个目录 |
| 测试数量 | grep `it(` 每个 spec 文件 |
| 骨架 Controller | 逐行读取确认 `NotImplementedException` |
| State Machine | 读取 `VALID_TRANSITIONS` 常量定义 |

---

**CTO Review 响应完成。等待 CTO Review 后进入 Phase 2: Architecture Proposal。**
