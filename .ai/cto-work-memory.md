# EduOS 工作记忆 (CTO Console)

> **维护者**: CTO (GPT 窗口) + Claude Code (实现窗口)
> **最后更新**: 2026-07-14
> **用途**: CTO 窗口长期保存，防止项目方向漂移

---

## 项目一句话

EduOS V1.0 = 教育运营操作系统。不是小程序，不是 ERP。是一套让培训机构所有人每天围绕运转的系统。

## 技术栈

NestJS 11 + TypeScript 5 + TypeORM 1.0.0 + MySQL 8.0.41 + EventBus

## 当前状态

| 维度 | 状态 |
|------|------|
| Phase 2 进度 | 35% |
| 最新 Gate | #005 PASS (2026-07-14) |
| Domain 冻结 | Teaching Domain Model 已冻结 |
| 下一步 | Sprint 4.1.1 — Course Entity 实现 |
| 版本 | v0.4.0 (Skeleton), 业务逻辑未实现 |

## 已冻结的 Domain

| Domain | 版本 | Gate | 状态 |
|--------|------|------|------|
| Identity Center | v0.2.0 | #001 ✅ | 代码完成，冻结 |
| Student Management | v0.3.0 | #002 ✅ | 代码完成，冻结 |
| Teaching Domain | v0.4.0 | #004 ✅ #005 ✅ | 骨架完成，领域模型冻结，业务逻辑待写 |

## 不能碰的东西

- Identity Center 代码 — 改了要走 CR
- Student Domain 代码 — 改了要走 CR
- Teaching Domain Model — 已冻结，改了要走 CR
- Constitution 25 条 — 修改需要正式 CR

## AI 模型配置

| 用途 | 模型 | API |
|------|------|-----|
| 代码/逻辑/对话 | DeepSeek V4 Flash | CCSWITCH |
| 图片识别 | MiMo V2.5 | CCSWITCH |
| 复杂架构决策 | Claude Opus 4 (预留) | CCSWITCH |

## 关键文件索引

| 文件 | 作用 |
|------|------|
| `docs/00-Constitution/Constitution-v4.0.md` | 25 条铁律 |
| `docs/DomainModel/TeachingDomainModel.md` | Teaching 领域模型权威源 |
| `docs/BusinessRules/TeachingRules.md` | Teaching 总规则 v1.2 |
| `docs/BusinessRules/CourseRules.md` | Course 规则 |
| `docs/BusinessRules/ClassRules.md` | Class 规则 |
| `docs/BusinessRules/ContractRules.md` | Contract 规则 |
| `docs/BusinessRules/LessonRules.md` | Lesson 规则 |
| `docs/StateMachine/StateMachineCatalog.md` | 全部状态机目录 |
| `docs/EventCatalog/EventCatalog.md` | 事件注册 |
| `docs/BusinessFlow/CoreBusinessFlow.md` | 端到端业务叙事 |
| `docs/DecisionLog/DEC-005-TeachingDomain.md` | 架构决策 |
| `docs/Gate/Gate-005-DomainReview.md` | Gate 清单 |
| `.ai/memory.md` | AI 工作记忆 |
| `.architect/sprint-history.md` | Sprint 历史 |
| `.architect/gate-history.md` | Gate 历史 |

## CTO 决策记录

| 日期 | 决策 | 结果 |
|------|------|------|
| 2026-07-06 | Teaching Rules v1.1: Contract 成为财务单元 | 通过 |
| 2026-07-07 | Sprint 4.0 Skeleton First | Gate #004 PASS |
| 2026-07-07 | Rule 25: One Domain At A Time | 写入 Constitution |
| 2026-07-14 | Task-EduOS-005: 深度建模再编码 | Gate #005 PASS |
| 2026-07-14 | Course = 纯知识产品，无定价 | DEC-005-01 |
| 2026-07-14 | Contract = 财务单元（非 Enrollment） | DEC-005-02 |
| 2026-07-14 | 两阶段事件（Completed ≠ Finished） | DEC-005-04 |

## Sprint 路线图

| Sprint | 内容 | 状态 |
|--------|------|------|
| 4.1.1 | Course Entity 实现 | ⬜ 下一步 |
| 4.1.2 | Class + TeacherAssignment | ⬜ |
| 4.1.3 | Contract + Enrollment | ⬜ |
| 4.1.4 | Lesson + Attendance + ChangeRequest | ⬜ |
| 4.2 | Events (LessonCompleted / LessonFinished) | ⬜ |
| 5.x | Finance Domain | ⬜ |
| 6.x | Points Domain | ⬜ |
| 7.x | Notification Domain | ⬜ |
| 8.x | Dashboard | ⬜ |

---

*CTO 窗口每次开工前先读这个文件。*
