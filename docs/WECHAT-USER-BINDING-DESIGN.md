# 微信用户绑定模型设计

> 版本：v1.0
> 创建时间：2026-07-24
> Mission：M-2026-07-25-EOS-MINIAPP-OPERATION-EXPANSION-LONG-RUNNING-V1
> Phase：3 (WeChat Login)
> Batch：3.2
> 状态：Research Complete — Skeleton Design
> 前置文档：docs/WECHAT-LOGIN-API-DESIGN.md（Batch 3.1）

---

## 一、现有数据模型审计

### 1.1 User 表当前字段（已存在）

```
字段名           类型              约束                    状态
─────────────────────────────────────────────────────────────
id              bigint           PK, AUTO_INCREMENT      ✅ 已有
username        varchar(50)      UNIQUE                   ✅ 已有
password        varchar(255)     select:false             ✅ 已有
mobile          varchar(20)      UNIQUE                   ✅ 已有
openid          varchar(100)     UNIQUE, NULLABLE         ✅ 已有 ← 微信绑定核心
unionid         varchar(100)     NULLABLE                 ✅ 已有 ← 跨平台扩展
name            varchar(50)      NOT NULL                 ✅ 已有
role            varchar(50)      INDEX                    ✅ 已有
status          tinyint          DEFAULT 1, INDEX         ✅ 已有
campusId        bigint           DEFAULT 0                ✅ 已有
avatar          varchar(255)     NULLABLE                 ✅ 已有
lastLoginAt     timestamp        NULLABLE                 ✅ 已有
refreshToken    varchar(255)     NULLABLE                 ✅ 已有
refreshTokenExpiresAt  timestamp NULLABLE                 ✅ 已有
createTime      timestamp        AUTO                     ✅ 已有
updateTime      timestamp        AUTO                     ✅ 已有
version         int              DEFAULT 1                ✅ 已有
deleted         tinyint          DEFAULT 0                ✅ 已有
```

### 1.2 字段评估结论

openid 字段：
- 类型 varchar(100)：✅ 足够（微信 openid 固定 28 字符）
- UNIQUE 约束：✅ 正确（一个 openid 只能绑定一个用户）
- NULLABLE：✅ 正确（未绑定微信的用户为 NULL）
- 评估：无需修改

unionid 字段：
- 类型 varchar(100)：✅ 足够（微信 unionid 固定 28 字符）
- 无 UNIQUE 约束：⚠️ 需评估（见 1.3）
- NULLABLE：✅ 正确
- 评估：建议添加 UNIQUE 约束（见下文）

session_key 字段：
- 当前状态：❌ 不存在于 User 表
- 评估：✅ 不需要添加（见 1.4）

### 1.3 unionid UNIQUE 约束分析

场景分析：
- unionid 是微信开放平台级别标识，同一微信用户在不同应用下 unionid 相同
- 当前系统仅接入一个小程序，unionid 与 openid 是 1:1 关系
- 如果未来接入公众号/APP，unionid 可能跨平台复用

决策：
- 当前阶段：不添加 UNIQUE 约束（保持灵活）
- 理由：unionid 主要用于未来跨平台识别，当前仅做记录用途
- 触发条件：当实际需要基于 unionid 做登录/绑定时，再添加 UNIQUE

### 1.4 session_key 存储方案决策

方案对比：

方案 A：存入 User 表
- 优点：查询简单
- 缺点：session_key 频繁更新导致 User 表写入放大；安全风险（User 表被多处查询）
- 评估：❌ 不推荐

方案 B：Redis 存储（key=openid, TTL=2h）
- 优点：高性能；自动过期；安全隔离
- 缺点：依赖 Redis 基础设施
- 评估：✅ 推荐（生产环境）

方案 C：内存 Map 存储（key=openid, TTL=2h）
- 优点：零依赖；实现简单
- 缺点：重启丢失；多实例不同步
- 评估：✅ 推荐（MVP 阶段）

决策：MVP 阶段使用方案 C（内存 Map），生产环境切换方案 B（Redis）

---

## 二、绑定模型设计

### 2.1 绑定关系定义

系统中存在两种绑定场景：

场景 A：首次微信登录 → 自动绑定
- 触发：用户首次通过微信登录，系统无对应 openid
- 流程：wx.login() → code → openid → 无匹配用户 → 绑定手机号 → 创建/关联用户 → 写入 openid
- 结果：User.openid = openid

场景 B：已登录用户 → 主动绑定微信
- 触发：已用用户名/密码登录的用户，想绑定微信以便后续微信登录
- 流程：已登录 → wx.login() → code → openid → 检查冲突 → 写入 openid
- 结果：User.openid = openid

### 2.2 绑定状态机

```
用户微信绑定状态：

[未绑定] ──(首次微信登录+手机号绑定)──→ [已绑定]
[未绑定] ──(已登录用户主动绑定)──────→ [已绑定]
[已绑定] ──(用户主动解绑)──────────→ [未绑定]
[已绑定] ──(管理员清除)────────────→ [未绑定]
```

状态转换规则：
- 未绑定 → 已绑定：必须通过微信 API 验证 openid 有效性
- 已绑定 → 未绑定：用户主动解绑或管理员操作
- 已绑定 → 已绑定：不允许（必须先解绑再绑定新的微信）

### 2.3 绑定数据流

```
微信服务器                    后端                        数据库
    |                          |                           |
    |  wx.login() → code       |                           |
    | ─────────────────────────>|                           |
    |                          |  jscode2session(code)     |
    | <────────────────────────|                           |
    |  openid + session_key    |                           |
    |                          |                           |
    |                          |  findByOpenid(openid)     |
    |                          | ─────────────────────────>|
    |                          | <─────────────────────────|
    |                          |  null / User              |
    |                          |                           |
    |                          |  [null] 创建/绑定流程      |
    |                          |  UPDATE user SET           |
    |                          |    openid = ?              |
    |                          | ─────────────────────────>|
    |                          | <─────────────────────────|
    |  JWT Token               |  OK                       |
    | <────────────────────────|                           |
```

---

## 三、绑定流程详细设计

### 3.1 场景 A：首次微信登录绑定

前置条件：
- 用户未注册/未绑定微信
- 用户拥有微信客户端
- 小程序已配置正确的 AppID

流程步骤：

Step 1：前端获取 code
```javascript
// miniapp/pages/login/login.js → onWechatLogin()
wx.login({
  success: function(res) {
    if (res.code) {
      // 发送 code 到后端
      post('/auth/wechat-login', { code: res.code });
    } else {
      // wx.login 失败
      showToast('微信登录失败，请重试');
    }
  },
  fail: function(err) {
    showToast('微信登录失败：' + err.errMsg);
  }
});
```

Step 2：后端用 code 换取 openid
```
POST /api/v1/auth/wechat-login
Body: { "code": "0a1b2c3d..." }

后端处理：
1. 调用微信 API: GET https://api.weixin.qq.com/sns/jscode2session
   ?appid={WECHAT_APPID}
   &secret={WECHAT_SECRET}
   &js_code={code}
   &grant_type=authorization_code

2. 成功响应：{ "openid": "oXXXX...", "session_key": "xxx...", "unionid": "oYY..." }
3. 缓存 session_key（内存 Map，key=openid，TTL=2h）
4. 查找 User：findByOpenid(openid)
5. 未找到 → 返回 { needBind: true, tempToken: "uuid", openid: "oX***" }
```

Step 3：用户绑定手机号
```
POST /api/v1/auth/wechat-bind
Body: { "tempToken": "uuid", "phone": "13800138000", "smsCode": "123456" }

后端处理：
1. 验证 tempToken（从内存查找，未过期）
2. 取出关联的 openid + session_key
3. 验证短信验证码
4. 用手机号查找 User：
   a. 找到 → 检查 openid 冲突 → 绑定 openid 到该用户
   b. 未找到 → 创建新用户（username=wx_前6位, mobile=手机号, openid=openid, role=Parent）
5. 签发 JWT
6. 清理 tempToken
7. 返回 { accessToken, refreshToken, user }
```

### 3.2 场景 B：已登录用户主动绑定

前置条件：
- 用户已通过用户名/密码登录
- 用户持有有效 JWT

流程步骤：

Step 1：前端发起绑定请求
```javascript
// 用户点击"绑定微信"按钮
wx.login({
  success: function(res) {
    if (res.code) {
      post('/auth/bind-wechat', { code: res.code });
      // header 中携带 Authorization: Bearer {jwt}
    }
  }
});
```

Step 2：后端处理绑定
```
POST /api/v1/auth/bind-wechat
Header: Authorization: Bearer {jwt}
Body: { "code": "0a1b2c3d..." }

后端处理：
1. JWT 验证 → 获取当前用户 ID（req.user.sub）
2. 调用微信 API 获取 openid
3. 冲突检查（见第四章）
4. 绑定：UPDATE user SET openid = ? WHERE id = ?
5. 返回 { openid: "oX***" }
```

### 3.3 UserRepository 需要新增的方法

```typescript
// backend/src/modules/identity/user.repository.ts

/**
 * 根据 openid 查找用户
 * 用于微信登录场景
 */
async findByOpenid(openid: string): Promise<User | null> {
  return this.repo.findOne({ where: { openid, deleted: false } });
}

/**
 * 检查 openid 是否已被占用
 * 用于绑定前的冲突检查
 */
async existsByOpenid(openid: string): Promise<boolean> {
  return this.repo.exists({ where: { openid, deleted: false } });
}

/**
 * 清除用户的微信绑定
 * 用于解绑场景
 */
async clearWechatBinding(userId: number): Promise<void> {
  await this.repo.update(userId, {
    openid: null as any,
    unionid: null as any,
  });
}
```

---

## 四、冲突处理设计

### 4.1 冲突类型矩阵

```
冲突类型              触发场景                         处理策略
─────────────────────────────────────────────────────────────────
C1: openid 已绑定     微信 A 的 openid 已被用户 X 绑定   拒绝绑定，返回错误
C2: 用户已绑定微信     用户 X 已有 openid，试图绑定新微信  拒绝绑定，需先解绑
C3: unionid 已绑定     微信 A 的 unionid 已被用户 Y 绑定  记录日志，允许绑定（仅告警）
C4: 手机号已存在       绑定手机号时，手机号已被用户 Z 使用  关联到已有用户（不创建新的）
```

### 4.2 C1：openid 已被其他用户绑定

触发场景：
- 场景 A：用户用微信登录，openid 已绑定到其他账号
- 场景 B：已登录用户试图绑定一个已被占用的 openid

处理策略：
```
检测到 openid 已绑定
  |
  ├─ 场景 A（微信登录）→ 直接登录到已绑定账号（正常流程，非冲突）
  |
  └─ 场景 B（主动绑定）→ 拒绝
      |
      └─ 返回错误码 40007：「该微信已绑定其他账号」
         建议：先解绑旧账号，或联系管理员
```

代码逻辑：
```typescript
// 场景 B 绑定检查
async bindWechat(userId: number, code: string) {
  const { openid, unionid } = await this.wechatService.code2Session(code);

  // 检查 openid 是否已被占用
  const existingUser = await this.userRepo.findByOpenid(openid);
  if (existingUser && existingUser.id !== userId) {
    throw new BadRequestException('该微信已绑定其他账号');
    // 错误码 40007
  }

  // 检查当前用户是否已绑定其他微信
  const currentUser = await this.userRepo.findById(userId);
  if (currentUser.openid) {
    throw new BadRequestException('您已绑定微信，请先解绑再绑定新微信');
    // 错误码 40009（新增）
  }

  // 执行绑定
  await this.userRepo.update(userId, { openid, unionid });
}
```

### 4.3 C2：用户已绑定其他微信

触发场景：
- 用户已有 openid_A，试图绑定 openid_B

处理策略：
```
检测到用户已绑定 openid_A
  |
  └─ 拒绝绑定 openid_B
      |
      └─ 返回错误码 40009：「您已绑定微信，请先解绑再绑定新微信」
         前端引导：提供"解绑微信"入口
```

设计理由：
- 一个用户只能绑定一个微信（1:1 关系）
- 避免多微信绑定带来的安全风险和身份混乱
- 如需更换微信，必须先解绑

### 4.4 C3：unionid 已被其他用户绑定

触发场景：
- 用户 A 的 unionid 与已存在的用户 B 的 unionid 相同
- 通常发生在同一微信开放平台下多个应用之间

处理策略：
```
检测到 unionid 冲突
  |
  ├─ 记录告警日志：「unionid 冲突：用户A(openid_A) vs 用户B(openid_B)」
  |
  └─ 允许绑定（unionid 仅做记录，不做唯一性约束）
      |
      └─ 后续可通过 unionid 发现同一用户的多个账号
```

设计理由：
- unionid 当前不做唯一性约束（见 1.3 评估）
- unionid 冲突不阻塞业务流程
- 未来可基于 unionid 做账号合并

### 4.5 C4：手机号已存在

触发场景：
- 首次微信登录 → 绑定手机号 → 手机号已在系统中存在

处理策略：
```
手机号已存在
  |
  ├─ 检查该用户是否已有 openid 绑定
  |   |
  |   ├─ 已有 → 返回错误码 40006：「该手机号已被其他微信绑定」
  |   |
  |   └─ 未有 → 将 openid 绑定到该已有用户
  |       |
  |       └─ 签发 JWT，登录成功
  |
  └─ 手机号不存在 → 创建新用户
```

### 4.6 冲突处理汇总

```
冲突    HTTP Status   错误码   用户提示                      前端引导
──────────────────────────────────────────────────────────────────────
C1      400          40007   该微信已绑定其他账号             联系管理员
C2      400          40009   您已绑定微信，请先解绑           跳转解绑入口
C3      —            —       （仅日志告警，不阻塞）            —
C4-a    400          40006   该手机号已被其他微信绑定         换个手机号/联系管理员
C4-b    —            —       （自动关联，不冲突）              —
```

---

## 五、解绑流程设计

### 5.1 用户主动解绑

前置条件：
- 用户已登录
- 用户已绑定微信（User.openid 不为 NULL）

流程：

Step 1：前端发起解绑请求
```javascript
// miniapp/pages/setting/setting.js（或"我的"页面）
async onUnbindWechat() {
  const that = this;
  wx.showModal({
    title: '确认解绑',
    content: '解绑后将无法使用微信登录，确定要解绑吗？',
    success: async function(res) {
      if (res.confirm) {
        try {
          await del('/auth/wechat-bindng');  // 或 POST /auth/unbind-wechat
          showToast('解绑成功');
          that.setData({ binded: false });
        } catch (err) {
          showToast(err.message || '解绑失败');
        }
      }
    }
  });
}
```

Step 2：后端处理解绑
```
POST /api/v1/auth/unbind-wechat
Header: Authorization: Bearer {jwt}

后端处理：
1. JWT 验证 → 获取当前用户 ID
2. 检查用户是否已绑定微信
   - 未绑定 → 返回错误「您尚未绑定微信」
3. 清除绑定：UPDATE user SET openid = NULL, unionid = NULL WHERE id = ?
4. 记录操作日志（可选）
5. 返回 { success: true }
```

### 5.2 管理员解绑

场景：
- 用户无法自行解绑（如忘记账号）
- 管理员需要重新分配微信绑定

接口：
```
POST /api/v1/admin/users/:id/unbind-wechat
Header: Authorization: Bearer {admin-jwt}
权限：Admin / SuperAdmin

后端处理：
1. 权限验证
2. 查找目标用户
3. 清除 openid + unionid
4. 记录审计日志
5. 返回 { success: true }
```

### 5.3 解绑约束

```
约束条件                              处理
──────────────────────────────────────────────────
用户未绑定微信                        → 返回错误「未绑定」
用户是某学生唯一关联的家长               → 警告但不阻止（解绑微信不影响学生关联）
用户是唯一的 SuperAdmin                → 警告但不阻止（解绑微信不影响角色权限）
```

设计理由：
- 微信绑定是登录方式的补充，不是身份的核心依赖
- 学生与家长的关联通过 student_parent 表，不依赖 openid
- 解绑微信 ≠ 删除账号，不影响业务数据

---

## 六、安全考虑

### 6.1 session_key 安全

微信官方安全规范：
- session_key 绝不能传到前端
- session_key 不能存储在日志中
- session_key 仅用于后端解密微信加密数据

本系统方案：
- 后端内存 Map 存储，key=openid，TTL=2h
- 仅在后端使用，不返回给前端
- 日志中不记录 session_key 值

### 6.2 openid 安全

- openid 是用户在当前小程序的唯一标识，不可伪造
- 后端通过微信 API 获取，不信任前端传入的 openid
- 返回给前端时做脱敏处理（仅显示前4位 + ***）
- 数据库中完整存储，查询时使用完整值

### 6.3 绑定操作安全

- 场景 B（主动绑定）需要 JWT 认证，确保是用户本人操作
- code 一次性使用，防止重放攻击
- 绑定操作记录 LoginLog，可追溯

### 6.4 解绑操作安全

- 解绑需要 JWT 认证
- 管理员解绑需要 Admin/SuperAdmin 权限
- 解绑操作记录审计日志

### 6.5 频率限制

```
接口                       限制策略
────────────────────────────────────────
/auth/wechat-login         同一 IP 每分钟 ≤ 10 次
/auth/wechat-bind          同一 tempToken ≤ 5 次尝试
/auth/bind-wechat          同一用户每分钟 ≤ 3 次
/auth/unbind-wechat        同一用户每分钟 ≤ 3 次
```

---

## 七、与 Batch 3.1 的关系

### 7.1 职责划分

```
Batch 3.1（WECHAT-LOGIN-API-DESIGN.md）    Batch 3.2（本文档）
─────────────────────────────────────────────────────────────
微信登录接口设计                            用户绑定模型设计
3 个 API 端点定义                           绑定/解绑详细流程
请求/响应结构                              冲突处理矩阵
错误码体系                                 安全考虑
前端/后端流程概览                           状态机设计
                                          数据模型审计
                                          UserRepository 扩展方法
```

### 7.2 接口复用

本文档的绑定/解绑流程复用 Batch 3.1 定义的接口：
- POST /auth/wechat-login → 场景 A 首次登录
- POST /auth/wechat-bind → 场景 A 绑定手机号
- POST /auth/bind-wechat → 场景 B 主动绑定

本文档新增接口：
- POST /auth/unbind-wechat → 用户主动解绑（新增）
- POST /admin/users/:id/unbind-wechat → 管理员解绑（新增）

### 7.3 新增错误码

```
错误码    HTTP Status   含义                         来源
──────────────────────────────────────────────────────────
40009    400          用户已绑定微信，需先解绑         Batch 3.2 新增
40010    400          用户未绑定微信，无法解绑          Batch 3.2 新增
```

---

## 八、实施计划

### 8.1 数据库变更

核心结论：无需 DDL 变更

现有字段已满足需求：
- user.openid（varchar 100, unique, nullable）✅
- user.unionid（varchar 100, nullable）✅

无需新增字段：
- session_key 使用内存/Redis 存储，不入 User 表

### 8.2 代码变更清单

后端（Skeleton 阶段）：

```
文件                                              操作     说明
──────────────────────────────────────────────────────────────────
backend/src/modules/identity/user.repository.ts   修改     新增 findByOpenid/existsByOpenid/clearWechatBinding
backend/src/modules/wechat/wechat.module.ts       新增     微信模块定义
backend/src/modules/wechat/wechat.service.ts      新增     微信 API 封装（jscode2session）
backend/src/modules/wechat/wechat-binding.service.ts  新增  绑定/解绑业务逻辑
backend/src/modules/wechat/dto/bind-wechat.dto.ts 新增     绑定请求 DTO
backend/src/modules/wechat/dto/unbind-wechat.dto.ts 新增   解绑请求 DTO
backend/src/modules/identity/auth/auth.controller.ts 修改  新增 unbind-wechat 端点
backend/src/modules/identity/auth/auth.service.ts    修改  集成绑定/解绑逻辑
```

前端：

```
文件                                              操作     说明
──────────────────────────────────────────────────────────────────
miniapp/pages/login/login.js                      修改     实现 onWechatLogin()
miniapp/pages/setting/setting.js                  新增     绑定/解绑微信入口
miniapp/pages/setting/setting.wxml                新增     设置页面 UI
```

### 8.3 测试计划

单元测试：
- UserRepository.findByOpenid() — 存在/不存在/已删除
- UserRepository.existsByOpenid() — 存在/不存在
- WechatBindingService.bind() — 正常绑定/C1冲突/C2冲突
- WechatBindingService.unbind() — 正常解绑/未绑定
- WechatService.code2Session() — 正常/失败/超时

集成测试：
- 完整绑定流程：wx.login → code → openid → bind → JWT
- 完整解绑流程：JWT → unbind → clear openid
- 冲突场景：openid 冲突/已绑定冲突/手机号冲突

---

## 九、Decision Gate

### 待 Owner 决策（与 Batch 3.1 合并）

决策 1：手机号绑定方案（同 Batch 3.1）
- 方案 A：微信手机号快速获取（需企业认证）
- 方案 B：手动输入 + 短信验证码
- 方案 C：两者都支持
- 建议：方案 C

决策 2：新用户默认角色（同 Batch 3.1）
- 建议：Parent

决策 3：是否保留用户名密码登录（同 Batch 3.1）
- 建议：保留

决策 4：session_key 存储方案（Batch 3.2 新增）
- 方案 A：内存 Map（MVP）→ Redis（生产）
- 方案 B：直接 Redis
- 建议：方案 A（渐进式）

决策 5：一个用户是否只能绑定一个微信（Batch 3.2 新增）
- 方案 A：1:1（当前设计）
- 方案 B：1:N（一个用户可绑定多个微信）
- 建议：方案 A（简化模型，后续按需扩展）

---

*文档版本：v1.0*
*设计人：EOS Research Agent (Claude Code)*
*审核状态：待 Owner 确认 Decision Gate*
*前置依赖：Batch 3.1 WECHAT-LOGIN-API-DESIGN.md*
