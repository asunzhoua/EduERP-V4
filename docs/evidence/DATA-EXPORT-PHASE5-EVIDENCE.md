# Phase 5 Evidence

## 验证结果

### 后端验证
- **API 可访问**：✅ 路由已注册（ExportModule 已导入 AppModule），控制器包含 5 个 POST 端点
  - POST /export/students
  - POST /export/lessons
  - POST /export/consumption
  - POST /export/salary
  - POST /export/finance
  - ⚠️ 后端整体 `npm run build` 因 Salary 模块的预存类型错误失败（与导出模块无关）
  - 导出模块测试均通过（23/23）
- **权限控制**：✅ ExportController 使用 `@UseGuards(RolesGuard)` + `@Roles('ADMIN')` 类级别装饰器
  - RolesGuard 通过 Reflector 读取 `roles` 元数据，校验 `user.role`
  - 仅 ADMIN 角色可访问导出端点
- **数据来源**：✅ 验证 ExportService 聚合的数据源
  - ✅ Student 表 — `studentRepo.find()` 查询学生基础信息
  - ✅ Lesson 表 — `lessonRepo.find()` 查询课程记录
  - ✅ Contract 表 — `contractRepo.find()` 查询合同/课时消耗
  - ✅ SalaryRecord 表 — `salaryRepo.find()` 查询工资记录
  - ❌ Payment 表 — 尚未实现（设计阶段标记为"预留"）
  - 额外数据源：LessonAttendanceEntity（出勤统计）、EnrollmentEntity（报名日期富化）
- **模块边界**：✅
  - ✅ 没有创建新的数据库表（仅 TypeOrmModule.forFeature 引用现有实体）
  - ✅ 没有修改现有业务逻辑
  - ✅ 只进行聚合查询（find, reduce, map）

### 前端验证
- **页面文件**：✅ 全部存在
  - ✅ `utils/export.js` — 导出工具函数（exportData + saveFile）
  - ✅ `pages/operation/dashboard/dashboard.wxml` — 含导出区域（5 个导出按钮）
  - ✅ `pages/operation/dashboard/dashboard.js` — 含 5 个导出函数
  - ✅ `pages/operation/dashboard/dashboard.wxss` — 含导出区域样式
- **API 调用**：✅ 前端通过 exportData() 调用 5 个 API
  - ✅ exportData('students') → POST /export/students
  - ✅ exportData('lessons') → POST /export/lessons
  - ✅ exportData('consumption') → POST /export/consumption
  - ✅ exportData('salary') → POST /export/salary
  - ✅ exportData('finance') → POST /export/finance
- **权限控制**：✅
  - 前端：`wx:if="{{showExport}}"` 基于 `wx.getStorageSync('userInfo').role === 'ADMIN'`
  - 后端：`@Roles('ADMIN')` 强制校验

### 测试验证
- **后端测试**：**23 passed**（2 suites）
  - export.controller.spec.ts: 8 passed
  - export.service.spec.ts: 15 passed
- **测试覆盖**：✅
  - ✅ ExportService 所有 5 个方法均被测试（students, lessons, consumption, salary, finance）
  - ✅ ExportController 所有 5 个路由均被测试
  - ✅ CSV/Excel 两种格式均被验证
  - ✅ CsvWriter 测试（BOM 头、中文转义、null 值）
  - ✅ ExcelWriter 测试（生成 Buffer、空数据处理）
  - ⚠️ 控制器测试中提供了 RolesGuard，但没有直接测试非 ADMIN 角色被拒绝的场景

### Git
- **Hash**: `30ce35a8910467b351a84a92e8aec9afbd268019`
- **Branch**: （当前 HEAD）

---

## 发现的问题（Gap）

### Gap 1: Payment 表未接入
- **描述**：导出功能中缺少 Payment/支付数据表的集成。设计文档 `DATA-EXPORT-RESEARCH.md` 中已标记 Payment 为"预留"状态，财务导出（exportFinance）仅聚合了合同收入和工资支出两部分数据。
- **影响**：财务导出不完整，缺少实收/实付流水数据。
- **优先级**：P2（后续 Phase 实现）

### Gap 2: 教师姓名未在工资导出中富化
- **描述**：`exportSalary()` 仅输出 `teacherId` 字段，未关联 User 实体获取教师姓名。代码注释标明"Since we can't join to a non-related entity, we'll export what we have"。
- **影响**：导出的工资记录缺少教师姓名，需要人工对照。
- **优先级**：P1

### Gap 3: 部分导出方法缺乏日期范围过滤
- **描述**：`exportConsumption()` 只支持 `status` 筛选，不支持 `startDate`/`endDate` 日期范围过滤。而 `exportStudents()` 也不支持日期过滤（仅支持 status）。
- **影响**：用户无法按时间段导出课时消耗数据。
- **优先级**：P2

### Gap 4: 频率限制未实现
- **描述**：设计文档中规划了"同一用户同一类型 1 分钟内最多 1 次"的导出频率限制，但当前控制器中未实现。
- **影响**：无频率保护，极端情况下可能被频繁调用。
- **优先级**：P3

### Gap 5: RolesGuard 权限未在控制器测试中直接验证
- **描述**：`export.controller.spec.ts` 中提供了 RolesGuard，但测试用例未模拟非 ADMIN 角色请求来验证 403 拒绝场景。
- **影响**：权限拦截逻辑无自动化测试保障。
- **优先级**：P2

### Gap 6: 后端整体构建因 Salary 模块类型错误失败
- **描述**：`npm run build` 因 `salary.service.ts` 和 `salary-calculator.service.ts` 中存在 4 个 TypeScript 类型错误而失败，与导出模块无关但影响 CI/CD 流水线。
- **影响**：无法生成完整的构建产物；但导出模块的测试可以独立运行。
- **优先级**：P1（需修复 Salary 模块类型错误）

---

## 建议的后续 Mission

1. **M-EDUOS-DATA-EXPORT-PAYMENT-INTEGRATION** — 集成 Payment 表到导出功能，在财务导出中加入实收/实付流水数据
2. **M-EDUOS-DATA-EXPORT-ENRICHMENT** — 富化导出数据（工资导出中关联教师姓名，学员导出中关联班级名称）
3. **M-EDUOS-DATA-EXPORT-FILTER-ENHANCEMENT** — 统一所有导出方法的日期范围过滤能力
4. **M-EDUOS-SALARY-MODULE-TYPE-FIX** — 修复 Salary 模块的 TypeScript 类型错误，恢复完整构建

---

## Git Commit

- **Hash**: `30ce35a8910467b351a84a92e8aec9afbd268019`
- **Status**: 工作区存在未提交的更改（coverage 报告文件）

---

## 文件列表

```
 M backend/coverage/...  (大量 coverage 报告文件)
 M docs/evidence/DATA-EXPORT-DESIGN-EVIDENCE.md
 M docs/evidence/LESSON-EXCEPTION-PHASE3-EVIDENCE.md
?? backend/coverage/lcov-report/src/common/decorators/current-user.decorator.ts.html
?? backend/coverage/lcov-report/src/config/typeorm-cli.config.ts.html
?? backend/coverage/lcov-report/src/migrations/
?? backend/coverage/lcov-report/src/modules/analytics/
?? backend/coverage/lcov-report/src/modules/dashboard/
?? backend/coverage/lcov-report/src/modules/reminder/
?? backend/coverage/lcov-report/src/modules/salary/
?? backend/coverage/lcov-report/src/modules/teaching/leave-request/
?? backend/coverage/lcov-report/src/modules/teaching/lesson-attendance/dto/
?? backend/coverage/lcov-report/src/modules/teaching/lesson-change-request/dto/
?? backend/coverage/lcov-report/src/modules/teaching/lesson/dto/create-lesson-with-attendance.dto.ts.html
?? backend/coverage/lcov-report/src/modules/teaching/lesson/lesson-exception/
?? backend/coverage/lcov-report/src/modules/teaching/suspend-request/
?? backend/coverage/lcov-report/src/modules/teaching/teacher-dashboard/
?? backend/docs/evidence/CORE-BUSINESS-CONSISTENCY-AUDIT-EVIDENCE.md
?? backend/docs/evidence/LESSON-EXCEPTION-CLOSURE-AUDIT-EVIDENCE.md
?? docs/ADMIN-DASHBOARD-DESIGN.md
?? docs/evidence/ADMIN-DASHBOARD-DESIGN-EVIDENCE.md
?? docs/evidence/ADMIN-DASHBOARD-PHASE5-EVIDENCE.md
?? docs/evidence/SALARY-CLOSURE-VERIFY-REPORT.md
```

---

## 结论

**Phase 5 验证与校正完成。**

导出功能基本可用：
- 后端 5 个导出 API 全部实现并受 ADMIN 角色保护
- 前端 5 个导出按钮全部对接并受管理员权限控制
- 23 个测试全部通过，覆盖所有服务方法和控制器路由
- 支持 CSV 和 Excel 双格式导出

存在 **6 个 Gap** 需要后续修复：
- 2 个数据完整性相关（Payment 表缺失、教师姓名未富化）
- 2 个功能完善性相关（日期过滤不完整、频率限制缺失）
- 2 个工程质量相关（权限测试不完整、Salary 模块构建错误）

整体验证结论：**PASS**（核心功能完整，Gap 已记录待后续 Phase 修复）
