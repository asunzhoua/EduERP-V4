# EduOS Decision Log

## Record Architecture Decisions (ADRs)

### ADR-001: One Sprint = One Bounded Context
- **Date**: 2026-07-06
- **Context**: AI kept crossing module boundaries during development
- **Decision**: Each Sprint must focus on exactly one business domain
- **Consequence**: Slower initial pace, but zero coupling issues

### ADR-002: Default Export Prohibited
- **Date**: 2026-07-06
- **Context**: AI tools frequently mis-import default exports
- **Decision**: Named exports only across the entire project
- **Consequence**: Slightly more verbose imports, but zero ambiguity

### ADR-003: Path Aliases Mandatory
- **Date**: 2026-07-06
- **Context**: Deep relative paths caused import errors
- **Decision**: Use @-aliases (tsconfig paths) everywhere
- **Consequence**: Clean imports, easy refactoring

### ADR-004: HoursLedger as Single Source of Truth
- **Date**: 2026-07-06
- **Context**: Need to prevent direct balance updates
- **Decision**: All hour changes go through HoursLedger; RemainHours is a cached read value
- **Consequence**: Zero balance corruption, full audit trail

### ADR-005: Event-Based Module Communication
- **Date**: 2026-07-06
- **Context**: Direct module calls created tight coupling
- **Decision**: All cross-module communication via EventBus only
- **Consequence**: New modules just listen to events, no existing code changes

### ADR-006: BCrypt + JWT (Access 2h / Refresh 7d)
- **Date**: 2026-07-06
- **Context**: Need secure auth with session management
- **Decision**: BCrypt for passwords, JWT access tokens (2h), DB-stored refresh tokens (7d)
- **Consequence**: Supports admin kick-out, password-change invalidation
