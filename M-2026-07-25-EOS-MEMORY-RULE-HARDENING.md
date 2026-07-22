# Mission: M-2026-07-25-EOS-MEMORY-RULE-HARDENING

## Mission Type
EOS Governance Improvement / AI Context Hardening

## Objective
根据近期真实 Mission 执行中暴露的问题，优化 EOS AI Memory、Context 和 Governance Rules。

目标：
让后续 AI Agent 正确处理：
- 当前状态判断
- Review 后决策流程
- Agent 职责边界
- Evidence 优先级
- 历史问题与当前问题区分

避免重复出现：
- Review 后未经确认自行实现
- 根据历史截图判断当前状态
- 重复验证已经完成事项
- CC 执行前缺少方案确认

## Background Evidence

近期 Mission 暴露以下事实：

### Issue 1: Review Decision Boundary
Review 输出包含多个需要业务/架构选择的问题。
例如：
1. endDate 计算规则
   - 方案 A: 使用最后课程日期
   - 方案 B: 使用 startDate + totalLessons 推算
2. 批量查询方案
   - 方案 A: IN 查询
   - 方案 B: JOIN 查询
3. 字段溢出处理
   - 方案 A: 拆 DTO
   - 方案 B: 调整字段设计

这些不是实现问题，而是 Decision 问题。
发现：Review 完成后，如果 Orchestrator 直接派发 Executor，会绕过 Owner Decision。

### Issue 2: Historical State Misinterpretation
实际发生：历史错误截图被误认为当前阻塞问题。
正确事实：历史 Evidence 表示曾经发生。当前状态必须以最新 Mission Result / Runtime Evidence 为准。

## Required Changes

### 1. Add Decision Gate Rule
新增 EOS-RULE-DECISION-GATE-001
规则：Review 完成后，如果发现：
- 业务规则存在多个合理解释
- 架构存在多个实现方案
- API Contract 需要选择
- 数据模型需要调整
- 影响长期设计方向

必须进入 WAITING_DECISION 状态，禁止 Review → Executor 直接跳转。

正确流程：
Research → Evidence → Review → Decision Extraction → Owner Decision → Execution

### 2. Add Current State Priority Rule
新增 EOS-RULE-CURRENT-STATE-001
信息优先级：
1. 最新 Mission Execution Result
2. 当前代码状态
3. Runtime Evidence
4. 最新报告
5. 历史报告
6. 历史截图

规则：任何 Agent 在提出修复前，必须判断是 Historical Issue 还是 Current Blocking Issue。
禁止：根据旧错误直接创建修复任务。

### 3. Agent Responsibility Boundary

**Research Agent**
负责：搜集事实、建立 Evidence
不负责：方案决策

**Review Agent**
负责：发现问题、分级风险、提供可选方案
不负责：最终选择

**Orchestrator**
负责：Mission 管理、Evidence 汇总、Decision Gate 控制、任务调度
不负责：替 Owner 决定业务规则

**Executor (CC)**
负责：实现已确认方案、输出执行 Evidence
禁止：自行改变需求、自行选择架构方案

### 4. Update AI Context / Memory
更新：.ai/、governance/、MEMORY.md
增加 AI Working Principles：

**Principle 1 — 事实优先**
不要根据推测补全状态。

**Principle 2 — 决策和执行分离**
没有确认方案，不进入编码。

**Principle 3 — 历史和当前状态分离**
旧问题不是当前问题。

**Principle 4 — 减少无价值验证循环**
验证必须服务于明确目标。

## Output
生成 EOS-AI-MEMORY-RULE-HARDENING-REPORT.md
内容：
1. 修改文件列表
2. 新增规则
3. Memory 更新内容
4. Agent 行为变化
5. Evidence

## Acceptance Criteria
完成后：
- Review 中发现方案分歧时自动进入 WAITING_DECISION
- Executor 不会执行未确认方案
- Agent 不会把历史错误当当前阻塞
- AI 新上下文可以理解上述规则
