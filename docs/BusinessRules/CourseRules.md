# Course — Business Rules

> **Domain**: Teaching > Course
> **Sprint**: 4
> **Version**: v0.1.0 (Design Freeze)
> **Last Updated**: 2026-07-07

---

## 1. Core Entity: Course

### 1.1 Description

A Course is the fundamental teaching product definition. It describes **what** is taught — but not who teaches it, when, or to whom. Those details are defined at the Class level.

Every training institution has a catalog of courses (e.g., "小学数学提高班", "少儿英语一级", "硬笔书法入门"). The Course entity is where this catalog lives.

### 1.2 Required Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `courseCode` | String | ✅ | Auto-generated, immutable (`CSYYYYMMNNNN`) |
| `name` | String | ✅ | Display name (e.g., "少儿英语一级") |
| `subject` | Enum | ✅ | Subject category (see 1.3) |
| `type` | Enum | ✅ | Course type (see 1.4) |
| `description` | Text | ❌ | Detailed course description |
| `totalHours` | Number | ✅ | Total teaching hours |
| `totalLessons` | Number | ✅ | Total lesson count for this course |
| `defaultDuration` | Number | ✅ | Default minutes per lesson (e.g., 90) |
| `status` | Enum | ✅ | See Section 2 |
| `tags` | JSON/String[] | ❌ | Course tags for categorization |
| `coverImage` | String | ❌ | URL to cover image (future use) |
| `note` | Text | ❌ | Internal notes |

### 1.3 Subject Categories

```typescript
enum Subject {
  MATH      = 'MATH',      // 数学
  ENGLISH   = 'ENGLISH',   // 英语
  CHINESE   = 'CHINESE',   // 语文
  PHYSICS   = 'PHYSICS',   // 物理
  CHEMISTRY = 'CHEMISTRY', // 化学
  ART       = 'ART',       // 美术
  MUSIC     = 'MUSIC',     // 音乐
  DANCE     = 'DANCE',     // 舞蹈
  SPORTS    = 'SPORTS',    // 体育
  CODING    = 'CODING',    // 编程
  OTHER     = 'OTHER',     // 其他
}
```

### 1.4 Course Types

```typescript
enum CourseType {
  INDIVIDUAL = 'INDIVIDUAL', // 一对一 (1-on-1 tutoring)
  GROUP      = 'GROUP',      // 小班课 (small group class)
  TRIAL      = 'TRIAL',      // 试听课 (trial/demo)
  CAMP       = 'CAMP',       // 集训营 (intensive camp)
}
```

**Type-specific rules:**

| Type | Max Students | Schedule | Notes |
|------|-------------|----------|-------|
| INDIVIDUAL | 1 | Flexible | One teacher, one student |
| GROUP | 2–30 | Fixed schedule | Most common type |
| TRIAL | No limit | Ad-hoc | Free or discounted, limited duration |
| CAMP | 5–50 | Daily consecutive | Short-term intensive program |

### 1.5 Pricing Rules (Updated v1.1)

**Price has been removed from Course. Price belongs to Contract.**

- Course is a **knowledge product** (what is taught), not a financial product
- Pricing is defined at the **Contract** level (how many lessons, at what price)
- The `defaultDuration` field on Course helps estimate lesson length, but actual pricing is on the Contract
- For pricing rules, see [ContractRules.md](./ContractRules.md) Section 4
- Discounts, promotions, and payment plans are out of scope for the Teaching domain

### 1.6 Soft Delete

- Courses use soft delete (`deleted` boolean flag)
- Only `DRAFT` courses can be soft-deleted
- `PUBLISHED` or `ARCHIVED` courses are NEVER deleted — only status-changed
- `courseCode` is never recycled after soft delete
- Soft-deleting a Course with existing Classes: the operation is rejected. Classes must be handled first.

---

## 2. Course Status Lifecycle

### 2.1 Status Definitions

```typescript
enum CourseStatus {
  DRAFT     = 'DRAFT',     // Being created, not yet available
  PUBLISHED = 'PUBLISHED', // Active — classes can be created
  ARCHIVED  = 'ARCHIVED',  // Discontinued — no new classes allowed
}
```

| Status | Meaning | Can create Classes? | Can enroll? |
|--------|---------|---------------------|-------------|
| DRAFT | Course is being set up | ❌ | ❌ |
| PUBLISHED | Course is active | ✅ | ✅ |
| ARCHIVED | Course is discontinued | ❌ | ✅ (existing classes only) |

### 2.2 State Transitions

```
                ┌─────────────┐
                │   DRAFT     │
                └──────┬──────┘
                       │ publish (all required fields filled)
                       ▼
                ┌─────────────┐
                │  PUBLISHED  │
                └──────┬──────┘
               ┌───────┴───────┐
               │               │
               ▼               ▼
        ┌──────────┐    ┌──────────┐
        │ ARCHIVED │    │ PUBLISHED│  (re-activate allowed)
        └──────────┘    └──────────┘
```

**Transition rules:**
- **DRAFT → PUBLISHED**: All required fields must be filled. At least one subject and type must be set.
- **PUBLISHED → ARCHIVED**: Allowed even if active classes exist (existing classes continue operating).
- **ARCHIVED → PUBLISHED**: Allowed (re-activation). Existing classes remain unaffected.
- ARCHIVED is NOT a terminal state (can be re-published at any time).
- There is no DELETE from PUBLISHED or ARCHIVED (only soft-delete from DRAFT).

---

## 3. Course-Class Relationship

### 3.1 Rules

- One Course can have **many** Class instances
- Each Class is a specific "run" of the Course (e.g., "周六上午10点班" and "周日下午2点班" are both Classes of "少儿英语一级")
- Course fields are NOT copied to Class — Class references Course by `courseCode`
- Changes to Course metadata (name, description, etc.) are reflected in all associated Classes (since queries JOIN on courseCode)
- When a Course is archived:
  - Existing Classes continue operating normally
  - No new Classes can be created under this Course
  - Existing enrollments remain valid

### 3.2 Cascade Rules

| Action | Effect on Classes | Effect on Lessons |
|--------|------------------|-------------------|
| Archive Course | Classes remain active | No effect |
| Re-publish Course | No effect | No effect |
| Soft-delete Draft Course | Rejected if classes exist | N/A |

---

## 4. Audit Requirements

### 4.1 course_audit_log Table

| Field | Type | Notes |
|-------|------|-------|
| `id` | Number | PK |
| `courseCode` | String | FK → Course.courseCode |
| `action` | Enum | `CREATE` / `UPDATE` / `STATUS_CHANGE` / `DELETE` |
| `fieldName` | String | Changed field (nullable for CREATE/DELETE) |
| `oldValue` | Text | Previous value |
| `newValue` | Text | New value |
| `operatedBy` | Number | User ID who performed the action |
| `operateTime` | DateTime | Auto-set |
| `source` | Enum | `ADMIN` / `API` / `IMPORT` |

---

## 5. API Endpoints (Design)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/courses | JWT+Role | Create course |
| GET | /api/v1/courses | JWT+Role | List courses (paginated, filterable) |
| GET | /api/v1/courses/:code | JWT+Role | Get course by courseCode |
| PUT | /api/v1/courses/:code | JWT+Role | Update course (field-level audit) |
| PATCH | /api/v1/courses/:code/status | JWT+Role | Change course status |
| DELETE | /api/v1/courses/:code | JWT+Role | Soft delete (DRAFT only) |

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Course code. See also: [TeachingRules.md](./TeachingRules.md), [ClassRules.md](./ClassRules.md), [LessonRules.md](./LessonRules.md).*
