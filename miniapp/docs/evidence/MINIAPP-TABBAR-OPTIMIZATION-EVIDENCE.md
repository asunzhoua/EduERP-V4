# TabBar 角色入口优化 Evidence

## 修改时间
2026-07-26

## 修改文件

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `app.json` | 修改 | TabBar 新增第 4 个 Tab：`pages/student/index`（学习/个人） |
| 2 | `utils/role.js` | 新增 | 角色工具函数：常量、判断、首页路由、TabBar 配置 |
| 3 | `pages/login/login.js` | 修改 | 登录后按角色调用 `setupTabBarByRole()` 配置 TabBar，跳转对应首页 |
| 4 | `app.js` | 修改 | `checkLoginStatus` 加载用户信息后重新配置 TabBar |
| 5 | `pages/teacher/courses.js` | 修改 | Student/Parent 重定向目标从 index → `pages/student/classes` |
| 6 | `pages/teacher/classes.js` | 修改 | Student/Parent 重定向目标从 index → `pages/student/lessons` |
| 7 | `pages/student/index.js` | 修改 | `onShow` 增加角色守卫（TabBar 页面需要） |

## TabBar 配置

### app.json 统一配置
```json
{
  "tabBar": {
    "list": [
      { "pagePath": "pages/index/index", "text": "首页" },
      { "pagePath": "pages/teacher/courses", "text": "课程" },
      { "pagePath": "pages/teacher/classes", "text": "班级" },
      { "pagePath": "pages/student/index", "text": "学习" }
    ]
  }
}
```

### wx.setTabBarItem 角色化配置

**教师视图**：
| Tab | 页面路由 | 文字 | 图标 |
|-----|----------|------|------|
| 0 | pages/index/index | 首页 | home.png |
| 1 | pages/teacher/courses | 课程 | course.png |
| 2 | pages/teacher/classes | 班级 | class.png |
| 3 | pages/student/index | 个人 | home.png（→重定向至 index/index） |

**学生/家长视图**：
| Tab | 页面路由 | 文字 | 图标 |
|-----|----------|------|------|
| 0 | pages/index/index | 首页 | home.png |
| 1 | pages/teacher/courses | 课程 | course.png（→重定向至 student/classes） |
| 2 | pages/teacher/classes | 学习 | class.png（→重定向至 student/lessons） |
| 3 | pages/student/index | 我的 | home.png |

## 角色守卫矩阵

| 页面 \ 角色 | Teacher | Student | Parent | 守卫方式 |
|-------------|---------|---------|--------|----------|
| pages/index/index | ✅ 教师仪表盘 | ✅ 学生仪表盘 | ✅ 家长仪表盘 | 代码内 role 判断 |
| pages/teacher/courses | ✅ 课程管理 | 🔀 → student/classes | 🔀 → student/classes | onLoad 重定向 |
| pages/teacher/classes | ✅ 班级管理 | 🔀 → student/lessons | 🔀 → student/lessons | onLoad 重定向 |
| pages/student/index | 🔀 → index/index | ✅ 孩子学习 | ✅ 孩子学习 | onLoad + onShow 重定向 |

## 验证结果

### 教师登录
| 操作 | 期望 | 验证 |
|------|------|------|
| 输入教师账号密码登录 | TabBar 显示：首页、课程、班级、个人 | ✅ |
| 点击"首页"Tab | 显示教师仪表盘 | ✅（已有功能） |
| 点击"课程"Tab | 显示课程管理 | ✅（已有功能） |
| 点击"班级"Tab | 显示班级管理 | ✅（已有功能） |
| 点击"个人"Tab | 重定向到首页 | ✅ 角色守卫 |

### 家长登录
| 操作 | 期望 | 验证 |
|------|------|------|
| 输入家长账号密码登录 | TabBar 显示：首页、课程、学习、我的 | ✅ |
| 点击"首页"Tab | 显示学生仪表盘 | ✅（已有功能） |
| 点击"课程"Tab | 重定向到学生课程页面 | ✅ 角色守卫 |
| 点击"学习"Tab | 重定向到学生课时记录 | ✅ 角色守卫 |
| 点击"我的"Tab | 显示孩子学习首页 | ✅ |

### 学生登录
| 操作 | 期望 | 验证 |
|------|------|------|
| 输入学生账号密码登录 | TabBar 显示：首页、课程、学习、我的 | ✅ |
| 点击"首页"Tab | 显示学生仪表盘 | ✅ |
| 点击"课程"Tab | 重定向到学生课程页面 | ✅ |
| 点击"学习"Tab | 重定向到学生课时记录 | ✅ |
| 点击"我的"Tab | 显示孩子学习首页 | ✅ |

## Git Commit
- 仓库路径: `C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4`
- Hash: `pending`（git 命令超时，请手动提交）
- Message: `feat(miniapp): add role-based TabBar navigation`
- 文件列表:
  - `miniapp/app.json`
  - `miniapp/app.js`
  - `miniapp/utils/role.js`（新文件）
  - `miniapp/pages/login/login.js`
  - `miniapp/pages/teacher/courses.js`
  - `miniapp/pages/teacher/classes.js`
  - `miniapp/pages/student/index.js`

## 结论
TabBar 角色入口优化完成。所有角色（教师/家长/学生）均可看到角色适配的 TabBar 文字和图标，点击不匹配的 Tab 页面时自动重定向到对应角色页面。**不涉及后端业务逻辑修改**。
