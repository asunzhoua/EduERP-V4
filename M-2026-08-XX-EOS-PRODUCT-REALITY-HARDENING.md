# Mission: M-2026-08-XX-EOS-PRODUCT-REALITY-HARDENING

## Mission Type

Long Running Product Completion Mission

## Runtime

12-24 hours

## Objective

基于当前 EduERP-V4 已完成能力，持续推进系统从代码完成状态进入真实业务可运行状态。

本 Mission 不重复执行已关闭验证。

重点：

1. 补齐真实业务数据链
2. 完善 MiniApp 用户流程
3. 清理产品化缺口
4. 提升系统真实使用完整度

---

# Current Confirmed State

## Backend

Confirmed:

- NestJS backend stable
- 935 tests / 75 suites PASS
- P1 enrichment completed
- Commit: 5bd1802

## MiniApp

Confirmed:

Phase 4 Business Flow Closure completed。

已具备：

- 登录
- 教师流程
- 学生流程
- API 对接
- Dashboard
- Course
- Class
- Student
- Lesson Record

---

# Known Data Gap

## Seed Data Reality Completion

Current:

Class references:

- ENG001
- MATH001

Missing:

- Course records
- Enrollment records
- Lesson records

Impact:

Enrichment fields return null.

Classification:

Data completeness issue.

Do not modify enrichment code unless evidence shows code defect.

---

# Execution Priority

## Priority 1 — Complete Business Seed Data

Create complete development data chain:

Student → Enrollment → Class → Course → Lesson → Attendance/Record → API Response → MiniApp Display

Requirements:

- Maintain existing data rules
- Follow existing entities
- Follow existing seed conventions
- Do not create temporary fake structures

Output: Seed completion evidence.

## Priority 2 — MiniApp Real User Flow Improvement

Improve existing pages:

Teacher: Dashboard, Course, Class, Student, Lesson Record
Student: Home, Class, Learning information

Focus:

- Real data presentation
- Empty state handling
- Error state handling
- User operation feedback

Do not add unrelated features.

## Priority 3 — API and Frontend Contract Cleanup

Review existing flows:

- Request parameters
- Response fields
- DTO consistency
- Naming consistency

Only modify when evidence shows mismatch or clear improvement exists.

## Priority 4 — Development Artifact Cleanup

Review:

- Mock fallback
- TODO
- Temporary code
- Placeholder messages
- Unused files

Rules: Do not delete without confirming usage.

---

# Decision Gate

Mandatory WAITING_DECISION when encountering:

1. Business rule ambiguity (date calculation rules, status definition, ownership rules)
2. Architecture choice (entity change, DTO strategy, API contract change)
3. Data model change

Process: Finding → Decision Required → Owner Choice → Execution

No autonomous decision.

---

# Evidence Requirements

Each completed item records:

- File changes
- Reason
- Related capability
- Test impact
- Runtime impact

---

# Forbidden Actions

禁止：

- 重复执行已关闭验证
- 重开已完成 P1
- 根据历史错误判断当前状态
- 无决策修改业务规则
- 为通过测试修改测试

---

# Final Report

Generate: EOS-PRODUCT-REALITY-HARDENING-REPORT.md

Include: Completed, Changed Files, Business Impact, Evidence, Remaining Issues, Decision Required

---

# Mission Flow

CREATED → RUNNING → WAITING_DECISION (if needed) → COMPLETED
