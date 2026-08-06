# Tech Debt Cleanup Design — 2026-08-06

## Context

During a full project analysis of EduERP-V4 (EduOS), several confirmed technical-debt items were identified. The project is in Release Freeze (P0/P1 fixes only), and the user chose to fix the core confirmed issues first. Every item below is backed by file:line evidence read in this session, not speculation.

**Scope approved by user**: Core 4 items + delete confirmed-dead `identity/login-log/` directory. The larger unused DDD framework (`src/shared/` + `src/kernel/` + `src/cli` generators + `src/test-toolkit/`) is explicitly **deferred** — it was found to be interconnected (not isolated dead code) and will be evaluated separately.

## Items

### 1. `ScheduleModule` never registered → `@Cron` never fires

- **Evidence**: `backend/src/app.module.ts` imports do not include `ScheduleModule`; `backend/src/modules/database/pool-monitor.service.ts:27` declares `@Cron(CronExpression.EVERY_MINUTE)`. Only `EventEmitterModule.forRoot()` is registered (`backend/src/events/event-bus.module.ts:7`).
- **Fix**: Add `ScheduleModule.forRoot()` to `app.module.ts` imports (`@nestjs/schedule@^4.1.2` already a dependency — no new package).
- **Effect**: DB connection-pool monitoring starts running on the 1-minute cron.

### 2. Stale e2e test asserts a route that does not exist

- **Evidence**: `backend/test/app.e2e-spec.ts:19-24` expects `GET /` → `200 "Hello World!"`, but the app has a global prefix `api/v1` (`backend/src/main.ts:13`) and no root route.
- **Fix**: In the e2e spec, call `app.setGlobalPrefix('api/v1')` before `init()`, then assert `GET /api/v1/health` returns `200` with `body.status === 'ok'`. The health endpoint is `@Public()` and DB-independent (`backend/src/modules/health/health.controller.ts`).

### 3. DB connection info logged at startup

- **Evidence**: `backend/src/app.module.ts:34-40` runs `console.log('[DB Config]', { host, port, username, password(truncated) })` on every boot.
- **Fix**: Remove the `console.log` block entirely. Connection config remains in env config; no functional need to print it.

### 4. Conflicting duplicate `login_log` entity + dead module

- **Evidence**: Two entities map to table `login_log` with different columns:
  - Live: `backend/src/modules/identity/entities/login-log.entity.ts` (used by `identity.module.ts`, `auth.service.ts`, `analytics.service.ts`, `database.module.ts`).
  - Dead: `backend/src/modules/identity/login-log/{login-log.entity,login-log.service,login-log.module}.ts` — `LoginLogModule` is never imported by any module (grep: only self-references). Because `app.module.ts:48` loads entities via glob `**/*.entity.js`, TypeORM registers **both** entities for the same table.
- **Fix**: Delete the `backend/src/modules/identity/login-log/` directory (3 files). Live `LoginLog` entity is unaffected.

## Out of scope (deferred)

- `src/shared/` + `src/kernel/` DDD framework, `src/cli` generators, `src/test-toolkit`, and `architecture.spec.ts` rules — interconnected, not isolated; evaluated separately.
- Refresh-token revocation (P1), Parent `/students` scope (already safe: `findAll` excludes Parent → 403), exception-filter hardening (already guarded by `isProduction`), P2 refactors (`self/*` sink, `request.js` unit tests), miniapp production config (part of production mission).

## Verification

- `cd backend && npm run build` — compiles.
- `npm run test` — unit suite stays green (especially `identity`, `analytics`, `pool-monitor`, `architecture` specs).
- `npm run test:e2e` — rewritten health e2e passes (requires MySQL reachable, since `AppModule` connects on boot).
- Manual boot: `npm run start:dev` → confirm pool monitor `@Cron` registers without error and DB config log is gone.
- Grep after deletion: no remaining references to `LoginLogModule`, `LoginLogService`, or `LoginLogEntity` outside the deleted dir.

## TDD note

Follow the project's TDD rule for logic changes. Items 1–3 are configuration/test rewrites: write/adjust the failing e2e assertion first, then make the fix. Item 4 is pure deletion — verify zero references via grep before and after.
