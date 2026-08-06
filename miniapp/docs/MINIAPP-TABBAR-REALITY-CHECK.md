# TabBar Reality Check

## 检查时间
2026-07-26

## 1. 当前 TabBar 配置

### app.json tabBar
```json
{
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#1890ff",
    "backgroundColor": "#ffffff",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "images/home.png",
        "selectedIconPath": "images/home-active.png"
      },
      {
        "pagePath": "pages/teacher/courses",
        "text": "课程",
        "iconPath": "images/course.png",
        "selectedIconPath": "images/course-active.png"
      },
      {
        "pagePath": "pages/teacher/classes",
        "text": "班级",
        "iconPath": "images/class.png",
        "selectedIconPath": "images/class-active.png"
      }
    ]
  }
}
```

**问题**：
- ❌ TabBar 仅配置教师端入口（课程、班级均为教师页面）
- ❌ 家长/学生无独立 TabBar 入口
- ❌ 登录后所有角色统一跳转 `/pages/index/index`（本质是教师首页）

## 2. 登录状态

### 登录页面
- 文件：`pages/login/login.js`
- 协议：`POST /auth/login` → `{ accessToken, user, expiresIn }`
- 存储：`app.saveLoginInfo(accessToken, user, expiresIn)` → `wx.setStorageSync('token', token)`
- 用户信息：`app.globalData.userInfo`
- 角色字段：`data.user.role`

### 当前登录后跳转逻辑（login.js）
```javascript
const role = data.user.role;
if (role === 'Teacher') {
  wx.switchTab({ url: '/pages/index/index' });
} else if (role === 'Student' || role === 'Parent') {
  wx.switchTab({ url: '/pages/index/index' });  // 全部去同一页面
} else {
  wx.switchTab({ url: '/pages/index/index' });
}
```

**问题**：
- ❌ 所有角色跳转到同一个页面
- ❌ `wx.switchTab` 只能跳转到 TabBar 中注册的页面
- ❌ 无法通过 switchTab 跳转到 `pages/student/index`（未在 TabBar 注册）

## 3. 页面映射

### 教师端页面
| 页面 | 路径 | 角色守卫 |
|------|------|----------|
| 教师首页 | pages/index/index | ✅ 已支持多角色（根据 role 显示不同内容） |
| 课程管理 | pages/teacher/courses | ✅ 已拦截 Student/Parent → index |
| 班级管理 | pages/teacher/classes | ✅ 已拦截 Student/Parent → index |
| 课时记录 | pages/teacher/lesson-record | ❌ 无守卫 |
| 学生管理 | pages/teacher/students | ❌ 无守卫 |
| 个人中心 | pages/teacher/profile | ❌ 无守卫 |

### 学生/家长端页面
| 页面 | 路径 | 角色守卫 |
|------|------|----------|
| 孩子学习 | pages/student/index | ✅ 已拦截 Teacher → index |
| 孩子课程 | pages/student/classes | ❌ 无守卫（但 API 有服务端鉴权） |
| 出勤记录 | pages/student/attendance | ✅ 已拦截 Teacher |
| 课时记录 | pages/student/lessons | ✅ 已拦截 Teacher |
| 个人中心 | pages/student/profile | ✅ 已拦截 Teacher |

### 核心发现
| 角色 | 推荐首页 | 当前 TabBar 状态 |
|------|----------|------------------|
| 教师 | pages/index/index | ✅ 已有 TabBar 入口 |
| 家长 | pages/student/index | ❌ 未配置 TabBar |
| 学生 | pages/student/index | ❌ 未配置 TabBar |
| 管理员 | pages/operation/dashboard/dashboard | ❌ 未配置 TabBar |

## 4. 技术约束

### 微信 TabBar 关键限制
1. **`wx.setTabBarItem()` 只能修改 text / iconPath / selectedIconPath**
2. **无法动态修改 `pagePath`** — 每个 Tab 的页面路由在 `app.json` 中静态声明
3. **max 5 个 Tab**

**影响**：无法为不同角色配置完全不同的页面路由 TabBar。

### 可行方案对比

| 方案 | 可行性 | 工作量 | 用户体验 |
|------|--------|--------|----------|
| A. 统一 TabBar + 角色内页跳转 | ✅ | 低 | 良好 |
| B. `reLaunch` 角色重定向 | ✅ | 低 | 可接受 |
| C. 纯 `navigateTo` 导航 | ✅ | 无需修改 | 当前状态 |
| D. 动态 TabBar（修改 pagePath） | ❌ 不支持 | — | — |

### 推荐方案：统一 TabBar + 角色内页跳转

**原理**：
1. 在 `app.json` 中注册 3~4 个通用 TabBar 页面
2. 登录后通过 `wx.setTabBarItem()` 修改 Tab 文字和图标
3. 各 Tab 页面在 `onLoad` 中做角色检测：
   - 页面内容适合该角色 → 正常显示
   - 页面内容不适合该角色 → `wx.reLaunch()` 重定向到角色合适的页面

## 5. 现有代码分析

### app.js 流程
```
onLaunch
  → 读取 wx.getStorageSync('token')
  → 检查过期
  → 有效则 get('/auth/me') 获取用户信息
  → 存入 globalData.userInfo
```

### 登录流程
```
login.js onLogin
  → post('/auth/login', { username, password })
  → app.saveLoginInfo(token, user, expiresIn)
  → switchTab 到对应首页
```

### 角色值
```javascript
// 从 index.js 确认的角色枚举
role: 'Teacher' | 'Student' | 'Parent' | 'Admin'
```

## 6. 修改计划

### 6.1 需要修改/新增的文件
| 文件 | 操作 | 说明 |
|------|------|------|
| `app.json` | 修改 | 添加 `pages/student/index` 到 tabBar |
| `utils/role.js` | 新增 | 角色判断工具函数 |
| `pages/login/login.js` | 修改 | 登录后按角色设置 TabBar + 跳转 |
| `pages/teacher/courses.js` | 修改 | 优化 Student/Parent 重定向目标 |
| `pages/teacher/classes.js` | 修改 | 优化 Student/Parent 重定向目标 |

### 6.2 TabBar 配置方案

**统一 TabBar（app.json）**：
```json
{
  "list": [
    { "pagePath": "pages/index/index", "text": "首页" },
    { "pagePath": "pages/teacher/courses", "text": "课程" },
    { "pagePath": "pages/teacher/classes", "text": "班级" },
    { "pagePath": "pages/student/index", "text": "学习" }
  ]
}
```

**教师视图**（通过 `wx.setTabBarItem` 调整）：
| Tab | 页面 | 显示文字 | 说明 |
|-----|------|----------|------|
| 1 | pages/index/index | 首页 | 教师仪表盘 |
| 2 | pages/teacher/courses | 课程 | 课程管理 |
| 3 | pages/teacher/classes | 班级 | 班级管理 |
| 4 | pages/student/index | 个人 | 重定向到 teacher/profile |

**学生/家长视图**：
| Tab | 页面 | 显示文字 | 说明 |
|-----|------|----------|------|
| 1 | pages/index/index | 首页 | 学生仪表盘 |
| 2 | pages/teacher/courses | 课程 | 重定向到 student/classes |
| 3 | pages/teacher/classes | 学习 | 重定向到 student/lessons |
| 4 | pages/student/index | 我的 | 学生个人中心 |

### 6.3 实现要点
1. 登录后调用 `setupTabBarByRole(role)` 配置 TabBar 文字和图标
2. 教师端 Tab 4（pages/student/index）在 `onLoad` 中重定向到 `pages/index/index`
3. 学生端 Tab 2 和 Tab 3 在 `onLoad` 中重定向到对应学生页面
4. 创建 `utils/role.js` 封装 `getHomePage()`、`isTeacher()` 等工具函数

## 7. 风险评估

### 7.1 影响范围
- ✅ 仅修改前端代码
- ✅ 不涉及后端业务逻辑
- ✅ 不影响现有 API

### 7.2 兼容性
- ⚠️ `wx.setTabBarItem()` 需要基础库 2.5.0+
- ✅ 当前主流基础库版本已支持
- ⚠️ `wx.reLaunch()` 会关闭所有页面，影响页面栈
- ✅ 仅在角色不匹配时触发一次，不影响正常操作

### 7.3 风险缓解
- 角色守卫逻辑已在多个页面中实现（teacher/courses, teacher/classes, student/index），本次修改只是优化重定向目标
- 所有修改均可独立测试
- 不涉及后端 API 变更

## 8. 结论

**当前状态**：
- ❌ TabBar 仅配置教师端入口
- ❌ 登录后所有角色跳转同一页面
- ✅ 登录流程已实现
- ✅ 角色字段已存在（Teacher/Student/Parent/Admin）
- ✅ pages/index/index 已支持多角色内容切换

**修改方案**：
- 统一 TabBar（4 Tab）+ 登录后角色化配置
- 角色页内重定向优化
- 新增 utils/role.js 工具函数
- 修改 4 个文件，新增 1 个文件

**预计工作量**：
- 修改 4 个文件
- 新增 1 个文件
- 新增约 80 行代码
