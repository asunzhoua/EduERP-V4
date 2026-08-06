# P1 Security Verification — 2026-08-06

Scope: verify 3 P1 security items with code evidence. NO code changes made.

## 1. Exception filter (P0) — satisfied

File: `backend/src/common/filters/global-exception.filter.ts:20-51`
- Unknown exceptions default to status 500, message `服务器内部错误` (lines 20-22).
- Only `HttpException` instances surface their real status/message (lines 24-39).
- Stack trace is logged only via `AppLogger.error(..., exception.stack)` — never returned to the client (lines 41-45).
- Response body is the generic `{ code, message, data: null }` shape (lines 47-51).

Verdict: satisfied — no stack/internals disclosure through error responses.

## 2. Parent data scope (P1) — satisfied

Files:
- `backend/src/modules/student/student.controller.ts:330-331` — the `GET /students` list is `@Roles('SuperAdmin', 'Admin', 'Teacher')`; a `Parent` gets 403.
- `student.controller.ts:322-328` — `GET /students/my-children` is `@Roles('Parent')` and derives `userId = req.user.sub` (line 325).
- `backend/src/modules/student/services/student.service.ts:317-328` — `getChildrenByUserId` filters `student_parent` by `parentId: userId`; a parent can only see their own children.
- `student.service.ts:336-344` — child-scoped endpoints verify the `parentId + childId` relation exists first, throwing `ForbiddenException` otherwise.

Verdict: satisfied — parent data access is scoped to `req.user.sub`.

## 3. Refresh token rotation & logout (P1) — satisfied, one accepted deferred gap

Files:
- `backend/src/modules/identity/auth/auth.service.ts:110-117` — refresh issues a new UUID token and overwrites the stored `refreshToken`, invalidating the previous one (rotation).
- `auth.service.ts:124-134` — `logout` clears `refreshToken` / `refreshTokenExpiresAt` to null.

Verdict: satisfied for rotation + logout.

Accepted gap (deferred P2/P3): no admin force-revoke endpoint for a stolen session. Registered as an accepted deferred item — not blocking.

## Method

Static code review with file:line citations. No code changed in this task.
