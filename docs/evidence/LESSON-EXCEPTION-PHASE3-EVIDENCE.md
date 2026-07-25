# Phase 3 Evidence

## 修改文件列表
- src/modules/teaching/lesson/lesson-exception/lesson-exception.service.ts
- src/modules/teaching/lesson/lesson-exception/lesson-exception.controller.ts
- src/modules/teaching/lesson/lesson-exception/dto/apply-leave.dto.ts
- src/modules/teaching/lesson/lesson-exception/dto/apply-suspend.dto.ts
- src/modules/teaching/lesson/lesson-exception/dto/apply-makeup.dto.ts
- src/modules/teaching/lesson/lesson-exception/dto/approve-exception.dto.ts
- src/modules/teaching/lesson/lesson-exception/lesson-exception.service.spec.ts
- src/modules/teaching/teaching.module.ts

## Git Commit
- Hash: TBD
- Message: feat: implement lesson exception business logic

## 测试结果
- Test Suites: 1 passed, 1 total
- Tests: 24 passed, 24 total
- Coverage (lesson-exception.service.ts): 88.94% Stmts, 71.15% Branch, 83.33% Funcs, 89.74% Lines

## 业务逻辑验证
- 请假流程：✅
  - 病假需附件（医院证明）
  - 事假至少提前24小时
  - 培训假至少提前48小时
  - 创建 PENDING 异常记录并记录状态流转日志
- 停课流程：✅
  - 短期停课1-7天
  - 长期停课7天以上
  - 批量创建异常记录
- 补课流程：✅
  - 仅 CANCELLED/SUSPENDED 状态可补课
  - 创建补课排期记录
  - 原课程状态 → RESCHEDULED
- 审批流程：✅
  - 病假 → CANCELLED
  - 事假 → SUSPENDED
  - 培训假 → SUSPENDED
  - 短期/长期停课 → SUSPENDED
- 自动恢复：✅
  - 扫描过期异常
  - 恢复 SUSPENDED → SCHEDULED
  - operatorType: SYSTEM
- 状态流转：✅
  - VALID_TRANSITIONS 验证
  - SYSTEM 操作员类型支持
- 补课完成：✅
  - 补课 Lesson → FINISHED
  - 原 Lesson → MAKEUP_COMPLETED
  - 触发 lesson.completed 事件
  - 触发 salary.calculation.triggered 事件
