# Epic 1: Teaching Capability — Architecture Proposal

**日期：** 2026-07-16
**阶段：** Phase 2 — Architecture Proposal
**角色：** Developer Agent
**目标：** 设计 Teaching Capability 最小业务闭环
**硬规则：** 等待 Founder 确认后才能编码

---

## 0. 设计原则

| 原则 | 说明 |
|------|------|
| 最小闭环 | 只实现 Blueprint 已定义的核心流程，不扩展范围 |
| 增量演进 | 不全量重构贫血模型。在现有代码上增量添加业务行为 |
| Blueprint 驱动 | 所有设计决策追溯到 Blueprint，不自行发明 |
| Finance 隔离 | Contract 扣减逻辑留给 Finance Context，Teaching 只发布事件 |
| 证据驱动 | 每个设计决策附带 Blueprint 依据 |

---

## 1. 当前 Domain 边界

```
┌─────────────────────────────────────────────────┐
│                  Teaching Context                │
│                                                  │
│  T1 Course ──→ T2 Class (+ TeacherAssignment)    │
│                    │                             │
│                    ↓ classCode                   │
│  T3 Contract ←── T5 Enrollment                   │
│       │              │                           │
│       │              ↓ classCode + studentCode   │
│       └────────→ T4 Lesson (+ Attendance)        │
│                                                  │
│  Events: lesson.completed, lesson.finished        │
│  (attendance.confirmed, leave.*, feedback: FUTURE)│
└─────────────────────────────────────────────────┘
         ↑                    ↓
    Identity            Finance (未实现)
    (认证)            (消费 lesson.finished)
         ↑
    Student
    (学生档案)
```

**Teaching Context 拥有：** 5 Aggregate, 8 表, 7 状态机, 6 Event（2 个可实现, 4 个 FUTURE）
**Teaching Context 不拥有：** Student 生命周期, Contract 扣减, 用户认证

---

## 2. Teaching Context 范围（Epic 1）

### 2.1 在范围内（Epic 1 实现）

| 能力 | 实现内容 | Blueprint 依据 |
|------|---------|---------------|
| Course 生命周期 | DRAFT → PUBLISHED → ARCHIVED，含软删 | COURSE-001, COURSE-002 |
| Class 生命周期 | DRAFT → ACTIVE → COMPLETED/CANCELLED，含教师分配 | CLASS-001, CLASS-002, CLASS-003 |
| Contract 基础 | 创建 + 状态管理（ACTIVE/FROZEN/REFUNDED） | CONTRACT-001, CONTRACT-003 |
| Enrollment 基础 | 创建 + ACTIVE→WITHDRAWN，含合同验证 | ENROLL-001~005 |
| Lesson 全流程 | 6 态状态机 + event 发布 | LESSON-001~005 |
| Attendance 基础 | Roll Call + Confirm + Lock | ATTEND-001~004, 两阶段设计 |

### 2.2 不在范围内（记录为 Gap）

| 能力 | 原因 |
|------|------|
| Contract.remainingLessons 扣减 | Blueprint CONTRACT-002：仅 Finance |
| Finance 消费 lesson.finished | Finance Context 未实现 |
| Lesson ChangeRequest 业务流程 | Blueprint 未定义业务流程 |
| Feedback / Leave | FUTURE 事件 |
| REST API 完整实现 | Controller 骨架保持，Epic 1 走 Command 路径 |

---

## 3. Enrollment 生命周期方案

### Blueprint 现状

- 枚举：ACTIVE, WITHDRAWN, COMPLETED
- 不变量：ENROLL-004（COMPLETED 是终态）
- **缺失：** 没有定义 ACTIVE→COMPLETED 的转换条件

### 方案对比

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A: 课程完成触发** | 当 Lesson 数量达到 Class.totalLessons 且全部 FINISHED 时自动 COMPLETED | 与教学流程自然对齐 | 需要跨 Aggregate 计数 |
| **B: 手动标记** | 教师/Admin 手动将 Enrollment 标记为 COMPLETED | 简单，可控 | 依赖人工操作 |
| **C: 不实现 COMPLETED** | Epic 1 仅实现 ACTIVE↔WITHDRAWN，COMPLETED 留给后续 | 最小范围 | 不满足 E2E "完整流程" |

### 📌 需要 Founder 决策：选哪个方案？

**我的建议：方案 C（最小范围）**

理由：
1. Blueprint 没有定义 COMPLETED 触发条件，我不应该自行补充
2. Epic 1 的核心闭环是 Course→Class→Lesson→Attendance→Event
3. COMPLETED 可以在 Epic 2 中补充，不影响当前闭环

如果 Founder 选择 A 或 B，我需要对应的 Blueprint 补充文档。

---

## 4. Lesson 生命周期（Blueprint 已定义，直接实现）

### 状态机

```
DRAFT ──→ SCHEDULED ──→ TEACHING ──→ FINISHED ──→ ARCHIVED
  │           │              │            │
  └── CANCELLED ←───────────┘            │
                                  SCHEDULED (reopen)
  FINISHED ──→ SCHEDULED (reopen)
  ARCHIVED  ──→ FINISHED (reopen)
  CANCELLED ──→ SCHEDULED (reopen)
```

### 关键行为（Blueprint 已定义）

| 行为 | 触发条件 | Event 发布 |
|------|---------|-----------|
| Start Lesson | SCHEDULED→TEACHING | 无（自动填充 actualStartTime） |
| Complete Lesson | TEACHING→FINISHED | `lesson.completed` |
| Archive Lesson | FINISHED→ARCHIVED | `lesson.finished` |
| Cancel Lesson | 任意→CANCELLED | 无（需 reason） |
| Reopen Lesson | ARCHIVED/FINISHED/CANCELLED→SCHEDULED/FINISHED | 无（需 reason） |

### 实现策略

**不重构贫血实体。** Lesson 实体保持 TypeORM 形态，状态机逻辑保留在 Service 层（现有实现已经可用）。增量改进：

1. 确保 `lesson.completed` 和 `lesson.finished` 的 payload 与 Blueprint 一致
2. 确保 Attendance 数据在 `lesson.finished` 时已全部 CONFIRMED
3. 不改变现有状态机实现（已经过 30+ 测试验证）

---

## 5. Attendance 设计（P0 阻塞项）

### Blueprint 定义

两阶段设计：

```
Phase 1: Roll Call（点名）
  PENDING → CHECKED_IN
  教师记录每个学生的出席状态（PRESENT/LATE/ABSENT/LEAVE/MAKEUP/ONLINE/OFFLINE）

Phase 2: Confirmation（确认）
  CHECKED_IN → CONFIRMED → LOCKED
  Review Window 默认 24h
  LOCKED 后不可修改
```

### 当前状态

- 实体 ✅（`LessonAttendanceEntity`，含 workflowState + status 双维度）
- 仓储 ✅（含 countPending, countUnconfirmed）
- 状态机定义 ✅（`VALID_WORKFLOW_TRANSITIONS`）
- **Service 全部 `NotImplementedException`** ❌

### 实现方案

在现有骨架上实现以下方法（不新建文件，修改现有 Service）：

```typescript
// 1. 自动创建出席记录（Lesson SCHEDULED 时）
async autoCreateForLesson(lessonId: number, studentCodes: string[]): Promise<void>

// 2. 点名（教师标记出席状态）
async recordAttendance(lessonId: number, studentCode: string, 
  status: AttendanceStatus, reason?: string): Promise<void>

// 3. 批量点名
async batchRollCall(lessonId: number, records: RollCallRecord[]): Promise<void>

// 4. 确认出席（Review Window 后）
async confirmAll(lessonId: number, confirmedBy: number): Promise<void>

// 5. 锁定（确认后自动锁定）
async lockByLessonId(lessonId: number): Promise<void>
```

### 与 Lesson 状态机的集成点

```
Lesson(SCHEDULED→TEACHING) → autoCreateForLesson()
Lesson(TEACHING→FINISHED)  → 验证所有 Attendance 已 CONFIRMED
Lesson(FINISHED→ARCHIVED)  → 验证所有 Attendance 已 LOCKED + 发布 lesson.finished
```

---

## 6. Domain Event 设计

### Epic 1 可实现的 Event

| Event | 发布时机 | Payload | Blueprint 依据 |
|-------|---------|---------|---------------|
| `lesson.completed` | TEACHING→FINISHED | lessonId, classCode, courseCode, teacherId, scheduledDate, attendance[], confirmedBy | ContextInteractionMatrix |
| `lesson.finished` | FINISHED→ARCHIVED | lessonId, classCode, courseCode, teacherId, scheduledDate, attendance[], confirmedBy, confirmedAt | ContextInteractionMatrix |

### Event 发布架构

**不使用 EventEmitter2（当前用法不规范）。** 使用 Kernel 的 `PendingEvents` + `CommitEvents` 机制：

```typescript
// 在 Lesson Service 中
async completeLesson(lessonId: number): Promise<void> {
  const lesson = await this.repository.findOneById(lessonId);
  
  // 1. 验证 Attendance 已 CONFIRMED
  const unconfirmed = await this.attendanceService.countUnconfirmed(lessonId);
  if (unconfirmed > 0) throw new Error('Not all attendance confirmed');
  
  // 2. 状态转换
  lesson.status = LessonStatus.FINISHED;
  lesson.actualEndTime = new Date();
  await this.repository.save(lesson);
  
  // 3. 发布事件（通过 EventBus）
  await this.eventBus.publish('lesson.completed', { /* payload */ });
}
```

### Event 与 Finance 的隔离

```
Teaching Context:
  lesson.finished Event ──→ EventBus ──→ Finance Context (未实现)
  
Epic 1 行为：
  - Event 被发布到 EventBus
  - 无 Consumer 消费
  - 不影响 Teaching 流程
  - Finance 实现后自动对接
```

---

## 7. 与 Finance 隔离方案

### Blueprint 约束

- CONTRACT-002：仅 Finance Context 修改 remainingLessons
- Teaching 不直接修改 Contract 的 remainingLessons

### Epic 1 实现策略

| Contract 字段 | Epic 1 行为 | 原因 |
|--------------|------------|------|
| status | Teaching 可设置 ACTIVE/FROZEN/REFUNDED | Blueprint 允许 |
| remainingLessons | **不修改** | Blueprint 约束：仅 Finance |
| totalLessons | 创建时设置 | Blueprint 允许 |

### 隔离验证

```typescript
// Contract Service 中禁止扣减
deductRemainingLessons(): never {
  throw new Error('CONTRACT-002: Only Finance Context may deduct remainingLessons');
}
```

---

## 8. 测试策略

### 8.1 测试分层

| 层 | 测试类型 | 覆盖范围 |
|----|---------|---------|
| Domain | 聚合行为测试 | 状态机、不变量、事件发布 |
| Application | Use Case 测试 | Command Handler 端到端 |
| Integration | 跨聚合测试 | Enrollment→Lesson→Attendance 流程 |
| E2E Scenario | 业务场景测试 | 完整 Happy Path + 异常路径 |

### 8.2 Memory Repository 测试

```typescript
// 每个 Aggregate 的 FakeRepository
const courseRepo = new FakeCourseRepository();
const classRepo = new FakeClassRepository();
const contractRepo = new FakeContractRepository();
const enrollmentRepo = new FakeEnrollmentRepository();
const lessonRepo = new FakeLessonRepository();
const attendanceRepo = new FakeLessonAttendanceRepository();
```

基于 Sprint 5.2 创建的 `FakeRepository` 基类。

### 8.3 E2E 场景测试（核心）

**Happy Path（必须通过）：**

```typescript
it('should complete full teaching flow', async () => {
  // 1. Create Course (DRAFT)
  // 2. Publish Course (PUBLISHED)
  // 3. Create Class (DRAFT)
  // 4. Activate Class (ACTIVE) with TeacherAssignment
  // 5. Create Contract (ACTIVE)
  // 6. Create Enrollment (ACTIVE)
  // 7. Schedule Lesson (SCHEDULED)
  // 8. Start Lesson (TEACHING)
  // 9. Roll Call (CHECKED_IN)
  // 10. Confirm Attendance (CONFIRMED)
  // 11. Complete Lesson (FINISHED) → lesson.completed Event
  // 12. Lock Attendance (LOCKED)
  // 13. Archive Lesson (ARCHIVED) → lesson.finished Event
});
```

**异常路径（必须覆盖）：**

| # | 场景 | 预期结果 |
|---|------|---------|
| 1 | Class 无 PRIMARY 教师时 Activate | CLASS-001 违规 |
| 2 | Contract 非 ACTIVE 时 Enrollment | ENROLL-002 违规 |
| 3 | 重复 Enrollment（同 Class+Student） | ENROLL-001 违规 |
| 4 | Attendance 未全部 CONFIRMED 时 Complete Lesson | 阻止 |
| 5 | 非 DRAFT Course 被删除 | COURSE-001 违规 |
| 6 | ARCHIVED Lesson 直接 SCHEDULED | 需要 reason |
| 7 | 同状态转换 | 阻止 |

---

## 9. 不确定项列表（等待 Founder 决策）

| # | 问题 | 选项 | 建议 | 需要决策者 |
|---|------|------|------|-----------|
| 1 | **Enrollment COMPLETED 含义** | A: 课程完成 / B: 学习关系结束 / C: 不实现 | C（Epic 1 不实现 COMPLETED） | Founder |
| 2 | **Enrollment 创建触发者** | A: Student 主动 / B: Admin 创建 / C: Contract 自动生成 | B（Admin 创建，Memory 模式直接构造） | Founder |
| 3 | **Lesson 完成触发条件** | A: 教师手动 / B: Attendance 全确认后自动 | A+B（教师触发，但前提 Attendance 已全确认） | Blueprint |
| 4 | **Attendance Review Window** | Blueprint 默认 24h。Epic 1 是否实现时间窗口？ | 不实现时间窗口，直接手动确认 | Founder |
| 5 | **Finance Context 实现时间** | Epic 1 范围内 or 之后？ | 之后（不在 Epic 1 范围） | Founder |

---

## 10. 实现计划（架构层面）

### Phase 2a: Attendance 实现（P0）

修改文件：
- `lesson-attendance.service.ts` — 实现5 个核心方法
- `lesson.service.ts` — 集成 Attendance 检查点
- 测试：~15 个新测试

### Phase 2b: Enrollment 增强（P1）

修改文件：
- `enrollment.service.ts` — 增加合同归属验证、完善状态守卫
- 测试：~5 个新测试

### Phase 2c: E2E 场景测试（P0）

新建文件：
- `teaching/__tests__/teaching-e2e.spec.ts`
- 场景：Happy Path + 7 个异常路径
- 测试：~10 个场景测试

### Phase 2d: Event 发布优化（P1）

修改文件：
- `lesson.service.ts` — 确保 payload 与 Blueprint 一致
- 验证 `lesson.completed` 和 `lesson.finished` payload

### Phase 2e: Blueprint Gap 记录

新建文件：
- `docs/epic1/TeachingBlueprintGaps.md` — 记录所有 Gap

### 预估测试增量

- Attendance 实现：~15 个
- Enrollment 增强：~5 个
- E2E 场景：~10 个
- Event 验证：~3 个
- **总增量：~33 个新测试**

---

**Architecture Proposal 完成。等待 Founder 确认后进入 Phase 3: Implementation。**
