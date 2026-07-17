# EduOS Project Roadmap

## 总体阶段

```
Phase 0 — 架构设计      ████████████████████ 100%
Phase 1 — 基础能力      ████████████████████ 100%
Phase 2 — 业务 Domain   ███████░░░░░░░░░░░░░  35%
Phase 3 — 业务联动(Event) ░░░░░░░░░░░░░░░░░░░   0%
Phase 4 — 运营分析       ░░░░░░░░░░░░░░░░░░░   0%
```

## Phase 0 — 架构设计 (100% ✅)

- [x] 项目定位与愿景
- [x] 8 大设计哲学
- [x] Architecture Constitution (25 rules)
- [x] PRD v4.0
- [x] SAD v4.0

## Phase 1 — 基础能力 (100% ✅)

- [x] NestJS 11 + TypeScript 5 工程搭建
- [x] MySQL 8.0.41 + TypeORM 连接
- [x] 统一配置、日志、返回格式、异常处理
- [x] RBAC 权限框架 (JwtAuthGuard + RolesGuard)
- [x] EventBus 事件总线
- [x] Swagger / OpenAPI 接入

## Phase 2 — 业务 Domain (30% ██████░░░░)

### 已完成
- [x] **Identity Center** — 用户认证 + 角色权限 (Sprint 2)
- [x] **Student Management** — 学生 CRUD + 家长关系 + 批量导入 (Sprint 3)
- [x] **Teaching Design Freeze** — 规则冻结 (Sprint 3.5)
- [x] **Teaching Skeleton** — 5 子模块骨架 (Sprint 4.0)
- [x] **Teaching Domain Deep Model** — 领域深度建模 (Task-EduOS-005, Gate #005)

### 进行中
- [ ] **Course Domain** — 业务逻辑实现 (Sprint 4.1.x)

### 待开发
- [ ] **Class Domain** (Sprint 4.2.x)
- [ ] **Contract Domain** (Sprint 4.3.x)
- [ ] **Teacher Management** (Sprint 5.x)
- [ ] **Lesson + Attendance** (Sprint 6.x)
- [ ] **Leave Management** (Sprint 7.x)

## Phase 3 — 业务联动 (0% ░░░░)

- [ ] LessonCompleted 事件发布与消费
- [ ] LessonFinished 事件发布与消费
- [ ] Finance 监听事件
- [ ] Points 监听事件
- [ ] Notification 监听事件

## Phase 4 — 运营分析 (0% ░░░░)

- [ ] Dashboard 数据聚合
- [ ] 经营报表
- [ ] AI 辅助分析

---

## 版本路线

| 版本 | 内容 | 状态 |
|------|------|------|
| v0.1.0 | Foundation | ✅ |
| v0.2.0 | Identity Center | ✅ Released |
| v0.3.0 | Student Management | ✅ Dev Complete |
| v0.3.5 | Teaching Design Freeze | ✅ Frozen |
| v0.4.0 | Teaching Skeleton | ✅ Complete |
| v0.4.1 | Course Entity | ⬜ |
| v0.4.2 | Course CRUD | ⬜ |
| v0.4.3 | Course Status Machine | ⬜ |
| v0.4.4 | Course API | ⬜ |
| v1.0.0 | 正式发布 | ⬜ |
