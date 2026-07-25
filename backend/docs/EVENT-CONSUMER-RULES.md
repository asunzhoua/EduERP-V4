# Event Consumer Rules

> EduOS 领域事件 Consumer（订阅方）治理规范。
> 版本：v1 | 生效日期：2026-07-26

---

## 核心原则

**模块之间只能通过 EventBus 通信，禁止跨模块直接调用业务 Service。**

---

## 规则

### 规则 1：禁止跨模块直接调用业务 Service

一个模块的业务 Service 不能直接调用另一个模块的业务 Service 的方法。

```typescript
// ❌ 错误 — 跨模块直接调用
// src/modules/teaching/lesson-attendance/lesson-attendance.service.ts
import { SalaryService } from '@modules/salary/salary.service';

class LessonAttendanceService {
  constructor(private salaryService: SalaryService) {}

  confirmAttendance() {
    this.salaryService.calculateSalary(...);  // ❌ 直接跨模块调用！
  }
}

// ✅ 正确 — 通过 EventBus
// LessonService 发布 lesson.completed 事件
this.eventBus.publish('lesson.completed', { ... });

// SalaryListener 接收事件后调用自己的 SalaryService
@OnEvent('lesson.completed')
handleLessonCompleted(event: LessonCompletedEvent) {
  this.salaryService.calculateSalary(event);  // ✅ 在自己的模块内调用
}
```

### 规则 2：Consumer 必须是独立的 Listener 类

Consumer 逻辑必须封装在独立的 Listener 类中，不能直接在 Service 中编写事件处理逻辑。

```typescript
// ✅ 正确 — 独立的 Listener 类
// src/modules/salary/listeners/salary.listener.ts
@Injectable()
export class SalaryListener {
  @OnEvent('lesson.completed')
  async handleLessonCompleted(event: LessonCompletedEvent) { ... }
}

// ❌ 错误 — Service 中直接处理事件
@Injectable()
export class LessonService {
  constructor() {
    this.eventBus.subscribe('lesson.completed', (payload) => {
      // ❌ Service 直接消费事件，职责混乱
    });
  }
}
```

### 规则 3：Consumer 不应该修改 Producer 的状态

Consumer 只能读取事件 Payload，不能反向修改 Producer 领域内的实体状态。如果需要产生副作用，应在自己的模块内完成。

```typescript
// ✅ 正确 — Consumer 只更新自己模块的数据
@OnEvent('lesson.completed')
async handleLessonCompleted(event: LessonCompletedEvent) {
  // 在自己的 SalaryService 中创建工资记录
  await this.salaryService.createSalaryRecord(event.lessonId, event.teacherId);
}

// ❌ 错误 — Consumer 修改 Producer 的数据
@OnEvent('lesson.completed')
async handleLessonCompleted(event: LessonCompletedEvent) {
  // ❌ 修改 Lesson 模块的数据
  await this.lessonService.markAsProcessed(event.lessonId);
}
```

### 规则 4：Consumer 必须幂等

由于事件可能被重复发送（至少一次语义），Consumer 必须保证重复处理不产生副作用。

```typescript
// ✅ 正确 — 幂等检查
@OnEvent('lesson.completed')
async handleLessonCompleted(event: LessonCompletedEvent) {
  const existing = await this.salaryRecordRepo.findOne({
    where: { lessonId: event.lessonId },
  });
  if (existing) return;  // ✅ 幂等：已处理则跳过
  // ... 创建记录
}
```

### 规则 5：Consumer 不应抛出异常（Fire-and-forget）

Consumer 处理事件时，异常应被捕获并记录，不应让事件处理失败影响主流程。

```typescript
// ✅ 正确 — 异常被捕获并记录
@OnEvent('lesson.completed')
async handleLessonCompleted(event: LessonCompletedEvent) {
  try {
    await this.calculator.calculate(event);
  } catch (error) {
    this.logger.error(`Failed: ${error.message}`);  // ✅ 只记录，不抛出
  }
}
```

### 规则 6：推荐使用统一的 `eventBus.subscribe()` API

当前代码中存在两种订阅机制：

| 机制 | 使用位置 | 状态 |
|------|---------|------|
| `eventBus.subscribe()` | `LessonEventSubscriber` | ✅ 推荐 |
| `@OnEvent` 装饰器 | `SalaryListener` | ⚠️ 直连 EventEmitter2，绕过了 EventBusService 的日志/监控 |

建议统一使用 `eventBus.subscribe()` 以保证事件追踪和监控能力。

---

## 示例

### ✅ 正确做法

```
LessonService (发布 lesson.completed)
  → EventBus
     → SalaryListener (调用 SalaryService 创建工资记录)
     → PointsListener (调用 PointsService 授予积分)
     → StatisticsListener (调用 StatisticsService 更新统计)
```

### ❌ 错误做法

```
LessonAttendanceService → 直接调用 SalaryService.createRecord()  // 跨模块直接调用
LessonService → 在 Service 中直接处理事件逻辑  // 缺少独立 Listener
SalaryListener → 修改 Lesson 的状态  // 反向修改 Producer 实体
```

---

## Consumer 目录规范

所有 Listener 必须放在对应模块的 `listeners/` 目录下：

```
src/modules/salary/listeners/
  salary.listener.ts
  salary.listener.spec.ts

src/modules/analytics/listeners/
  statistics.listener.ts
  statistics.listener.spec.ts

src/modules/teaching/lesson/
  lesson-event.subscriber.ts    ← 当前日志订阅者（可迁移至 listeners/）
  lesson-event.subscriber.spec.ts
```
