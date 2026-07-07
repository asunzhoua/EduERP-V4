# EduOS Project Status

## Sprint 1 — 基础工程搭建 (DONE ✅)
- [x] Project scaffolding + NestJS init
- [x] MySQL + TypeORM connection
- [x] Unified config, logging, response format
- [x] Global exception filter
- [x] RBAC framework (RolesGuard + @Roles())
- [x] EventBus framework
- [x] .ai/ + .architect/ directories

## Sprint 2 — Identity Center (DONE ✅ — Gate #002 Approved 🟢)

- [x] 6 database tables (user/role/permission/user_role/role_permission/login_log)
- [x] 4 auth endpoints (login/logout/refresh/me)
- [x] JWT + Passport auth (Access 2h / Refresh 7d, DB-stored token rotation)
- [x] Global JwtAuthGuard + @Public() decorator
- [x] RolesGuard + @Roles() RBAC permission checks
- [x] Seed data (admin/admin123 + 4 roles + 12 permissions)
- [x] LoginLog audit trail
- [x] MySQL 8.0.41 production install (Windows Service)
- [x] npm run seed script
- [x] v0.2.0 tagged

## Sprint 3 — Student Domain (APPROVED, ready to start)

**Architect-approved scope:**
- [ ] Student CRUD (StudentCode auto-generation, soft delete)
- [ ] Parent-Student relationship (many-to-many)
- [ ] Student status lifecycle (Active/Paused/Graduated/Inactive)
- [ ] Student tags (JSON array, max 10 per student)
- [ ] Batch Excel/CSV import with validation
- [ ] BusinessRules/StudentRules.md created

## Sprint 4+ (Pending)

Waiting Architect assignment.

