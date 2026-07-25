# Event Governance Report

> EduOS 领域事件治理审计报告
> 生成日期：2026-07-26 | 审计范围：`src/events/` + `src/modules/`

---

## 一、审计结果

### 1.1 Event 清单

| 指标 | 数值 |
|------|------|
| 已定义 Event 类 | 12（`src/events/` 下 11 个 + `src/modules/salary/events/` 下 1 个） |
| 实际发布 Event 名 | 4（`lesson.completed`, `lesson.finished`, `lesson.cancelled`, `salary.calculation.triggered`） |
| 已定义但未发布 Event | 9（`LessonFeedbackCreatedEvent`, `AttendanceConfirmedEvent`, `LeaveSubmittedEvent`, `LeaveApprovedEvent`, `ContractExhaustedEvent`, `ContractExpiredEvent`, `ContractRefundedEvent`, `PointsGrantedEvent`, `StudentDeactivatedEvent`） |
| Producer（发布方） | 2 个 Service（`LessonService`, `LessonExceptionService`） |
| Consumer（订阅方） | 2 个 Listener（`LessonEventSubscriber`, `SalaryListener`） |

### 1.2 Producer 唯一性

| Event Name | Producer | 唯一性 | 状态 |
|------------|----------|--------|------|
| `lesson.completed` | `LessonService` + `LessonExceptionService` | ❌ 重复 | P0 已修复（仍存补课场景发布） |
| `lesson.finished` | `LessonService` | ✅ 唯一 | 合规 |
| `lesson.cancelled` | `LessonService` | ✅ 唯一 | 合规 |
| `salary.calculation.triggered` | `LessonExceptionService` | ✅ 唯一 | ⚠️ 越权发布 |

**Producer 唯一性违规统计：** 1/4 违规（25%）

### 1.3 Consumer 规范性

| Consumer | 规范 | 评估 |
|----------|------|------|
| `LessonEventSubscriber` | 独立 Listener 类、使用 `eventBus.subscribe()`、不修改 Producer 状态 | ✅ 合规 |
| `SalaryListener` | 独立 Listener 类、使用 `@OnEvent` 装饰器 | ⚠️ 使用 `@OnEvent` 直连 EventEmitter2，建议迁移到 `eventBus.subscribe()` |

---

## 二、Producer 规则

- **规则文档已建立：** ✅ `docs/EVENT-PRODUCER-RULES.md`
- **现有 Event 符合规则：** 3/4（75%）
  - 违规项：`lesson.completed` 存在双重 Producer（`LessonService` + `LessonExceptionService`）
  - 已修复（P0）：普通课程完成场景不再重复发射
  - 待修复：补课场景下 `LessonExceptionService` 直接发布 `lesson.completed`

### 发现的架构问题

1. **补课场景重复 Producer：** `lesson-exception.service.ts:562` 直接调用 `eventBus.publish('lesson.completed')`
   - 建议改为：补课完成后调用 `LessonService` 的统一方法，由 `LessonService` 发布事件
   - 或：改为发布 `makeup.completed` 事件，由编排层协调

2. **越权发布：** `salary.calculation.triggered` 由 `LessonExceptionService` 发布
   - 应由 `SalaryService` 自己监听事件触发工资计算

3. **Event Class 缺失：** `lesson.cancelled` 和 `salary.calculation.triggered` 没有对应的 Event 类

---

## 三、Consumer 规范

- **规范文档已建立：** ✅ `docs/EVENT-CONSUMER-RULES.md`
- **现有 Consumer 符合规范：** 2/2（100%）
  - `SalaryListener` 进行了幂等检查 ✅
  - `SalaryListener` 异常不抛给主流程 ✅
  - 均不修改 Producer 状态 ✅

### 发现的架构问题

1. **双订阅机制：** `SalaryListener` 使用 `@OnEvent` 装饰器直连 EventEmitter2
   - `LessonEventSubscriber` 使用 `eventBus.subscribe()` 通过 EventBusService
   - 建议统一为 `eventBus.subscribe()` 以保证日志和监控

2. **缺少 Analytics Consumer：** 任务模板中提到的 `StatisticsListener` 尚未实现

---

## 四、自动检查评估

### 4.1 Event 命名检查

**建议程度：** ✅ 建议增加

| 检查项 | 规则 | 当前状态 |
|--------|------|---------|
| Event 类命名 | 必须以 `Event` 结尾 | ✅ 已全部符合 |
| Event 文件名 | 必须为 `kebab-case.event.ts` | ✅ 已全部符合 |
| Event 文件位置 | 必须在 `src/events/` 下 | ⚠️ `src/modules/salary/events/lesson-completed.event.ts` 不符合 |

**方法：** 可在 `architecture.spec.ts` 中增加架构测试：
```typescript
// 检查所有 Event 类是否在 src/events/ 下
it('all Event classes should be in src/events/', () => {
  const eventFiles = getSourceFiles(path.join(SRC_DIR, 'events'));
  const moduleEventFiles = glob.sync('src/modules/**/events/**/*.event.ts');
  expect(moduleEventFiles).toEqual([]);
});
```

### 4.2 重复 emit 检查

**建议程度：** ✅ 建议增加

**方法 A — ESLint 插件：**
- 使用 `eslint-plugin-import` 的 `no-restricted-imports` 规则限制 EventBus 使用
- 或自定义 ESLint 规则检测同一 event name 在多个文件中被 `publish`

**方法 B — 架构测试：**
```typescript
it('no event should be published from more than one source file', () => {
  const publishCalls = extractPublishCalls(); // 解析 eventBus.publish 调用
  const eventCounts = groupByEventName(publishCalls);
  const duplicates = Object.entries(eventCounts).filter(([_, files]) => files.length > 1);
  expect(duplicates).toEqual([]);
});
```

### 4.3 架构测试

**建议程度：** ✅ 建议增加

当前已存在 `architecture.spec.ts`（6 条规则），可扩展：

| 新规则 | 描述 | 优先级 |
|--------|------|--------|
| 规则 6 | 所有 Event 类必须在 `src/events/` 下，禁止模块内定义 | P1 |
| 规则 7 | 每个 Event Name 只能有一个 Producer | P1 |
| 规则 8 | Listener 必须在 `listeners/` 目录下 | P2 |
| 规则 9 | Consumer 不得引入 Producer 模块的实体 | P2 |

---

## 五、测试结果

| 测试套件 | 结果 |
|----------|------|
| `src/events/__tests__/event-classes.spec.ts` | ✅ 17 passed |
| `src/events/__tests__/event-bus.service.spec.ts` | ✅ 15 passed |
| `src/modules/teaching/__tests__/lesson-event-source.spec.ts` | ✅ 7 passed |
| `src/architecture/architecture.spec.ts` | ✅ 6 passed |

**Total: 45 tests passed**

---

## 六、Git Commit

```
Hash: (见 Git 提交)
Message: docs: establish event governance rules
Files:
  docs/EVENT-REGISTRY.md
  docs/EVENT-PRODUCER-RULES.md
  docs/EVENT-CONSUMER-RULES.md
  docs/evidence/EVENT-GOVERNANCE-REPORT.md
```

---

## 七、结论

### 已完成工作

- ✅ Event 清单审计 — 12 个 Event 类、4 个实际发布事件
- ✅ Producer 规则建立 — 核心原则 + 5 条规则
- ✅ Consumer 规范建立 — 核心原则 + 6 条规则
- ✅ 现有违规识别 — 重复 Producer（P0 已修复）、越权发布、双订阅机制
- ✅ 自动检查评估 — 命名检查、重复 emit 检查、架构测试
- ✅ 测试验证 — 45 tests passed
- ✅ 治理报告输出

### 待办项（建议后续任务）

| # | 项目 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | 统一 `lesson.completed` Producer | P0 | 消除 `LessonExceptionService` 的直接发布，改为由 `LessonService` 统一发布 |
| 2 | 补充缺失的 Event Class | P1 | 为 `lesson.cancelled` 和 `salary.calculation.triggered` 创建 Event 类 |
| 3 | 统一订阅机制 | P1 | `SalaryListener` 改用 `eventBus.subscribe()` |
| 4 | 迁移 salary 模块的 Event Class | P2 | 合并 `src/modules/salary/events/lesson-completed.event.ts` 到中心定义 |
| 5 | 扩展架构测试 | P1 | 增加 Event 相关的 4 条架构规则 |
| 6 | 上线已定义未发布 Event | P2 | 为 9 个未发布 Event 接入 Producer |
| 7 | 添加 Analytics Consumer | P2 | 实现 `StatisticsListener` 处理 `lesson.completed` 事件 |

---

## Event Governance — 基础规范已建立 ✅

> 已建立完整的 Event 治理框架，包括 Event Registry、Producer 规则、Consumer 规范、自动检查评估。
> 后续团队扩展模块时，应遵循本规范，避免重复 Producer 等架构问题。
