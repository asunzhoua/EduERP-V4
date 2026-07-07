# EduOS Development Rules

> All AI developers (Claude, Qwen, YuanBao, Cursor, Trae) MUST follow these rules.

## Golden Rules

### Rule 1: One Sprint = One Bounded Context
NEVER develop two business domains in one Sprint.
Wait for Architect review before starting the next Sprint.

### Rule 2: Document Before Code
Any new feature MUST first update the corresponding docs/ file(s).
Code without document updates will be REJECTED.

### Rule 3: No Default Export
Use named exports only:
```ts
// ✅ CORRECT
export class UserService {}
export const USER_ROLES = { ... };

// ❌ WRONG
export default class UserService {}
```

### Rule 4: Path Aliases Only
NEVER use relative paths with `../../`.
Use registered aliases:
```ts
// ✅ CORRECT
import { UserService } from '@modules/identity';
import { AppLogger } from '@utils/logger';

// ❌ WRONG
import { UserService } from '../../../modules/identity';
```

### Rule 5: No Direct DB Access
- All DB operations go through Repository layer
- TypeORM entities are the ONLY way to define table structure
- NEVER write raw SQL in services or controllers

### Rule 6: Event Bus Only
Modules NEVER call each other directly.
Publish events and let listeners handle the rest.

### Rule 7: Audit Everything
Every data modification MUST:
1. Create a business document (e.g., HoursLedger)
2. Write AuditLog
3. Include a reason

### Rule 8: No Hardcoded Rules
Business rules (pricing, salary, points) MUST come from config/DB.
NEVER write `if (teacherId === 1)` in business logic.

## Definition of Done (DoD)

Every Sprint / Task must pass ALL stages:

```
[Ready]
    │
    ▼
[Doing] — Code implementation
    │
    ▼
[Build] — npx nest build (zero errors)
    │
    ▼
[Self-Review] — Check against docs
    │
    ▼
[Architect Review] — Wait for approval
    │
    ▼
[Done]
```

No skipping stages. No "done" without Review.

## Change Request (CR) Process

Any new feature or requirement MUST follow CR:

```
CR-001: [Title]
Type: Feature | Bug | Enhancement
Status: Proposed → Approved → In Progress → Done
Description: ...
Affects: [docs files]
```

No direct code changes without a CR.
