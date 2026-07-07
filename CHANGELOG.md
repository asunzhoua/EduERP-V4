# EduERP V4 — Changelog

## v0.3.0 — Student Domain (2026-07-07) 🟢 Gate #003 Approved (98/100)

### Student Domain (Sprint 3)
- Student entity: StudentCode auto-generation, basic/contact/school info, tags, status, soft delete
- StudentStatus enum: ACTIVE / PAUSED / GRADUATED / INACTIVE (terminal state validation)
- StudentParent many-to-many: one student ↔ multiple parents, one parent ↔ multiple students
- StudentCodeGeneratorService: centralized `STYYYYMMNNNN` format
- 7 CRUD endpoints + 4 parent-relation endpoints + 1 import endpoint
- Field-level audit tracking (oldValue, newValue, fieldName, operator, source)
- createdSource tracking (ADMIN / IMPORT / API)
- Reusable ImportService with validation + Import Report
- import_history table reserved for future import tracking
- BusinessRules/StudentRules.md — business rules separated from code
- Review/Sprint-03-Checklist.md — gate review checklist

### Database Tables (4 new)
- `student` — Student profiles
- `student_parent` — Parent-Student associations
- `student_audit_log` — Field-level audit trail
- `import_history` — Import metadata (reserved)

### Technical
- TypeORM 1.0.0 compatibility resolved (new Entity() pattern, relations object format)
- synchronize: false permanently (production-safe)
- xlsx package added for Excel/CSV parsing
- @types/multer added for file upload types

---

## v0.2.0 — Identity Center (2026-07-07) 🟢 Gate #002 Approved

### Identity Center (Sprint 2)
- 6 database tables: user, role, permission, user_role, role_permission, login_log
- 4 auth endpoints: login, logout, refresh, me
- JWT Access 2h + Refresh 7d (DB-stored, token rotation)
- Global JwtAuthGuard + @Public() decorator
- RolesGuard + @Roles() RBAC permission checks
- Seed data: admin/admin123 + 4 roles + 12 permissions
- LoginLog audit trail for all auth events
- MySQL 8.0.41 production install (Windows Service)

### Infrastructure Fixes
- ESM module resolution fixed (module: commonjs)
- @Public() decorator applied to public endpoints
- synchronize: false (production-safe schema management)
- npm run seed script for CLI seeding

### Gate Review
- **Gate #002**: 🟢 Approved by Chief Architect
- Sprint 2 frozen — CR required for any future Identity changes

---

## v0.0.2 — Identity Scaffold (2026-07-06)

### Architecture Freeze

- 建立项目骨架与目录结构
- 建立完整文档体系（docs/）
- 初始化 18 份文档模板
- 制定 AI 开发规范与编码约定
- **尚未开始开发业务代码**

---

*此文件将记录每个版本的变更历史。*
