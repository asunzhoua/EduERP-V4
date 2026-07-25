# Event Source Analysis Report

## 概述

审计 `lesson.completed` 事件的发射源，确认是否存在重复发射及 payload 不一致问题。

## 事件发射源总览

| # | 位置 | 方法 | 触发条件 | 机制 |
|---|------|------|----------|------|
| 1 | `src/modules/teaching/lesson/lesson.service.ts:327` | `updateStatus()` | `TEACHING → FINISHED` 状态转换 | `eventBus.publish()` (EventBusService) |
| 2 | `src/modules/teaching/lesson-attendance/lesson-attendance.service.ts:289` | `batchRollCall()` | 批量考勤记录后 | `eventEmitter.emit()` (直接 EventEmitter2) |
| 3 | `src/modules/teaching/lesson/lesson-exception/lesson-exception.service.ts:562` | `completeMakeupLesson()` | 补课完成 | `eventBus.publish()` (EventBusService) |

## 各源详细分析

### 源 1: LessonService.updateStatus (主入口)

- **文件**: `src/modules/teaching/lesson/lesson.service.ts`
- **行号**: 327
- **触发**: 课程状态从 `TEACHING` 变为 `FINISHED`
- **方法调用**: `eventBus.publish('lesson.completed', payload)`
- **中间件**: `EventBusService.publish()` → 自动注入 `eventId` (UUID) + `timestamp` (ISO)
- **Payload**:
  ```typescript
  {
    lessonId: number,
    classCode: string,
    courseCode: string,
    teacherId: number,
    scheduledDate: Date,
    actualStartTime: string | null,   // .toISOString()
    actualEndTime: string | null,     // .toISOString()
    durationMinutes: number,          // computed from startTime/endTime
    eventId: string,                  // 由 EventBusService 注入
    timestamp: string,                // 由 EventBusService 注入
  }
  ```

### 源 2: LessonAttendanceService.batchRollCall (重复源 ❌)

- **文件**: `src/modules/teaching/lesson-attendance/lesson-attendance.service.ts`
- **行号**: 289
- **触发**: `batchRollCall()` 执行考勤记录保存后
- **方法调用**: `eventEmitter.emit('lesson.completed', new LessonCompletedEvent(...))`
- **中间件**: 直接 EventEmitter2.emit — **不经过 EventBusService**，因此缺少 `eventId` 和 `timestamp` 字段
- **Payload**:
  ```typescript
  new LessonCompletedEvent(
    input.lessonId,         // number
    firstRecord.teacherId,  // number
    firstRecord.classCode,  // string (但事件类型标注为 number — 有类型错误)
    new Date(),             // completedAt: Date
  )
  ```
- **问题**:
  1. 使用 `LessonCompletedEvent` 类实例而非普通对象，payload 结构与源 1 不同
  2. 缺少 `courseCode`、`scheduledDate`、`actualStartTime`、`actualEndTime`、`durationMinutes` 等字段
  3. `classCode` 参数类型不匹配 (实际是 string 但事件类标注 number)
  4. 不经过 EventBusService，缺少 `eventId` 和 `timestamp`
  5. **与源 1 重复触发**，导致 SalaryListener 被调用两次

### 源 3: LessonExceptionService.completeMakeupLesson (补课场景 ✅)

- **文件**: `src/modules/teaching/lesson/lesson-exception/lesson-exception.service.ts`
- **行号**: 562
- **触发**: `completeMakeupLesson()` 补课完成时
- **方法调用**: `eventBus.publish('lesson.completed', payload)`
- **中间件**: EventBusService (与源 1 一致)
- **Payload**:
  ```typescript
  {
    lessonId: number,
    classCode: string,
    courseCode: string,
    teacherId: number,
    scheduledDate: Date,
    actualStartTime: string,      // new Date().toISOString()
    actualEndTime: string,        // new Date().toISOString()
    durationMinutes: number,
    isMakeup: true,               // 补课标记
    originalLessonId: number,     // 原课程 ID
    eventId: string,              // 由 EventBusService 注入
    timestamp: string,            // 由 EventBusService 注入
  }
  ```
- **说明**: 这是合法的业务场景 — 补课作为一个独立的 `lesson.completed` 事件发射，携带 `isMakeup` 和 `originalLessonId` 字段供下游区分

## Payload 字段对比

| 字段 | 源 1 (LessonService) | 源 2 (Attendance) ❌ | 源 3 (Exception) |
|------|:---:|:---:|:---:|
| `lessonId` | ✅ | ✅ | ✅ |
| `teacherId` | ✅ | ✅ | ✅ |
| `classCode` | ✅ | ✅ (参数类型错误) | ✅ |
| `courseCode` | ✅ | ❌ | ✅ |
| `scheduledDate` | ✅ | ❌ | ✅ |
| `actualStartTime` | ✅ | ❌ | ✅ |
| `actualEndTime` | ✅ | ❌ | ✅ |
| `durationMinutes` | ✅ | ❌ | ✅ |
| `eventId` | ✅ (自动注入) | ❌ | ✅ (自动注入) |
| `timestamp` | ✅ (自动注入) | ❌ | ✅ (自动注入) |
| `completedAt` | ❌ | ✅ | ❌ |
| `isMakeup` | ❌ | ❌ | ✅ |
| `originalLessonId` | ❌ | ❌ | ✅ |

## 调用链分析

```
源 1: LessonService.updateStatus(FINISHED)
  └─→ eventBus.publish('lesson.completed')
       └─→ EventBusService.publish()
            └─→ eventEmitter.emit('lesson.completed')  
                 └─→ SalaryListener.handleLessonCompleted()  ← 工资生成

源 2: LessonAttendanceService.batchRollCall()  
  └─→ eventEmitter.emit('lesson.completed')          ← 重复！造成双倍工资
       └─→ SalaryListener.handleLessonCompleted()    ← 第二次触发

源 3: LessonExceptionService.completeMakeupLesson()
  └─→ eventBus.publish('lesson.completed')
       └─→ EventBusService.publish()
            └─→ eventEmitter.emit('lesson.completed')
                 └─→ SalaryListener.handleLessonCompleted()  ← 补课工资
```

## 影响评估

| 影响 | 严重度 | 说明 |
|------|--------|------|
| 工资重复生成 | 🔴 严重 | `batchRollCall` + `updateStatus` 各触发一次，SalaryRecord 可能生成两条 |
| 统计重复计算 | 🟡 中等 | 统计模块若也监听 `lesson.completed` 会重复计数 |
| Payload 不一致 | 🟡 中等 | 源 2 的 payload 缺少关键字段，下游不可靠 |
| 补课流程 | 🟢 正常 | 源 3 为独立业务场景，不受影响 |

## 修复建议

1. **移除源 2**: 删除 `lesson-attendance.service.ts` 中 `lesson.completed` 事件发射代码
2. **保留幂等检查**: `SalaryListener` 已有 `lessonId` 级幂等检查，作为防御性措施保留
3. **补课流程维持**: 源 3 的 `completeMakeupLesson` 为合法业务场景，不变

---

*报告生成时间: 2026-07-25*
*审计人: code agent*
