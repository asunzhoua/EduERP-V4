# Tech Debt Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use 子代理驱动开发 (recommended) or 执行计划 to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four confirmed tech-debt items in the EduOS backend: register the missing `ScheduleModule`, rewrite a stale e2e test, stop logging DB credentials at startup, and delete a dead duplicate `login_log` module.

**Architecture:** All changes are isolated to the NestJS backend. Items 1–3 touch `app.module.ts` (composition root) and its test; item 4 removes an untracked dead directory. No domain logic, DB schema, or API behaviour changes.

**Tech Stack:** NestJS 11, TypeScript 5.7, TypeORM (MySQL 8), Jest 30, supertest 7, `@nestjs/schedule@^4.1.2` (already a dependency).

## Global Constraints

- **Release Freeze**: the project accepts only P0/P1 fixes. This plan fixes existing defects only; it adds no features.
- **TDD**: every logic change must start with a failing test (write test → see it fail → implement → see it pass).
- **Commit discipline — CRITICAL**: the working tree is DIRTY with the user's in-progress work. NEVER run `git add -A` or `git add .`. Only `git add` the exact files listed in each task's `Files:` section. `backend/src/app.module.ts` currently contains uncommitted changes (an in-progress OptimizedExceptionFilter/SentryModule/PerformanceInterceptor/HealthModule refactor) — Task 0 resolves whether those get committed/stashed before this plan's commits.
- `backend/src/modules/identity/login-log/` is UNTRACKED in git, so deleting it requires no git commit.
- **Working directory**: `npm`/`npx` commands run from `backend/`; git commands run from the repo root `C:\Users\27157\Desktop\claude code\EduERP-V4\EduERP-V4`.
- **e2e requirement**: `npm run test:e2e` boots the whole `AppModule`, which connects to MySQL (`retryAttempts: 1`). MySQL must be reachable for e2e to pass.
- **Naming**: use existing repo style; no new dependencies; do not modify files outside each task's `Files:` list.

---

### Task 0: Pre-flight — verify baseline and git hygiene

**Files:** (none modified)

**Interfaces:** none. Establishes the working-tree baseline for all later commits.

- [ ] **Step 1: Capture the dirty-tree baseline**

Run (from repo root):
```bash
git status --short
```
Expected: a long list of modified/untracked files (user's in-progress work). Record this list mentally — later tasks must never stage these.

- [ ] **Step 2: Inspect pre-existing changes to the file this plan edits**

Run:
```bash
git diff -- backend/src/app.module.ts
```
Expected: the diff is limited to adding `HealthModule`/`SentryModule`/`PerformanceInterceptor` and switching `GlobalExceptionFilter` → `OptimizedExceptionFilter`. This is unrelated to the 4 plan items; the plan edits `app.module.ts` on top of it.

- [ ] **Step 3: Gate — resolve commit strategy with the user**

The plan's Tasks 1 and 3 stage `backend/src/app.module.ts`, which would also sweep in the user's in-progress refactor. Ask the user to choose:
1. **Commit/stash their in-progress work first** (cleanest), or
2. **Allow this plan's `app.module.ts` commits to include that refactor** (the commit message must then mention it).

Do NOT start Task 1 until this is decided.

---

### Task 1: Register `ScheduleModule` so the pool-monitor cron fires

**Files:**
- Create: `backend/src/app.module.spec.ts`
- Modify: `backend/src/app.module.ts` (add one import + one import entry)

**Interfaces:**
- Consumes: nothing.
- Produces: `backend/src/app.module.spec.ts` containing two tests — one asserting `ScheduleModule` is registered (this task) and one asserting no `[DB Config]` log (added in Task 3). Task 3 extends this same file.

- [ ] **Step 1: Write the failing test**

Create `backend/src/app.module.spec.ts`:

```ts
import 'reflect-metadata';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('should register ScheduleModule so @Cron jobs are scheduled', () => {
    const imports: any[] = Reflect.getMetadata('imports', AppModule) ?? [];
    const hasScheduleModule = imports.some((mod) => {
      const name = mod?.module?.name ?? mod?.name;
      return name === 'ScheduleModule';
    });
    expect(hasScheduleModule).toBe(true);
  });
});
```

Note: `ScheduleModule.forRoot()` returns a `DynamicModule` whose `.module` is `ScheduleModule`, so both static and dynamic module entries are handled.

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`):
```bash
npx jest app.module.spec.ts
```
Expected: FAIL — `expect(received).toBe(true)` with `received` = `false` (no `ScheduleModule` in imports).

- [ ] **Step 3: Implement — add `ScheduleModule.forRoot()`**

In `backend/src/app.module.ts`:
- Add the import on the line before `import { EventBusModule }` (line 4):
  ```ts
  import { ScheduleModule } from '@nestjs/schedule';
  ```
- Add `ScheduleModule.forRoot(),` as the first entry in the `imports: [...]` array (before `ConfigModule.forRoot`, currently line 25).

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`):
```bash
npx jest app.module.spec.ts
```
Expected: PASS (1 passed).

- [ ] **Step 5: Build check**

Run (from `backend/`):
```bash
npm run build
```
Expected: exit 0, no TypeScript errors.

- [ ] **Step 6: Commit**

Run (from repo root; per the Task 0 gate decision — if the user's `app.module.ts` refactor rides along, say so in the message):
```bash
git add backend/src/app.module.spec.ts backend/src/app.module.ts
git commit -m "fix: register ScheduleModule so pool-monitor cron runs"
```

---

### Task 2: Rewrite the stale e2e test to assert a real endpoint

**Files:**
- Modify: `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a passing e2e assertion against `GET /api/v1/health` (the `@Public()` health endpoint, no DB queries at request time).

- [ ] **Step 1: Confirm the current test fails**

Run (from `backend/`, MySQL must be up):
```bash
npm run test:e2e
```
Expected: FAIL — the test asserts `GET /` returns `200` + `"Hello World!"`, but the app has global prefix `api/v1` and no root route, so it gets `404`.

- [ ] **Step 2: Rewrite the test**

Replace the entire contents of `backend/test/app.e2e-spec.ts` with:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
```

`setGlobalPrefix('api/v1')` mirrors what `backend/src/main.ts:13` does, so the test exercises the same route shape as production.

- [ ] **Step 3: Run the test to verify it passes**

Run (from `backend/`, MySQL up):
```bash
npm run test:e2e
```
Expected: PASS (1 passed) — `GET /api/v1/health` returns `200` and `body.status === 'ok'`.

- [ ] **Step 4: Commit**

Run (from repo root):
```bash
git add backend/test/app.e2e-spec.ts
git commit -m "test: rewrite stale e2e to assert /api/v1/health"
```

---

### Task 3: Stop logging DB connection info at startup

**Files:**
- Modify: `backend/src/app.module.spec.ts` (add one test)
- Modify: `backend/src/app.module.ts` (delete the `console.log` block)

**Interfaces:**
- Consumes: `app.module.spec.ts` created in Task 1.
- Produces: a regression guard that `[DB Config]` never reappears in `app.module.ts`.

- [ ] **Step 1: Write the failing guard test**

Append to `backend/src/app.module.spec.ts` (inside the existing `describe('AppModule', ...)` block, alongside the ScheduleModule test):

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

it('should not log DB connection info on startup', () => {
  const source = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');
  expect(source).not.toContain('[DB Config]');
});
```

This source-level guard is a cheap regression check for a security-relevant side effect (credential logging). Under ts-jest, `__dirname` is `backend/src`, so the path resolves.

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`):
```bash
npx jest app.module.spec.ts
```
Expected: FAIL — the second test's `expect(...).not.toContain('[DB Config]')` finds the string in `app.module.ts`.

- [ ] **Step 3: Implement — remove the `console.log` block**

In `backend/src/app.module.ts`, inside the `useFactory: () => {` body (currently lines 34–40), delete exactly this:

```ts
        console.log('[DB Config]', {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD?.substring(0, 3) + '...',
          database: process.env.DB_DATABASE,
        });
```

Do not touch any other line in the factory.

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`):
```bash
npx jest app.module.spec.ts
```
Expected: PASS (2 passed).

- [ ] **Step 5: Build check**

Run (from `backend/`):
```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 6: Commit**

Run (from repo root; same Task 0 gate note about `app.module.ts`):
```bash
git add backend/src/app.module.spec.ts backend/src/app.module.ts
git commit -m "fix: stop logging DB connection info at startup"
```

---

### Task 4: Delete the dead `identity/login-log` module

**Files:**
- Delete: `backend/src/modules/identity/login-log/login-log.entity.ts`
- Delete: `backend/src/modules/identity/login-log/login-log.module.ts`
- Delete: `backend/src/modules/identity/login-log/login-log.service.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a clean `login_log` entity situation — only `backend/src/modules/identity/entities/login-log.entity.ts` (the live `LoginLog`) maps that table. The deleted `LoginLogEntity` was a conflicting schema for the same table, loaded via the `**/*.entity.js` glob in `app.module.ts:48`.

- [ ] **Step 1: Confirm the dead code has no external references**

Run (from `backend/`):
```bash
grep -rn "LoginLogEntity\|LoginLogService\|LoginLogModule\|identity/login-log" src --include="*.ts"
```
Expected: matches appear ONLY in the three files being deleted (`src/modules/identity/login-log/...`). No file under `src/modules/`, `src/events/`, `src/database/`, `src/common/` references them.

- [ ] **Step 2: Delete the directory**

Run (from repo root):
```bash
rm -rf "backend/src/modules/identity/login-log"
```

- [ ] **Step 3: Verify the build still compiles (proves nothing imports the deleted module)**

Run (from `backend/`):
```bash
npm run build
```
Expected: exit 0 — if any file still imported the deleted module, TypeScript would fail on the missing module.

- [ ] **Step 4: Verify the unit suite still passes**

Run (from `backend/`):
```bash
npm run test
```
Expected: all unit tests PASS. (The live `LoginLog` entity used by `identity.module.ts`, `auth.service.ts`, `analytics.service.ts`, and `database.module.ts` is untouched.)

- [ ] **Step 5: Confirm zero remaining references**

Run (from `backend/`):
```bash
grep -rn "LoginLogEntity\|LoginLogService\|LoginLogModule\|identity/login-log" src --include="*.ts" || echo "NO_REFERENCES"
```
Expected: `NO_REFERENCES`.

- [ ] **Step 6: No git commit required**

The deleted files were untracked (`?? backend/src/modules/identity/login-log/` in `git status`), so there is nothing to stage. Confirm with `git status --short -- backend/src/modules/identity/login-log` → empty.

---

## Full Verification

Run these from `backend/` in order, after all tasks:

1. `npm run build` — exit 0.
2. `npm run test` — all unit suites pass.
3. `npm run test:e2e` — the rewritten health e2e passes (MySQL up).
4. Manual boot: `npm run start:dev` → startup log contains NO `[DB Config]` line, and the pool monitor `@Cron` registers without error.
5. Grep guard: `grep -rn "[DB Config]" backend/src || echo "CLEAN"` → `CLEAN`.
6. `git status --short` — shows only the 3 commits from Tasks 1–3 (plus the user's pre-existing in-progress work; nothing new swept in).
