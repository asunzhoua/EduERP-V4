# M-TEACHER-SALARY-CAPABILITY-V1 Evidence

## Mission Objective
建立教师工资计算能力 V1，作为 Lesson Finished 事件的业务结果。

## Actual Scope: Phase 1 — 数据模型设计
> ⚠️ 本 Mission 采用分批交付策略。当前完成 **Phase 1（数据模型）**，后续 Phase 将在下一轮迭代中完成。

### Phase 1: 数据模型设计 ✅
- `SalaryRuleEntity` (salary_rule): 薪酬规则实体
  - 字段: id, name, type, baseAmount, multiplier, courseType, teacherLevel, isActive, note, createdBy, createTime, updatedBy, updateTime
  - 规则匹配优先级: 4 级 (courseType+teacherLevel → courseType → teacherLevel → 通配)
- `SalaryRecordEntity` (salary_record): 工资记录实体
  - 字段: id, teacherId, lessonId, attendanceId, salaryRuleId, ruleVersion, amount, lessonDate, duration, status, notes, createdBy, createTime, updatedBy, updateTime
  - 状态流转: PENDING → CONFIRMED → PAID
- `SalaryRuleType` 枚举: PER_LESSON / HOURLY / MONTHLY
- `SalaryRecordStatus` 枚举: PENDING / CONFIRMED / PAID

### Phase 2~6: 待后续迭代 📅

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 数据模型设计（实体 + 枚举 + 设计文档） | ✅ 完成 |
| Phase 2 | 事件触发机制（Listener + Emitter） | 📅 待开始 |
| Phase 3 | 工资规则引擎（计算 Service + 规则匹配） | 📅 待开始 |
| Phase 4 | 查询 API + 状态流转接口 | 📅 待开始 |
| Phase 5 | 规则管理 API（CRUD） | 📅 待开始 |
| Phase 6 | 前端页面开发 | 📅 计划中 |

### 已有基础设施（Phase 1 之前已存在）
- `LessonCompletedEvent` — `events/lesson/lesson-completed.event.ts` ✅
- EventBus Service — `events/event-bus.service.ts` ✅
- `salary:read` 权限种子 — `database/seeds/seed.service.ts` ✅

## Core Principle
工资不是输入数据，而是 Lesson Finished 事件产生的业务结果。

## Event Chain (设计)
```
Lesson → status=FINISHED
    ↓
emit("lesson.completed", LessonCompletedEvent)
    ↓
[listener: 待 Phase 2] → process_lesson_completed()
    ↓
[引擎: 待 Phase 3] → 查找规则 → 计算金额 → 保存记录
```

## 设计文档
- `backend/docs/SALARY-DATA-MODEL-DESIGN.md` — 完整数据模型设计
- `docs/SALARY-MODEL-DESIGN.md` — 教师薪酬模型设计（4种模式）
- `docs/SALARY-DATABASE-DESIGN.md` — 完整数据库设计（含 Settlement）
- `docs/SALARY-CALCULATION-DESIGN.md` — 薪酬计算引擎设计（策略模式）

## Test Results
- **Total Test Suites:** 82 passed, 82 total
- **Total Tests:** 1121 passed, 1121 total  
- **Salary-specific tests:** 0 (待 Phase 2~5 添加)
- **New test regressions:** 0

## TypeScript Build
- **Salary module:** 0 errors ✅
- **Pre-existing errors (unrelated):** 6 (controller specs + e2e test config)

## Git
- **Commit:** `cad7f95`
- **Message:** `feat: implement teacher salary capability V1 — Phase 1 data model`
- **Branch:** master
- **Remote:** github.com:asunzhoua/EduERP-V4.git
- **Push:** ✅

## Phase 1 Completion Criteria
- [x] SalaryRuleEntity (数据模型 + 索引设计)
- [x] SalaryRecordEntity (数据模型 + 状态流转)
- [x] SalaryRuleType / SalaryRecordStatus 枚举
- [x] 4 级规则匹配优先级设计
- [x] 数据模型设计文档
- [x] Tests ALL PASS (1121)
- [x] Build: 0 salary-related errors
- [x] Evidence 完整

## 未完成项（下一轮迭代）
- [ ] Phase 2: Salary 事件监听器 + Lesson Completed 触发
- [ ] Phase 3: Salary 计算引擎 + 规则匹配实现
- [ ] Phase 4: 教师/管理员查询 API + 状态流转
- [ ] Phase 5: 规则管理 CRUD API
- [ ] Phase 6: 前端页面
- [ ] Salary 工资测试
- [ ] 工资导出功能
- [ ] 工资规则版本管理增强

## 文件清单

| 文件 | 路径 | 状态 |
|------|------|------|
| salary.enums.ts | src/modules/salary/enums/salary.enums.ts | ✅ Added |
| salary-rule.entity.ts | src/modules/salary/entities/salary-rule.entity.ts | ✅ Added |
| salary-record.entity.ts | src/modules/salary/entities/salary-record.entity.ts | ✅ Added |
| SALARY-DATA-MODEL-DESIGN.md | docs/SALARY-DATA-MODEL-DESIGN.md | ✅ Added |

## Next Steps
1. **Phase 2** — 实现工资事件监听器（SalaryListener），订阅 LessonCompletedEvent
2. **Phase 3** — 实现工资计算引擎（SalaryCalculatorService），策略模式支持多规则
3. **Phase 4** — 开发查询 API（教师端 + 管理端）
4. **Phase 5** — 开发规则管理 API（CRUD）
5. **Phase 6** — 前端页面开发（教师端工资查询、管理端工资统计）
