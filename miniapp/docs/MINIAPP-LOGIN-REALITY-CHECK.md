# 微信登录 Reality Check

## 检查时间
2026-07-27

## 1. 当前登录实现

### 1.1 登录页面
- 文件：`pages/login/login.js`
- 当前实现：**stub（占位实现）**
- `onWechatLogin()` 方法仅显示 Toast "微信授权登录待实现"，未调用 `wx.login()`

### 1.2 登录流程（当前）
```javascript
// 当前实现
onWechatLogin() {
  // 微信授权登录（待实现）
  wx.showToast({ title: '微信授权登录待实现', icon: 'none' });
}
```

### 1.3 用户名密码登录（正常工作）
```javascript
async onLogin() {
  // 调用 wx.login()？ ❌
  // 获取 code？ ❌
  // 调用后端接口？ ✅ POST /auth/login { username, password }
  // 如何保存 token？ ✅ app.saveLoginInfo(token, user, expiresIn)
  // 页面跳转？ ✅ 根据角色跳转到对应首页
}
```

### 1.4 问题
- ❌ `onWechatLogin()` 未调用 `wx.login()`
- ❌ 未获取微信授权 code
- ❌ 使用模拟登录（待实现占位）
- ❌ 无独立的 auth.js 工具模块

## 2. 后端登录接口

### 2.1 现有接口定义
| 端点 | 方法 | 参数 | 返回 |
|------|------|------|------|
| `/auth/login` | POST | `{ username, password }` | `{ accessToken, refreshToken, expiresIn, user }` |
| `/auth/refresh` | POST | `{ refreshToken }` | `{ accessToken, refreshToken, expiresIn }` |
| `/auth/logout` | POST | (需 JWT) | 退出成功 |
| `/auth/me` | GET | (需 JWT) | `User` 对象 |

### 2.2 后端实现现状
- 用户名密码验证使用 bcrypt 比对
- JWT 签发包含: `sub, username, role, name`
- Token 有效期: 2 小时 accessToken + 7 天 refreshToken
- 登录日志记录到 login_log 表

### 2.3 微信登录支持情况
- User 实体已有 `openid`（unique, nullable）和 `unionid`（nullable）字段 ✅
- `configuration.ts` 已定义 `wechat.appid` 和 `wechat.secret` 配置项 ✅
- 但未实现 WeChat 登录端点 ❌
- 未实现 jscode2session 调用 ❌
- 未实现 openid → 用户查找/创建逻辑 ❌

## 3. 用户绑定逻辑

### 3.1 当前实现
- 微信 openid 获取方式：未实现
- 与系统用户绑定方式：未实现
- 新用户处理逻辑：未实现

### 3.2 问题
- ❌ 未实现 jscode2session 换取 openid
- ❌ 未实现 openid → 系统用户映射
- ❌ 未实现新用户注册

## 4. 修改计划

### 4.1 需要修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `pages/login/login.js` | 修改 | 实现真实微信登录流程 |
| `pages/login/login.wxml` | 无需修改 | 已包含微信授权按钮 |
| `utils/auth.js` | 新增 | token 管理工具函数 |
| `app.js` | 无需修改 | 已有完整的登录状态管理 |

**后端：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `auth.controller.ts` | 修改 | 添加 `POST /auth/wechat-login` 端点 |
| `auth.service.ts` | 修改 | 实现 jscode2session + openid 登录逻辑 |
| `login.dto.ts` | 修改 | 添加 `WechatLoginDto` |

### 4.2 前端实现代码

**login.js (wechat 部分)**:
```javascript
async onWechatLogin() {
  this.setData({ loading: true });
  try {
    const { code } = await wx.login();
    if (!code) {
      wx.showToast({ title: '微信授权失败', icon: 'none' });
      return;
    }
    const data = await post('/auth/wechat-login', { code });
    app.saveLoginInfo(data.accessToken, data.user, data.expiresIn);
    const role = data.user.role;
    setupTabBarByRole(role);
    const homePage = getHomePage(role);
    wx.switchTab({ url: homePage });
  } catch (err) {
    wx.showToast({ title: err.message || '微信登录失败', icon: 'none' });
  } finally {
    this.setData({ loading: false });
  }
}
```

**utils/auth.js**:
```javascript
export function getToken() { return wx.getStorageSync('token'); }
export function setToken(token) { wx.setStorageSync('token', token); }
export function clearToken() { wx.removeStorageSync('token'); wx.removeStorageSync('tokenExpiry'); }
export function isLoggedIn() { return !!getToken(); }
```

### 4.3 后端实现

**auth.controller.ts** - 添加端点:
```typescript
@Public()
@Post('wechat-login')
@HttpCode(HttpStatus.OK)
async wechatLogin(@Body() wechatLoginDto: WechatLoginDto, @Req() req: any) {
  const result = await this.authService.wechatLogin(
    wechatLoginDto.code,
    req.ip,
    req.headers['user-agent'],
  );
  return ApiResponse.success(result);
}
```

**auth.service.ts** - 添加方法:
```typescript
async wechatLogin(
  code: string, ip?: string, device?: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: Partial<User> }> {
  // 1. 调用微信 jscode2session 接口
  const wxResult = await this.getWxSession(code);
  const { openid, unionid } = wxResult;
  
  // 2. 查找或创建用户
  let user = await this.userRepository.findByOpenid(openid);
  if (!user) {
    throw new UnauthorizedException('微信用户未绑定系统账号，请联系管理员');
  }
  
  // 3. 生成 JWT
  const payload = { sub: user.id, username: user.username, role: user.role, name: user.name };
  const accessToken = this.jwtService.sign(payload, { expiresIn: '2h' });
  // ... 返回 token 和用户信息
}
```

## 5. 风险评估

### 5.1 影响范围
- ✅ 仅修改登录流程和新增微信登录端点
- ✅ 不涉及现有业务逻辑
- ✅ 不影响核心业务链
- ✅ 不修改权限模型
- ✅ username/password 登录完全不受影响

### 5.2 兼容性
- ✅ `wx.login()` 基础库 1.0.0+ 支持
- ✅ 所有微信版本兼容
- ✅ 新建端点不破坏现有接口

### 5.3 安全性
- ✅ 使用微信官方 jscode2session 授权
- ✅ code 一次性有效
- ✅ JWT token 安全存储
- ✅ 后端验证 code 有效性
- ⚠️ 需配置 WECHAT_APPID / WECHAT_SECRET

## 6. 结论

**当前状态**：
- ❌ `onWechatLogin()` 是 stub 占位
- ❌ 未接入微信授权
- ❌ 未实现后端 jscode2session 换 openid

**修改方案**：
- ✅ 前端：调用 `wx.login()` 获取 code → 发送后端
- ✅ 后端：新增 `POST /auth/wechat-login` 端点
- ✅ 复用 User.openid 字段进行用户映射
- ✅ 后端已有微信配置基础设施

**预计工作量**：
- 前端修改 1 个文件 + 新增 1 个工具模块
- 后端修改 2 个文件 + 1 个 DTO
- 新增 ~120 行代码
