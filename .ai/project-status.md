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
- [x] 6 database tables
- [x] 4 auth endpoints
- [x] JWT + Passport auth
- [x] Global guards + decorators
- [x] RBAC permissions
- [x] Seed data
- [x] LoginLog audit trail
- [x] MySQL 8.0.41 production install
- [x] v0.2.0 tagged

## Sprint 3 — Student Domain (DEVELOPMENT COMPLETE 🔧 — Pending Gate Review)

### Module 1: Student Entity ✅
- [x] Student entity with all required fields
- [x] StudentCode: `ST2026070001` format (auto-generated)
- [x] Basic info: name, gender, birthDate
- [x] Contact info: phone, email
- [x] School info: school, grade
- [x] Tags: JSON array (e.g. `["新生","重点"]`)
- [x] Status: ACTIVE / PAUSED / GRADUATED / INACTIVE (enum)
- [x] Notes: free-text
- [x] Soft delete: `deleted` flag
- [x] Merge预留: `mergedToStudentId` field
- [x] Audit fields: createdBy, createdSource, updatedBy

### Module 2: ParentStudent Relation ✅
- [x] Many-to-many: one student ↔ multiple parents
- [x] Support: one parent ↔ multiple students
- [x] Relation type, isPrimary flag

### Module 3: Student Status Enum ✅
- [x] StudentStatus enum: ACTIVE, PAUSED, GRADUATED, INACTIVE
- [x] Status transition validation (Graduated is terminal)
- [x] All references use enum (no raw strings)

### Module 4: StudentCodeGeneratorService ✅
- [x] Format: `STYYYYMMNNNN` (prefix + year + month + sequence)
- [x] Sequence reset per month
- [x] Centralized generation (not in entity)

### Module 5: Student CRUD ✅
- [x] `GET /api/v1/students` — List with pagination + filters
- [x] `GET /api/v1/students/:id` — Get by ID
- [x] `POST /api/v1/students` — Create (StudentCode auto-generated)
- [x] `PUT /api/v1/students/:id` — Update (with field-level audit)
- [x] `PATCH /api/v1/students/:id/status` — Change status
- [x] `DELETE /api/v1/students/:id` — Soft delete
- [x] Permission guards: student:read / student:create / student:update

### Module 6: Parent-Student Endpoints ✅
- [x] `POST /api/v1/students/:id/parents` — Link parent
- [x] `DELETE /api/v1/students/:id/parents/:parentId` — Unlink parent
- [x] `GET /api/v1/students/:id/parents` — Get student's parents
- [x] `GET /api/v1/students/parents/:parentId/students` — Get parent's students

### Module 7: ImportService (Excel/CSV) ✅
- [x] Reusable ImportService created
- [x] Supports `.xlsx` and `.csv` parsing
- [x] Row-level validation with error collection
- [x] Import Report: total/success/failure + error details
- [x] `POST /api/v1/students/import` endpoint

### Module 8: Student Audit ✅
- [x] Creation audit: who, when, source (ADMIN/IMPORT/API)
- [x] Modification audit: field name, old value, new value, operator
- [x] Status change audit with transition details
- [x] Delete audit with student info
- [x] All stored in `student_audit_log` table

### Cross-Cutting ✅
- [x] BusinessRules/StudentRules.md created
- [x] Review/Sprint-03-Checklist.md created
- [x] Build passes: `npx nest build`
- [x] 12 API endpoints tested with curl
- [x] `synchronize: false` (production-safe)
- [x] TypeORM 1.0.0 compatibility resolved

## Sprint 4+ (Pending)
- Waiting Architect assignment
