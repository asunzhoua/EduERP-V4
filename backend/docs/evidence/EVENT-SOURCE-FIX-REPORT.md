# Event Source Fix Report

## Mission
`M-EDUOS-LESSON-COMPLETED-EVENT-SOURCE-FIX-V1`

## 修复内容
- **统一 lesson.completed 事件发射源**
  - 保留 `LessonService.updateStatus(FINISHED)` 作为唯一发射源（`eventBus.publish` via EventBusService）
  - 移除 `LessonAttendanceService.batchRollCall()` 中的事件发射（`eventEmitter.emit` via EventEmitter2）
- **Payload 规范化**
  - 移除的冗余源使用 `LessonCompletedEvent` 类实例，缺少 `courseCode`、`scheduledDate`、`durationMinutes` 等字段
  - 统一后的源使用 `eventBus.publish` 普通对象 payload，含完整字段
- **SalaryListener 幂等检查**（已有）
  - 通过 `lessonId` 检查 `SalaryRecord` 是否已存在，避免重复生成
- **补课流程维持不变**
  - `LessonExceptionService.completeMakeupLesson()` 作为独立的合法业务场景保留

## 修改文件

| 文件 | 变更 |
|------|------|
| `src/modules/teaching/lesson-attendance/lesson-attendance.service.ts` | 移除 `EventEmitter2` 导入、`LessonCompletedEvent` 导入、`eventEmitter` 构造注入、`lesson.completed` 事件发射块 |
| `docs/event-source-analysis.md` | 新增 — 事件源分析报告 |
| `docs/historical-risk-report.md` | 新增 — 历史风险检查报告 |
| `src/modules/teaching/__tests__/lesson-event-source.spec.ts` | 新增 — 回归验证测试 |
| `docs/evidence/EVENT-SOURCE-FIX-REPORT.md` | 本报告 |

## 事件源总览（修复后）

| 源 | 位置 | 状态 |
|----|------|------|
| `LessonService.updateStatus(FINISHED)` | `lesson.service.ts:327` | ✅ 主入口 |
| `LessonAttendanceService.batchRollCall()` | `lesson-attendance.service.ts:289` | ❌ 已移除 |
| `LessonExceptionService.completeMakeupLesson()` | `lesson-exception.service.ts:562` | ✅ 补课场景保留 |

## 测试结果

```
PASS src/modules/teaching/__tests__/lesson-event-source.spec.ts
  Lesson Completed Event Source
    单一事件源
      ✓ 完成课程一次，只产生一次 lesson.completed (49 ms)
      ✓ batchRollCall 不再发射 lesson.completed (8 ms)
    Salary 幂等性
      ✓ Salary 只生成一次 (64 ms)
      ✓ 重复事件不重复创建 SalaryRecord（幂等） (8 ms)
      ✓ 重复请求幂等 — 再次 FINISHED 应被拒绝 (44 ms)
    Exception 流程
      ✓ 不产生 SalaryRecord 的异常流不应发布 lesson.completed (7 ms)
    补课流程
      ✓ 补课完成仍可发布 lesson.completed（独立业务场景） (5 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

## 历史风险

- **重复 SalaryRecord**: 0 条（`salary_record` 表无数据）
- **重复事件**: 无法检查（无事件持久化表）
- **风险评估**: 低（系统尚未投产）

## 验证结果

| 检查项 | 结果 |
|--------|------|
| ✅ `lesson.completed` 单一来源 | LessonService.updateStatus(FINISHED) |
| ✅ 无重复触发 | batchRollCall 不再发射事件 |
| ✅ Salary 正常 | 幂等检查防止重复生成 |
| ✅ Statistics 正常 | 单次事件避免重复统计 |
| ✅ Exception 正常 | 异常流不涉及事件发射 |
| ✅ Event 幂等 | SalaryListener 按 lessonId 去重 |

## 禁止事项检查

| 禁止操作 | 是否违反 |
|----------|----------|
| ❌ 修改工资规则 | ✅ 未修改 |
| ❌ 修改课时规则 | ✅ 未修改 |
| ❌ 增加新事件 | ✅ 未增加 |
| ❌ 大规模重构 | ✅ 仅移除重复代码 |
| ❌ 直接修复历史数据 | ✅ 仅记录，未修改 |

---

*报告生成时间: 2026-07-25*
*提交人: code agent*
