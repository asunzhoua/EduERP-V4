# 真实业务验证问题记录

**验证时间**: 2026-07-26  
**Mission**: M-EDUOS-REAL-BUSINESS-FLOW-VALIDATION-V1  

---

## 发现的问题

### GAP-001: Payment 模块未实现

**问题**: 财务导出功能缺少 Payment 表数据  
**影响**: 财务记录导出不完整  
**优先级**: P2  
**位置**: `src/modules/export/export.service.ts`  
**建议**: 实现 Payment 模块后补充

---

### GAP-002: 工资导出缺少教师姓名

**问题**: 工资导出只有 teacherId，没有 teacherName  
**影响**: 导出不易读  
**优先级**: P1  
**位置**: `src/modules/export/export.service.ts:exportSalary()`  
**建议**: 关联 User 实体，添加 teacherName 字段

---

### GAP-003: 课时消耗导出缺少日期过滤

**问题**: exportConsumption 仅支持 status 筛选  
**影响**: 无法按日期范围导出  
**优先级**: P2  
**位置**: `src/modules/export/export.service.ts:exportConsumption()`  
**建议**: 添加 startDate/endDate 参数

---

### GAP-004: 频率限制未实现

**问题**: 导出 API 没有限流  
**影响**: 可能被滥用  
**优先级**: P3  
**位置**: `src/modules/export/export.controller.ts`  
**建议**: 添加频率限制（ThrottlerGuard）

---

### GAP-005: RolesGuard 权限未在测试中验证

**问题**: Controller 测试未模拟非 ADMIN 角色  
**影响**: 权限控制未充分测试  
**优先级**: P2  
**位置**: `src/modules/export/export.controller.spec.ts`  
**建议**: 补充权限测试

---

### GAP-006: Salary 模块类型错误

**问题**: Salary 模块有 4 个 TS 错误  
**影响**: 构建失败  
**优先级**: P1  
**位置**: `src/modules/salary/`  
**建议**: 修复 TS 错误

---

### GAP-007: Lesson Finished Event 双发射源

**问题**: lesson.completed 事件在两个地方发射  
**位置**: 
- `src/modules/teaching/lesson/lesson.service.ts:327`
- `src/modules/teaching/lesson-attendance/lesson-attendance.service.ts:289`

**影响**: 可能导致重复处理  
**优先级**: P0  
**建议**: 统一发射源，只保留 LessonService.updateStatus(FINISHED)

---

### GAP-008: Consumer 订阅方式不统一

**问题**: SalaryListener 使用 @OnEvent，LessonEventSubscriber 使用 eventBus.subscribe()  
**影响**: 维护不规范  
**优先级**: P2  
**位置**: 
- `src/modules/salary/listeners/salary.listener.ts`
- `src/modules/teaching/lesson/lesson-event.subscriber.ts`

**建议**: 统一为 eventBus.subscribe()

---

## 建议的修复 Mission

### 优先级 P0（立即修复）

1. **M-EDUOS-LESSON-COMPLETED-EVENT-SOURCE-FIX-V1**
   - 统一 lesson.completed 事件发射源
   - 消除重复发射风险
   - 预计工作量: 0.5 天

### 优先级 P1（尽快修复）

2. **M-EDUOS-SALARY-TS-ERROR-FIX-V1**
   - 修复 Salary 模块 TS 错误
   - 确保构建成功
   - 预计工作量: 0.5 天

3. **M-EDUOS-EXPORT-TEACHER-NAME-V1**
   - 工资导出添加 teacherName
   - 提升导出可读性
   - 预计工作量: 0.5 天

### 优先级 P2（后续修复）

4. **M-EDUOS-EXPORT-DATE-FILTER-V1**
   - 课时消耗导出添加日期过滤
   - 提升导出灵活性
   - 预计工作量: 0.5 天

5. **M-EDUOS-EXPORT-PERMISSION-TEST-V1**
   - 补充导出 API 权限测试
   - 确保权限控制正确
   - 预计工作量: 0.5 天

6. **M-EDUOS-EVENT-CONSUMER-UNIFICATION-V1**
   - 统一 Consumer 订阅方式
   - 提升代码规范性
   - 预计工作量: 1 天

### 优先级 P3（可选修复）

7. **M-EDUOS-EXPORT-RATE-LIMIT-V1**
   - 添加导出 API 频率限制
   - 防止滥用
   - 预计工作量: 0.5 天

---

## 总结

**发现问题总数**: 8 个

| 优先级 | 数量 | 说明 |
|--------|------|------|
| P0 | 1 | 关键业务风险，需立即修复 |
| P1 | 2 | 重要问题，需尽快修复 |
| P2 | 4 | 一般问题，可延后修复 |
| P3 | 1 | 可选问题，视情况修复 |

**预计总工作量**: 4 天

**建议修复顺序**:
1. P0: Event 双发射源（0.5 天）
2. P1: TS 错误修复（0.5 天）
3. P1: 导出增强（0.5 天）
4. P2: 其他问题（2.5 天）

---

**记录人**: CC (Code Agent)  
**审核人**: 龙虾 (Orchestrator)  
**记录日期**: 2026-07-26
