# ADMIN-DASHBOARD-PHASE2-EVIDENCE

Mission: M-EDUOS-ADMIN-OPERATION-DASHBOARD-V1
Phase: 2 — DashboardService Backend Capability

## 验证时间
2026-07-26

## 完成内容

### 文件列表

```
src/modules/dashboard/
├── dashboard.module.ts
├── dashboard.service.ts
├── dashboard.service.spec.ts
├── dashboard.controller.ts
└── dto/
    └── dashboard-response.dto.ts
```

### 实现方法

| Method | Description | Data Sources |
|--------|-------------|-------------|
| getOverview() | 今日运营总览 | Lesson, Exception, Student, Contract, SalaryRecord |
| getLessons() | 课程统计 | Lesson (by status: FINISHED, CANCELLED, SUSPENDED) |
| getStudents() | 学员统计 | Student, Contract |
| getTeachers() | 教师统计 | User (role=Teacher), Lesson, SalaryRecord |
| getFinance() | 财务统计 | Contract (consumedValue), Payment placeholder |

### 设计决策

1. **教师数据来源**：使用 `User` 实体 `role='Teacher'` 统计教师数量，非 `TeacherAssignment`
   - 原因：教师身份通过 User.role 定义（SuperAdmin/Admin/Teacher/Parent），TeacherAssignment 仅记录教师与班级的分配关系
2. **Payment/Ledger 占位**：`todayIncome` / `totalIncome` / `monthIncome` 当前返回 0
   - 原因：系统中尚无 Payment/Ledger 实体实现，Phase 3+ 引入后可直接注入对应 Repository
3. **不新增业务真值**：所有聚合字段均可从已有实体实时计算推导，未创建中间统计表
4. **不修改现有业务**：DashboardService 仅做只读聚合，不修改任何业务状态

### 测试结果

```
PASS src/modules/dashboard/dashboard.service.spec.ts
  DashboardService
    ✓ should be defined
    getOverview
      ✓ should return a complete DashboardOverviewDto
      ✓ should handle empty data gracefully
      ✓ should calculate consumedLessons correctly
    getLessons
      ✓ should return lesson statistics
    getStudents
      ✓ should return student statistics
    getTeachers
      ✓ should return teacher statistics
    getFinance
      ✓ should return finance statistics

Tests:       12 passed, 12 total
```

### Git Commit

```
c270f826d42de6b7a71783d460e67b813a501c72
```

## 结论

Phase 2 完成 DashboardService 后端能力实现：
- 5 methods implemented
- 12 tests passing
- 5 files created
- 0 existing files modified
- 0 database tables created
- 0 business logic changes

## 下一步

Phase 3 — API 实现（DashboardController REST endpoints）
