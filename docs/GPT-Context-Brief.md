# EduOS — CTO × AI 协作规则 & 项目全景 (GPT 参考文档)

> **用途**: 让新窗口的 GPT 快速理解项目背景、对话规则、架构宪法和当前进度
> **生成日期**: 2026-07-14
> **生成者**: Claude Code (首席架构师角色)

---

## 一、项目是什么

### EduOS V1.0 = EduERP V4

**Education Operating System（教育运营操作系统）**

不是小程序、不是 ERP、不是 CRM。是一套让教育培训机构所有人每天围绕运转的操作系统。

**用户角色**:
- **老板**: 一分钟知道机构怎么样。打开就是经营数据。
- **管理员**: 处理业务，系统自动统计。
- **老师**: 今天给谁上课、赚多少钱、反馈什么。
- **家长**: 孩子有没有课、剩多少课、积分、请假。
- **AI (未来)**: 辅助提醒续费、流失预警。不能自动收费。

**技术栈**:
- NestJS 11 + TypeScript 5
- TypeORM 1.0.0 + MySQL 8.0.41 (Windows Service)
- Event-driven architecture（EventBus）
- RBAC 权限体系
- Swagger / OpenAPI

---

## 二、对话规则（AI 必须遵守）

### 角色定位

- AI 是**首席架构师**角色，不是码农
- 推荐正确方案，不是最简单的方案
- 用户（CTO）说错了要 push back，不要 fold
- 永远不要说"完成了"但没跑测试/验证

### 工作节奏

- **先文档，后代码**（Rule 5）
- **一个 Domain 一个 Sprint**（Rule 25）
- **Skeleton First**（Rule 24）— 先骨架，再业务逻辑
- **Gate Review** — 每个阶段结束要有 Gate 审查
- **Change Request** — 修改已冻结的东西必须走 CR 流程

### 沟通风格

- 说中文（CTO 偏好）
- 不要加 em dash（—）、en dash（–）
- British English（behaviour, colour, licence）
- 不要加 emoji（除非 CTO 明确要求）
- 不要过度包装，直接给结果

### 质量铁律

1. **不要跳过测试说通过** — 跑了再说
2. **不要删测试来过关** — 不允许 `.skip`、注释掉测试
3. **不要吞错误** — 不允许 `eslint-disable`、`@ts-ignore`
4. **不要改没要求改的东西** — scope 纪律
5. **不要说"Done"没有自审** — 100/100 需要证据

### AI 模型配置

| 用途 | 模型 | API |
|------|------|-----|
| 代码开发、业务逻辑、对话 | DeepSeek V4 Flash | CCSWITCH (OpenCode) |
| 图片识别、多模态理解 | MiMo V2.5 | CCSWITCH (OpenCode) |
| 复杂架构决策（预留） | Claude Opus 4 | CCSWITCH (OpenCode) |

---

## 三、架构宪法（25 条铁律）

### 设计哲学（8 条）

| # | 原则 | 含义 |
|---|------|------|
| 1 | Reality First | 系统只记录真实发生。老师完成课程 → 系统自动扣课，不是管理员点扣课。 |
| 2 | Event First | 任何业务全部来源事件。新增功能 = 监听事件，不是改旧代码。 |
| 3 | Document First | 所有修改都是新增业务单据。老板永远知道为什么改、谁改。 |
| 4 | Rule First | 不要硬编码。工资、课时、积分全部配置化。 |
| 5 | Audit First | 所有关键业务记录：谁、什么时候、为什么修改。 |
| 6 | Simplicity First | 老师每天用的功能才做，万分之一的需求不做。 |
| 7 | Stable First | 稳定第一，速度第二。宁可消息慢 2 秒，不能扣错课。 |
| 8 | Human First | AI 永远建议不是决定。财务、工资、退款最终人确认。 |

### 开发铁律（17 条，Rule 1-8 + 15-25）

**数据安全（Rule 1-4）**:
1. 禁止直接修改核心业务数据
2. 禁止硬编码业务规则
3. 禁止跨模块直接调用
4. 禁止删除审计日志

**开发流程（Rule 5-7）**:
5. 新增功能先更新文档再写代码
6. 一个 Sprint 只完成一个业务域
7. 对已冻结模块修改必须走 CR

**业务规则（Rule 15-25）**:
15. 业务对象必须先存在（先有 Student，再有 Lesson）
16. 所有资金相关业务必须由 LessonFinished 事件触发
17. 任何业务只能修改自己的数据（禁止跨 Domain 改数据库）
18. 所有用户看到的数据必须来自数据库（不允许前端自己算）
19. **Lesson 是整个 EduOS 唯一的业务时间轴**
20. **Every Money Must Have A Lesson** — 每一分钱追溯到一节课
21. 每一个 Domain 必须公开自己的 Event
22. 所有状态变化必须单向，不允许跳状态
23. 任何自动计算结果必须能够重新计算（Replayable）
24. **Skeleton First** — 新 Domain 先完成骨架再编码
25. **One Domain At A Time** — 同一时刻只开发一个 Domain

---

## 四、四层架构

```
Client（小程序/Web/后台）
    ↓
API Layer（NestJS Controllers）
    ↓
EventBus（@nestjs/event-emitter）
    ↓
Domain Layer（Services + Repositories + Entities）
```

### 路径别名

```
@common/*    → 公共工具
@modules/*   → 业务模块
@events/*    → 事件定义
@database/*  → 数据库配置
@config/*    → 配置
@utils/*     → 工具函数
```

### 全局配置

- API 前缀: `/api/v1`
- JWT: Access 2h + Refresh 7d（DB 存储 token rotation）
- 全局 JwtAuthGuard + `@Public()` 装饰器跳过认证
- RolesGuard + `@Roles()` 装饰器控制权限

---

## 五、已开发的 Domain

### 1. Identity Center (v0.2.0 — Frozen ✅)

6 个实体: User, Role, Permission, UserRole, RolePermission, LoginLog
4 个端点: POST login/logout/refresh, GET me
Seed: admin/admin123 + 4 roles + 12 permissions

### 2. Student Management (v0.3.0 — Frozen ✅)

12 个 API 端点
Student CRUD + StudentCode 自动生成 (STYYYYMMNNNN)
Parent-Student 多对多关系
Student 状态: ACTIVE/PAUSED/GRADUATED/INACTIVE
批量 Excel/CSV 导入 + 校验
Student 审计日志

### 3. Teaching Domain (v0.4.0 — Skeleton Complete, Domain Model Frozen ✅)

5 个子模块: course, class, contract, lesson, teacher-assignment
61 个骨架文件, ~40 个 API 端点 (全部 HTTP 501)
Build: 0 errors, ESLint: 0 errors

**Task-EduOS-005 深度建模完成** (Gate #005 Approved):
- TeachingDomainModel.md (权威源)
- 8 个实体定义完整
- 3 个状态机文档
- 8 项架构决策
- Domain Model 已冻结

---

## 六、Teaching Domain 核心概念

### 教学链 (Teaching Chain)

```
Course（课程）→ Class（教学班）→ Lesson（课次）
```

**Course** = 纯知识产品（无定价、无排课、无教师）
**Class** = 运营实例（关联 Course、Teacher、Schedule、Students）
**Lesson** = 最小业务原子（所有业务围绕 Lesson 展开）

### 财务链 (Financial Chain)

```
家长付款 → Contract（课时合同）
学生报名 → Enrollment（关联 Contract）
课程完成 → LessonFinished → Finance 扣减 Contract.remainingLessons
```

**Contract** = 财务单元（剩余课时在这里）
**Enrollment** = 桥梁（连接 Student ↔ Class ↔ Contract）

### 两阶段事件

```
LessonCompleted（教学完成，不涉及钱）
    ↓ Review Window (24h)
LessonFinished（财务结算，钱可以动）
```

**为什么?** 老师完成课后，家长可能打电话说"孩子那天请假了"。需要一个修正窗口。

### 扣减链路

```
Lesson Finished
  → Enrollment (classCode + studentCode)
    → Contract.contractCode
      → Contract.remainingLessons -= 1
        → 如果 remainingLessons = 0 → EXHAUSTED
```

### 8 个实体

| 实体 | 用途 | 标识 |
|------|------|------|
| Course | 知识产品定义 | courseCode (CS...) |
| Class | 教学班实例 | classCode (CL...) |
| Contract | 课时合同 | contractCode (CT...) |
| Enrollment | 报名关系 | classCode + studentCode |
| TeacherAssignment | 教师分配 | classCode + teacherId |
| Lesson | 课次 | id (int PK) |
| LessonAttendance | 考勤记录 | lessonId + studentCode |
| LessonChangeRequest | 调课申请 | id (int PK) |

---

## 七、Domain 依赖图

```
                   ┌──────────┐
                   │ Identity │  (Foundation)
                   └────┬─────┘
                        │
                   ┌────▼─────┐
                   │  Student │
                   └────┬─────┘
                        │
                   ┌────▼──────┐
                   │ Teaching  │  ◄── 当前在这里
                   └────┬──────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Finance  │  │  Points  │  │Attendance│
   └──────────┘  └──────────┘  └──────────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                 ┌──────────────┐
                 │ Notification │
                 └──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  Dashboard   │
                 └──────────────┘
```

---

## 八、状态机一览

### Student: ACTIVE → PAUSED | GRADUATED | INACTIVE
### Course: DRAFT → PUBLISHED ↔ ARCHIVED
### Class: DRAFT → ACTIVE → COMPLETED | CANCELLED
### Contract: ACTIVE → EXHAUSTED | EXPIRED | FROZEN | REFUNDED
### Lesson: SCHEDULED → TEACHING → FINISHED → ARCHIVED | CANCELLED
### Enrollment: ACTIVE → WITHDRAWN | COMPLETED

**铁律**: 状态变化单向，不允许跳状态。反向修改需要 admin override + reason。

---

## 九、事件注册

| 事件 | 发布者 | 触发 | 金钱变动 |
|------|--------|------|----------|
| lesson.completed | Teaching | Lesson → FINISHED | ❌ |
| lesson.finished | Teaching | Lesson → ARCHIVED | ✅ |
| contract.deducted | Finance (future) | 扣减完成 | — |
| salary.calculated | Finance (future) | 工资计算 | — |
| points.awarded | Points (future) | 积分发放 | — |

---

## 十、当前进度

```
Phase 0 — 架构设计      ████████████████████ 100% ✅
Phase 1 — 基础能力      ████████████████████ 100% ✅
Phase 2 — 业务 Domain   ███████░░░░░░░░░░░░░  35%
Phase 3 — 业务联动      ░░░░░░░░░░░░░░░░░░░   0%
Phase 4 — 运营分析      ░░░░░░░░░░░░░░░░░░░   0%
```

### Sprint 历史

| Sprint | 内容 | Gate | 版本 |
|--------|------|------|------|
| Sprint 1 | Foundation Engineering | — | v0.1.0 |
| Sprint 2 | Identity Center | #001 ✅ | v0.2.0 |
| Sprint 3 | Student Management | #002 ✅ | v0.3.0 |
| Sprint 3.5 | Teaching Design Freeze | #003 ✅ | v0.3.5 |
| Sprint 4.0 | Teaching Skeleton | #004 ✅ | v0.4.0 |
| Task-EduOS-005 | Teaching Domain Deep Model | #005 ✅ | — |

### 下一步

**Sprint 4.1.1 — Course Entity 实现**
基于冻结的 Domain Model，填充 Course Entity 全部字段，实现业务逻辑。

---

## 十一、文档体系

```
docs/
├── 00-Constitution/Constitution-v4.0.md    ← 架构宪法（25 条）
├── BusinessRules/
│   ├── TeachingRules.md v1.2               ← Teaching 总规则
│   ├── CourseRules.md                      ← Course 规则
│   ├── ClassRules.md                       ← Class 规则
│   ├── ContractRules.md                    ← Contract 规则
│   └── LessonRules.md                      ← Lesson 规则
├── DomainModel/
│   └── TeachingDomainModel.md              ← 领域模型权威源
├── StateMachine/
│   ├── StateMachineCatalog.md              ← 全部状态机目录
│   ├── CourseStateMachine.md               ← Course 状态机
│   ├── ClassStateMachine.md                ← Class 状态机
│   └── LessonStateMachine.md               ← Lesson 状态机
├── EventCatalog/EventCatalog.md            ← 事件注册
├── DomainCatalog/DomainCatalog.md          ← Domain 归属
├── BusinessFlow/CoreBusinessFlow.md        ← 端到端业务叙事
├── DecisionLog/DEC-005-TeachingDomain.md   ← 架构决策日志
├── Gate/Gate-005-DomainReview.md           ← Gate 审查清单
└── Review/Sprint-03-Checklist.md           ← Sprint 审查
```

---

## 十二、给 GPT 的指令

如果你是 GPT，被分配到这个项目，请遵守以下规则：

1. **先读文档再写代码** — 至少读 `TeachingDomainModel.md` + `Constitution-v4.0.md` + 对应的 Rules 文件
2. **不要自作主张改已冻结的东西** — 改了要走 CR
3. **代码质量** — 不允许 `any`、`@ts-ignore`、`eslint-disable`
4. **测试不能跳过** — 不允许 `.skip`、注释测试
5. **一个 Domain 一个 Sprint** — 不要跨域开发
6. **先文档后代码** — 新功能先写规则文档，再写代码
7. **Event-driven** — Domain 之间通 EventBus，不要直接调用
8. **Lesson 是核心** — 所有业务围绕 Lesson，不围绕 Class 或 Course
9. **钱只在 LessonFinished 之后动** — 不是 LessonCompleted
10. **所有数字来自数据库** — 前端不算业务数据

---

*This document is auto-generated by Claude Code for GPT context transfer. Last updated: 2026-07-14.*
