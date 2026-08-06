# Account Management Design

**Mission**: M-EDUOS-ACCOUNT-MANAGEMENT-DESIGN-V1  
**Date**: 2026-07-27  
**Status**: FINAL  

---

## 1. 核心原则

| 原则 | 说明 |
|------|------|
| 不开放注册 | 系统不提供任何公开注册入口，所有账号由管理员创建 |
| 角色隔离 | 不同角色（SuperAdmin/Admin/Teacher/Parent/Student）权限严格分离 |
| 密码加密 | 所有密码使用 bcrypt 存储，不存明文 |
| 审计日志 | 所有用户创建、修改操作记录登录日志 |

---

## 2. 管理员创建账户流程

### 2.1 流程图

```
SuperAdmin/Admin 登录
       │
       ▼
  进入用户管理页面
       │
       ▼
  点击「创建用户」
       │
       ▼
  ┌─────────────────────────────┐
  │ 填写用户信息                 │
  │ - 用户名（唯一）             │
  │ - 密码（自动生成或手动输入）  │
  │ - 姓名                      │
  │ - 手机号（可选）             │
  │ - 邮箱（可选）               │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ 选择角色                    │
  │ ○ Teacher                   │
  │ ○ Parent                    │
  │ ○ Student                   │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ 绑定业务关系（根据角色）      │
  │                             │
  │ Teacher:                    │
  │   - 绑定课程（course）       │
  │   - 绑定班级（class）        │
  │                             │
  │ Parent:                     │
  │   - 绑定学生（student_parent）│
  │                             │
  │ Student:                    │
  │   - 绑定学生资料（student）   │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ ✓ 角色绑定验证               │
  │ Teacher → 至少1个课程/班级   │
  │ Parent  → 至少1个学生        │
  │ Student → 已关联学生资料      │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ 生成登录凭证                 │
  │ - 密码 bcrypt 加密存储       │
  │ - 返回用户信息               │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ 通知用户首次登录             │
  │ - 方式：线下/电话/短信       │
  │ - 告知：用户名 + 初始密码    │
  │ - 建议：首次登录后修改密码    │
  └─────────────────────────────┘
```

### 2.2 数据库关系

#### User 表
```sql
-- 核心用户表
CREATE TABLE user (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,     -- bcrypt hash
  name        VARCHAR(100) NOT NULL,
  mobile      VARCHAR(20),
  role        ENUM('SuperAdmin','Admin','Teacher','Parent','Student') NOT NULL,
  status      TINYINT DEFAULT 1,         -- 1=启用, 0=禁用
  campusId    INT,
  refreshToken VARCHAR(255),
  lastLoginAt DATETIME,
  -- ... audit fields
);
```

#### 业务关联

| 角色 | 关联表 | 关联字段 |
|------|--------|---------|
| Teacher | `teacher_assignment` | `teacherId → user.id`, `classCode` |
| Parent | `student_parent` | `parentId → user.id`, `studentCode` |
| Student | `student` | `userId → user.id` |

### 2.3 API 设计

```typescript
// 创建用户请求
POST /api/v1/admin/users
Body: {
  username: string,       // 必填，唯一
  password: string,       // 必填，最少8位
  name: string,           // 必填
  mobile?: string,        // 可选
  role: 'Teacher' | 'Parent' | 'Student',  // 必填
  // 角色绑定（至少选一组）
  teacherBindings?: {
    classCodes?: string[],    // 班级编码
    courseCodes?: string[],   // 课程编码
  },
  parentBindings?: {
    studentCodes: string[],   // 至少一个学生
  },
  studentBinding?: {
    studentCode: string,      // 学生资料编码
  }
}

// 响应
Response: {
  id: number,
  username: string,
  name: string,
  role: string,
  createdAt: string,
}
```

---

## 3. SMS Policy

### 3.1 定位

短信服务定位为**辅助能力**（辅助认证手段），不作为主要认证方式。

### 3.2 允许场景

| 场景 | 说明 | 优先级 |
|------|------|--------|
| 找回密码 | 用户忘记密码时，通过短信验证码验证身份后重置 | 高 |
| 高风险操作验证 | 修改密码、删除账户等操作需要短信二次确认 | 中 |
| 可选 MFA | 管理员可启用多因素认证（密码 + 短信验证码） | 低 |

### 3.3 禁止场景

| 场景 | 原因 |
|------|------|
| ❌ 短信注册 | 违反「管理员创建账户」核心原则，会产生垃圾账号 |
| ❌ 短信登录 | 增加短信费用和通道依赖，不如密码登录安全可靠 |
| ❌ 用户创建入口 | 同上 |

### 3.4 原因总结

1. **成本控制**：每条短信都有费用，作为登录入口会产生大量不必要的费用
2. **通道依赖**：短信通道可能因运营商故障、欠费、被封等原因不可用
3. **安全考量**：短信验证码可能被拦截、劫持，不如密码安全
4. **国际兼容**：国际号码的短信发送存在兼容性和可达性问题
5. **业务流程**：教育场景中，学生和家长的关系应由管理员建立，而非自行注册

---

## 4. Authentication Strategy

### 4.1 主要认证方式

**Primary Login**: 账号 + 密码

```
[用户输入] → POST /auth/login → JWT → 小程序 Storage → 业务接口
```

### 4.2 流程说明

1. 用户在登录页输入用户名和密码
2. 调用 `POST /api/v1/auth/login`
3. 服务端验证：
   - 用户是否存在
   - 用户状态是否启用
   - 密码是否正确（bcrypt.compare）
4. 验证通过后返回 JWT Token（2小时有效期）+ Refresh Token（7天有效期）
5. 小程序存储 Token：`wx.setStorageSync('token', token)`
6. 后续请求自动携带 Token：`Authorization: Bearer {token}`

### 4.3 Token 管理

| 项目 | 实现 |
|------|------|
| 存储位置 | `wx.setStorageSync('token', token)` |
| 过期处理 | 401 响应 → `handleTokenExpired()` → 清除 Token → 跳转登录页 |
| 并发保护 | `isLoggingOut` 锁防止多个并发请求同时触发跳转 |
| 刷新机制 | `POST /auth/refresh` 已实现，使用 Refresh Token 换新 Access Token |
| Token 内容 | `{ sub: userId, username, role, name, iat, exp }` |

### 4.4 辅助认证方式

| 方式 | 状态 | 说明 |
|------|------|------|
| 微信登录 | ✅ 已实现 | `POST /auth/wechat-login`，需先绑定微信 openid |
| Refresh Token | ✅ 已实现 | 7 天有效期，无感续期 |
| SMS 验证码 | 🔜 待实现 | 仅用于找回密码和高风险操作 |

### 4.5 认证拦截器链

```
Request
  │
  ▼
JwtAuthGuard (验证 Token 有效性)
  │
  ▼
RolesGuard (验证角色权限)
  │
  ▼
@Roles('SuperAdmin', 'Admin', ...) 装饰器
  │
  ▼
Controller Handler
```

---

## 5. 权限矩阵

### 5.1 用户管理权限

| 操作 | SuperAdmin | Admin | Teacher | Parent | Student |
|------|-----------|-------|---------|--------|---------|
| 创建用户 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 修改用户 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 删除用户 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 查看用户列表 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 重置密码 | ✅ | ✅ | ❌ | ❌ | ❌ |

### 5.2 角色绑定约束

| 角色 | 绑定约束 | 验证点 |
|------|---------|--------|
| Teacher | 必须绑定至少1个班级或课程 | 创建时验证 `teacherBindings` 非空 |
| Parent | 必须绑定至少1个学生 | 创建时验证 `parentBindings.studentCodes` 非空 |
| Student | 必须关联学生资料 | 创建时验证 `studentBinding.studentCode` 非空 |

---

## 6. 异常处理

| 场景 | 处理方式 |
|------|---------|
| 用户名已存在 | 返回 409：用户名已存在 |
| 角色绑定不完整 | 返回 400：请完善角色绑定信息 |
| 非管理员创建用户 | 返回 403：无权操作 |
| 禁用用户登录 | 返回 401：用户已被禁用 |

---

## 7. 与其他模块的交互

| 模块 | 交互方式 |
|------|---------|
| 学生模块 | 创建 Student 用户时同步创建/关联 student 记录 |
| 教学模块 | 创建 Teacher 用户时创建 teacher_assignment 记录 |
| 家长模块 | 创建 Parent 用户时创建 student_parent 关联 |
| 审计模块 | 所有创建/修改操作写入 login_log 和操作日志 |

---

**Design Status**: FINAL ✅  
**Next Step**: M-EDUOS-PRODUCTION-READINESS-REVIEW-V1
