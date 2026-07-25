# 数据权限设计

## 设计时间
2026-07-25

## 设计目标
建立基于角色的数据隔离机制，确保每个角色只能访问其权限范围内的数据。数据权限在 Service 层执行，Guard 层之上的最后一道防线。

## 数据范围层级

```
全平台 ── SUPER_ADMIN
  └── 机构级 ── ADMIN (organizationId)
        ├── 教师个人 ── TEACHER (teacherId = currentUser.id)
        ├── 学生个人 ── STUDENT (studentId = currentUser.id)
        └── 家长绑定的孩子 ── PARENT (parent → linked student)
```

## 各角色的 Data Scope 规则

### SUPER_ADMIN
- 范围：无限制，可访问所有数据
- 过滤条件：无
- 适用场景：系统运维、全局统计、平台级操作

### ADMIN
- 范围：机构级隔离
- 过滤条件：`organizationId = currentUser.organizationId`
- 说明：需要 User 实体增加 `organizationId` 字段，或通过校区归属推断机构
- 适用场景：机构管理、查看本机构所有师生数据

### TEACHER
- 范围：教师个人数据（自己授课相关的数据）
- 过滤条件：`teacherId = currentUser.id`
- 影响实体：
  - Lesson（课时）：`teacherId = currentUser.id`
  - Class（班级）：通过 TeacherAssignment 关联，`teacherId = currentUser.id`
  - Attendance（考勤）：通过 Lesson 关联，`lesson.teacherId = currentUser.id`
  - Student（学生）：仅查看自己班级的学生
  - Contract（合同）：仅查看关联到自己班级学生的合同
- 例外：公共查询（如获取自己基本信息）无需过滤

### STUDENT
- 范围：学生个人数据
- 过滤条件：`studentId = currentUser.id`
- 影响实体：
  - Lesson（课时）：可通过 Enrollment/StudentLesson 关联，`studentId = currentUser.id`
  - Attendance（考勤）：`studentId = currentUser.id`
  - Contract（合同）：`studentId = currentUser.id`
- 说明：Student 对应的 User 实体需与 Student 表中的学生记录建立映射关系
- 例外：可查看班级基本信息和课程信息（只读）

### PARENT
- 范围：绑定孩子的数据
- 过滤条件：`studentId IN (当前家长绑定的孩子的 ID 列表)`
- 影响实体：
  - Lesson（课时）：`studentId IN (childIds)`
  - Attendance（考勤）：`studentId IN (childIds)`
  - Contract（合同）：`studentId IN (childIds)`
- 说明：需建立家长-学生绑定关系表（parent_student 或类似）

## 当前数据模型字段分析

### 需要支持 Data Scope 的字段
| 实体 | 当前归属字段 | 状态 |
|------|-------------|------|
| User | role（角色）、campusId（校区） | 已有 |
| Student | — | 需确认 |
| Lesson | teacherId | 已有（需确认） |
| Attendance | — | 需确认 |
| Contract | — | 需确认 |
| Class | — | 需确认 |
| Enrollment | — | 需确认 |

### 缺失的关联关系
1. **User ↔ Student 映射**：需要将 Student 实体关联到 User 实体（userId 外键）
2. **User ↔ Teacher 映射**：需要将 Teacher 关联到 User（可能已有）
3. **Parent ↔ Student 绑定**：需要创建独立的关系表
4. **User.organizationId**：需要将机构归属从校区间接推断改为直接字段

## 实现方案

### 方案：Service 层 Data Scope Filter

在每个 Service 的查询方法中添加数据范围过滤，推荐使用 Repository 的 QueryBuilder 动态拼接 WHERE 条件。

```typescript
// data-scope.interface.ts
export interface DataScopeFilter {
  teacherId?: number;    // Teacher 模式
  studentId?: number;    // Student 模式
  studentIds?: number[]; // Parent 模式
  organizationId?: number; // Admin 模式
}

// data-scope.service.ts（抽象公共逻辑）
export class DataScopeService {
  buildScopeFilter(user: User): DataScopeFilter {
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        return {}; // 无限制
      case UserRole.ADMIN:
        return { organizationId: user.organizationId };
      case UserRole.TEACHER:
        return { teacherId: user.id };
      case UserRole.STUDENT:
        return { studentId: user.id };
      case UserRole.PARENT:
        return { studentIds: this.getLinkedStudentIds(user.id) };
      default:
        return {};
    }
  }
}
```

### 各 Service 集成示例

```typescript
// lesson.service.ts
async findAll(user: User, query: PaginationDto) {
  const scope = this.dataScopeService.buildScopeFilter(user);
  const qb = this.lessonRepository.createQueryBuilder('lesson');

  if (scope.teacherId) {
    qb.andWhere('lesson.teacherId = :teacherId', { teacherId: scope.teacherId });
  }
  if (scope.studentId) {
    qb.innerJoin('enrollment', 'e', 'e.lessonId = lesson.id')
      .andWhere('e.studentId = :studentId', { studentId: scope.studentId });
  }
  if (scope.studentIds?.length) {
    qb.innerJoin('enrollment', 'e', 'e.lessonId = lesson.id')
      .andWhere('e.studentId IN (:...studentIds)', { studentIds: scope.studentIds });
  }
  if (scope.organizationId) {
    qb.andWhere('lesson.organizationId = :orgId', { orgId: scope.organizationId });
  }

  // ... pagination & execute
}
```

### 应对策略：跳过数据权限的场景

某些场景需要跳过数据权限过滤：
1. **授权接口**：如 ADMIN 给教师分配班级时，ADMIN 的写入操作需要跨数据范围
2. **系统内部调用**：定时任务、后台作业应使用 SUPER_ADMIN 上下文
3. **公共查询**：如获取课程列表（学生只看基本信息）

建议：提供 `@BypassDataScope()` 装饰器或 `DataScopeService.runAs(user, callback)` 模式。

## 影响范围

| 模块 | 影响 Service | 改造工作量 |
|------|-------------|-----------|
| Lesson | lesson.service.ts | 中 |
| Attendance | lesson-attendance.service.ts | 中 |
| Class | class.service.ts | 中 |
| Student | student.service.ts | 中 |
| Contract | contract.service.ts | 低 |
| Enrollment | enrollment.service.ts | 低 |
| Course | course.service.ts | 低（只读数据） |
| Reminder | reminder.service.ts | 低 |
| Analytics | analytics.service.ts | 高（聚合查询需特殊处理） |

## 实施建议

### 分阶段推进
1. **Phase 1**：实现 DataScopeService 基础框架和过滤器逻辑
2. **Phase 2**：Lesson + Attendance 模块接入（最核心业务）
3. **Phase 3**：Student + Class + Contract 模块接入
4. **Phase 4**：Analytics 聚合查询改造
5. **Phase 5**：编写集成测试验证各角色的数据隔离

### 验证用例
| 用例 | 角色 | 预期结果 |
|------|------|---------|
| Teacher 查课时列表 | TEACHER | 只看到 teacherId=self 的课时 |
| Student 查自己的课时 | STUDENT | 只看到 enrollments 中包含自己的课时 |
| Parent 查孩子课时 | PARENT | 只看到孩子们 enrolled 的课时 |
| Admin 查全部课时 | ADMIN | 看到本机构所有课时 |
| Teacher 查班级学生 | TEACHER | 只看到自己教的班级 |
| Student 查合同 | STUDENT | 只看到自己的合同 |
