# Epic 1: Teaching Capability — Blueprint Audit Report

**日期：** 2026-07-16
**阶段：** Phase 1 — Blueprint Audit
**角色：** Developer Agent
**硬规则：** 本阶段禁止写代码

---

## 1. 当前教学能力理解

Teaching Context 是 EduOS 的**核心域（Core Domain）**。教育机构的核心业务就是教学。

**地位：**
- 定位：Core Domain（"业务就是教学"）
- 状态：In Progress（Sprint 4 启动，Sprint 5.2 Kernel 已完成）
- 依赖：Identity（认证）→ Student（学生档案）
- 消费者：Finance（扣费）、Points（积分）、Notification（通知）、Dashboard（看板）

**Bounded Context 拥有的数据：**
8 张表、8 个实体、5 个聚合根

| # | 聚合 | 根实体 | 子实体 | 身份标识 | 状态机 |
|---|------|--------|--------|---------|--------|
| T1 | Course | Course | — | courseCode (CSYYYYMMNNNN) | DRAFT → PUBLISHED → ARCHIVED |
| T2 | Class | Class | TeacherAssignment[] | classCode (CLYYYYMMNNNN) | DRAFT → ACTIVE → COMPLETED / CANCELLED |
| T3 | Contract | Contract | — | contractCode (CTYYYYMMNNNN) | ACTIVE → EXHAUSTED / EXPIRED / FROZEN → REFUNDED |
| T4 | Lesson | Lesson | LessonAttendance[], LessonChangeRequest[] | lessonId (number) | DRAFT → SCHEDULED → TEACHING → FINISHED → ARCHIVED / CANCELLED |
| T5 | Enrollment | Enrollment | — | (classCode, studentCode) 联合 | ACTIVE → WITHDRAWN / COMPLETED |

---

## 2. 已有能力（Blueprint 已定义 + 代码已实现）

### 2.1 聚合（Aggregate）— Blueprint 已冻结，代码已存在

| 聚合 | Blueprint | 代码位置 | 状态 |
|------|-----------|---------|------|
| T1 Course | ✅ 冻结 | `src/modules/teaching/course/` | CRUD + DRAFT→PUBLISHED→ARCHIVED |
| T2 Class | ✅ 冻结 | `src/modules/teaching/class/` | CRUD + DRAFT→ACTIVE→COMPLETED + TeacherAssignment |
| T3 Contract | ✅ 冻结 | `src/modules/teaching/contract/` | CRUD + remainingLessons + status |
| T4 Lesson | ✅ 冻结 | `src/modules/teaching/lesson/` | CRUD + 6态状态机 + Attendance + ChangeRequest |
| T5 Enrollment | ✅ 冻结 | `src/modules/teaching/enrollment/` | CRUD + ACTIVE→WITHDRAWN/COMPLETED |

### 2.2 业务规则（Business Rules）— 22 条不变量已冻结

| 聚合 | 规则数 | 关键不变量 |
|------|--------|-----------|
| T1 Course | 2 | COURSE-001（仅 DRAFT 可软删）, COURSE-002（ARCHIVED 非终态） |
| T2 Class | 3 | CLASS-001（ACTIVE 需恰好1个 PRIMARY 教师）, CLASS-002（DRAFT→ACTIVE 需教师+课表）, CLASS-003（ACTIVE→COMPLETED 自动） |
| T3 Contract | 3 | CONTRACT-001（remainingLessons ≥ 0）, CONTRACT-002（仅 Finance 扣减）, CONTRACT-003（FROZEN↔ACTIVE 双向） |
| T4 Lesson | 5 | LESSON-001~005（日期、状态、出席确认等） |
| T5 Enrollment | 5 | ENROLL-001~005（唯一性、合同、终态等） |
| T4 Attendance | 4 | ATTEND-001~004（工作流状态、出席状态） |

### 2.3 状态机（State Machines）— 7 个已冻结

1. **Course Status** — DRAFT → PUBLISHED → ARCHIVED
2. **Class Status** — DRAFT → ACTIVE → COMPLETED / CANCELLED
3. **Contract Status** — ACTIVE → EXHAUSTED / EXPIRED / FROZEN → REFUNDED
4. **Lesson Status** — DRAFT → SCHEDULED → TEACHING → FINISHED → ARCHIVED / CANCELLED
5. **Enrollment Status** — ACTIVE → WITHDRAWN / COMPLETED
6. **Attendance Workflow** — PENDING → CHECKED_IN → CONFIRMED → LOCKED
7. **Teacher Assignment Status** — ACTIVE ↔ INACTIVE

### 2.4 事件（Events）— 6 个已冻结

| # | 事件 | 所有者 | 发布时机 |
|---|------|--------|---------|
| 1 | lesson.completed | Teaching | Lesson 完成（教师视角） |
| 2 | lesson.finished | Teaching | Lesson 最终确认（含出席数据） |
| 3 | attendance.confirmed | Teaching | 出席确认（Review Window 后） |
| 4 | lesson.feedback.created | Teaching | 教师提交反馈（FUTURE） |
| 5 | leave.submitted | Teaching | 学员请假提交（FUTURE） |
| 6 | leave.approved | Teaching | 学员请假批准（FUTURE） |

**已冻结但标记为 FUTURE 的事件：** attendance.confirmed, lesson.feedback.created, leave.submitted, leave.approved

### 2.5 通用语言（Ubiquitous Language）— 已冻结

所有教学术语已在 UbiquitousLanguage.md 中定义，包括：
- 标识符格式：CS/CL/CT/ST + YYYYMMNNNN
- 反模式词典：11 个禁用词 → 正确术语
- 跨上下文翻译表

### 2.6 通用代码

| 代码 | 位置 | 状态 |
|------|------|------|
| BaseEntity（审计字段） | `src/shared/entity/entity.base.ts` | ✅ Sprint 5.2 |
| AggregateRoot（事件收集） | `src/shared/entity/aggregate-root.ts` | ✅ Sprint 5.2 |
| Result Monad | `src/shared/result/result.ts` | ✅ Sprint 5.2 |
| Guard | `src/shared/guard/guard.ts` | ✅ Sprint 5.2 |
| AggregateRuntime | `src/kernel/domain/aggregate-runtime.ts` | ✅ Sprint 5.2 |
| SpecificationRuntime | `src/kernel/specification/specification-runtime.ts` | ✅ Sprint 5.2 |
| PolicyRuntime | `src/kernel/policy/` | ✅ Sprint 5.2 |
| FakeRepository | `src/test-toolkit/fake-repository.ts` | ✅ Sprint 5.2 |

---

## 3. 缺失能力（Blueprint Gap）

### 3.1 Blueprint 未定义的能力

| # | Gap | 严重度 | 说明 |
|---|-----|--------|------|
| G1 | **Enrollment 创建流程** | HIGH | Blueprint 定义了 Enrollment 聚合（ACTIVE→WITHDRAWN/COMPLETED），但没有定义 Enrollment 是如何被创建的。谁触发 Enrollment？什么条件？Blueprint 未回答。 |
| G2 | **Lesson → Attendance → Finance 完整链路** | HIGH | Blueprint 定义了 lesson.finished 事件的 payload 和 Finance 的消费算法，但没有定义：(1) 谁发布 lesson.finished？(2) 出席数据从哪里来？(3) Review Window 在哪里实现？ |
| G3 | **Course→Class 的业务流程** | MEDIUM | Blueprint 定义了 Course（DRAFT→PUBLISHED→ARCHIVED）和 Class（DRAFT→ACTIVE→COMPLETED），但没有定义：(1) Course PUBLISHED 的条件是什么？(2) Class 什么时候从 DRAFT 变为 ACTIVE？ |
| G4 | **Contract 创建流程** | MEDIUM | Blueprint 定义了 Contract 聚合，但没有定义：(1) 谁创建 Contract？(2) 创建时 initialLessons 从哪里来？（Finance Context？） |
| G5 | **Student 注册→Enrollment 的桥接** | MEDIUM | Student Context 冻结，Teaching Context 有 Enrollment，但两者之间的"Student 被 Enrollment"这个动作没有被任何 Blueprint 定义。 |
| G6 | **Teacher Assignment 业务流程** | LOW | Blueprint 定义了 Class 包含 TeacherAssignment[]，但没有定义：(1) 谁分配教师？(2) PRIMARY/SUBSTITUTE 的分配规则？ |

### 3.2 代码已实现但 Blueprint 未定义的能力

| # | Gap | 说明 |
|---|-----|------|
| G7 | **Lesson ChangeRequest** | 代码实现了 RESCHEDULE/TEACHER_CHANGE/CANCEL/REOPEN 四种变更请求。Blueprint 有状态机，但没有定义 ChangeRequest 的业务流程（谁发起？谁审批？） |

---

## 4. 数据依赖

### 4.1 聚合间依赖（已审计，无循环）

```
Identity (无依赖，根)
  └── Student (依赖 Identity.userId)
        └── Teaching Context:
              ├── Course (无依赖)
              │     └── Class (依赖 Course.courseCode, Identity.teacherId)
              ├── Contract (依赖 Student.studentCode)
              │     └── Enrollment (依赖 Class, Student, Contract) ← 中风险
              └── Lesson (依赖 Class.classCode)
                    ├── LessonAttendance (依赖 Student.studentCode)
                    └── LessonChangeRequest
```

### 4.2 跨上下文依赖

| 生产者 | 消费者 | 事件 | 机制 |
|--------|--------|------|------|
| Identity | All | JWT 认证 | 同步 |
| Student | Teaching | student.deactivated, student.status.changed | EventBus |
| **Teaching** | **Finance** | lesson.finished | **EventBus（核心链路）** |
| Finance | Teaching | contract.exhausted/expired/refunded | EventBus |
| Teaching | Points | attendance.confirmed, lesson.finished | EventBus |
| Teaching | Notification | lesson.completed, lesson.feedback.created, leave.* | EventBus（FUTURE） |
| Teaching | Dashboard | lesson.completed, lesson.finished, attendance.confirmed | EventBus |

### 4.3 关键数据流

```
Teaching Flow（核心业务流）:

Course(PUBLISHED) → Class(DRAFT→ACTIVE, 含 TeacherAssignment)
    ↓
Class(ACTIVE) + Contract(ACTIVE) → Enrollment(ACTIVE)
    ↓
Enrollment(ACTIVE) → Lesson(SCHEDULED→TEACHING→FINISHED)
    ↓
Lesson(FINISHED) → Attendance(CONFIRMED→LOCKED)
    ↓
Attendance(LOCKED) → lesson.finished Event
    ↓
Finance: contract.remainingLessons -= attended_lessons
```

---

## 5. 技术风险

### 5.1 高风险

| # | 风险 | 影响 | Blueprint 建议的缓解 |
|---|------|------|---------------------|
| R1 | **Enrollment 是单点故障** | Enrollment 连接 Class、Student、Contract 三个聚合。如果 Enrollment 出错，整个教学流程中断。 | UNIQUE 约束 + ACTIVE 合同要求 + 异常监控 |
| R2 | **Contract.remainingLessons 竞态条件** | 多个 Lesson 同时完成时可能并发扣减 remainingLessons。 | UPDATE WHERE remainingLessons > 0 + 乐观锁 |

### 5.2 中风险

| # | 风险 | 影响 |
|---|------|------|
| R3 | **Event 顺序保证** | lesson.finished 必须在 attendance.confirmed 之后。如果乱序，Finance 会扣减错误数据。 |
| R4 | **FUTURE 事件与当前实现的差距** | attendance.confirmed, lesson.feedback.created, leave.* 标记为 FUTURE，但 Lesson 状态机依赖 attendance.confirmed 来完成 FINISHED→ARCHIVED 转换。 |

### 5.3 低风险

| # | 风险 | 说明 |
|---|------|------|
| R5 | **Student deactivation 与 Enrollment 的交互** | Student.deactivated 事件被 Teaching Context 消费，但 Blueprint 未定义自动处理逻辑。 |

---

## 6. 开发建议

### 6.1 实现顺序（建议）

基于 Blueprint 和数据依赖，建议的实现顺序：

```
Step 1: Course Aggregate（无依赖，可独立运行）
    ↓
Step 2: Class Aggregate（依赖 Course + Identity）
    ↓
Step 3: Contract Aggregate（依赖 Student，但可独立实现）
    ↓
Step 4: Enrollment Aggregate（依赖 Class + Student + Contract）
    ↓
Step 5: Lesson Aggregate + Attendance（依赖 Class + Enrollment）
    ↓
Step 6: Event Flow（lesson.completed → attendance.confirmed → lesson.finished）
    ↓
Step 7: Cross-context Integration（Finance 消费 lesson.finished）
```

### 6.2 Memory Repository 策略

每个 Aggregate 需要一个 MemoryRepository：
- `FakeCourseRepository`
- `FakeClassRepository`
- `FakeContractRepository`
- `FakeEnrollmentRepository`
- `FakeLessonRepository`

使用 Sprint 5.2 创建的 `FakeRepository` 基类。

### 6.3 Blueprint Gap 的处理策略

| Gap | 策略 |
|-----|------|
| G1-G6 | **记录为 Blueprint Gap**，在 Phase 11 Technical Debt 中记录。不在本次实现中新增业务规则。 |
| G7 | ChangeRequest 业务流程未定义，**不在本次实现中处理**。仅实现聚合结构。 |
| FUTURE 事件 | **不实现**。仅实现已冻结的事件（lesson.completed, lesson.finished）。 |

### 6.4 E2E 场景（可实现的）

基于 Blueprint 已定义的能力，可实现的完整场景：

```
Scenario: Happy Path — 课程到出席完整流程
1. CreateCourse → Course(DRAFT)
2. PublishCourse → Course(PUBLISHED)
3. CreateClass → Class(DRAFT)
4. ActivateClass → Class(ACTIVE) [含 TeacherAssignment]
5. CreateContract → Contract(ACTIVE) [含 remainingLessons]
6. CreateEnrollment → Enrollment(ACTIVE)
7. ScheduleLesson → Lesson(SCHEDULED)
8. StartLesson → Lesson(TEACHING)
9. RollCall → Attendance(CHECKED_IN)
10. ConfirmAttendance → Attendance(CONFIRMED)
11. CompleteLesson → Lesson(FINISHED)
12. LockAttendance → Attendance(LOCKED)
13. lesson.finished Event 发布
```

**注意：** Step 5 (CreateContract) 和 Step 6 (CreateEnrollment) 的业务触发条件来自 Gap G4 和 G1。在 Memory Repository 模式下，直接构造数据，不涉及跨上下文触发。

---

## 7. 不确定项

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| Q1 | **Course DRAFT→PUBLISHED 的条件是什么？** | Blueprint 未定义 PUBLISHED 的前置条件。 | Gap: 记录。实现时使用简单的状态转换，不做前置检查。 |
| Q2 | **Class DRAFT→ACTIVE 的触发条件是什么？** | Blueprint CLASS-002 说"需要教师+课表"，但"课表"的具体结构未定义。 | Gap: 记录。实现时假设已手动设置 schedule 字段。 |
| Q3 | **Contract 由谁创建？** | Blueprint 定义了 Contract 聚合，但创建流程属于 Finance Context。 | Gap: 记录。Memory 模式下直接构造。 |
| Q4 | **Enrollment 由谁创建？** | Blueprint 未定义 Enrollment 的创建触发条件。 | Gap: 记录。Memory 模式下直接构造。 |
| Q5 | **lesson.finished 事件的 payload 中 attendance[] 包含哪些字段？** | ContextInteractionMatrix 定义了 payload 结构，但具体字段粒度不确定。 | 使用 ContextInteractionMatrix 中定义的 payload。 |
| Q6 | **FUTURE 事件（attendance.confirmed 等）是否影响当前状态机？** | Lesson 状态机 FINISHED→ARCHIVED 需要所有 attendance 确认。 | FUTURE 事件不实现。ARCHIVED 转换在当前 scope 中不实现。 |
| Q7 | **Finance Context 尚未实现，lesson.finished 事件发给谁？** | Event Dispatcher 存在但没有 Finance Consumer。 | Memory 模式下，事件被收集但不实际消费。记录为 Gap。 |

---

## 审计结论

### 已有的

- ✅ 5 个 Aggregate（T1-T5）蓝图完整冻结
- ✅ 22 条业务不变量冻结
- ✅ 7 个状态机冻结
- ✅ 6 个 Event 冻结（其中 4 个 FUTURE）
- ✅ 通用语言 100% 覆盖教学术语
- ✅ Kernel 运行时（Sprint 5.2 完成）
- ✅ 依赖分析无循环

### 缺失的

- ❌ 6 个 Blueprint Gap（G1-G6）— 业务流程未定义
- ❌ 1 个代码实现 Gap（G7）— ChangeRequest 业务流程
- ❌ Finance Context 未实现 — 无法消费 lesson.finished
- ❌ 跨上下文 EventBus 未实现 — 仅 Memory 模式

### 建议

**本 Epic 的边界应该是：**

在 Blueprint 已定义的范围内，实现一个可完整运行的教学流程（Course → Class → Lesson → Attendance）。

不扩展 Blueprint。不新增业务概念。所有 Gap 记录在 Technical Debt 中。

---

**Blueprint Audit 完成。等待 CTO Review。**
