# 权限现状审计报告

## 审计时间
2026-07-25

## 1. JWT 结构
- 实现: passport-jwt Strategy（标准 JWT Bearer Token 方案）
- JwtAuthGuard 全局注册为 APP_GUARD（在 app.module.ts）
- Payload 字段: sub(userId), username, role, name
- 过期时间: accessToken 2h（代码硬编码）, config 层配置默认 7d（JWT_EXPIRES_IN）
- Refresh Token: UUID v4 存数据库, 7 天过期
- Secret: dev-jwt-secret-do-not-use-in-production（生产环境强制要求配置）

## 2. RBAC 实现
- RolesGuard: 存在（src/common/guards/roles.guard.ts），按字符串比较 user.role 是否在 requiredRoles 中
- @Roles 装饰器: 存在（src/common/decorators/roles.decorator.ts）
- RolesGuard 注册方式: 非全局，需在各 Controller 通过 @UseGuards(JwtAuthGuard, RolesGuard) 手动加入
- 当前角色枚举（UserRole，在 user.entity.ts 中定义）:
  - SUPER_ADMIN = 'SuperAdmin'
  - ADMIN = 'Admin'
  - TEACHER = 'Teacher'
  - PARENT = 'Parent'
- UserRole 枚举缺失角色: Student（但多个 Controller 使用了 @Roles('Student')）
- Role 实体（role.entity.ts）和 UserRole 中间表（user-role.entity.ts）存在但未被实际用于权限校验
- Permission 实体（permission.entity.ts）和 RolePermission 中间表存在但未被使用

## 3. Controller 覆盖
- 总 Controller 数: 13
- 已声明 @Roles 的 Controller: 12（analytics, reminder, student, class, contract, course, enrollment, lesson, lesson-attendance, lesson-change-request, teacher-assignment, teacher-dashboard）
- 未声明 @Roles 的 Controller: 1（auth.controller.ts — 合理，auth 用 @Public 和 JwtAuthGuard 自洽）
- 覆盖率: 12/13 = 92.3%

## 4. 数据隔离
- 当前数据归属过滤: 不存在系统级方案
- analytics.controller.ts 有手工实现的 verifyStudentAccess / verifyTeacherAccess 方法做数据归属校验（仅覆盖 analytics 模块）
- teacherId 过滤: 大部分 Controller 的查询 API 不按 teacherId 过滤，Teacher 角色可看到所有数据
- parentId 过滤: 仅 StudentController 的 getSelf* 系列通过 userId→studentCode 做了归属过滤
- organizationId/campusId 过滤: 完全不存在
- User 实体有 campusId 字段，但未被用于数据隔离

## 5. 发现的缺口

### 缺口 1: UserRole 枚举缺少 Student 角色
- Severity: P1
- 位置: src/modules/identity/entities/user.entity.ts:13（UserRole 枚举）
- 影响: student.controller.ts 等大量 Controller 使用 @Roles('Student')，但枚举中没有 Student 定义。TypeScript 编译期无检查，运行期依赖字符串值。Student 角色用户无法通过枚举正确映射

### 缺口 2: RolesGuard 非全局注册，存在遗漏风险
- Severity: P2
- 位置: src/app.module.ts（APP_GUARD 仅注册 JwtAuthGuard，未注册 RolesGuard）
- 影响: 如果新 Controller 忘记在 @UseGuards 中加入 RolesGuard，则 @Roles 装饰器不生效，方法将允许所有已认证用户访问

### 缺口 3: 数据隔离（数据归属）系统性缺失
- Severity: P0
- 位置: 全局（Controller/Service 层普遍缺少数据归属过滤）
- 影响:
  - Teacher 登录后可搜索查看所有学生数据（student.service.ts findAll）
  - Teacher 可查看所有班级/课程/课次数据
  - 缺少 campusId/organizationId 的多租户隔离
  - 仅 analytics.controller.ts 有手工数据归属校验

### 缺口 4: JWT 过期时间配置矛盾
- Severity: P2
- 位置: auth.service.ts:45（硬编码 '2h'）vs configuration.ts jwt.expiresIn = '7d'
- 影响: 配置中心定义的 expiresIn 未被使用，auth.service.ts 写死了 2h。refresh token 有效期 7d 但 access token 仅 2h 可能过于激进

### 缺口 5: Role/RBAC 体系存在两种实现但均不完整
- Severity: P1
- 位置: user.entity.ts（字符串 role 字段）、role.entity.ts（多对多 Role 表）、user-role.entity.ts（中间表）
- 影响: 数据库中有 role 表和 user_role 中间表，但权限校验只用了 user.role 字符串字段。Role-Permission 的细粒度权限模型未接入

### 缺口 6: @Roles 使用字符串字面量，无枚举约束
- Severity: P2
- 位置: 所有 Controller 中的 @Roles 调用
- 影响: 'Student' 未在 enum 中定义但被使用，类似字符串拼写错误（如 'Superadmin' vs 'SuperAdmin'）无编译期保护

### 缺口 7: Auth Controller 缺少角色保护
- Severity: P3
- 位置: auth.controller.ts logout() 和 getProfile()
- 影响: logout 和 getProfile 仅有 JwtAuthGuard 保护，无角色限制，任意登录用户可调用（风险较低，但不符合全局守卫一致性）

## 结论
- 当前成熟度: 4/10
- 主要风险: 数据隔离缺失（P0）、Student 角色枚举缺失（P1）、RBAC 双体系未整合（P1）、RolesGuard 非全局化（P2）
- 建议优先级:
  1. P0: 实现数据归属过滤层（Service 层按角色/scope 过滤查询结果）
  2. P0: 新增 organizationId/campusId 级数据隔离
  3. P1: 修复 UserRole 枚举，补充 Student 角色
  4. P1: 整合 Role 表多对多关系，废弃 user.role 字符串字段
  5. P1: 废弃 Permission/RolePermission 等未使用实体或真正接入
  6. P2: 将 RolesGuard 注册为全局 APP_GUARD 或统一基础 Controller 类
  7. P2: 引入角色字符串常量/枚举约束 @Roles 入参类型
