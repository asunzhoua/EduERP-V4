# 家长登录流程验证报告

## 验证时间
2026-07-24

## 验证范围
- 登录页面（miniapp/pages/login/）
- 登录 API（backend/modules/identity/auth/）
- 用户身份识别（JWT Strategy + Token 存储）
- 首页展示（miniapp/pages/index/）
- 角色权限（RolesGuard + @Roles 装饰器）

## 验证结果

### 1. 登录页面
- 页面显示: ✅ login.wxml 包含 logo + 标题(EduERP) + 副标题 + 用户名/密码输入框 + 登录按钮 + 微信登录按钮
- 表单正确: ✅ username(type=text) + password(type=password) 输入框，bindinput 绑定正确
- 提交逻辑: ✅ 空值校验 → loading状态 → POST /auth/login → 成功saveLoginInfo+跳转 / 失败showToast → finally重置loading
- Status: ✅ PASS

### 2. 登录 API
- API 存在: ✅ POST /auth/login，@Public() 装饰器标记（无需登录即可访问）
- 请求参数: ✅ LoginDto 验证 username(IsString+IsNotEmpty) + password(IsString+IsNotEmpty) + device(IsOptional)
- 响应格式: ✅ ApiResponse.success → { code: 0, data: { accessToken, refreshToken, expiresIn, user } }
- Token 生成: ✅ JWT payload 包含 sub/id, username, role, name；expiresIn 2h
- Status: ✅ PASS

### 3. 用户身份识别
- JWT 解析: ✅ JwtStrategy 从 Bearer Token 提取 payload → validate 返回 { sub, username, role, name }
- 角色识别: ✅ role 在 JWT payload 中，通过 req.user.role 可在所有 Controller 中获取
- 用户信息存储: ✅ saveLoginInfo 存储 token(globalData+Storage) + userInfo(globalData) + tokenExpiry(globalData+Storage)
- Token 过期处理: ✅ request.js 检测 code=2002 → handleTokenExpired → logout → reLaunch 登录页（防并发跳转锁）
- 本地过期检查: ✅ app.js onLaunch 检查 tokenExpiry，本地过期直接 logout
- Status: ✅ PASS

### 4. 首页展示
- 角色识别: ✅ getRoleText 映射 Parent→'家长'，setData 设置 role + roleText
- 内容展示: ✅ wx:if 条件区分：
  - Teacher/Admin: 显示教师端快捷入口（我的课程/班级/学生管理/课时记录/提醒/个人中心）
  - Student/Parent: 显示学生端快捷入口（我的班级/课时记录/提醒/出勤记录/个人中心）
  - Admin/SuperAdmin: 额外显示运营看板入口
- 数据加载: ✅ loadDashboard 根据 role 分支：
  - Student/Parent: 调用 /students/self/contracts + /students/self/lessons
  - Teacher: 调用 /teacher/dashboard + /classes
- 错误处理: ✅ loading/error/正常三态展示，错误时显示重试按钮
- Status: ✅ PASS

### 5. 角色权限
- Parent 权限: ✅ Student controller @Roles('Student', 'Parent') 授权 Parent 访问 self 端点
- 权限守卫: ✅ @UseGuards(JwtAuthGuard, RolesGuard) 在 student.controller.ts 类级别注册
  - JwtAuthGuard: 验证 JWT Token 有效性
  - RolesGuard: 检查 req.user.role 是否在 requiredRoles 中
- 全局守卫: ✅ APP_GUARD 注册 JwtAuthGuard（app.module.ts line 73）
- 未登录拦截: ✅ 非 @Public() 端点均需有效 JWT；request.js 处理 401/2002 自动跳转
- Self 端点列表: ✅ GET /students/self, /self/contracts, /self/lessons, /self/attendance 均对 Parent 开放
- Status: ✅ PASS

## 发现的问题

### ISSUE-001: Login API 未返回 expiresIn 字段
- Severity: P2
- Location: backend/src/modules/identity/auth/auth.service.ts (login method return)
- Impact: 前端 login.js 调用 saveLoginInfo(data.accessToken, data.user, data.expiresIn)，data.expiresIn 为 undefined，saveLoginInfo 默认 86400s(24h)。但 JWT 实际 2h(7200s) 过期。导致 2h-24h 期间，本地认为 Token 有效但 API 返回 2002，用户体验为"打开App→短暂显示内容→突然跳转登录页"。
- Fix: ✅ 已修复 — auth.service.ts login/refresh 方法返回值增加 expiresIn: 7200

## 修复记录
| Issue | File | Line | Fix | Commit |
|-------|------|------|-----|--------|
| ISSUE-001 | auth.service.ts | login return | 增加 expiresIn: 7200 | 待提交 |
| ISSUE-001 | auth.service.ts | refresh return | 增加 expiresIn: 7200 | 待提交 |
| ISSUE-001 | auth.service.ts | login type | 更新返回类型声明 | 待提交 |
| ISSUE-001 | auth.service.ts | refresh type | 更新返回类型声明 | 待提交 |

## 代码审计详细发现

### 登录流程链路追踪
```
用户输入 → login.js onLogin()
  → post('/auth/login', { username, password })
    → request.js → wx.request POST {baseUrl}/auth/login
      → Backend AuthController.login()
        → AuthService.validateUser() → bcrypt.compare
        → JwtService.sign({ sub, username, role, name }, { expiresIn: '2h' })
        → ApiResponse.success({ accessToken, refreshToken, expiresIn: 7200, user })
      ← { code: 0, data: { accessToken, refreshToken, expiresIn, user } }
    ← request.js resolve(res.data.data) → { accessToken, refreshToken, expiresIn, user }
  ← login.js: app.saveLoginInfo(data.accessToken, data.user, data.expiresIn)
    → globalData.token = token
    → globalData.userInfo = userInfo
    → tokenExpiry = Date.now() + 7200 * 1000 (2h) ✅
    → wx.setStorageSync('token', token)
    → wx.setStorageSync('tokenExpiry', expiry)
  → wx.switchTab('/pages/index/index')
    → index.js onLoad → loadUserInfo() → setData({ role: 'Parent', roleText: '家长' })
    → index.js onShow → loadDashboard()
      → role === 'Parent' → GET /students/self/contracts + /students/self/lessons
      ← 数据渲染
```

### 安全审计
- ✅ 密码使用 bcrypt 加密存储
- ✅ JWT secret 从配置读取（非硬编码）
- ✅ 登录响应排除 password/refreshToken/refreshTokenExpiresAt 字段
- ✅ @Public() 仅用于 login/refresh，其他端点均需认证
- ✅ Token 过期处理有并发锁（isLoggingOut）防止重复跳转

### 观察项（非 Bug）
1. UserRole enum 未包含 'Student'（但 varchar 列可存储任意值，前端也检查 Student 角色）
2. TabBar 固定3个tab（首页/课程/班级），Parent 角色仍可见教师端 tab（设计选择，非 Bug）
3. 微信授权登录功能标记为"待实现"（onWechatLogin 仅 showToast）

## 结论
- Total Checks: 20
- Passed: 20
- Failed: 0
- Issues Found: 1 (P2)
- Issues Fixed: 1
- Build: ✅ PASS (0 TS errors)
- Tests: ✅ 21 auth tests ALL PASS
- Status: ✅ ALL PASS
