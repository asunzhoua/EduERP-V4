# 角色模型设计

## 设计时间
2026-07-25

## 审计基础（Phase 1 发现）

### 当前 UserRole 枚举（user.entity.ts）
```
SUPER_ADMIN = 'SuperAdmin'
ADMIN = 'Admin'
TEACHER = 'Teacher'
PARENT = 'Parent'
```

### 已发现的问题
1. STUDENT 角色缺失 — 枚举中不存在，但 13 个 Controller 已在 @Roles() 装饰器中引用 'Student' 字符串
2. 角色值为 PascalCase 字符串（'Admin'），与角色键名不一致
3. 无统一角色导入路径，各文件直接写字符串

### 代码中存在 'Student' 引用的文件
- analytics.controller.ts
- reminder.controller.ts
- student.controller.ts
- class.controller.ts
- contract.controller.ts
- enrollment.controller.ts
- lesson.controller.ts
- lesson-attendance.controller.ts

## 目标角色枚举

```typescript
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
}
```

### 枚举值变更影响
| 当前值 | 目标值 | 影响范围 |
|--------|--------|----------|
| 'SuperAdmin' | 'SUPER_ADMIN' | 需更新 DB 存量数据 |
| 'Admin' | 'ADMIN' | 需更新 DB 存量数据 |
| 'Teacher' | 'TEACHER' | 需更新 DB 存量数据 |
| 'Parent' | 'PARENT' | 需更新 DB 存量数据 |
| 不存在 | 'STUDENT' | 新增，无存量数据 |

## 各角色权限范围

### SUPER_ADMIN — 系统级超级管理员
- 管理所有机构
- 管理所有管理员账号
- 查看全平台数据
- 系统配置变更
- 数据导出与备份

### ADMIN — 机构级管理者
- 管理本机构下的教师、学生、家长
- 管理本机构课程、班级、课时
- 查看本机构全部数据
- 工资规则设置
- 本机构数据导出

### TEACHER — 教师
- 查看自己的排课、课时
- 查看自己授课班级的学生信息
- 登记课时、记录考勤
- 查看自己的工资单
- 不可查看其他教师的数据
- 不可查看机构财务/管理数据

### STUDENT — 学生
- 查看自己的课表
- 查看自己的课时记录
- 查看自己的合同/报名信息
- 不可查看其他学生的数据

### PARENT — 家长
- 查看绑定孩子的课表
- 查看绑定孩子的课时记录
- 查看绑定孩子的合同
- 不可查看其他孩子/学生的数据

## 角色间关系约束

```
SUPER_ADMIN
  └── ADMIN（由 SUPER_ADMIN 管理）
        ├── TEACHER（由 ADMIN 管理，归属机构）
        ├── STUDENT（由 ADMIN/TEACHER 管理，归属机构）
        └── PARENT（由 ADMIN 管理，与 STUDENT 绑定）
```

### 约束规则
1. SUPER_ADMIN 不能由任何角色创建，只能通过 Seed/系统初始化
2. ADMIN 只能由 SUPER_ADMIN 创建
3. TEACHER/STUDENT/PARENT 只能由 ADMIN（或 SUPER_ADMIN）创建
4. STUDENT 与 PARENT 存在多对多绑定关系（一个学生可绑定多个家长，一个家长可绑定多个孩子）
5. 角色升级（如 TEACHER→ADMIN）需 SUPER_ADMIN 审批

## 权限矩阵

### 功能权限
| 功能模块 | SUPER_ADMIN | ADMIN | TEACHER | STUDENT | PARENT |
|----------|:-----------:|:-----:|:-------:|:-------:|:------:|
| 教师管理（增删改） | ✅ | ✅ | ❌ | ❌ | ❌ |
| 学生管理（增删改） | ✅ | ✅ | ✅（查看） | ❌ | ❌ |
| 课程管理 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 班级管理 | ✅ | ✅ | ✅（查看） | ❌ | ❌ |
| 排课管理 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 课时登记 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 考勤管理 | ✅ | ✅ | ✅（自己的课） | ❌ | ❌ |
| 合同管理 | ✅ | ✅ | ✅（查看关联） | ✅（查看自己） | ✅（查看绑定孩子） |
| 工资管理 | ✅ | ✅ | ✅（查看自己） | ❌ | ❌ |
| 数据导出 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 系统配置 | ✅ | ❌ | ❌ | ❌ | ❌ |

### 数据访问权限
| 数据范围 | SUPER_ADMIN | ADMIN | TEACHER | STUDENT | PARENT |
|----------|:-----------:|:-----:|:-------:|:-------:|:------:|
| 全平台 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 本机构 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 本人/所教数据 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 本人学习数据 | ✅ | ✅ | ❌ | ✅ | ❌ |
| 绑定孩子数据 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 自己基本信息 | ✅ | ✅ | ✅ | ✅ | ✅ |

## 实施计划

### Phase 4：代码实现
1. 更新 UserRole 枚举，添加 STUDENT，统一值格式为 UPPER_CASE
2. 更新 RolesGuard 支持枚举（可选：兼容字符串）
3. 统一所有 Controller 的 @Roles() 使用枚举而非字符串
4. 创建数据迁移 Migration

### Phase 5：数据迁移
1. 将存量数据中 old role 值（'SuperAdmin'/'Admin'/'Teacher'/'Parent'）转换为新值（'SUPER_ADMIN'/'ADMIN'/'TEACHER'/'PARENT'）
2. 补充 STUDENT 相关 Seed 数据

### Phase 6：验证
1. 角色 CRUD 权限测试
2. 数据隔离测试
3. 边界场景测试
