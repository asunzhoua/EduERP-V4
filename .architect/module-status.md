# EduOS Module Status

## Legend
- ✅ Done
- 🔧 In Progress
- ⬜ Not Started
- 🚫 Blocked

## Sprint 1 — Foundation Engineering (DONE ✅)

| Module | Status | Notes |
|--------|--------|-------|
| Project Structure | ✅ | Directory layout complete |
| Backend Init | ✅ | NestJS 11 + TypeScript |
| Config Center | ✅ | .env, ConfigModule |
| Logging | ✅ | 4-channel logging |
| API Response | ✅ | Unified format + interceptor |
| Exception Filter | ✅ | GlobalExceptionFilter |
| RBAC Framework | ✅ | RolesGuard + decorator |
| EventBus | ✅ | publish/subscribe + 5 events |
| Memory System | ✅ | .ai/ + .architect/ |

## Sprint 2 — Identity Center (DONE ✅)

| Module | Status | Notes |
|--------|--------|-------|
| User Entity | ✅ | user table with BCrypt password |
| Role Entity | ✅ | role table |
| Permission Entity | ✅ | permission table |
| UserRole Entity | ✅ | user_role relation table |
| RolePermission Entity | ✅ | role_permission relation table |
| LoginLog Entity | ✅ | login_log table |
| POST /api/v1/auth/login | ✅ | JWT access token (2h) + refresh token (7d) |
| POST /api/v1/auth/logout | ✅ | Clears refresh token, logs action |
| POST /api/v1/auth/refresh | ✅ | Rotates tokens |
| GET /api/v1/auth/me | ✅ | Current user info |
| JwtAuthGuard | ✅ | Global auth guard, supports @Public() |
| JwtStrategy | ✅ | Passport JWT strategy |
| RBAC Integration | ✅ | RolesGuard + @Roles() decorator |
| Seed Data | ✅ | Admin user + 4 roles + 12 permissions |

## Sprint 3 — Student Management (DONE ✅)

| Module | Status | Notes |
|--------|--------|-------|
| Student Entity | ✅ | student table |
| Student CRUD | ✅ | Full CRUD with pagination, search, filter |
| Student Status | ✅ | ACTIVE/INACTIVE/GRADUATED/TRANSFERRED lifecycle |
| Student Query | ✅ | name, phone, school, grade, status filter |

## Sprint 3.5 → 4.0 — Teaching Domain Design Freeze + Skeleton (DONE ✅)

| Module | Status | Notes |
|--------|--------|-------|
| Teaching Rules v1.1 | ✅ | Contract added, two-phase events, Constitution Rules 19-24 |
| Lesson Rules v1.1 | ✅ | DRAFT→SCHEDULED→TEACHING→FINISHED→ARCHIVED lifecycle |
| Contract Rules (NEW) | ✅ | ACTIVE/EXHAUSTED/EXPIRED/FROZEN/REFUNDED lifecycle |
| Course Rules Update | ✅ | Price removed from Course, moved to Contract |
| Class Rules Update | ✅ | TeacherAssignment effectiveFrom/effectiveTo, enrollment contractCode |
| Core Business Flow | ✅ | 7-phase end-to-end narrative |
| DomainCatalog | ✅ | 9 domains with dependencies |
| EventCatalog | ✅ | 2 current + 5 planned events |
| StateMachineCatalog | ✅ | 5 entity state machines |
| Teaching Skeleton | ✅ | 61 files across 5 sub-modules (course, class, contract, lesson, teacher-assignment) |
| ~40 API Endpoints | ✅ | All HTTP 501 NotImplementedException, Swagger-documented |
| Build & ESLint | ✅ | tsc 0 errors, ESLint 0 errors/warnings on teaching module |

## Future Sprints

| Sprint | Module | Status |
|--------|--------|--------|
| Sprint 4.1.1 | Course Entity | ⬜ |
| Sprint 4.1.2 | Course CRUD | ⬜ |
| Sprint 4.1.3 | Course Status Machine | ⬜ |
| Sprint 4.1.4 | Course API + Gate | ⬜ |
| Sprint 4.2.x | Class Domain | ⬜ |
| Sprint 4.3.x | Contract Domain | ⬜ |
| Sprint 5.x | Teacher Management | ⬜ |
| Sprint 6.x | Lesson + Attendance | ⬜ |
| Sprint 7.x | Leave Management | ⬜ |
| Sprint 8.x | Finance + Salary | ⬜ |
| Sprint 9.x | Points + Dashboard | ⬜ |
| Sprint 10.x | Notifications | ⬜ |
