# Event Producer Rules

> EduOS 领域事件 Producer（发布方）治理规范。
> 版本：v1 | 生效日期：2026-07-26

---

## 核心原则

**一个 Domain Event 只能有一个 Producer。**

每个领域事件代表业务领域中发生的一件事实，应只由该业务逻辑的自然所有者发出。多 Producer 导致重复消费、数据不一致、难以排查等严重问题。

---

## 规则

### 规则 1：唯一 Producer

每个 Event Name（如 `lesson.completed`）必须有且仅有一个 Service 作为 Producer。

```typescript
// ✅ 正确 — 唯一 Producer
// LessonService 是课程完成逻辑的自然所有者
this.eventBus.publish('lesson.completed', { ... });

// ❌ 错误 — 多个 Producer 发布同一事件
// LessonService 发布 lesson.completed
// LessonExceptionService 也发布 lesson.completed  ← 重复！
```

### 规则 2：禁止多 Service 直接发布同一事件

如果多个业务场景需要触发同一领域事件，必须通过统一的 Producer Service 来发布。

**解决方案示例：**
- `LessonExceptionService` 在补课完成时不应直接 `publish('lesson.completed')`
- 应调用 `LessonService` 的公共方法，由 `LessonService` 统一发布事件
- 或在 `LessonExceptionService` 中发布不同的子事件（如 `makeup.completed`），由专门的路由/编排层转换

### 规则 3：Producer 必须是业务逻辑的自然所有者

| Event | 自然所有者 | 理由 |
|-------|-----------|------|
| `lesson.completed` | `LessonService` | 课程状态变更（TEACHING→FINISHED）由 LessonService 管理 |
| `lesson.finished` | `LessonService` | 课程归档（FINISHED→ARCHIVED）由 LessonService 管理 |
| `lesson.cancelled` | `LessonService` | 课程取消由 LessonService 管理 |
| `salary.calculation.triggered` | `SalaryService` | ❌ 当前由 LessonExceptionService 发布，应迁移到 SalaryService |

### 规则 4：Event Name 与 Event Class 必须对应

每个 `publish()` 调用必须有一个对应的 Event Class 在 `src/events/` 下定义。

```typescript
// ✅ 正确 — Event Class 存在
this.eventBus.publish('lesson.completed', { ... });  // → LessonCompletedEvent

// ❌ 错误 — 无对应 Event Class
this.eventBus.publish('lesson.cancelled', { ... });  // → 缺少 LessonCancelledEvent 类
this.eventBus.publish('salary.calculation.triggered', { ... });  // → 缺少 SalaryCalculationTriggeredEvent 类
```

### 规则 5：Event Class 必须在 `src/events/` 下定义

所有 Domain Event 类必须集中在 `src/events/` 目录下，按业务子域分目录存放。

模块内部不应定义自己的 Event Class（模块内部使用的 DTO 除外）。

```typescript
// ✅ 正确 — 中心定义
src/events/lesson/lesson-completed.event.ts

// ❌ 错误 — 模块内定义
src/modules/salary/events/lesson-completed.event.ts  // 应合并到中心定义
```

---

## 示例

### ✅ 正确做法

```
lesson.completed        → LessonService（课程完成逻辑所有者）
lesson.finished         → LessonService（课程归档逻辑所有者）
lesson.cancelled        → LessonService（课程取消逻辑所有者）
contract.exhausted      → ContractService（合同课时耗尽逻辑所有者）
leave.submitted         → LeaveRequestService（请假提交逻辑所有者）
```

### ❌ 错误做法

```
lesson.completed        → LessonService + LessonExceptionService（重复 Producer！）
lesson.cancelled        → LessonService + CancelLessonService（重复 Producer！）
salary.calculation      → LessonExceptionService（越权发布，应由 SalaryService 发布）
```

---

## 违规处理

1. 新增 Event 时必须先在 `src/events/` 下定义 Event Class，并在 `EVENT-REGISTRY.md` 注册
2. 新增 `eventBus.publish()` 调用前必须确认该 Event Name 尚无 Producer
3. Code Review 时必须检查 Producer 唯一性
4. 架构测试应自动拦截重复 Producer
