# EduERP V4 — Entity Relationship Diagram

> 版本：v4.0
> 状态：架构冻结
> 最后更新：2026-08-07

> **说明**：本文档为从领域层文档合成的**概要初稿**（非逐字段 ERD）。字段级权威定义见领域模型文档（字段名 snake_case）：
> - 教学域：`docs/DomainModel/TeachingDomainModel.md`、`docs/DomainModel/AttendanceDomainModel.md`
> - 表归属与域边界：`docs/DomainCatalog/DomainCatalog.md`
> - 状态机：`docs/StateMachine/StateMachineCatalog.md`

---

## 实体清单（按域）

| 域 | 实体表 | 字段权威文档 |
|----|--------|--------------|
| Identity | `user`, `role`, `permission`, `user_role`, `role_permission`, `login_log` | DomainCatalog §Identity |
| Student | `student`, `student_parent`, `student_audit_log`, `import_history` | DomainCatalog §Student |
| Teaching | `course`, `class`, `teacher_assignment`, `contract`, `enrollment`, `lesson`, `lesson_attendance`, `lesson_change_request`，`course_audit_log`, `class_audit_log`, `contract_audit_log`, `lesson_audit_log` | TeachingDomainModel / AttendanceDomainModel |

## 核心关系（概要）

```
Course (1) ──< Class (1) ──< Lesson (1) ──< LessonAttendance
                              │ 1 ──< LessonChangeRequest
Class (1) ──< Enrollment (1) ──< Contract
User (1) ──< TeacherAssignment
Student (1) ──< StudentParent
```

> 注：Finance / Points / Notification / Dashboard 为规划域（Sprint 6+），其表归属见 DomainCatalog。
