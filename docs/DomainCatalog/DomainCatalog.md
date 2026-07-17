# EduOS Domain Catalog

> **Version**: v0.1.0
> **Last Updated**: 2026-07-07
> **Purpose**: Every developer's first reference. Know which domain owns what, before writing any code.

---

## How to Read This

```
Domain Name
  Responsibility: What this domain does
  Owns:          Tables this domain manages (CRUD authority)
  Depends On:    Domains this domain needs data from (via EventBus, never direct DB)
  Emits:         Events this domain publishes
```

---

## Identity

| | |
|---|---|
| **Responsibility** | 登录认证、权限管理、角色分配 |
| **Owns** | `user`, `role`, `permission`, `user_role`, `role_permission`, `login_log` |
| **Depends On** | — (foundation domain) |
| **Emits** | *(none yet — future: `user.login`, `user.logout`)* |
| **Status** | ✅ v0.2.0 (Frozen) |

---

## Student

| | |
|---|---|
| **Responsibility** | 学生档案、家长关联、标签管理 |
| **Owns** | `student`, `student_parent`, `student_audit_log`, `import_history` |
| **Depends On** | Identity (admin users who operate student data) |
| **Emits** | *(none yet — future: `student.status.changed`, `student.created`)* |
| **Status** | ✅ v0.3.0 (Frozen) |

---

## Teaching

| | |
|---|---|
| **Responsibility** | 课程定义、班级管理、课时安排、课时合同、教师分配、学生报名 |
| **Owns** | `course`, `class`, `teacher_assignment`, `contract`, `enrollment`, `lesson`, `lesson_attendance`, `lesson_change_request`, `course_audit_log`, `class_audit_log`, `contract_audit_log`, `lesson_audit_log` |
| **Depends On** | Student (student profiles), Identity (teachers, admin users) |
| **Emits** | `lesson.completed`, `lesson.finished` |
| **Status** | 🔧 Sprint 4 (In Progress — Design Frozen) |

---

## Attendance *(Planned — Sprint 5)*

| | |
|---|---|
| **Responsibility** | 考勤统计、出勤率分析 |
| **Owns** | *(to be determined)* |
| **Depends On** | Teaching (LessonCompleted events) |
| **Emits** | *(future: `attendance.anomaly`, `attendance.summary`)* |
| **Status** | ⬜ Not Started |

---

## Finance *(Planned — Sprint 6)*

| | |
|---|---|
| **Responsibility** | 课时扣费、教师工资、财务报表 |
| **Owns** | *(to be determined)* |
| **Depends On** | Teaching (LessonFinished events), Student (student contracts) |
| **Emits** | *(future: `contract.deducted`, `salary.calculated`)* |
| **Status** | ⬜ Not Started |

---

## Points *(Planned)*

| | |
|---|---|
| **Responsibility** | 学生积分管理、积分兑换 |
| **Owns** | *(to be determined)* |
| **Depends On** | Teaching (LessonFinished events), Student (student identity) |
| **Emits** | *(future: `points.awarded`, `points.redeemed`)* |
| **Status** | ⬜ Not Started |

---

## Notification *(Planned)*

| | |
|---|---|
| **Responsibility** | 消息推送（微信、短信、App） |
| **Owns** | *(to be determined)* |
| **Depends On** | Teaching, Finance, Points (reacts to various events) |
| **Emits** | *(none — terminal domain)* |
| **Status** | ⬜ Not Started |

---

## Dashboard *(Planned)*

| | |
|---|---|
| **Responsibility** | 经营数据看板、统计报表 |
| **Owns** | *(none — read-only, reads from all domains)* |
| **Depends On** | All domains |
| **Emits** | *(none — read-only domain)* |
| **Status** | ⬜ Not Started |

---

## System *(Planned)*

| | |
|---|---|
| **Responsibility** | 系统配置、规则中心、日志归档 |
| **Owns** | *(to be determined — Rule Center, Config)* |
| **Depends On** | Identity (admin access) |
| **Emits** | *(future: `rule.updated`, `config.changed`)* |
| **Status** | ⬜ Not Started |

---

## Domain Dependency Graph

```
                   ┌──────────┐
                   │ Identity │  (Foundation)
                   └────┬─────┘
                        │
                   ┌────▼─────┐
                   │  Student │
                   └────┬─────┘
                        │
                   ┌────▼──────┐
                   │ Teaching  │  ◄── You are here (Sprint 4)
                   └────┬──────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │Finance   │  │ Points   │  │Attendanc │
   └──────────┘  └──────────┘  └──────────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                 ┌──────────────┐
                 │ Notification │
                 └──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  Dashboard   │  (Read-only)
                 └──────────────┘
```

---

*This is a living document. Update it whenever a new domain is added or an existing domain's boundaries change.*
