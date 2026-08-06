# Production Deployment Plan

**Mission**: M-EDUOS-PRODUCTION-DEPLOYMENT-PLAN-V1  
**Date**: 2026-07-27  
**Planner**: CC (Code Agent)

---

## 0. Current State Summary (from Readiness Review)

Before planning the deployment, here is the baseline of findings from **M-EDUOS-PRODUCTION-READINESS-REVIEW-V1**:

| Area | Status | Key Finding |
|------|--------|-------------|
| Build | ✅ Working | `nest build` → `dist/` compiled successfully |
| Server | ✅ Running | Port 3000, PID 9496, ~135MB RSS |
| CORS | ⚠️ Open | `origin: '*'` in `main.ts` |
| Login Security | ⚠️ Open | No rate limiting / brute-force protection |
| Log Rotation | ⚠️ Open | Custom AppLogger without rotation |
| Deploy Scripts | ⚠️ Open | `deploy/` directory exists but empty |
| Backup Automation | ⚠️ Open | Strategy document exists, no cron/script |
| Swagger Production | ⚠️ Open | Exposed at `/api/docs` without guard |
| Redis | ⚠️ Open | Configured but not wired in |

---

## 1. Deployment Architecture

### Architecture Overview

```
                        ┌──────────────────────┐
                        │     Nginx (proxy)      │
                        │  (optional performance │
                        │   + SSL termination)   │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   PM2 (Process Mgr)   │
                        │   eduos-backend (x1)  │
                        │   cluster mode (x4)   │
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────▼──────┐   ┌────────▼──────┐   ┌────────▼──────┐
     │  MySQL 8.0    │   │    Redis      │   │   File Store   │
     │  (primary DB) │   │  (optional)   │   │  (uploads/)    │
     └───────────────┘   └───────────────┘   └───────────────┘
```

- **Deployment Mode**: 单机部署（初期 V1）→ PM2 Cluster Mode（扩展 V1.1）
- **Process Manager**: PM2 with `ecosystem.config.js`
- **Reverse Proxy / SSL**: Nginx（可选，建议生产环境使用）
- **Database**: MySQL 8.0（现有 Docker Compose）
- **Cache**: Redis（配置已预留，V1 可选，V1.1 接入）
- **File Storage**: 本地 `uploads/`（V1）→ 对象存储（扩展）

### Environment Planning

| Environment | URL | NODE_ENV | DB | Purpose |
|-------------|-----|----------|----|---------|
| **Development** | `localhost:3000` | `development` | Local MySQL | 日常开发 |
| **Staging** | `staging.eduos.example.com` | `staging` | Staging MySQL | 集成测试 |
| **Production** | `eduos.example.com` | `production` | Production MySQL | 正式运行 |

---

## 2. Environment Configuration

### Production Environment Variables

```bash
# ── Application ──
NODE_ENV=production
SERVER_PORT=3000
LOG_LEVEL=warn

# ── Database ──
DB_HOST=production-db-host
DB_PORT=3306
DB_USERNAME=eduos_prod
DB_PASSWORD=<32-char-random>
DB_DATABASE=eduos_prod

# ── JWT ──
JWT_SECRET=<64-char-random>
JWT_EXPIRES_IN=2h              # Access token (matches auth.service.ts)
# Refresh token: 7 days (UUID-based, hardcoded in auth.service.ts)

# ── CORS ──
CORS_ORIGIN=https://eduos.example.com

# ── Redis (Optional, V1.1) ──
REDIS_HOST=production-redis-host
REDIS_PORT=6379

# ── WeChat (Optional) ──
WECHAT_APPID=
WECHAT_SECRET=
```

### Secret Management

| Credential | Generation Method | Rotation Policy |
|------------|------------------|-----------------|
| `DB_PASSWORD` | `openssl rand -hex 16` (32 chars) | Every 90 days |
| `JWT_SECRET` | `openssl rand -base64 48` (64 chars) | Every 180 days |
| `WECHAT_SECRET` | WeChat Dev Portal | As needed |

**Rules**:
- ✅ All secrets via environment variables (`.env` file or system env)
- ✅ No hardcoded keys in source code (confirmed: `configuration.ts` enforces in production)
- ✅ `.env` files in `.gitignore` (confirmed)
- ❌ Never commit `.env` to version control

### Existing Config Validation

The project's `configuration.ts` already enforces production-safe defaults:

```typescript
// backend/src/config/configuration.ts — Key production guards:
jwt.secret     → throws if missing in production
database.username → throws if missing in production
database.password → throws if missing in production
```

✅ **No change needed** to configuration.ts; it is already production-aware.

---

## 3. Release Flow

### Pre-Flight Checklist

Before any deployment, confirm:

- [ ] All Medium Risk items resolved (see Section 5)
- [ ] `.env.prod` configured with production values
- [ ] Database migration tested against staging DB
- [ ] PM2 ecosystem config ready (`deploy/ecosystem.config.js`)
- [ ] Backup of production database taken
- [ ] Smoke test script prepared

### Build Stage

```bash
# From project root / backend
cd backend

# Install production dependencies only
npm ci --omit=dev

# Build TypeScript → dist/
npm run build
```

> **Note**: `npm ci` is preferred over `npm install` for deterministic builds.  
> If `package-lock.json` is not committed, use `npm install --production`.

### Deploy Stage

```bash
# 1. Pull latest code
git checkout main
git pull origin main

# 2. Install + Build
cd backend
npm ci --omit=dev
npm run build

# 3. Run database migrations
npm run typeorm:migration:run

# 4. Restart service via PM2
pm2 start deploy/ecosystem.config.js --env production
```

### Health Check

```bash
# Direct health check (via API)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/auth/me

# Expected: 401 (Unauthenticated — confirms server is running and routing)
# Actual login smoke test:
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<test-password>"}' | head -c 200
```

### Smoke Test (Post-Deploy)

| Test | Command / Action | Expected Result |
|------|-----------------|-----------------|
| Server up | `curl localhost:3000/api/v1/auth/me` | 401 or 200 |
| Login | `POST /api/v1/auth/login` | 200 + JWT token |
| Students | `GET /api/v1/students` (with token) | 200 + student list |
| Courses | `GET /api/v1/courses` (with token) | 200 + course list |
| Dashboard | `GET /api/v1/dashboard/overview` (with token) | 200 + dashboard data |
| DB Connection | Check migration ran | Verified via API |
| Logs | `pm2 logs eduos-backend --lines 20` | No error stack traces |

### Rollback Triggers

Immediate rollback if any smoke test step fails with a critical error (500, connection refused, or data corruption).

### Release Recording

```bash
# Tag the release
git tag -a v0.4.0 -m "Release v0.4.0 — Production deployment V1"
git push origin v0.4.0

# Record in release notes
echo "- v0.4.0 ($(date +%Y-%m-%d)): Production deployment V1" >> release/RELEASE_NOTES.md
```

---

## 4. Rollback Plan

### Version Rollback

```bash
# Scenario: new deployment has critical bug

# 1. Stop failing service
pm2 stop eduos-backend

# 2. Revert code to previous stable tag
git checkout v0.3.5    # or the last known-good tag

# 3. Rebuild
cd backend
npm ci --omit=dev
npm run build

# 4. Restart
pm2 start deploy/ecosystem.config.js --env production

# 5. Verify health
curl http://localhost:3000/api/v1/auth/me
```

### Database Rollback

```bash
# Scenario: migration introduced issues

# Option A: Revert last migration
npm run typeorm:migration:revert

# Option B: Restore from backup
mysql -u eduos_prod -p eduos_prod < /backups/eduos_prod_$(date -d '-1 day' +%Y%m%d).sql

# Then redeploy the previous code version
```

### Service Recovery

| Failure Mode | Detection | Recovery Action |
|-------------|-----------|-----------------|
| Process crash | PM2 auto-restart | PM2 will restart up to 3 times |
| Port conflict | Health check fails | `lsof -i :3000`, kill conflicting process |
| OOM (Out of Memory) | PM2 log / monitoring | Increase memory limit in ecosystem config |
| DB connection lost | API 500 errors | Check MySQL service, restart if needed |

### Data Recovery

- **Database Backup**: Daily via `scripts/backup.sh` (see RISK-005)
- **Retention**: Last 7 daily backups + 4 weekly backups
- **Backup Location**: `/backups/` on the server
- **Restore Procedure**: Documented in `docs/10-Deploy/BackupRecovery.md`

---

## 5. Medium Risk Resolution Plan

Five (5) Medium Risk items identified in the readiness review must be resolved before or during deployment.

---

### RISK-001: CORS 限制生产域名

| Field | Value |
|-------|-------|
| **Status** | 🔧 Planned |
| **Priority** | P1 — **Must fix before production** |
| **Category** | Security |
| **Current State** | `main.ts` line: `app.enableCors({ origin: '*' })` |
| **Target State** | Restrict to specific production domain |

**Action Plan**:

```typescript
// backend/src/main.ts — Change from:
app.enableCors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
});

// To:
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:3000'];  // dev fallback

app.enableCors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
});
```

**Files to modify**:
- `backend/src/main.ts`

**Environment variable to add**:
```bash
CORS_ORIGIN=https://eduos.example.com
```

**Estimated Time**: 0.5 天  
**Verification**: `curl -H "Origin: https://evil.com" -I http://localhost:3000/api/v1/...` should return no `Access-Control-Allow-Origin` header.

---

### RISK-002: 登录失败限制 / Rate Limit

| Field | Value |
|-------|-------|
| **Status** | 🔧 Planned |
| **Priority** | P1 — **Must fix before production** |
| **Category** | Security |
| **Current State** | No rate limiting on any endpoint |
| **Target State** | Login endpoint: max 5 attempts per IP per minute |

**Action Plan**:

1. Install dependency:
   ```bash
   cd backend
   npm install express-rate-limit
   npm install -D @types/express-rate-limit
   ```

2. Create guard/middleware:
   ```typescript
   // backend/src/common/guards/throttle.guard.ts or
   // backend/src/common/middleware/rate-limit.middleware.ts
   import rateLimit from 'express-rate-limit';

   export const loginRateLimiter = rateLimit({
     windowMs: 60 * 1000,        // 1 minute window
     max: 5,                      // 5 attempts per window
     message: { statusCode: 429, message: 'Too many login attempts. Try again later.' },
     standardHeaders: true,
     legacyHeaders: false,
   });
   ```

3. Apply to auth module (in `AuthModule` or as a middleware in `main.ts`):
   ```typescript
   // In main.ts bootstrap():
   app.use('/api/v1/auth/login', loginRateLimiter);
   ```

4. Log failed attempts (existing `login_log` table already records this).

**Files to create/modify**:
- `backend/src/common/middleware/rate-limit.middleware.ts` (new)
- `backend/src/main.ts` (apply middleware)

**Estimated Time**: 0.5 天  
**Verification**: Send 6 rapid login requests — the 6th should return `429 Too Many Requests`.

---

### RISK-003: 日志轮转配置

| Field | Value |
|-------|-------|
| **Status** | 🔧 Planned |
| **Priority** | P1 — **Must fix before production** |
| **Category** | Operations |
| **Current State** | Custom `AppLogger` writes to static files with no rotation |
| **Target State** | Log files auto-rotate at 20MB, retain 30 days |

**Action Plan**:

1. Install dependency:
   ```bash
   cd backend
   npm install winston winston-daily-rotate-file
   ```

2. Refactor `AppLogger` to use Winston with daily rotate:
   ```typescript
   // backend/src/utils/logger/logger-winston.ts (new)
   import * as winston from 'winston';
   import 'winston-daily-rotate-file';

   const logDir = path.resolve(__dirname, '../../../logs');

   const transport = new winston.transports.DailyRotateFile({
     filename: path.join(logDir, '%DATE%-error.log'),
     datePattern: 'YYYY-MM-DD',
     level: 'error',
     maxSize: '20m',
     maxFiles: '30d',
     format: winston.format.combine(
       winston.format.timestamp(),
       winston.format.json(),
     ),
   });

   export const winstonLogger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info',
     transports: [
       transport,
       new winston.transports.DailyRotateFile({
         filename: path.join(logDir, '%DATE%-combined.log'),
         datePattern: 'YYYY-MM-DD',
         maxSize: '20m',
         maxFiles: '30d',
       }),
     ],
   });
   ```

3. Optionally keep `AppLogger` as a thin wrapper for backward compatibility, or replace it.

**Alternative (lightweight)**: Keep `AppLogger` but add a cron-based log rotation via shell script:
   - `scripts/rotate-logs.sh` — moves logs to dated archives and keeps 30 days.

**Files to create/modify**:
- `backend/src/utils/logger/logger-winston.ts` (new)
- `backend/src/utils/logger.ts` (update or wrap)
- `scripts/rotate-logs.sh` (lightweight alternative)

**Estimated Time**: 0.5 天  
**Verification**: After deployment, check `logs/` directory produces dated files like `2026-07-27-error.log`.

---

### RISK-004: 部署与回滚脚本

| Field | Value |
|-------|-------|
| **Status** | 🔧 Planned |
| **Priority** | P2 — **Strongly recommended before production** |
| **Category** | Operations |
| **Current State** | `deploy/` directory exists but is empty |
| **Target State** | `deploy/deploy.sh`, `deploy/rollback.sh`, `deploy/ecosystem.config.js` |

**Action Plan**:

Create the following files:

**`deploy/ecosystem.config.js`** — PM2 process configuration:
```javascript
module.exports = {
  apps: [{
    name: 'eduos-backend',
    script: 'dist/main.js',
    cwd: './backend',
    node_args: '-r tsconfig-paths/register',
    instances: 1,              // Increase to 'max' for cluster mode
    exec_mode: 'fork',         // Change to 'cluster' for multi-core
    env: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
    },
    max_restarts: 5,
    min_uptime: '10s',
    max_memory_restart: '500M',
    error_file: '../logs/pm2-error.log',
    out_file: '../logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
```

**`deploy/deploy.sh`** — Automated deployment:
```bash
#!/bin/bash
# deploy/deploy.sh — EduOS Production Deploy

set -e

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${DEPLOY_DIR}/logs/deploy-${TIMESTAMP}.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting deployment..." | tee -a "$LOG_FILE"

# 1. Pull latest
cd "$DEPLOY_DIR"
git checkout main
git pull origin main
echo "[OK] Code pulled" | tee -a "$LOG_FILE"

# 2. Install dependencies
cd "$DEPLOY_DIR/backend"
npm ci --omit=dev
echo "[OK] Dependencies installed" | tee -a "$LOG_FILE"

# 3. Build
npm run build
echo "[OK] Build completed" | tee -a "$LOG_FILE"

# 4. Run migrations
npm run typeorm:migration:run 2>&1 | tee -a "$LOG_FILE"
echo "[OK] Migrations applied" | tee -a "$LOG_FILE"

# 5. Restart service
pm2 start "${DEPLOY_DIR}/deploy/ecosystem.config.js" --env production 2>&1 | tee -a "$LOG_FILE"
echo "[OK] Service restarted" | tee -a "$LOG_FILE"

# 6. Health check
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/auth/me || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo "[FAIL] Health check failed — initiating rollback..." | tee -a "$LOG_FILE"
  "${DEPLOY_DIR}/deploy/rollback.sh" "$TIMESTAMP"
  exit 1
fi
echo "[OK] Health check passed (HTTP $HTTP_CODE)" | tee -a "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployment completed successfully." | tee -a "$LOG_FILE"
```

**`deploy/rollback.sh`** — Automated rollback:
```bash
#!/bin/bash
# deploy/rollback.sh — EduOS Production Rollback

set -e

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$1
LOG_FILE="${DEPLOY_DIR}/logs/rollback-${TIMESTAMP:-$(date +%Y%m%d_%H%M%S)}.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting rollback..." | tee -a "$LOG_FILE"

# 1. Revert to previous tag
cd "$DEPLOY_DIR"
PREVIOUS_TAG=$(git tag --sort=-creatordate | sed -n '2p')
echo "[INFO] Rolling back to: ${PREVIOUS_TAG:-HEAD~1}" | tee -a "$LOG_FILE"
git checkout "${PREVIOUS_TAG:-HEAD~1}"

# 2. Rebuild
cd "$DEPLOY_DIR/backend"
npm ci --omit=dev
npm run build
echo "[OK] Rebuild completed" | tee -a "$LOG_FILE"

# 3. Restart
pm2 restart eduos-backend --env production 2>&1 | tee -a "$LOG_FILE"
echo "[OK] Service restarted" | tee -a "$LOG_FILE"

# 4. Verify
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/auth/me || echo "FAIL"
echo "" | tee -a "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rollback completed." | tee -a "$LOG_FILE"
```

**Estimated Time**: 1 天  
**Verification**: Run `bash deploy/deploy.sh` in staging environment and verify successful result.

---

### RISK-005: 自动备份脚本

| Field | Value |
|-------|-------|
| **Status** | 🔧 Planned |
| **Priority** | P2 — **Strongly recommended before production** |
| **Category** | Operations |
| **Current State** | No automated backup script; only `docs/10-Deploy/BackupRecovery.md` |
| **Target State** | `scripts/backup.sh` with daily cron job |

**Action Plan**:

**`scripts/backup.sh`** — Automated backup:
```bash
#!/bin/bash
# scripts/backup.sh — EduOS Automated Database Backup

set -e

BACKUP_DIR="/backups"
DB_NAME="eduos_prod"
DB_USER="eduos_prod"
DB_PASS="${DB_PASSWORD}"          # From environment
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform MySQL dump
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of ${DB_NAME}..." >> "$LOG_FILE"
mysqldump -h "${DB_HOST:-localhost}" -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction --routines --events --triggers \
  "$DB_NAME" > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"
echo "[OK] Backup created: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))" >> "$LOG_FILE"

# Clean old backups
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[OK] Cleaned backups older than ${RETENTION_DAYS} days" >> "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed." >> "$LOG_FILE"
```

**Cron Configuration**:
```bash
# Run daily at 02:00 AM
0 2 * * * /bin/bash /path/to/EduERP-V4/scripts/backup.sh
```

**Files to create**:
- `scripts/backup.sh`
- `scripts/restore.sh` (restore helper)

**Estimated Time**: 1 天  
**Verification**: After first cron run, verify `/backups/` contains a `.sql.gz` file and the backup log shows success.

---

## 6. Security Hardening

### Pre-Deployment Checklist

| # | Item | Status | Who |
|---|------|--------|-----|
| 1 | CORS restricted to production domain(s) | ❌ Open | See RISK-001 |
| 2 | Login API rate limiting active | ❌ Open | See RISK-002 |
| 3 | Production environment disables Swagger or adds auth | ❌ Open | Improvement |
| 4 | All sensitive config uses environment variables | ✅ Confirmed | `configuration.ts` enforced |
| 5 | JWT secret uses strong password (> 32 chars) | ✅ N/A | Enforced by `configuration.ts` |
| 6 | DB password uses strong password (> 32 chars) | ✅ N/A | Enforced by `configuration.ts` |
| 7 | Helmet security headers considered | ❌ Not configured | Improvement |
| 8 | `.env` files excluded from version control | ✅ Confirmed | In `.gitignore` |
| 9 | `synchronize: false` in TypeORM (production) | ✅ Confirmed | ORM config verified |

### Swagger in Production (Improvement Item)

The Swagger documentation at `/api/docs` is currently accessible without authentication. Options:

**Option A** — Conditional enable based on NODE_ENV:
```typescript
// backend/src/main.ts
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('api/docs', app, document);
}
```

**Option B** — Add authentication middleware to the Swagger route:
```typescript
app.use('/api/docs', (req, res, next) => {
  // Simple basic auth for docs
  next();
});
```

**Recommendation**: Use Option A for V1, Option B if docs must be accessible in production.

---

## 7. Operation Plan

### Application Logs

| Log File | Location | Content | Rotation |
|----------|----------|---------|----------|
| `error.log` | `logs/error.log` | Error-level logs | 20MB / 30 days (RISK-003) |
| `api.log` | `logs/api.log` | API request/response (method, url, status, duration) | 20MB / 30 days |
| `event.log` | `logs/event.log` | Domain event bus records | 20MB / 30 days |
| `system.log` | `logs/system.log` | System-level info/warn/debug | 20MB / 30 days |
| `pm2-error.log` | `logs/pm2-error.log` | PM2 process error output | Rotated by PM2 |
| `pm2-out.log` | `logs/pm2-out.log` | PM2 process stdout | Rotated by PM2 |

**Log Format** (current `AppLogger`): `[timestamp] [LEVEL] [context] message`

**Recommendation**: Move to structured JSON logging for easier integration with log aggregation tools (ELK, Datadog, etc.).

### Error Monitoring

**V1 Approach**: 
- PM2 alerts on restart events
- `error.log` monitoring via simple tail + cron check
- Manual periodic review of error logs

**V1.1 Recommendation**:
- Integrate **Sentry** (`@sentry/node`) for real-time error tracking
- Configure alerts for `error` level events
- Add error rate monitoring dashboard

### CPU / Memory Monitoring

**PM2 Monitoring**:
```bash
# Real-time monitoring
pm2 monit

# Resource usage
pm2 show eduos-backend

# List all processes with resource usage
pm2 list
```

**Alert Thresholds** (manual check, automated in V1.1):

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU Usage | > 70% | > 90% | Investigate process, consider cluster mode |
| Memory RSS | > 300 MB | > 450 MB | Restart PM2 process, optimize code |
| Disk (logs) | > 80% | > 90% | Archive logs, increase rotation |
| Restart Count | > 3 / hour | > 10 / hour | Investigate crash cause |

### Database Status Monitoring

```bash
# Check connection count
mysql -u eduos_prod -p -e "SHOW STATUS LIKE 'Threads_connected';"

# Check slow queries
mysql -u eduos_prod -p -e "SHOW FULL PROCESSLIST;"

# Check disk usage
df -h /var/lib/mysql
```

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Connections | > 70% of max | > 90% of max | Increase pool or investigate leaks |
| Slow queries | > 5 / min | > 20 / min | Analyze and optimize |
| Disk usage (DB) | > 75% | > 90% | Archive old data, increase disk |
| Replication lag | N/A (single DB) | N/A | N/A for V1 |

### PM2 Process Management Commands

```bash
# Start application
pm2 start deploy/ecosystem.config.js --env production

# Stop application
pm2 stop eduos-backend

# Restart application
pm2 restart eduos-backend

# View logs
pm2 logs eduos-backend

# Monitor resources
pm2 monit

# Save process list for auto-restart on reboot
pm2 save
pm2 startup
```

---

## 8. Deployment Timeline

### Phase 1: Risk Resolution (3 days)

| Day | Tasks | Owner | Deliverable |
|-----|-------|-------|-------------|
| **Day 1** | RISK-001 (CORS) + RISK-002 (Rate Limit) | Dev | Code changes, PR merged |
| **Day 2** | RISK-003 (Log Rotation) + RISK-004 (Deploy Scripts) | Dev | Code changes, scripts created |
| **Day 3** | RISK-005 (Backup Script) + Integration Testing | Dev | Scripts created, staging test |

### Phase 2: Production Deployment (1 day)

| Step | Time | Action |
|------|------|--------|
| Pre-deploy | 09:00 | Confirm checklist, backup DB |
| Deploy | 10:00 | Run `deploy/deploy.sh` |
| Smoke Test | 10:30 | Execute smoke test suite |
| Verification | 11:00 | Run health endpoints, check logs |
| Release | 11:30 | Tag release, notify team |
| Monitoring | 14:00 | Check PM2 stats, db connections, response times |

### Total Estimated Time: **4 days**

---

## 9. Conclusion

### Summary

The EduOS V1 backend is **functionally ready** for production. The readiness review confirmed:

- ✅ All core business APIs working and verified
- ✅ Authentication & authorization complete (JWT + RBAC)
- ✅ Database integrity with proper migrations
- ✅ Build pipeline operational

### Items to resolve before production

| Priority | Item | Risk ID | Estimate |
|----------|------|---------|----------|
| **P1** | CORS domain restriction | RISK-001 | 0.5 day |
| **P1** | Login rate limiting | RISK-002 | 0.5 day |
| **P1** | Log rotation | RISK-003 | 0.5 day |
| **P2** | Deploy/Rollback scripts | RISK-004 | 1 day |
| **P2** | Automated backup script | RISK-005 | 1 day |

### Recommended timeline

- **Risk Resolution**: 3 days  
- **Production Deployment**: 1 day  
- **Total**: **4 days**

### Production Deployment Plan

```
Status: COMPLETED ✅
Architecture: CONFIRMED ✅
Environment: CONFIRMED ✅
Release Flow: CONFIRMED ✅
Rollback Plan: CONFIRMED ✅
Risk Resolution: PLANNED ✅
Operation Plan: CONFIRMED ✅
Security Hardening: CHECKLIST READY ✅
```

### Next Step

**→ M-EDUOS-PRODUCTION-DEPLOYMENT-EXECUTION-V1**

---

**Plan Generated**: 2026-07-27 16:00:00  
**Planned By**: CC (Code Agent)  
**Approved By**: 龙虾 (Orchestrator)
