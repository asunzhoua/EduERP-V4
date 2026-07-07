# Student Domain — Business Rules

> **Domain**: Student
> **Sprint**: 3
> **Version**: v0.1.0
> **Last Updated**: 2026-07-07
> **Author**: Chief Architect

---

## 1. Core Entity: Student

### 1.1 Student Unique Identifier

Every student MUST have a system-generated unique identifier:

```
Format: STYYYYMMNNNN
- ST: prefix (Student)
- YYYY: admission year
- MM: admission month
- NNNN: sequential number (zero-padded, 4 digits)
```

Examples:
- `ST2026070001` — first student admitted in July 2026
- `ST2026070002` — second student admitted in July 2026

**Rules:**
- StudentCode is **immutable** after creation
- StudentCode is the **primary business reference** for all cross-module operations
- Database auto-increment ID is for internal use only — all external references MUST use StudentCode

### 1.2 Required Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| studentCode | String | ✅ | Auto-generated, immutable |
| name | String | ✅ | Real name |
| gender | Enum | ✅ | Male / Female |
| birthDate | Date | ✅ | |
| school | String | ❌ | School name |
| grade | String | ❌ | e.g., Grade 1, Grade 2 |
| phone | String | ❌ | Contact number |
| note | Text | ❌ | Free-text remarks |
| tags | JSON/String[] | ❌ | Student tags (see Section 4) |
| status | Enum | ✅ | See Section 2 |

### 1.3 Soft Delete

Students MUST NOT be hard-deleted. When a student is "removed":
- Set `deleted = true`
- Keep all historical data intact
- StudentCode remains reserved (never recycled)
- UI should filter out deleted students by default but allow admin to view them

---

## 2. Student Status Lifecycle

### 2.1 Status Definitions

```
Active     → Student is currently enrolled and attending classes
Paused     → Student has temporarily stopped (can resume later)
Graduated  → Student has completed the program
Inactive   → Student has been withdrawn or discontinued
```

### 2.2 State Transitions

```
                     ┌─────────────┐
                     │   Active    │
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌─────────┐  ┌──────────┐  ┌───────────┐
        │ Paused  │  │Graduated │  │ Inactive  │
        └────┬────┘  └──────────┘  └─────┬─────┘
             │                            │
             └──────────┬─────────────────┘
                        ▼
                  ┌─────────────┐
                  │   Active    │
                  └─────────────┘
```

**Allowed transitions:**
- Active → Paused (temporary stop)
- Active → Graduated (completed program)
- Active → Inactive (withdrawn)
- Paused → Active (resume)
- Inactive → Active (recover)
- Graduated → (terminal state, no further transitions)

### 2.3 Status Change Record

Every status change MUST be logged with:
- Previous status
- New status
- Changed by (userId)
- Changed at (timestamp)
- Reason (optional)

---

## 3. Parent-Student Relationship

### 3.1 Relationship Model

Many-to-many relationship between Parent and Student:

- **One parent can have multiple students** (e.g., siblings in the same school)
- **One student can have multiple parents** (e.g., both father and mother)

### 3.2 Parent Entity

A "Parent" in the system is a User with role `Parent`. Key rules:
- Parent MUST have at least one linked student to be active
- Parent can be linked to students across different campuses
- Parent sees only their linked students' data

### 3.3 Relationship Fields

| Field | Required | Notes |
|-------|----------|-------|
| parentId | ✅ | FK → User.id (role = Parent) |
| studentId | ✅ | FK → Student.id |
| relation | ✅ | 父亲 / 母亲 / 祖父 / 祖母 / 监护人 / Other |
| isPrimary | ❌ | Default false; primary contact for school communications |

---

## 4. Student Tags

### 4.1 Purpose

Tags provide flexible categorization without structural changes. Used for:
- Marketing targeting (e.g., "新生", "续费目标")
- Academic grouping (e.g., "竞赛班", "毕业班")
- Attention flags (e.g., "重点关注")

### 4.2 Implementation Rules

- Tags are **free-text strings** (no fixed tag taxonomy)
- Tags are stored as a JSON array on the Student entity
- Maximum 10 tags per student
- Maximum 20 characters per tag
- Tags are NOT hierarchical (no parent-child tag relationships)

### 4.3 Common Tag Examples

```
新生          — New enrollment
续费目标      — Renewal target
重点关注      — Needs special attention
竞赛班        — Competition class
毕业班        — Graduating class
VIP           — VIP student
试听          — Trial student
```

---

## 5. Batch Import

### 5.1 Supported Formats

Only `.xlsx` and `.csv` files are supported.

**Prohibited formats:**
- ❌ PDF
- ❌ Word (.doc/.docx)
- ❌ Images (.jpg/.png/.bmp)
- ❌ Any other non-tabular format

### 5.2 Import Template Requirements

The import file MUST contain these headers (case-insensitive):

```
name, gender, birthDate, school, grade, phone, note, tags
```

Optional headers (if omitted, field is left empty):
```
school, grade, phone, note, tags
```

### 5.3 Import Validation Rules

| Rule | Action |
|------|--------|
| Row has empty name | Skip row, log error |
| Invalid gender (not Male/Female/男/女) | Skip row, log error |
| Invalid birthDate format | Skip row, log error |
| Duplicate phone with existing student | Skip row, log warning |
| File exceeds 5000 rows | Reject entire file |

### 5.4 Import Process

1. Upload file → Validate format
2. Parse rows → Validate each row
3. Generate StudentCode for each valid row
4. Insert valid students → Return success count
5. Return error report for skipped rows
6. All-or-nothing per row (valid rows are inserted even if some rows fail)

### 5.5 Import Audit

Every import operation MUST be logged:
- Imported by (userId)
- Imported at (timestamp)
- Filename
- Total rows / Success / Failure counts
- Error details

---

## 6. API Design Constraints

### 6.1 Student Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/students | JWT+Role | Create student |
| GET | /api/v1/students | JWT+Role | List students (paginated, filterable) |
| GET | /api/v1/students/:code | JWT+Role | Get student by StudentCode |
| PATCH | /api/v1/students/:code | JWT+Role | Update student |
| PATCH | /api/v1/students/:code/status | JWT+Role | Change student status |
| DELETE | /api/v1/students/:code | JWT+Role | Soft delete student |
| POST | /api/v1/students/import | JWT+Role | Batch import from Excel/CSV |

### 6.2 Parent-Student Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/student-parents | JWT+Role | Link parent to student |
| DELETE | /api/v1/student-parents | JWT+Role | Unlink parent from student |
| GET | /api/v1/students/:code/parents | JWT+Role | Get student's parents |
| GET | /api/v1/parents/:userId/students | JWT+Role | Get parent's students |

### 6.3 Permission Mapping

| Permission Code | Required For |
|-----------------|-------------|
| student:read | GET endpoints |
| student:create | POST endpoints (create, import) |
| student:update | PATCH endpoints, DELETE |

---

## 7. Data Integrity Rules

- StudentCode is **globally unique** across the entire system
- StudentCode is **never recycled** — even after soft delete
- A student MUST have at least one parent link before becoming Active
- A parent MUST have at least one student link to be considered "active parent"
- Deleting a student (soft) SHOULD NOT cascade-delete linked parents

---

## 8. Cross-Module References

When other domains reference Student:
- Always use **StudentCode** as the reference (never internal DB ID)
- Student status MUST be checked before lesson operations (cannot schedule lessons for Inactive students)
- Student tags MAY be used for marketing segmentation (future)

---

*This document is part of the EduOS Business Rules series. It must be read before implementing any Student Domain code.*
