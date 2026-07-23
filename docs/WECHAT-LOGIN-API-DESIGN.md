# 微信登录接口设计文档

> 版本：v1.0
> 创建时间：2026-07-24
> Mission：M-2026-07-25-EOS-MINIAPP-OPERATION-EXPANSION-LONG-RUNNING-V1
> Phase：3 (WeChat Login)
> Batch：3.1
> 状态：Research Complete — Skeleton Design

---

## 一、接口定义

### 1.1 主接口：微信登录

- 路径：`POST /api/v1/auth/wechat-login`
- 认证：Public（无需 JWT）
- 用途：微信小程序用户通过 code 换取登录凭证

### 1.2 辅助接口：微信绑定手机号

- 路径：`POST /api/v1/auth/wechat-bind`
- 认证：Public（使用临时 token 验证）
- 用途：首次微信登录未绑定账号时，绑定手机号完成注册/关联

### 1.3 辅助接口：已登录用户绑定微信

- 路径：`POST /api/v1/auth/bind-wechat`
- 认证：需要 JWT
- 用途：已登录用户（用户名密码登录）绑定微信 openid，后续可用微信登录

---

## 二、请求/响应结构

### 2.1 POST /api/v1/auth/wechat-login

请求体：

```json
{
  "code": "微信临时登录凭证（wx.login() 获取）",
  "userInfo": {
    "nickName": "用户昵称（可选）",
    "avatarUrl": "头像URL（可选）"
  }
}
```

字段说明：

- code（必填）：wx.login() 返回的临时登录凭证，有效期 5 分钟，一次性使用
- userInfo.nickName（可选）：用户昵称，用于首次注册时填充
- userInfo.avatarUrl（可选）：用户头像 URL，用于首次注册时填充

响应体（已绑定用户 — 直接登录成功）：

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "uuid-refresh-token",
    "user": {
      "id": 1,
      "name": "张三",
      "role": "Parent",
      "openid": "oXXXX_openid",
      "avatar": "https://xxx/avatar.jpg",
      "binded": true
    }
  }
}
```

响应体（未绑定用户 — 需要绑定手机号）：

```json
{
  "code": 0,
  "message": "需要绑定手机号",
  "data": {
    "needBind": true,
    "tempToken": "临时令牌（30分钟有效）",
    "openid": "oXXXX_openid"
  }
}
```

### 2.2 POST /api/v1/auth/wechat-bind

请求体：

```json
{
  "tempToken": "上一步返回的临时令牌",
  "phone": "手机号",
  "smsCode": "短信验证码"
}
```

响应体（绑定成功 — 返回正式 JWT）：

```json
{
  "code": 0,
  "message": "绑定成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "uuid-refresh-token",
    "user": {
      "id": 1,
      "name": "张三",
      "role": "Parent",
      "openid": "oXXXX_openid",
      "avatar": null,
      "binded": true
    }
  }
}
```

### 2.3 POST /api/v1/auth/bind-wechat

请求体：

```json
{
  "code": "微信临时登录凭证"
}
```

响应体：

```json
{
  "code": 0,
  "message": "微信绑定成功",
  "data": {
    "openid": "oXXXX_openid"
  }
}
```

---

## 三、错误码定义

### 3.1 业务错误码

| 错误码 | HTTP Status | 含义 | 触发场景 |
|:------|:------------|:-----|:---------|
| 40001 | 400 | 微信code无效 | code 格式错误或已被使用 |
| 40002 | 400 | 微信code已过期 | code 超过 5 分钟未使用 |
| 40003 | 400 | 用户未绑定微信 | openid 在系统中无对应账号 |
| 40004 | 500 | 微信登录失败 | 微信 API 调用异常 |
| 40005 | 400 | 临时令牌无效或已过期 | tempToken 超过 30 分钟 |
| 40006 | 400 | 手机号已被其他微信绑定 | 手机号冲突 |
| 40007 | 400 | 该微信已绑定其他账号 | openid 已被其他用户绑定 |
| 40008 | 400 | 短信验证码错误 | 验证码不匹配 |

### 3.2 微信 API 错误码映射

| 微信 errcode | 含义 | 系统映射 |
|:-------------|:-----|:---------|
| 40029 | code 无效 | → 40001 |
| 40014 | access_token 无效 | → 40004（内部重试） |
| 40163 | code 已被使用 | → 40001 |
| 45011 | API 调用频率限制 | → 40004（内部重试） |

---

## 四、流程设计

### 4.1 前端流程

```
用户点击"微信授权登录"
  |
  ├─ 调用 wx.login() 获取 code
  |   |
  |   ├─ 失败 → 提示"微信登录失败，请重试"
  |   |
  |   └─ 成功 → 获取 code
  |       |
  |       └─ POST /api/v1/auth/wechat-login { code }
  |           |
  |           ├─ 返回 needBind: true
  |           |   |
  |           |   └─ 跳转手机号绑定页/弹窗
  |           |       |
  |           |       ├─ 方案A：微信手机号快速获取（企业认证）
  |           |       |   → <button open-type="getPhoneNumber">
  |           |       |   → 获取 encryptedData + iv
  |           |       |   → POST /api/v1/auth/wechat-bind
  |           |       |
  |           |       └─ 方案B：手动输入手机号 + 短信验证码
  |           |           → 用户输入手机号
  |           |           → POST /api/v1/auth/sms-send { phone }
  |           |           → 用户输入验证码
  |           |           → POST /api/v1/auth/wechat-bind { tempToken, phone, smsCode }
  |           |
  |           └─ 返回 accessToken + user
  |               |
  |               └─ app.saveLoginInfo(token, user)
  |                   → 根据角色跳转首页
```

### 4.2 后端流程

```
POST /api/v1/auth/wechat-login
  |
  ├─ 1. 参数校验（code 非空）
  |
  ├─ 2. 调用微信 API：sns/jscode2session
  |   GET https://api.weixin.qq.com/sns/jscode2session
  |     ?appid={APPID}
  |     &secret={SECRET}
  |     &js_code={code}
  |     &grant_type=authorization_code
  |   |
  |   ├─ 失败 → 映射错误码返回（40001/40002/40004）
  |   |
  |   └─ 成功 → 获取 openid + session_key
  |       |
  |       └─ 3. 缓存 session_key（内存/Redis，key=openid，TTL=2h）
  |           |
  |           └─ 4. 用 openid 查找 User 表
  |               |
  |               ├─ 找到用户（openid 已绑定）
  |               |   |
  |               |   ├─ 检查用户状态（status === 1）
  |               |   |   └─ 禁用 → 抛出 UnauthorizedException
  |               |   |
  |               |   ├─ 更新 lastLoginAt
  |               |   |
  |               |   ├─ 签发 JWT（accessToken 2h + refreshToken 7d）
  |               |   |
  |               |   ├─ 记录 LoginLog
  |               |   |
  |               |   └─ 返回 { accessToken, refreshToken, user, binded: true }
  |               |
  |               └─ 未找到用户（首次微信登录）
  |                   |
  |                   ├─ 生成 tempToken（UUID，存 Redis/内存，TTL=30min）
  |                   ├─ 关联 openid + session_key
  |                   |
  |                   └─ 返回 { needBind: true, tempToken, openid(脱敏) }
```

### 4.3 绑定手机号流程

```
POST /api/v1/auth/wechat-bind
  |
  ├─ 1. 验证 tempToken（从 Redis/内存查找，未过期）
  |   |
  |   ├─ 无效/过期 → 40005
  |   |
  |   └─ 有效 → 取出关联的 openid + session_key
  |       |
  |       └─ 2. 验证短信验证码
  |           |
  |           ├─ 错误 → 40008
  |           |
  |           └─ 正确 →
  |               |
  |               └─ 3. 用手机号查找 User 表
  |                   |
  |                   ├─ 找到已有用户（手机号匹配）
  |                   |   |
  |                   |   ├─ 检查 openid 是否已被其他用户绑定 → 40007
  |                   |   |
  |                   |   └─ 绑定 openid 到该用户
  |                   |
  |                   └─ 未找到 → 自动创建新用户
  |                       |
  |                       ├─ username = "wx_" + openid前6位
  |                       ├─ mobile = 手机号
  |                       ├─ openid = openid
  |                       ├─ role = "Parent"（默认）
  |                       ├─ name = 手机号后4位（临时）
  |                       └─ password = 随机 UUID（不可密码登录）
  |
  ├─ 4. 签发 JWT（accessToken + refreshToken）
  |
  ├─ 5. 记录 LoginLog
  |
  ├─ 6. 清理 tempToken
  |
  └─ 7. 返回 { accessToken, refreshToken, user, binded: true }
```

### 4.4 异常处理

场景 1：微信 API 不可用
- 后端重试 1 次（间隔 500ms）
- 仍失败 → 返回 40004，前端提示"微信服务暂时不可用"

场景 2：code 过期/已使用
- 微信返回 40029/40163 → 映射为 40001
- 前端提示"登录凭证已失效，请重新登录"

场景 3：并发绑定同一 openid
- 数据库 openid UNIQUE 约束兜底
- 并发冲突 → 返回 40007

场景 4：tempToken 过期
- 30 分钟有效期，过期后清除
- 用户需重新点击微信登录

---

## 五、安全考虑

### 5.1 session_key 保护

- session_key 绝不能传到前端（微信安全规范）
- 后端存储在 Redis/内存中，key = openid，TTL = 2 小时
- 仅在后端用于解密微信加密数据（如手机号）

### 5.2 code 一次性使用

- 微信 code 只能使用一次，后端调用 jscode2session 后即失效
- 防止重放攻击

### 5.3 tempToken 安全

- 使用 crypto.randomUUID() 生成，不可预测
- 30 分钟 TTL，过期自动清除
- 使用后即删除，不可重复使用
- 存储时关联 openid + session_key，不暴露给前端

### 5.4 openid 脱敏

- 返回给前端的 openid 仅用于展示，不做业务逻辑依赖
- 完整 openid 仅在后端使用

### 5.5 频率限制

- /wechat-login 接口：同一 IP 每分钟最多 10 次
- /wechat-bind 接口：同一 tempToken 最多 5 次尝试
- 防止暴力破解和接口滥用

### 5.6 AppSecret 保护

- AppSecret 仅存在后端环境变量中（WECHAT_SECRET）
- 绝不传到前端或日志中
- 日志中脱敏处理（仅记录前4位 + ****）

---

## 六、与现有系统的集成点

### 6.1 复用现有模块

- JWT 签发：复用 AuthService 中的 jwtService.sign() 逻辑
- LoginLog：复用 LoginLog entity 记录微信登录事件
- UserRepository：新增 findByOpenid() 方法
- ApiResponse：统一响应格式包装
- @Public() 装饰器：标记无需认证的端点
- configuration.ts：已预留 wechat.appid / wechat.secret

### 6.2 需要新增的模块

后端文件清单：

- backend/src/modules/wechat/wechat.module.ts — 微信模块定义
- backend/src/modules/wechat/wechat.service.ts — 微信 API 封装
- backend/src/modules/wechat/dto/wechat-login.dto.ts — 请求 DTO
- backend/src/modules/wechat/dto/wechat-bind.dto.ts — 绑定 DTO
- backend/src/modules/identity/auth/auth.controller.ts — 新增 3 个端点（修改）
- backend/src/modules/identity/auth/auth.service.ts — 新增微信登录方法（修改）
- backend/src/modules/identity/user.repository.ts — 新增 findByOpenid()（修改）

前端文件清单：

- miniapp/pages/login/login.js — 实现 onWechatLogin()（修改）
- miniapp/pages/login/login.wxml — 无需修改（按钮已存在）
- miniapp/pages/bind-phone/（新增，如选方案B）— 手机号绑定页
- miniapp/config.js — 新增微信相关配置项

### 6.3 数据库变更

核心流程无需 DDL 变更：
- user.openid（已存在，varchar 100, unique, nullable）
- user.unionid（已存在，varchar 100, nullable）
- user.avatar（已存在，varchar 255, nullable）

可选扩展（后续迭代）：
- wechat_session_key 表（或 Redis 存储）
- subscribe_message_log 表（订阅消息发送记录）

---

## 七、实施计划

### 阶段划分

阶段 1：后端微信 API 封装（0.5 天）
- 新建 wechat.module / wechat.service
- 实现 jscode2session 调用
- 实现 access_token 管理（缓存 + 自动刷新）
- 单元测试覆盖

阶段 2：后端登录接口（1 天）
- 新增 /auth/wechat-login 端点
- 新增 /auth/wechat-bind 端点
- 新增 /auth/bind-wechat 端点
- UserRepository.findByOpenid() 方法
- 错误码体系集成
- 单元测试覆盖

阶段 3：前端微信登录（1 天）
- 实现 onWechatLogin() 完整流程
- 手机号绑定页面（方案 B 为主，方案 A 可选）
- 错误处理和用户提示

阶段 4：联调测试（0.5 天）
- 首次微信登录 → 绑定 → 成功
- 再次微信登录 → 直接成功
- 异常场景覆盖
- 真机测试

### 前置条件

- Owner 提供微信小程序 AppID + AppSecret
- 后端 .env 配置 WECHAT_APPID / WECHAT_SECRET
- （如选方案B）短信验证码服务接入

### 预估总工作量

2-3 天（后端 1.5 天 + 前端 1 天 + 联调 0.5 天）

---

## 八、Decision Gate

### 待 Owner 决策

决策 1：手机号绑定方案
- 方案 A：微信手机号快速获取（需企业认证小程序，体验最好）
- 方案 B：手动输入手机号 + 短信验证码（需短信服务商，通用）
- 方案 C：两者都支持（推荐，覆盖所有场景）
- 建议：方案 C

决策 2：新用户默认角色
- 方案 A：统一默认 Parent（家长）
- 方案 B：需要管理员手动分配角色
- 建议：方案 A（MVP 阶段简化流程）

决策 3：是否保留用户名密码登录
- 方案 A：保留（教师/管理员用密码，家长/学生用微信）
- 方案 B：C 端仅微信登录，B 端仅密码登录（入口分离）
- 建议：方案 A（保持灵活性）

---

*文档版本：v1.0*
*设计人：EOS Research Agent*
*审核状态：待 Owner 确认 Decision Gate*
