# EduOS Memory

## Project
- EduOS V1.0 = EduERP V4
- Sprint 1 ✅ → Sprint 2 ✅ (Gate #002 Approved 🟢)
- **Current: Sprint 3 — Student Domain (ready to start)**

## Architecture
- Four layers: Client → API → EventBus → Domain
- NestJS 11 + TypeScript + MySQL 8.0.41 (Windows Service)
- Event-driven, modules communicate only via EventBus
- RBAC: 6 tables, global JwtAuthGuard, @Public(), RolesGuard

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

## Sprint 3 — Student Domain (approved)
- Student CRUD with StudentCode auto-generation
- Parent-Student many-to-many relationship
- Student status lifecycle (Active/Paused/Graduated/Inactive)
- Student tags (JSON array)
- Batch Excel/CSV import
- BusinessRules/StudentRules.md created

## Key Rules
- No business logic in Controller
- No direct DB modification (all changes through HoursLedger)
- All business calculations server-side
- One API does one thing
- No Default Export (always Named Export)
- One Sprint = One Bounded Context
- Read .architect/ before starting work
- **Any Identity Center changes MUST go through CR**

## DoD Checklist
- [x] Code → [x] Build → [x] Lint → [x] MySQL verified → [ ] Tests → [ ] Docs → [ ] Review

## Current Focus
- Implement Sprint 3 Student Domain per Architect-approved scope
