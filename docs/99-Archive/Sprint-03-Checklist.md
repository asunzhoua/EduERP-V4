# Sprint 3 — Student Domain Checklist

> **Gate #003**: 🟢 Approved by Chief Architect on 2026-07-07
> **Status**: ✅ Complete — Pending Architect Gate Review

---

## Module 1: Student Entity ✅

- [x] `Student` entity created with all required fields
- [x] StudentCode field (system-generated, immutable)
- [x] Basic info: name, gender, birthDate
- [x] Contact info: phone, email
- [x] School info: school, grade
- [x] Tags: JSON Array (e.g. `["新生","重点"]`)
- [x] Status: ACTIVE / PAUSED / GRADUATED / INACTIVE (enum)
- [x] Notes: free-text
- [x] Soft delete: `deleted` flag
- [x] Merge预留: `mergedToStudentId` field
- [x] Audit fields: `createdBy`, `createdAt`, `createdSource`, `updatedBy`, `updatedAt`

## Module 2: ParentStudent Relation ✅

- [x] `StudentParent` entity created (many-to-many)
- [x] Support: one student ↔ multiple parents
- [x] Support: one parent ↔ multiple students
- [x] Relation field: 父亲/母亲/祖父/祖母/监护人/Other
- [x] isPrimary flag for primary contact

## Module 3: Student Status Enum ✅

- [x] `StudentStatus` enum: ACTIVE, PAUSED, GRADUATED, INACTIVE
- [x] All references use enum (no raw strings)
- [x] Status transition validation (Graduated = terminal)

## Module 4: StudentCodeGeneratorService ✅

- [x] `StudentCodeGeneratorService` in student module
- [x] Format: `STYYYYMMNNNN` (prefix + year + month + sequence)
- [x] Sequence reset per month (based on latest code in DB)
- [x] Centralized — not in entity, supports future extraction

## Module 5: Student CRUD ✅

- [x] `GET /api/v1/students` — List with pagination + filters
- [x] `GET /api/v1/students/:id` — Get by ID
- [x] `POST /api/v1/students` — Create student (StudentCode auto-generated)
- [x] `PUT /api/v1/students/:id` — Update student (field-level audit)
- [x] `PATCH /api/v1/students/:id/status` — Change status
- [x] `DELETE /api/v1/students/:id` — Soft delete
- [x] Permission guards: student:read / student:create / student:update
- [x] Validation: class-validator DTOs

## Module 6: ImportService (Excel/CSV) ✅

- [x] Reusable `ImportService` created in `@utils/services/`
- [x] Supports `.xlsx` and `.csv` formats
- [x] Template validation (headers: name, gender, birthDate, school, grade, phone, note, tags)
- [x] Row-level validation with error collection
- [x] StudentCode auto-generation during import
- [x] `POST /api/v1/students/import` endpoint
- [x] Permission guard: student:create

## Module 7: Import Report ✅

- [x] Import returns: total rows, success count, failure count
- [x] Failure details: row number, field, reason
- [x] Structured API response format

## Module 8: Student Audit ✅

- [x] Creation audit: who, when, source (ADMIN/IMPORT/API)
- [x] Modification audit: field name, old value, new value, operator
- [x] Status change audit with transition details
- [x] Delete audit with student info
- [x] All stored in `student_audit_log` table

## Cross-Cutting ✅

- [x] All entities use named exports (no default exports)
- [x] Path aliases used: @modules, @common, @utils, @database, @events, @config
- [x] `student:read/student:create/student:update` permissions already in seed
- [x] Build passes: `npx nest build`
- [x] API endpoints tested with curl (12 endpoints)
- [x] CHANGELOG updated
- [x] Release notes updated
- [x] `.ai/project-status.md` updated
- [x] `.ai/memory.md` updated

## Gate #003 Review

- [x] All above items completed
- [ ] **Present for Architect review** ⬅️ HERE
- [ ] Sprint 3 frozen — CR required for any future changes
