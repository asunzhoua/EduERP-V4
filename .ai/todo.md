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

## Sprint 3 (待定)

- 等待 Architect 指令
