# 教师工资模块状态报告

## 整理时间
2026-07-24

## 整理目的
Phase 6 Batch 6.1 — 确认教师工资模块已有资料，不是开发任务。

---

## 已有资料

### 技术文档
- docs/00-Constitution/Constitution-v4.0.md — 工资相关原则（Rule First、Audit First、Stable First、Human First、事件驱动）
- docs/01-PRD/PRD-v4.0.md — 工资查询功能需求、教师权限（查看自己工资）、管理端功能（工资）
- docs/02-SAD/SAD-v4.0.md — Salary 作为 Domain Layer 业务模块、SalaryCalculated/SalaryAdjusted 事件定义、Rule Engine 包含工资规则
- 状态: ✅ 存在（3份核心文档均包含工资模块设计）

### 架构设计
- docs/domain/DomainMap.md — Finance Context 包含 salary.calculated 事件
- docs/domain/BoundedContexts.md — Finance Context 暴露 salary.calculated 事件
- docs/domain/BusinessCapabilityMap.md — 4.2 Teacher Salary Calculation（Planned Sprint 6）
- docs/domain/SkeletonPlanning.md — finance/salary/ 目录结构规划（salary.service.ts、salary.controller.ts、salary.repository.ts）
- docs/domain/UbiquitousLanguage.md — 工资相关术语定义
- docs/05-EventBus/EventBusSpecification.md — SalaryFinished 事件、SalaryAdjusted 事件、CalculateSalary 命令、SalaryService 监听器
- docs/BusinessFlow/CoreBusinessFlow.md — LessonFinished → 工资计算完整业务流程
- docs/BusinessRules/TeachingRules.md — LessonFinished 触发工资计算的规则定义
- 状态: ✅ 存在（架构设计完整，事件驱动链路清晰）

### 数据模型
- docs/03-Database/TableDictionary.md — 3张工资相关表设计：
  1. Teacher 表（含 SalaryRuleID 字段）
  2. TeacherSalaryLedger（老师工资流水表）— 7个字段
  3. SalaryRule（工资方案表）— 6个字段，支持固定课时费/阶梯课时费/固定月薪/混合模式
- 状态: ✅ 存在（数据模型已设计，但未建表）

### API 设计
- docs/04-API/API-Specification.md — GET /salary/my 接口设计（返回月份、课时数、工资金额）
- 状态: ✅ 存在（基础查询接口已设计）

### 权限设计
- docs/06-Permission/PermissionDesign.md — 工资相关权限：
  - SuperAdmin: 修改工资规则
  - Admin: 工资修正、工资审核
  - Teacher: 查看自己工资（不能改工资）
  - seed.service.ts 已植入 salary:read 权限种子
- 状态: ✅ 存在

---

## 已有代码

### Entity
- 无工资相关 Entity 文件
- 状态: ❌ 不存在

### Service
- 无工资相关 Service 文件
- 状态: ❌ 不存在

### Controller
- 无工资相关 Controller 文件
- 状态: ❌ 不存在

### Module
- 无 finance/ 或 salary/ 模块目录
- 状态: ❌ 不存在

### 数据库表
- MySQL 中无 salary 相关表
- 状态: ❌ 不存在

### 唯一代码引用
- backend/src/database/seeds/seed.service.ts — 第136行：`{ code: 'salary:read', name: '查看工资', module: 'salary', action: 'read' }`
- 状态: ✅ 仅有权限种子数据

---

## 缺少内容

### 技术文档
- 无独立的工资模块技术文档（SalaryModule-TechDoc.md）
- 无工资计算规则详细说明文档

### 架构设计
- SalaryRule StepConfig JSON Schema 未定义（阶梯配置具体格式）
- 工资计算详细算法未文档化（固定/阶梯/固定月薪/混合的具体公式）
- 工资修正（SalaryAdjusted）业务流程未详细设计

### 数据模型
- 3张表设计存在但未建表（无 migration 文件）
- TeacherSalaryLedger 与 Lesson 的关联细节未明确
- SalaryRule 的 RuleType 枚举值未定义

### API 设计
- 仅有 GET /salary/my（教师自查）
- 缺少：管理员查看教师工资列表 API
- 缺少：工资规则 CRUD API
- 缺少：工资修正 API
- 缺少：工资统计/报表 API

### 代码实现
- 无 Finance Module
- 无 Salary Entity / Service / Controller / Repository
- 无 SalaryRule Entity / Service / Controller
- 无 TeacherSalaryLedger Entity / Repository
- 无 LessonFinished 事件的工资监听器
- 无工资计算引擎

### 业务规则文档
- Constitution 第10条明确："工资规则 — 待完成"
- 无独立的工资业务规则文档（类似 AttendanceRules.md、LessonRules.md）
- 阶梯工资的具体阶梯定义缺失
- 工资结算周期未明确（按月？按周？）
- 工资审核流程未设计

---

## 开发前置条件

### 业务规则（需 Owner 明确）
1. 工资结算周期：按月结算？按周结算？按课时结算？
2. 阶梯工资的具体阶梯定义：多少课时一个阶梯？每个阶梯单价多少？
3. 混合模式的具体规则：底薪 + 课时费的具体组合方式？
4. 请假/停课是否扣工资？扣多少？
5. 代课工资规则：A老师代B老师的课，工资给谁？
6. 工资审核流程：是否需要管理员审核后发放？
7. 工资修正规则：什么情况下修正？修正是否需要审批？
8. 试用期工资规则：新教师是否有试用期工资？

### 技术决策（需做出）
1. SalaryRule StepConfig JSON Schema 设计
2. RuleType 枚举值定义（固定课时费/阶梯课时费/固定月薪/混合）
3. 工资计算触发时机：LessonFinished 同步计算 vs 异步批量计算
4. 工资流水是否需要关联到合同（Contract）？
5. 是否需要工资条（Payslip）概念？
6. 工资数据是否需要加密存储？

### 数据准备
1. 创建 SalaryRule 表 migration
2. 创建 TeacherSalaryLedger 表 migration
3. Teacher 表添加 SalaryRuleID 外键
4. 准备初始工资规则种子数据
5. 确认现有 Teacher 表的 SalaryRuleID 字段是否已存在

### 依赖模块
1. LessonFinished 事件已就绪 ✅
2. Teaching Module 已就绪 ✅
3. Identity/Permission Module 已就绪 ✅
4. EventBus 已就绪 ✅
5. Finance Module 未创建 ❌（工资模块属于 Finance Context）

---

## 结论

### 模块状态
- 设计状态: ⚠️ 部分（架构设计完整，但详细业务规则缺失）
- 代码状态: ❌ 缺失（仅有权限种子数据，无任何实现代码）
- 可开发状态: ❌ 需设计（需先明确业务规则和技术决策）

### 已有资料统计
- 技术文档: 3份（Constitution、PRD、SAD）
- 架构文档: 8份（DomainMap、BoundedContexts、BusinessCapabilityMap、SkeletonPlanning、EventBus、CoreBusinessFlow、TeachingRules、UbiquitousLanguage）
- 数据模型: 3张表设计（Teacher.SalaryRuleID、TeacherSalaryLedger、SalaryRule）
- API设计: 1个接口（GET /salary/my）
- 权限设计: ✅ 完整（4个角色的工资权限已定义）

### 已有代码统计
- Entity: 0
- Service: 0
- Controller: 0
- Module: 0
- 权限种子: 1条（salary:read）

### 缺少内容统计
- 业务规则文档: 1份（需新建）
- 详细技术设计: 2项（StepConfig Schema、RuleType 枚举）
- API接口: 4个（管理员列表、规则CRUD、修正、统计）
- 代码文件: ~8个（Module、2 Entity、2 Service、2 Controller、1 Event Listener）
- 数据库表: 2张（SalaryRule、TeacherSalaryLedger）

### 下一步建议
1. 【P0 - Owner 决策】明确工资业务规则（结算周期、阶梯定义、请假扣款、代课规则）
2. 【P1 - 技术设计】完成 SalaryRule StepConfig JSON Schema 和 RuleType 枚举定义
3. 【P2 - 开发准备】创建独立的工资业务规则文档（SalaryRules.md）
4. 【P3 - 开发实施】创建 Finance Module，实现工资计算引擎（依赖 P0/P1 完成）

---

## 参考文件清单

| 文件路径 | 内容 |
|----------|------|
| docs/00-Constitution/Constitution-v4.0.md | 工资原则（Rule First、Audit、Stable、Human） |
| docs/01-PRD/PRD-v4.0.md | 工资查询需求、教师/管理员权限 |
| docs/02-SAD/SAD-v4.0.md | Salary Domain、事件定义、Rule Engine |
| docs/03-Database/TableDictionary.md | 3张表设计 |
| docs/04-API/API-Specification.md | GET /salary/my 接口 |
| docs/05-EventBus/EventBusSpecification.md | 工资事件/命令/监听器 |
| docs/06-Permission/PermissionDesign.md | 4角色工资权限 |
| docs/domain/DomainMap.md | Finance Context 工资事件 |
| docs/domain/BoundedContexts.md | Finance Context 边界 |
| docs/domain/BusinessCapabilityMap.md | 4.2 Teacher Salary Calculation |
| docs/domain/SkeletonPlanning.md | finance/salary/ 目录规划 |
| docs/BusinessFlow/CoreBusinessFlow.md | 工资业务流程 |
| docs/BusinessRules/TeachingRules.md | LessonFinished → 工资触发规则 |
| backend/src/database/seeds/seed.service.ts | salary:read 权限种子 |
