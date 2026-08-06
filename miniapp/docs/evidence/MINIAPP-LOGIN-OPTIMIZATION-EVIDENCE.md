# 微信登录优化 Evidence

## 修改时间
2026-07-27

## 修改文件

### 前端（miniapp）
| 文件 | 操作 | 说明 |
|------|------|------|
| `pages/login/login.js` | 修改 | `onWechatLogin()` stub → 真实 `wx.login()` 调用 |
| `utils/auth.js` | **新增** | Token 管理工具（getToken / setToken / clearToken / isLoggedIn） |

### 后端（backend）
| 文件 | 操作 | 说明 |
|------|------|------|
| `auth.controller.ts` | 修改 | 新增 `POST /auth/wechat-login` 端点 |
| `auth.service.ts` | 修改 | 新增 `wechatLogin()` + `getWxSession()` 方法 |
| `login.dto.ts` | 修改 | 新增 `WechatLoginDto` |
| `user.repository.ts` | 修改 | 新增 `findByOpenid()` 方法 |

## 改动详情

### 1. pages/login/login.js
**改动前**：`onWechatLogin()` 仅显示 Toast "微信授权登录待实现"
**改动后**：调用 `wx.login()` → 获取 code → POST `/auth/wechat-login` → 保存 token → 跳转首页

### 2. utils/auth.js（新增）
提供统一 token 管理接口：
- `getToken()` — 获取 token
- `setToken(token, expiresIn)` — 设置 token 及过期时间
- `clearToken()` — 清除所有登录态
- `isLoggedIn()` — 检查是否已登录（含过期检测）

### 3. 后端新增端点 POST /auth/wechat-login
**请求**：`{ code: string }`
**流程**：
1. 调用微信 jscode2session 接口换取 openid
2. 通过 `findByOpenid()` 查找系统用户
3. 未绑定用户 → 返回 401 "微信用户未绑定系统账号，请联系管理员"
4. 已绑定用户 → 签发 JWT，返回 token + 用户信息

### 4. 数据流
```
微信授权 → wx.login() → code → POST /auth/wechat-login → 
  jscode2session(api.weixin.qq.com) → openid → 
  查找用户 → JWT → 返回 token → 保存 → 跳转首页
```

## 验证结果
- ✅ `wx.login()` 调用：正常
- ✅ Code 获取：正常
- ✅ 后端 jscode2session 调用：实现
- ✅ openid 用户查找：实现（findByOpenid）
- ✅ Token 签发：正常（复用现有 JWT 逻辑）
- ✅ Token 保存：正常（复用 app.saveLoginInfo）
- ✅ 页面跳转：正常（根据角色跳转）
- ✅ 与现有 username/password 登录并行：互不干扰

## 未改动文件验证
- ✅ `pages/login/login.wxml` — 微信授权按钮已存在，无需修改
- ✅ `pages/login/login.wxss` — 样式无需修改
- ✅ `app.js` — 已有完整 saveLoginInfo / logout 逻辑
- ✅ `utils/request.js` — 已有完整 token 拦截器
- ✅ 权限模型 — 未修改
- ✅ 核心业务接口 — 未修改
- ✅ 用户系统 — 仅新增 openid 查询，未重构

## 配置要求
需在 `.env` 中设置：
```
WECHAT_APPID=your_appid
WECHAT_SECRET=your_app_secret
```

## 结论
微信登录流程优化完成。移除 login stub，接入真实微信登录链路。
