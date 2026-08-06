# EOS 系统框架说明 V1.0

## 1. EOS 定位

EOS（Execution Orchestration System）是一个面向 AI 多智能体协作的软件工程执行治理框架。

**核心目标**：
让多个 AI Agent 在大型软件项目中按照明确角色、流程、证据标准协同工作，避免 AI 随意修改代码、缺少验证、状态失真。

**EOS 不负责替代开发人员，而负责**：
- 项目状态管理
- 任务拆解
- AI 调度
- 执行监督
- 多 AI 审核
- Evidence 证据管理
- Release Gate 控制

---

## 2. EOS 核心角色模型

EOS 采用角色隔离：

```
                 Owner
                   |
                   |
              Orchestrator
                (龙虾)
                   |
        ---------------------
        |                   |
      CC Executor      AI Reviewers
      (代码执行)        (多AI审核)
```

---

## 3. Owner（项目负责人）

**职责**：
- 定义目标
- 做最终决策
- 确认 Mission 是否执行
- 接收审核结果

**Owner 不直接参与**：
- 代码修改
- 自动执行命令
- 生成虚假结果

---

## 4. Orchestrator（龙虾）

**定位**：项目智能调度中心。

**职责**：

### 任务管理
- 创建 Mission
- 拆解任务
- 分配执行者
- 跟踪状态

**示例**：
```
Mission:
M-EDUOS-V1.1-IMPLEMENTATION-V1
↓
Task 1: Health Check
Task 2: Teacher API
Task 3: Monitoring
↓
CC执行
↓
审核
↓
Evidence
```

### 状态管理

EOS 使用状态机：
```
IDEA
↓
READY
↓
EXECUTING
↓
VALIDATING
↓
COMPLETED
↓
RELEASE READY
```

**禁止**：未验证直接进入完成状态。

---

## 5. CC（Trusted Executor）

**定位**：代码执行 Agent。

**职责**：
- 查看代码
- 修改代码
- 执行测试
- 执行命令
- 生成执行结果

**CC 是唯一允许**：
- 修改项目文件
- 执行部署命令
- 修改代码逻辑

的执行角色。

---

## 6. AI Reviewer（多AI审核层）

**作用**：避免单 AI 判断错误。

**审核维度**：

### Architecture Review
- 架构合理性
- 模块边界
- 技术方案

### Security Review
- 权限
- 数据隔离
- API暴露
- 密钥风险

### Backend Review
- NestJS结构
- 数据库设计
- API逻辑

### QA Review
- 测试覆盖
- 验证完整性

### Governance Review
- 是否符合EOS流程
- 是否有Evidence
- 是否越权执行

---

## 7. Mission任务体系

EOS 所有工作必须 Mission 化。

**标准格式**：
```
Mission ID:
M-项目-模块-动作-V版本

Example:
M-EDUOS-V1.1-RELEASE-VALIDATION-V2
```

**包含**：
- Mission
- Status
- Priority
- Goal
- Scope
- Tasks
- Execution
- Validation
- Evidence
- Next Step

---

## 8. Evidence证据体系

**EOS 核心原则**：没有 Evidence，不算完成。

**Evidence 包含**：

### 执行证据
```
npm test
结果: 1025 passed
```

### 修改证据
```
新增: health.controller.ts
修改: app.module.ts
```

### 验证证据
```
API: GET /api/v1/health
Result: 200 OK
```

---

## 9. 文档治理体系

EOS 使用文档驱动开发。

**核心文件**：
```
.ai/                    # 项目AI规则
.architect/             # 架构文档
.governance/            # 治理规则
docs/evidence/          # 执行证据
PROJECT_STATE.md        # 当前状态
MISSION_QUEUE.md        # 任务队列
DECISION_LOG.md         # 决策记录
EVIDENCE_LOG.md         # 证据索引
```

---

## 10. Runtime Truth Rule（运行事实规则）

**核心原则**：

**禁止**：
- 推测完成
- 模拟结果
- 根据代码判断运行成功

**必须**：
- 代码状态 ≠ 运行状态
- 测试通过 ≠ 生产可用
- 设计完成 ≠ 部署完成

**只有真实执行结果有效**。

---

## 11. Release Gate 发布控制

EOS 不允许直接发布。

**必须经过**：
```
Code Review
↓
Security Review
↓
Build Validation
↓
Test Validation
↓
Runtime Validation
↓
Permission Validation
↓
Release Decision
```

**状态**：
```
NOT READY
↓
READY
↓
RELEASE CANDIDATE
↓
RELEASE READY
```

---

## 12. 当前 EduOS 实际应用架构

**项目**：EduERP-V4 / EduOS

**技术**：
```
Backend:
- NestJS
- TypeScript
- TypeORM
- MySQL
- Passport JWT

Frontend:
- 微信小程序
```

**AI体系**：
```
Owner
↓
龙虾 Orchestrator
↓
CC Executor
↓
Code/Test/Deploy
↓
Multi AI Review
↓
Evidence
↓
Release Gate
```

---

## 13. EOS 核心原则总结

**原则1：执行和决策分离**
AI不能自己证明自己完成。

**原则2：证据优先**
任何完成状态必须有 Evidence。

**原则3：小任务闭环**
不要一次修改大量系统。
采用：Mission → Execute → Validate → Evidence → Next Mission

**原则4：冻结机制**
进入 Release Freeze 后：
禁止：新功能、架构变化、范围扩大
只允许：Bug修复、验证、发布准备

**原则5：多AI审查**
关键节点必须经过多个 AI 角色审核。

---

## EOS 一句话说明（提供给其他AI）

EOS 是一个 AI 软件工程治理操作系统，通过 Orchestrator 调度、Trusted Executor 执行、多 AI 审核、Evidence 证据链和 Release Gate 控制，实现大型项目中 AI Agent 的可靠协同开发。
