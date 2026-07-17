# EduOS Todo

## Sprint 1 (已完成)

- [x] Task 1: 建立项目目录
- [x] Task 2: 建立 Backend (NestJS + TypeScript)
- [x] Task 3: 数据库连接 — 代码就绪，需 MySQL 服务
- [x] Task 4: 统一配置中心
- [x] Task 5: 统一日志
- [x] Task 6: 统一返回格式
- [x] Task 7: 全局异常处理
- [x] Task 8: RBAC 权限框架
- [x] Task 9: EventBus 框架
- [x] Task 10: .ai 项目记忆目录

## Sprint 2 — Identity Center (已完成)

- [x] Phase A: 目录优化 + .architect + 规范文件
- [x] Phase A: backend/README.md
- [x] Phase A: release/v0.0.1.md
- [x] 6 张数据库表：user / role / permission / user_role / role_permission / login_log
- [x] POST /api/v1/auth/login — BCrypt + JWT (2h)
- [x] POST /api/v1/auth/logout — 清除 Refresh Token
- [x] POST /api/v1/auth/refresh — 刷新 Token (7d, DB存储)
- [x] GET /api/v1/auth/me — 当前用户信息
- [x] JwtAuthGuard (全局) + @Public() 装饰器
- [x] Seed 数据：admin 用户、4 角色、12 权限
- [x] 构建通过 (nest build + tsc --noEmit)

## Sprint 3 (已完成)

- [x] Student 实体设计
- [x] Student CRUD 接口 (12 endpoints)
- [x] Parent-Student 多对多关系
- [x] StudentCode 自动生成 (STYYYYMMNNNN)
- [x] 学生状态管理 (ACTIVE/PAUSED/GRADUATED/INACTIVE)
- [x] Excel/CSV 批量导入
- [x] Student 审计日志

## Sprint 3.5 — Teaching Domain Design Freeze (已完成)

- [x] Teaching Rules v1.1 重写 (新增 Contract、双阶段事件)
- [x] Lesson 生命周期 v1.1 (DRAFT→SCHEDULED→TEACHING→FINISHED→ARCHIVED/CANCELLED)
- [x] ContractRules.md 新建文档
- [x] CourseRules.md 移除价格字段
- [x] ClassRules.md 更新 TeacherAssignment/Enrollment
- [x] LessonRules.md 完整重写 (7状态考勤、ChangeRequest、审计reason)
- [x] Constitution Rules 19-24
- [x] DomainCatalog：9个域
- [x] EventCatalog：2当前+5规划事件
- [x] StateMachineCatalog：5个状态机
- [x] CoreBusinessFlow：7阶段全流程

## Sprint 4.0 — Teaching Skeleton (已完成 ✅)

- [x] course 子模块：6端点、13文件
- [x] class 子模块：12端点、13文件
- [x] contract 子模块：6端点、11文件
- [x] lesson 子模块：12端点、13文件
- [x] teacher-assignment 子模块：4端点、10文件
- [x] TeachingModule 注册至 AppModule
- [x] Swagger 接入 main.ts
- [x] ESLint 配置修复 (argsIgnorePattern: '^_')
- [x] 构建通过：tsc 0 错误
- [x] ESLint 通过：teaching 模块 0 错误/警告

## Sprint 4.1 (待开始)

- [ ] Course Domain 业务逻辑实现（实体字段、CRUD 逻辑、业务规则）
- [ ] 等待 Architect 指令
