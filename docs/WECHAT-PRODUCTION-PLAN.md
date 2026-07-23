# 微信生产能力接入计划

> 版本：v1.0
> 创建时间：2026-07-24
> 状态：Research Complete — 待 Owner 决策
> Mission：M-2026-07-25-EOS-MINIAPP-SCALE-READINESS-LONG-RUNNING-V1
> Phase：4 (WeChat Production Readiness)
> Batch：4.1

---

## 一、微信登录

### 1.1 当前登录流程分析

当前系统使用用户名 + 密码登录，完整链路如下：

前端（miniapp/pages/login/login.js）：
- 用户输入 username + password
- 调用 post('/auth/login', { username, password })
- 成功后调用 app.saveLoginInfo(accessToken, user, expiresIn)
- 根据角色跳转首页

后端（backend/src/modules/identity/auth/）：
- AuthController.login() → AuthService.login()
- validateUser() → bcrypt.compare() 校验密码
- 签发 JWT（accessToken 2h + refreshToken 7d）
- 记录 LoginLog（userId, action, ip, device）
- 返回 { accessToken, refreshToken, user }

Token 管理：
- 前端存储：wx.setStorageSync('token', token) + tokenExpiry
- 请求拦截：request.js 自动附加 Authorization: Bearer <token>
- 过期处理：handleTokenExpired() 全局单例，防并发跳转
- 刷新机制：POST /auth/refresh → 新 accessToken + 新 refreshToken

### 1.2 openid 绑定方案

数据库层面已预留字段（User entity）：
- openid: varchar(100), unique, nullable — 微信用户唯一标识
- unionid: varchar(100), nullable — 跨应用统一标识（如有开放平台）

绑定流程设计：

场景 A：首次微信登录（无账号）
1. 前端 wx.login() → 获取 code
2. 前端 POST /auth/wx-login { code }
3. 后端调用微信 sns/jscode2session → 获取 openid + session_key
4. 后端用 openid 查 User 表 → 未找到
5. 后端返回 { needBind: true, tempToken: xxx }
6. 前端引导用户输入手机号（或从微信获取手机号按钮）
7. 前端 POST /auth/wx-bind { tempToken, phone, smsCode }
8. 后端验证手机号 → 查找或创建 User → 绑定 openid → 签发正式 JWT

场景 B：已绑定用户再次微信登录
1. 前端 wx.login() → 获取 code
2. 前端 POST /auth/wx-login { code }
3. 后端调用微信 sns/jscode2session → 获取 openid
4. 后端用 openid 查 User 表 → 找到
5. 后端直接签发 JWT → 返回 { accessToken, refreshToken, user }

场景 C：已有密码账号绑定微信
1. 用户已登录状态 → 进入个人中心
2. 点击"绑定微信"
3. 前端 wx.login() → 获取 code
4. 前端 POST /auth/bind-wechat { code }（携带当前 JWT）
5. 后端获取 openid → 检查是否已被其他用户绑定
6. 绑定 openid 到当前 User → 返回成功

### 1.3 用户关联设计

现有 User 表字段与微信的关联关系：

- id (bigint) → 系统主键，JWT sub 字段
- username (varchar 50, unique) → 系统用户名，微信登录时自动生成（如 wx_前6位openid）
- mobile (varchar 20, unique) → 手机号，微信绑定时的关键关联字段
- openid (varchar 100, unique, nullable) → 微信 openid，绑定后不可重复
- unionid (varchar 100, nullable) → 跨应用 unionid，预留字段
- name (varchar 50) → 用户姓名，可与微信昵称不同
- role (varchar 50) → 角色（SuperAdmin/Admin/Teacher/Parent）
- avatar (varchar 255, nullable) → 头像 URL，可存微信头像
- lastLoginAt (timestamp, nullable) → 最后登录时间
- refreshToken (varchar 255, nullable) → 刷新令牌
- deleted (tinyint, default 0) → 软删除

关联约束：
- openid 唯一约束确保一个微信只能绑定一个系统账号
- mobile 唯一约束确保手机号不重复
- 一个 openid 只能关联一个 User（一对一）
- 一个 User 只能绑定一个 openid（一对一）

### 1.4 登录流程优化

当前问题：
- 家长/学生需要记忆用户名和密码，体验差
- 密码遗忘后无自助找回机制
- C 端用户（家长）使用频率低，更容易忘记密码

优化方案：
- 微信登录作为 C 端（家长/学生）的主要登录方式
- 用户名+密码登录保留给 B 端（教师/管理员）
- 登录页根据入口自动选择登录方式
- 首次微信登录后自动关联已有账号（通过手机号匹配）

---

## 二、微信订阅消息

### 2.1 订阅消息模板设计

推荐申请以下模板（教培核心场景）：

模板 1：上课提醒
- 场景：课程开始前提醒学生/家长
- 字段：课程名称、上课时间、教室、教师姓名
- 触发时机：课程开始前 30 分钟（需定时任务）
- 模板关键词：课程提醒

模板 2：考勤通知
- 场景：教师确认出勤后通知家长
- 字段：学生姓名、课程名称、到课状态、时间
- 触发时机：教师点击"确认到课"后
- 模板关键词：考勤通知

模板 3：课时变动
- 场景：扣课/加课/退课后通知家长
- 字段：课程名称、变动类型、剩余课时、变动时间
- 触发时机：课时流水产生后
- 模板关键词：课时变动

模板 4：课程反馈
- 场景：教师提交课程反馈后通知家长
- 字段：课程名称、教师姓名、反馈摘要
- 触发时机：教师提交反馈后
- 模板关键词：学习反馈

模板 5：请假审批结果
- 场景：请假审批通过/拒绝后通知家长
- 字段：请假课程、审批结果、审批人、审批时间
- 触发时机：管理员审批完成后
- 模板关键词：审批通知

### 2.2 用户授权流程

微信订阅消息授权规则：
- 用户必须主动点击授权按钮（不能静默获取）
- 每次授权只对单次发送有效（长期订阅需特殊资质）
- 用户勾选"总是保持以上选择"可实现一次授权多次发送

授权时机设计：

时机 1：登录成功后
- 弹出授权弹窗，请求"上课提醒"和"考勤通知"模板授权
- 文案引导："开启消息提醒，不错过课程安排"

时机 2：课时完成后（教师端）
- 教师确认到课后，提示家长授权"课时变动"通知
- 场景自然，用户接受度高

时机 3：布置作业后（教师端）
- 教师提交课程反馈后，提示家长授权"学习反馈"通知

时机 4：个人中心
- 设置页面提供"消息订阅管理"入口
- 用户可随时开启/关闭各类通知

前端实现要点：
- 调用 wx.requestSubscribeMessage({ tmplIds: [...] })
- 处理用户拒绝场景（不阻塞业务流程）
- 记录用户授权状态（避免重复弹窗）

### 2.3 消息发送逻辑

后端发送流程：

1. 业务事件触发（如 lesson.completed）
2. EventBus 发布事件
3. WechatNotificationSubscriber 监听事件
4. 查询目标用户的 openid（通过 User 表）
5. 组装模板数据（data 字段）
6. 调用微信 API 发送

微信 API 调用链：
- 获取 access_token：GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=APPSECRET
- 发送订阅消息：POST https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=ACCESS_TOKEN
- access_token 有效期 2 小时，需缓存 + 自动刷新

后端架构设计：

新增文件：
- backend/src/modules/wechat/wechat.service.ts — 微信 API 封装（access_token 管理 + 消息发送）
- backend/src/modules/wechat/wechat.module.ts — 模块定义
- backend/src/modules/wechat/wechat-notification.subscriber.ts — 事件监听 + 消息触发
- backend/src/modules/wechat/dto/send-message.dto.ts — 消息 DTO

事件映射表：
- lesson.completed → 考勤通知模板
- lesson.finished → 课时变动模板
- feedback.created → 课程反馈模板
- leave.approved / leave.rejected → 请假审批结果模板
- lesson.scheduled（未来） → 上课提醒模板

错误处理：
- 用户未授权 → 静默跳过（不报错）
- access_token 过期 → 自动刷新重试一次
- 发送失败 → 记录日志 + 写入失败队列
- 频率限制 → 微信限制每分钟发送量，需排队

### 2.4 模板 ID 配置需求

需要 Owner 在微信公众平台申请模板后获取：

环境变量（backend/.env）：
- WX_SUBSCRIBE_TEMPLATE_CLASS_REMINDER — 上课提醒模板 ID
- WX_SUBSCRIBE_TEMPLATE_ATTENDANCE — 考勤通知模板 ID
- WX_SUBSCRIBE_TEMPLATE_LESSON_CHANGE — 课时变动模板 ID
- WX_SUBSCRIBE_TEMPLATE_FEEDBACK — 课程反馈模板 ID
- WX_SUBSCRIBE_TEMPLATE_LEAVE_RESULT — 请假审批结果模板 ID

前端配置（miniapp/config.js）：
- templateIds.classReminder — 上课提醒模板 ID
- templateIds.attendance — 考勤通知模板 ID
- templateIds.lessonChange — 课时变动模板 ID
- templateIds.feedback — 课程反馈模板 ID
- templateIds.leaveResult — 请假审批结果模板 ID

---

## 三、当前架构支持度评估

### 3.1 后端对微信登录的支持度

已具备的能力：
- ✅ JWT 认证体系完整（accessToken + refreshToken + login log）
- ✅ User entity 已预留 openid（varchar 100, unique, nullable）字段
- ✅ User entity 已预留 unionid（varchar 100, nullable）字段
- ✅ 配置体系已预留 wechat.appid 和 wechat.secret（configuration.ts）
- ✅ .env.example 已预留 WECHAT_APP_ID 和 WECHAT_APP_SECRET
- ✅ EventBus 事件驱动架构成熟，可扩展消息通知
- ✅ AuthService 结构清晰，新增 wx-login 方法改动集中

需要新增的后端能力：
- ❌ 微信 API 客户端（调用 sns/jscode2session）
- ❌ /auth/wx-login 端点（Public）
- ❌ /auth/wx-bind 端点（绑定手机号）
- ❌ /auth/bind-wechat 端点（已登录用户绑定微信）
- ❌ openid 查找用户的 Repository 方法
- ❌ 微信 access_token 管理服务
- ❌ 订阅消息发送服务
- ❌ 事件订阅者（监听业务事件 → 发送微信通知）

后端改动评估：中等
- 新增 1 个模块（wechat module）
- 修改 1 个模块（auth module — 新增 3 个端点）
- 新增约 4-5 个文件
- 预计工作量：2-3 天

### 3.2 前端对微信登录的支持度

已具备的能力：
- ✅ 登录页已有"微信授权登录"按钮（bindtap="onWechatLogin"）
- ✅ onWechatLogin() 方法已预留（当前为 placeholder）
- ✅ request.js 封装完善，支持 JWT 自动附加
- ✅ Token 管理机制成熟（存储 + 过期检测 + 自动跳转）
- ✅ config.js 环境配置集中管理

需要新增的前端能力：
- ❌ wx.login() 调用获取 code
- ❌ 微信登录 API 调用（/auth/wx-login）
- ❌ 首次登录绑定手机号流程（新页面或弹窗）
- ❌ 微信手机号快速获取按钮（<button open-type="getPhoneNumber">）
- ❌ 订阅消息授权弹窗（wx.requestSubscribeMessage）
- ❌ 个人中心页面（头像/昵称/绑定管理）

前端改动评估：中等
- 修改 1 个页面（login — 实现微信登录逻辑）
- 新增 1 个页面或弹窗（手机号绑定）
- 新增 1 个页面（个人中心 — 可选）
- 修改 config.js（新增模板 ID 配置）
- 预计工作量：2-3 天

### 3.3 数据库支持度

已具备：
- ✅ user 表有 openid 列（varchar 100, unique, nullable）
- ✅ user 表有 unionid 列（varchar 100, nullable）
- ✅ user 表有 avatar 列（varchar 255, nullable）
- ✅ user 表有 lastLoginAt 列（timestamp, nullable）

可能需要新增：
- ⚠️ user 表新增 wechatNickname 列（可选，区分系统姓名和微信昵称）
- ⚠️ 新增 subscribe_message_log 表（记录发送历史，可选）
- ⚠️ 新增 user_subscription 表（记录用户订阅授权状态，可选）

数据库改动评估：小
- 核心字段已存在，无需 migration
- 可选扩展表不影响核心流程

---

## 四、第三方配置需求

### 4.1 微信公众平台配置

Owner 需要在微信公众平台（mp.weixin.qq.com）完成以下配置：

配置项 1：获取 AppID 和 AppSecret
- 路径：登录小程序后台 → 开发管理 → 开发设置 → 开发者ID
- 用途：微信登录、access_token 获取、订阅消息发送
- 优先级：P0（所有微信能力的前置条件）

配置项 2：服务器域名白名单
- 路径：小程序后台 → 开发管理 → 开发设置 → 服务器域名
- 需配置：request 合法域名 → 后端 API 域名（如 https://api.yourdomain.com）
- 注意：开发阶段可在开发者工具中勾选"不校验合法域名"
- 优先级：P0（生产环境必须）

配置项 3：小程序类目确认
- 路径：小程序后台 → 设置 → 基本设置 → 服务类目
- 建议类目：教育 → 在线教育 或 教育培训
- 影响：类目决定可申请的订阅消息模板范围
- 优先级：P0（影响审核通过）

### 4.2 小程序后台配置

配置项 4：订阅消息模板申请
- 路径：小程序后台 → 订阅消息 → 公共模板库
- 需申请：上课提醒、考勤通知、课时变动、课程反馈、审批结果（共 5 个）
- 注意：模板需与小程序类目匹配
- 优先级：P1

配置项 5：隐私协议配置
- 路径：小程序后台 → 设置 → 基本设置 → 服务内容声明 → 用户隐私保护指引
- 内容：需说明收集用户信息（openid、手机号）的用途
- 优先级：P0（审核必须）

配置项 6：小程序图标和名称
- 路径：小程序后台 → 设置 → 基本设置
- 需配置：小程序图标（已设计）、小程序名称（已确定）
- 优先级：P1

### 4.3 需要 Owner 配置的内容清单

P0 — 阻塞项（必须先完成）：
1. 注册微信小程序（如未注册）→ 获取 AppID
2. 获取 AppSecret → 小程序后台 → 开发设置
3. 配置服务器域名 → request 合法域名添加后端 API 地址
4. 确认服务类目 → 教育相关类目
5. 配置隐私协议 → 用户隐私保护指引

P1 — 核心功能（微信登录 + 订阅消息需要）：
6. 申请订阅消息模板 → 至少 3 个核心模板
7. 提供模板 ID → 配置到环境变量和前端 config

P2 — 体验优化（可后续完成）：
8. 设计分享卡片图片（如需分享功能）
9. 配置小程序码（如需扫码登录）

P3 — 暂不需要：
10. 微信商户号（支付功能 — 当前不需要）
11. 微信开放平台（unionid 跨应用 — 当前不需要）

---

## 五、实施计划

### Phase 1：基础配置（1 天）

前置条件：Owner 完成 P0 配置项（AppID、AppSecret、域名、类目、隐私协议）

工作内容：
1. 后端环境变量配置
   - .env 添加 WECHAT_APPID 和 WECHAT_APP_SECRET
   - configuration.ts 已有 wechat 配置块，无需修改结构

2. 前端环境配置
   - miniapp/config.js 添加微信相关配置项
   - 添加 templateIds 配置（待模板申请后填入）

3. 微信 API 基础封装
   - 新建 wechat.service.ts
   - 实现 access_token 获取和缓存（Redis 或内存缓存）
   - 实现 jscode2session 调用

依赖：
- Owner 提供 AppID + AppSecret
- 服务器已部署且有公网域名

产出：
- 后端能通过 AppID+AppSecret 获取 access_token
- 后端能通过 code 换取 openid

### Phase 2：微信登录对接（2-3 天）

前置条件：Phase 1 完成

工作内容：

Day 1 — 后端微信登录 API
1. 新增 UserRepository.findByOpenid() 方法
2. 新增 AuthService.wxLogin(code) 方法
   - 调用 wechat.service.jscode2session(code)
   - 用 openid 查 User → 存在则签发 JWT
   - 不存在则返回 needBind 状态
3. 新增 AuthService.wxBindPhone(tempToken, phone, smsCode) 方法
   - 验证临时令牌
   - 查找或创建用户
   - 绑定 openid
   - 签发正式 JWT
4. 新增 AuthController 端点
   - POST /auth/wx-login（Public）
   - POST /auth/wx-bind（Public）

Day 2 — 前端微信登录流程
1. 实现 login.js 的 onWechatLogin() 方法
   - 调用 wx.login() 获取 code
   - POST /auth/wx-login { code }
   - 处理两种返回：直接登录成功 / 需要绑定手机号
2. 实现手机号绑定流程
   - 方案 A：微信手机号快速获取（<button open-type="getPhoneNumber">）
   - 方案 B：手动输入手机号 + 短信验证码
   - 推荐方案 A（体验更好，但需企业认证小程序）
3. 处理绑定成功后的登录跳转

Day 3 — 联调测试 + 边界处理
1. 首次微信登录 → 绑定手机号 → 登录成功
2. 再次微信登录 → 直接登录成功
3. 已有密码账号 → 绑定微信 → 后续可用微信登录
4. 微信已绑定 → 换手机号场景处理
5. 并发绑定防护（openid 唯一约束）

依赖：
- Phase 1 完成
- 短信验证码服务（如选方案 B）

产出：
- 家长/学生可通过微信一键登录
- 教师/管理员仍可使用用户名+密码登录

### Phase 3：订阅消息（3-5 天）

前置条件：Phase 2 完成 + Owner 已申请订阅消息模板

工作内容：

Day 1-2 — 后端订阅消息服务
1. 完善 wechat.service.ts
   - 实现 sendSubscribeMessage() 方法
   - 实现消息模板数据组装
   - 实现错误处理和重试逻辑
2. 新建 wechat-notification.subscriber.ts
   - 监听 lesson.completed → 发送考勤通知
   - 监听 lesson.finished → 发送课时变动通知
   - 监听 feedback.created → 发送课程反馈通知
   - 监听 leave.approved/rejected → 发送审批结果通知
3. 新增发送记录表（可选）
   - 记录每次发送的 openid、模板 ID、发送时间、状态

Day 3 — 前端订阅授权
1. 登录成功后请求订阅授权
   - wx.requestSubscribeMessage({ tmplIds: [上课提醒, 考勤通知] })
2. 关键操作后请求订阅授权
   - 课时完成后请求"课时变动"授权
   - 反馈提交后请求"学习反馈"授权
3. 个人中心订阅管理
   - 展示当前订阅状态
   - 提供重新授权入口

Day 4-5 — 联调测试 + 优化
1. 端到端测试：教师确认到课 → 家长收到考勤通知
2. 端到端测试：教师提交反馈 → 家长收到反馈通知
3. 处理用户未授权场景（静默跳过）
4. 处理发送失败场景（日志 + 重试）
5. access_token 过期自动刷新测试

依赖：
- Phase 2 完成（用户 openid 已绑定）
- Owner 已申请订阅消息模板并提供模板 ID

产出：
- 家长可收到上课提醒、考勤通知、课时变动、课程反馈等微信通知
- 替代人工通知，提升运营效率

---

## 六、Decision Gate

### 6.1 需要 Owner 决策的问题

决策 1：微信登录方案选择
- 方案 A：微信手机号快速获取（需企业认证小程序）
- 方案 B：手动输入手机号 + 短信验证码（需短信服务商）
- 方案 C：两者都支持（企业认证用方案 A，个人认证用方案 B）
- 建议：方案 C（覆盖所有场景）
- 影响：前端实现复杂度和用户体验

决策 2：C 端用户是否强制微信登录
- 方案 A：微信登录为唯一方式（家长/学生只能用微信登录）
- 方案 B：微信登录为可选方式（保留用户名+密码登录）
- 方案 C：新注册用户强制微信登录，老用户保留密码登录
- 建议：方案 B（保持灵活性，降低迁移风险）
- 影响：用户体验和账号管理复杂度

决策 3：订阅消息优先级
- 5 个模板全部实现 vs 先实现核心 2-3 个
- 核心推荐：考勤通知 + 课时变动 + 课程反馈
- 可延后：上课提醒（需定时任务）、请假审批（频率低）
- 建议：先实现 3 个核心模板，后续迭代
- 影响：开发周期和用户体验

决策 4：个人中心页面范围
- 方案 A：最小化（仅头像+昵称+退出登录）
- 方案 B：标准版（头像+昵称+手机号+订阅管理+退出登录）
- 方案 C：完整版（含消息中心、绑定管理、设置等）
- 建议：方案 B（满足需求，不过度设计）
- 影响：前端工作量

### 6.2 需要第三方配置的内容（Owner 手动完成）

配置 1：微信小程序注册
- 平台：mp.weixin.qq.com
- 产出：AppID + AppSecret
- 阻塞：是（P0）

配置 2：服务器域名白名单
- 平台：小程序后台 → 开发管理 → 服务器域名
- 内容：request 合法域名 → 后端 API 域名
- 阻塞：是（生产环境 P0，开发阶段可跳过）

配置 3：服务类目确认
- 平台：小程序后台 → 设置 → 基本设置 → 服务类目
- 建议：教育 → 在线教育
- 阻塞：是（影响模板申请和审核）

配置 4：隐私协议
- 平台：小程序后台 → 设置 → 基本设置 → 用户隐私保护指引
- 内容：说明收集 openid、手机号的用途
- 阻塞：是（审核必须）

配置 5：订阅消息模板
- 平台：小程序后台 → 订阅消息 → 公共模板库
- 需申请：上课提醒、考勤通知、课时变动、课程反馈、审批结果
- 产出：5 个模板 ID
- 阻塞：是（订阅消息功能的前置条件）

---

## 七、风险与注意事项

### 7.1 技术风险

风险 1：session_key 安全
- 微信规定 session_key 不能传到前端
- 后端保存 session_key 用于解密加密数据
- 建议：session_key 存 Redis，设置 2 小时过期

风险 2：access_token 并发刷新
- 多个请求同时发现 access_token 过期 → 并发刷新
- 解决：使用单例模式 + 刷新锁
- 或使用微信的 stable_token 接口（更稳定）

风险 3：订阅消息授权衰减
- 用户每次授权只对单次有效
- 长期订阅需要特殊资质（教培类可能申请不到）
- 解决：在关键操作后反复引导授权
- 解决：引导用户勾选"总是保持以上选择"

### 7.2 合规风险

风险 4：用户隐私合规
- 微信审核要求小程序有隐私协议
- 收集 openid 需明确告知用途
- 手机号收集需用户主动授权

风险 5：小程序审核
- 教育类小程序可能需要资质证明
- 订阅消息功能需在审核时说明用途
- 建议：先提交体验版测试，确认无问题后提审

---

## 八、总结

### 当前准备度

微信登录：⚠️ 基础已备，待实现
- 数据库字段已预留（openid, unionid）
- 配置体系已预留（appid, secret）
- 前端入口已预留（onWechatLogin）
- 后端认证体系完整，可扩展

订阅消息：❌ 从零开始
- 无任何相关代码
- 需申请模板
- 需实现完整发送链路

### 总工作量估算

Phase 1（基础配置）：1 天
Phase 2（微信登录）：2-3 天
Phase 3（订阅消息）：3-5 天
总计：6-9 天

### 关键阻塞项

1. AppID + AppSecret（Owner 配置）
2. 服务器域名（Owner 配置）
3. 订阅消息模板（Owner 申请）
4. 隐私协议（Owner 配置）

以上 4 项均需 Owner 在微信公众平台手动完成，AI 无法代为操作。

---

*文档版本：v1.0*
*创建人：EOS Research Agent*
*审核状态：待 Owner 决策*
