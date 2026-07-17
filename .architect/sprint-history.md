# EduOS Sprint History

项目所有 Sprint 的完整记录。

---

## Sprint 1 — Foundation Engineering (DONE ✅)

| 字段 | 内容 |
|------|------|
| **状态** | ✅ 完成 |
| **目标** | 搭建 NestJS 基础工程、配置、日志、EventBus、RBAC 框架 |
| **交付物** | Project structure, Config, Logging, Response interceptor, Exception filter, RBAC framework, EventBus |
| **Gate** | — (Phase 0, 无 Gate) |
| **版本** | v0.1.0 |

---

## Sprint 2 — Identity Center (DONE ✅)

| 字段 | 内容 |
|------|------|
| **状态** | ✅ 完成 |
| **目标** | 用户认证 + 角色权限体系 |
| **交付物** | 6 entities, 4 auth endpoints, JWT, Seed data, MySQL 8.0.41 |
| **Gate** | Gate #001 🟢 PASS |
| **版本** | v0.2.0 |

---

## Sprint 3 — Student Management (DONE ✅)

| 字段 | 内容 |
|------|------|
| **状态** | ✅ 开发完成 |
| **目标** | 学生管理 CRUD + 家长关系 + 批量导入 + 审计日志 |
| **交付物** | 12 endpoints, ImportService, AuditLog, StudentRules.md |
| **Gate** | Gate #002 🟢 PASS |
| **版本** | v0.3.0 |

---

## Sprint 3.5 — Teaching Domain Design Freeze (DONE ✅)

| 字段 | 内容 |
|------|------|
| **状态** | ✅ 完成 |
| **目标** | Teaching 域设计冻结，10 项架构变更落地 |
| **交付物** | Teaching Rules v1.1, Lesson lifecycle v1.1, Contract Rules, Course/Class Rules update, DomainCatalog, EventCatalog, StateMachineCatalog, CoreBusinessFlow, Constitution Rules 19-24 |
| **Gate** | Gate #003 🟢 PASS |
| **版本** | v0.3.5 |

---

## Sprint 4.0 — Teaching Skeleton (DONE ✅)

| 字段 | 内容 |
|------|------|
| **状态** | ✅ 完成 |
| **目标** | Teaching 域 5 个子模块骨架搭建 (Skeleton First) |
| **交付物** | 61 files, ~40 API endpoints, Swagger 接入, ESLint 配置修复 |
| **Gate** | Gate #004 🟢 PASS |
| **版本** | v0.4.0 |
| **备注** | Constitution Rule 24 (Skeleton First) + Rule 25 (One Domain At A Time) |

---

## Task-EduOS-005 — Teaching Domain Deep Modeling (DONE ✅)

| 字段 | 内容 |
|------|------|
| **状态** | ✅ 完成 |
| **目标** | Teaching 域深度建模 — 冻结领域模型后再编码 |
| **交付物** | TeachingDomainModel.md, CourseStateMachine.md, ClassStateMachine.md, LessonStateMachine.md, DEC-005, Gate-005 |
| **Gate** | Gate #005 🟢 PASS |
| **关键决策** | Course 是纯知识产品(无定价/排课/教师)；Contract 是财务单元；Schedule 嵌入 Class；两阶段事件；Lesson 是最小业务原子；ChangeRequest 替代直接编辑 |
| **备注** | Teaching Domain Model 已冻结。任何修改需走 CR 流程。 |

---

## Sprint 4.1.1 — Course Entity / Local Module Implementation (PASS WITH CONDITIONS ⚠️)

| 字段 | 内容 |
|------|------|
| **状态** | ⚠️ PASS WITH CONDITIONS |
| **目标** | Course Entity 实现（最小闭环） |
| **实际交付** | 17 files: Entity, AuditLog, Enums, DTOs, Service, Repository, CodeGenerator, Controller, Module, Tests |
| **越界记录** | 实现范围超出任务单定义的"最小闭环"，包含了完整的 Service/Controller/DTO 层。CTO 判定为流程越界。 |
| **CTO 裁决** | 保留成果，但禁止自动模板化。后续实体必须重新定义边界。 |
| **Gate** | 无独立 Gate（Sprint 内审查） |
| **通过条件** | 1. 仅视为 Course 局部实现 2. 不自动推广为其他实体模板 3. 后续每个实体 Sprint 必须重新下任务单 4. userId=1 临时实现不得扩散 5. 审计日志方案需单独决策 |

---

## Sprint 4.1.2 — Class + TeacherAssignment (待 CTO 重新定义边界 ⬜)

| 字段 | 内容 |
|------|------|
| **状态** | ⬜ 未开始，待 CTO 重新定义边界 |
| **目标** | Class + TeacherAssignment 实现 |
| **依赖** | Sprint 4.1.1 (Course) + CTO 新任务单 |

---

## 未来 Sprint 规划

| Sprint | 内容 | 状态 |
|--------|------|------|
| Sprint 4.2.x | Class Domain | ⬜ |
| Sprint 4.3.x | Contract Domain | ⬜ |
| Sprint 5.x | Teacher Management | ⬜ |
| Sprint 6.x | Lesson + Attendance | ⬜ |
| Sprint 7.x | Leave Management | ⬜ |
| Sprint 8.x | Finance + Salary | ⬜ |
| Sprint 9.x | Points + Dashboard | ⬜ |
| Sprint 10.x | Notifications | ⬜ |
