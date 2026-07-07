# EduOS Architecture Overview

> This file is the **single source of truth** for EduOS architecture.
> Every AI (Claude, Qwen, YuanBao, Cursor, Trae) MUST read this file before starting any work.

## System Architecture

```
Client Layer (WeChat MiniApp / Web)
        │
        ▼
API Layer (NestJS REST API)
        │
        ▼
Event Bus (EventEmitter2)
        │
        ▼
Domain Layer (Business Modules)
        │
        ▼
Data Layer (MySQL / TypeORM)
```

## Core Principles

1. **Event First** — All business originates from events, never direct module calls
2. **Document First** — All changes must update docs before code
3. **Audit First** — Every modification writes AuditLog
4. **Rule First** — All business rules are configurable, never hardcoded
5. **Reality First** — System only records what actually happened

## Layer Rules

### API Layer
- One API = One responsibility
- API never computes business logic
- API only publishes events, then returns
- Unified response format: `{ code, message, data }`

### Event Bus
- Only communication mechanism between modules
- Events are past tense (e.g., `LessonFinished`)
- Events contain only base data, no computed values
- All listeners run in parallel
- P0 events have retry guarantee via `SYS_P0_RETRY_QUEUE`

### Domain Layer
- All business logic lives here
- Never expose domain directly to API
- Every module has its own bounded context

## Module Structure

```
modules/
├── identity/     — Auth, users, roles, permissions (Sprint 2)
├── student/      — Student management (Sprint 3)
├── teacher/      — Teacher management
├── parent/       — Parent management
├── lesson/       — Lesson scheduling and execution
├── course/       — Course definitions
├── attendance/   — Check-in/out
├── leave/        — Leave management
├── finance/      — Payments, salary
├── points/       — Points system
├── dashboard/    — Statistics and dashboard
└── system/       — System configuration
```

## Database Rules

- MySQL is the single source of truth
- HoursLedger is the ONLY source of truth for remaining hours (never UPDATE directly)
- All monetary values: Decimal(18,2)
- All lesson hours: Decimal(6,2)
- Every table has: ID, CreateTime, UpdateTime, Status, Version, Deleted

## Key Events (V1)

| Event | Publisher | Listeners |
|-------|-----------|-----------|
| LessonFinished | Lesson module | Hours, Salary, Points, Message, Statistics, Audit |
| LeaveApproved | Leave module | Hours, Salary, Message, Statistics, Audit |
| HoursAdjusted | Finance module | Statistics, Audit, Notification |
| PaymentCompleted | Finance module | Finance, Statistics, Dashboard, Message |
| PointAdded | Points module | GiftCenter, Statistics, Message, Dashboard |

## Development Rules

- ONE Sprint = ONE Bounded Context
- No cross-context development in a single Sprint
- All code must pass: Build → Lint → Test → Review
- Default exports are PROHIBITED
- Path aliases: @common, @modules, @events, @database, @config, @utils
