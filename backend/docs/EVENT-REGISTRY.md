# Event Registry

> EduOS Domain Event 清单 — 记录所有已定义 Events、Producer、Consumer 及 Payload。
> 生成日期：2026-07-26
> 扫描范围：`src/events/` + `src/modules/`

---

## 总览

| 指标 | 数值 |
|------|------|
| 已定义 Event 类 | 12 |
| 实际发布 Event 名 | 4 |
| Producer（发布方） | 2 个 Service |
| Consumer（订阅方） | 2 个 Listener |
| Producer 唯一性违规 | 1 处（已修复 P0） |

---

## Event 清单

### 已发布（Published）

| Event Name | Event Class | Producer | Consumer | Payload |
|------------|-------------|----------|----------|---------|
| `lesson.completed` | `LessonCompletedEvent`（`src/events/lesson/`） | `LessonService`（`lesson.service.ts`） | `SalaryListener`（`salary.listener.ts`） | lessonId, classCode, courseCode, teacherId, scheduledDate, actualStartTime, actualEndTime, durationMinutes |
| `lesson.completed`（补课场景） | `LessonCompletedEvent`（`src/events/lesson/`） | `LessonExceptionService`（`lesson-exception.service.ts`） | `SalaryListener` | lessonId, classCode, courseCode, teacherId, scheduledDate, actualStartTime, actualEndTime, durationMinutes, isMakeup, originalLessonId |
| `lesson.finished` | `LessonFinishedEvent`（`src/events/lesson/`） | `LessonService`（`lesson.service.ts`） | `LessonEventSubscriber`（日志） | lessonId, classCode, courseCode, teacherId, scheduledDate, actualStartTime, actualEndTime, durationMinutes, confirmedBy, confirmedAt |
| `lesson.cancelled` | 无独立 Event 类 | `LessonService`（`lesson.service.ts`） | `LessonEventSubscriber`（日志） | lessonId, classCode, courseCode, teacherId, scheduledDate, cancelledReason, cancelledBy, cancelledAt |
| `salary.calculation.triggered` | 无独立 Event 类 | `LessonExceptionService`（`lesson-exception.service.ts`） | 无 Consumer | lessonId, teacherId, classCode, scheduledDate, durationMinutes, isMakeup |

### 已定义但未发布（Defined but Not Published）

| Event Name | Event Class | 文件路径 | Producer | Notes |
|------------|-------------|----------|----------|-------|
| `LessonFeedbackCreatedEvent` | `LessonFeedbackCreatedEvent` | `src/events/lesson/lesson-feedback-created.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `AttendanceConfirmedEvent` | `AttendanceConfirmedEvent` | `src/events/lesson/attendance-confirmed.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `LeaveSubmittedEvent` | `LeaveSubmittedEvent` | `src/events/leave/leave-submitted.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `LeaveApprovedEvent` | `LeaveApprovedEvent` | `src/events/leave/leave-approved.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `ContractExhaustedEvent` | `ContractExhaustedEvent` | `src/events/finance/contract-exhausted.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `ContractExpiredEvent` | `ContractExpiredEvent` | `src/events/finance/contract-expired.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `ContractRefundedEvent` | `ContractRefundedEvent` | `src/events/finance/contract-refunded.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `PointsGrantedEvent` | `PointsGrantedEvent` | `src/events/finance/points-granted.event.ts` | ❌ 无 | 已定义尚未接入发布 |
| `StudentDeactivatedEvent` | `StudentDeactivatedEvent` | `src/events/student/student-deactivated.event.ts` | ❌ 无 | 已定义尚未接入发布 |

### 模块内部事件

| Event Class | 文件路径 | 用途 |
|------------|----------|------|
| `LessonCompletedEvent`（Salary） | `src/modules/salary/events/lesson-completed.event.ts` | Salary 模块内部用于 Calculator 入参（独立于中心定义） |

---

## 事件发射源（Producer 详情）

| # | Service | 文件 | 发射事件 | 行号 |
|---|---------|------|----------|------|
| 1 | `LessonService` | `src/modules/teaching/lesson/lesson.service.ts` | `lesson.completed`（TEACHING→FINISHED） | 327 |
| 2 | `LessonService` | `src/modules/teaching/lesson/lesson.service.ts` | `lesson.finished`（FINISHED→ARCHIVED） | 343 |
| 3 | `LessonService` | `src/modules/teaching/lesson/lesson.service.ts` | `lesson.cancelled`（→CANCELLED） | 362 |
| 4 | `LessonExceptionService` | `src/modules/teaching/lesson/lesson-exception/lesson-exception.service.ts` | `lesson.completed`（补课完成） | 562 |
| 5 | `LessonExceptionService` | `src/modules/teaching/lesson/lesson-exception/lesson-exception.service.ts` | `salary.calculation.triggered`（补课完成） | 576 |

---

## 消费者（Consumer 详情）

| # | Listener | 文件 | 订阅事件 | 机制 |
|---|----------|------|----------|------|
| 1 | `LessonEventSubscriber` | `src/modules/teaching/lesson/lesson-event.subscriber.ts` | `lesson.completed`, `lesson.finished`, `lesson.cancelled` | `eventBus.subscribe()` |
| 2 | `SalaryListener` | `src/modules/salary/listeners/salary.listener.ts` | `lesson.completed` | `@OnEvent('lesson.completed')` 装饰器 |
