# Lesson Completed Event Source Fix Review

**Mission**: M-EDUOS-LESSON-COMPLETED-EVENT-SOURCE-FIX-V1  
**Status**: COMPLETED  
**Priority**: P0  
**Commit**: 396e0c0  

---

## 1. Summary

本次 Mission 修复 `lesson.completed` 事件多来源问题。

**历史问题**：  
同一个课程完成动作可能触发多个 `lesson.completed` 事件，导致下游业务重复执行风险，尤其是 SalaryRecord 重复生成风险。

**修复目标**：
- 统一 lesson.completed 事件来源
- 保证一次完成只产生一次事件
- 保证 Salary 消费幂等
- 保持补课完成业务兼容

---

## 2. Problem Before Fix

修复前：

```
Lesson Finish
    |
    +–– emit lesson.completed

batchRollCall
    |
    +–– emit lesson.completed

          |
          ↓

    Salary Handler

          |
          ↓

    SalaryRecord
```

**风险**：
- 重复事件
- 重复薪资记录
- 下游模块重复处理

---

## 3. Fix Result

修复后：

```
Lesson Completion
        |
        ↓
  lesson.completed
        |
        ↓
   Salary Handler
        |
        ↓
   SalaryRecord
```

**核心变化**：
- lesson.completed 单一 Producer
- batchRollCall 不再发布完成事件
- Salary 保持幂等消费

---

## 4. Validation

**测试结果**：

| 验证项 | 结果 |
|--------|------|
| 完成课程只产生一次 lesson.completed | PASS |
| batchRollCall 不再发送 lesson.completed | PASS |
| SalaryRecord 只生成一次 | PASS |
| 重复事件不会创建重复 SalaryRecord | PASS |
| 重复 FINISHED 请求被拒绝 | PASS |
| 异常流程不会发布完成事件 | PASS |
| 补课完成仍支持发布事件 | PASS |

---

## 5. Evidence

**新增**：
- `backend/docs/event-source-analysis.md`
- `backend/docs/historical-risk-report.md`
- `backend/src/modules/teaching/__tests__/lesson-event-source.spec.ts`
- `backend/docs/evidence/EVENT-SOURCE-FIX-REPORT.md`

---

## 6. Risk Assessment

**当前检查**：
- 重复 SalaryRecord：0 条
- 系统未投产，无生产历史污染

**限制**：
当前无事件持久化表，无法追溯历史事件数量。

**结论**：
当前数据状态正常，历史事件重复情况不可验证。

---

## 7. Architecture Rule

本次修复建立规则：

### Domain Event Single Producer Rule

一个 Domain Event 必须只有一个业务来源。

**例如**：
```
lesson.completed
Producer: Lesson Completion Service
```

**禁止**：
- Controller
- Batch Job
- Scheduler
- 多个 Service

同时发布同一个 Domain Event

---

## 8. Final Conclusion

**Mission**: M-EDUOS-LESSON-COMPLETED-EVENT-SOURCE-FIX-V1  
**Result**: ✅ PASS

**核心成果**：
- 事件来源统一
- 重复事件风险消除
- Salary 幂等保护有效
- 教学领域事件治理增强
