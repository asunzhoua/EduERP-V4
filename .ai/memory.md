# EduOS Memory

## Project
- EduOS V1.0 = EduERP V4
- Sprint 1 ✅ → Sprint 2 ✅ (Gate #002 Approved 🟢)
- Sprint 3 ✅ (Student Domain — Gate #003 Approved 🟢)
- Sprint 3.5 → 4.0 ✅ (Teaching Design Freeze + Skeleton — Gate #004 Approved 🟢)
- Task-EduOS-005 ✅ (Teaching Domain Deep Modeling — Gate #005 Approved 🟢)
- Sprint 4.1.1 ✅⚠️ (Course Entity — PASS WITH CONDITIONS, 等待 Sprint 4.1.2 任务单)
- **Current: 等待 CTO 提供 Sprint 4.1.2 任务单 (Class + TeacherAssignment)

## Architecture
- Four layers: Client → API → EventBus → Domain
- NestJS 11 + TypeScript + MySQL 8.0.41 (Windows Service)
- Event-driven, modules communicate only via EventBus
- RBAC: 6 tables, global JwtAuthGuard, @Public(), RolesGuard
- Global API prefix: `/api/v1`
- Path aliases: `@common/*`, `@modules/*`, `@events/*`, `@database/*`, `@config/*`, `@utils/*`

## Sprint 1 (DONE ✅)
- NestJS foundation, Config, Logging, EventBus, RBAC framework
- .ai/ + .architect/ + release/ + docs/

## Sprint 2 Identity Center (DONE ✅ — Gate #002 Approved 🟢)
- 6 entities (User, Role, Permission, UserRole, RolePermission, LoginLog)
- 4 endpoints: POST login/logout/refresh, GET me
- JWT Access 2h + Refresh 7d (DB-stored token rotation)
- Global JwtAuthGuard + @Public() decorator
- RolesGuard + @Roles() decorator
- Seed: admin/admin123 + 4 roles + 12 permissions
- MySQL 8.0.41 production install
- v0.2.0 tagged & released

## Sprint 3 — Student Domain (DONE ✅)
- Student CRUD with StudentCode auto-generation (STYYYYMMNNNN)
- Parent-Student many-to-many relationship
- Student status lifecycle (ACTIVE/PAUSED/GRADUATED/INACTIVE)
- Student tags (JSON array)
- Batch Excel/CSV import with validation
- 12 API endpoints
- Student audit log table

## Sprint 4.1.1 — Course Entity (DONE ✅ — PASS WITH CONDITIONS ⚠️)
- Course Entity 实现完成：17 files, 6 endpoints, 13 unit tests
- Entity: 17 fields matching DomainModel Section 3.1
- State Machine: DRAFT → PUBLISHED ↔ ARCHIVED (ARCHIVED non-terminal verified in code)
- Audit Log: field-level diff tracking per update
- Code Generator: CS + YYYYMM + 4-digit sequence
- **CTO 裁决: PASS WITH CONDITIONS** — 范围越界（实现了 Service/Controller/DTO，超出"最小闭环"）
- 保留成果，禁止自动模板化，后续实体必须重新下任务单

## Sprint 3.5 → 4.0 — Teaching Domain Design Freeze + Skeleton (DONE ✅ — Gate #004 Approved 🟢)
- Teaching Rules v1.1 rewrite: Contract added, two-phase events
- Lesson lifecycle v1.1: DRAFT→SCHEDULED→TEACHING→FINISHED→ARCHIVED+CANCELLED
- Contract entity: ACTIVE/EXHAUSTED/EXPIRED/FROZEN/REFUNDED
- Attendance 7-status system
- LessonChangeRequest with 4 change types
- Constitution expanded to 24 rules (Rules 19-24 added)
- 3 catalog documents: DomainCatalog, EventCatalog, StateMachineCatalog
- CoreBusinessFlow: 7-phase end-to-end narrative
- Teaching Skeleton: 61 files across 5 sub-modules (course, class, contract, lesson, teacher-assignment)
- ~40 API endpoints, all HTTP 501 NotImplementedException, Swagger-documented
- Build: tsc 0 errors, ESLint: 0 errors/warnings on teaching module

## Task-EduOS-005 — Teaching Domain Deep Modeling (DONE ✅ — Gate #005 Approved 🟢)
- **TeachingDomainModel.md**: Core domain model — 8 entities, relationships, teaching chain, financial chain, 8 acceptance questions answered
- **CourseStateMachine.md**: 3 states (DRAFT/PUBLISHED/ARCHIVED). ARCHIVED not terminal.
- **ClassStateMachine.md**: 4 states. Activation requires teacher + schedule. Batch lesson generation.
- **LessonStateMachine.md**: 6 states. Two-phase events. FINISHED = safe (no money). ARCHIVED = terminal.
- **DEC-005**: 8 architectural decisions documented (Course as knowledge product, Contract as financial unit, Schedule embedded in Class, Two-phase events, Lesson as atomic unit, ChangeRequest over direct edit, Batch generation, Enrollment carries Contract ref)
- **Gate #005**: All 8 acceptance questions answered, 11 Constitution rules aligned, 37 checklist items PASS
- **TeachingRules.md** bumped to v1.2 (references DomainModel as authoritative source)
- Domain Model is now FROZEN — any changes require CR per Rule 7 and Rule 25

## 总体阶段
- Phase 0 架构设计 ████████████████████ 100%
- Phase 1 基础能力 ████████████████████ 100%
- Phase 2 业务Domain ███████░░░░░░░░░░░░  35%
- Phase 3 业务联动(Event) ░░░░░░░░░░░░░░░░░░░   0%
- Phase 4 运营分析 ░░░░░░░░░░░░░░░░░░░   0%

## AI 模型配置 (已冻结)

```
主模型（代码/逻辑/对话）：DeepSeek V4 Flash
视觉模型（图片识别）    ：MiMo V2.5
```

| 用途 | 模型 | API | 说明 |
|------|------|-----|------|
| 代码开发、业务逻辑、对话 | deepseek-v4-flash | CCSWITCH (OpenCode) | 主力模型，所有日常任务 |
| 图片识别、多模态理解 | mimo-v2.5 | CCSWITCH (OpenCode) | 需要识别图片时调用 |
| Claude Opus | claude-opus-4-8 | CCSWITCH (OpenCode) | 预留，复杂架构决策时使用 |
| Claude Haiku | claude-haiku-4-5 | CCSWITCH (OpenCode) | 预留，轻量任务 |

**规则：**
- 默认使用 DeepSeek，不主动切换模型
- 只有明确需要识别图片时才调用 MiMo V2.5
- MiMo V2.5 Benchmark: MMMU 56.7 / MathVista 74.0 / AI2D 93.0（7B 级别最强）
- MiMo V2.5 局限：复杂图表深度分析能力不如大参数模型

## Key Rules
- No business logic in Controller
- No direct DB modification (all changes through HoursLedger)
- All business calculations server-side
- One API does one thing
- No Default Export (always Named Export)
- One Sprint = One Bounded Context
- Read .architect/ before starting work
- Rule 19: Lesson is the ONLY business timeline
- Rule 20: Every Money Must Have A Lesson
- Rule 21: Every Domain must publish its events publicly
- Rule 22: All state changes must be unidirectional, no skipping states
- Rule 23: All auto-calculated results must be replayable
- Rule 24: Skeleton First — new domain must complete skeleton before business logic
- **Rule 25: One Domain At A Time** — 任一时刻只能开发一个业务 Domain。当前 Domain 未完成 Gate、Release、Freeze 前，不允许进入下一个 Domain。如需修改已冻结 Domain，必须通过 CR 流程。
- **Any Identity Center changes MUST go through CR**

## DoD Checklist
- [x] Code → [x] Build → [x] Lint → [x] MySQL verified → [ ] Tests → [ ] Docs → [ ] Review

## Current Focus
- Sprint 4.1.1 完成 (PASS WITH CONDITIONS ⚠️)
- Teaching Domain Model 已冻结，Course Entity 已实现
- **等待 CTO 提供 Sprint 4.1.2 任务单** — Class + TeacherAssignment
- 不开始任何新的 Sprint，直到收到 CTO 任务单
