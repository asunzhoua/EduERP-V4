# 微信小程序 Reality Audit

## 审计时间
2026-07-26

## 1. 页面清单

### 1.1 家长端（Student 角色 — 取代 Parent 角色）
> 说明：小程序实际使用 `student` 命名，无独立的 `parent` 页面。家长通过登录 Student 角色账户查看子女数据。

| 页面 | 路径 | 4文件齐全 | 状态 | 说明 |
|------|------|:---------:|:----:|------|
| 首页 | pages/student/index | ✅ | ✅ 完整 | 学习概览、合同列表、最近课时、请假入口 |
| 班级列表 | pages/student/classes | ✅ | ✅ 完整 | 显示合同列表映射为班级，可跳详情 |
| 班级详情 | pages/student/class-detail | ✅ | ✅ 完整 | 班级基本信息、进度、出勤入口 |
| 出勤记录 | pages/student/attendance | ✅ | ✅ 完整 | 出勤统计（到课率/到课/缺勤/迟到/请假） |
| 课时记录 | pages/student/lessons | ✅ | ✅ 完整 | 课时列表 + 状态筛选，统计数据 |
| 个人中心 | pages/student/profile | ✅ | ✅ 完整 | 学生信息、合同列表、学习概览、出勤率 |
| 请假申请 | pages/student/leave-apply/leave-apply | ✅ | ✅ 完整 | 选课程 → 请假类型 → 日期 → 原因 → 附件 |
| 请假记录 | pages/student/leave-records/leave-records | ✅ | ✅ 完整 | 异常记录列表，过滤、跳详情 |
| 异常详情 | pages/student/exception-detail/exception-detail | ✅ | ✅ 完整 | 异常详情 + 审批意见 + 补课安排 |

### 1.2 教师端

| 页面 | 路径 | 4文件齐全 | 状态 | 说明 |
|------|------|:---------:|:----:|------|
| 课程列表 | pages/teacher/courses | ✅ | ✅ 完整 | 搜索、分页、下拉刷新、上拉加载 |
| 课程详情 | pages/teacher/course-detail | ✅ | ✅ 完整 | 课程信息、跳转班级 |
| 班级列表 | pages/teacher/classes | ✅ | ✅ 完整 | 筛选、进度计算、跳详情/学生/记录 |
| 班级详情 | pages/teacher/class-detail | ✅ | ✅ 完整 | 多 Tab（信息/学生/课时），出勤率 |
| 学生列表 | pages/teacher/students | ✅ | ✅ 完整 | 搜索、班级过滤、首字母索引 |
| 学生详情 | pages/teacher/student-detail | ✅ | ✅ 完整 | 学生信息、班级、进度 |
| 课时记录 | pages/teacher/lesson-record | ✅ | ✅ 完整 | 4步引导：选班级→选学生→输入→确认 |
| 个人中心 | pages/teacher/profile | ✅ | ✅ 完整 | 个人信息、班级统计、教学概览、退出 |
| 我的异常 | pages/teacher/my-exceptions/my-exceptions | ✅ | ✅ 完整 | 今日/历史/补课 Tab、跳详情 |
| 请假申请 | pages/teacher/leave-apply/leave-apply | ✅ | ✅ 完整 | 停课申请（SUSPEND），教师专用 |

### 1.3 管理端（Operation）

| 页面 | 路径 | 4文件齐全 | 状态 | 说明 |
|------|------|:---------:|:----:|------|
| Dashboard | pages/operation/dashboard/dashboard | ✅ | ✅ 完整 | 运营数据概览 + 数据导出按钮 |
| 异常列表 | pages/operation/exception-list/exception-list | ✅ | ✅ 完整 | 异常审批列表，过滤 |
| 异常审批 | pages/operation/exception-approve/exception-approve | ✅ | ✅ 完整 | 审批详情，通过/拒绝操作 |
| 补课查看 | pages/operation/reschedule-view/reschedule-view | ✅ | ✅ 完整 | 原课程+补课安排对比 |

### 1.4 公共/共享页面

| 页面 | 路径 | 4文件齐全 | 状态 | 说明 |
|------|------|:---------:|:----:|------|
| 登录 | pages/login/login | ✅ | ✅ 完整 | 用户名密码登录 + 微信授权（待实现） |
| 首页 | pages/index/index | ✅ | ✅ 完整 | 角色分流（教师端/学生端），仪表盘 |
| 提醒列表 | pages/reminder/list | ✅ | ✅ 完整 | 分页、筛选、标记已读、未读数 |
| 提醒详情 | pages/reminder/detail | ✅ | ✅ 完整 | 查看提醒、标记已读/忽略 |

## 2. API 调用情况

### 2.1 已调用 API — 认证

| 页面 | API 端点 | 方法 | 状态 |
|------|----------|:----:|:----:|
| login | /auth/login | POST | ✅ |
| app.js / teacher/profile | /auth/me | GET | ✅ |

### 2.2 已调用 API — 家长/学生端

| 页面 | API 端点 | 方法 | 状态 |
|------|----------|:----:|:----:|
| student/index, profile | /students/self | GET | ✅ |
| student/index, classes, profile | /students/self/contracts | GET | ✅ |
| student/index, lessons, leave-apply | /students/self/lessons | GET | ✅ |
| student/attendance, profile | /students/self/attendance | GET | ✅ |
| student/class-detail | /classes/{code} | GET | ✅ |
| student/leave-apply | /lessons/{lessonId}/leave | POST | ✅ |
| student/leave-records | /lesson-exceptions | GET | ✅ |
| student/exception-detail | /lesson-exceptions/{id} | GET | ✅ |
| student/exception-detail | /lesson-exceptions/{id}/reschedule | GET | ✅ |

### 2.3 已调用 API — 教师端

| 页面 | API 端点 | 方法 | 状态 |
|------|----------|:----:|:----:|
| index | /teacher/dashboard | GET | ✅ |
| index | /students/self/contracts | GET | ✅ (学生端) |
| index | /students/self/lessons | GET | ✅ (学生端) |
| courses | /courses | GET | ✅ |
| course-detail | /courses/{code} | GET | ✅ |
| classes | /classes | GET | ✅ |
| class-detail | /classes/{code} | GET | ✅ |
| class-detail | /classes/{code}/students | GET | ✅ |
| class-detail | /classes/{code}/lessons | GET | ✅ |
| students | /classes/{code}/students | GET | ✅ |
| students | /students | GET | ✅ |
| student-detail | /students (with studentCode) | GET | ✅ |
| student-detail | /enrollments/students/{code}/enrollments | GET | ✅ |
| lesson-record | /classes (ACTIVE) | GET | ✅ |
| lesson-record | /classes/{code}/students | GET | ✅ |
| lesson-record | /lessons | POST | ✅ |
| profile | /auth/me | GET | ✅ |
| profile | /teacher-assignments | GET | ✅ |
| profile | /classes | GET | ✅ |
| profile | /teacher/dashboard | GET | ✅ |
| profile | /classes/{code}/lessons | GET | ✅ |
| leave-apply | /teacher/assignments | GET | ✅ (实为停课) |
| leave-apply | /lessons/suspend | POST | ✅ |
| my-exceptions | /lesson-exceptions | GET | ✅ |

### 2.4 已调用 API — 管理端

| 页面 | API 端点 | 方法 | 状态 |
|------|----------|:----:|:----:|
| dashboard | /dashboard/overview | GET | ✅ |
| dashboard | /dashboard/lessons | GET | ✅ |
| dashboard | /dashboard/students | GET | ✅ |
| dashboard | /dashboard/teachers | GET | ✅ |
| dashboard | /dashboard/finance | GET | ✅ |
| dashboard | /export/{type} | POST | ✅ |
| exception-list | /lesson-exceptions | GET | ✅ |
| exception-approve | /lesson-exceptions/{id} | GET | ✅ |
| exception-approve | /lesson-exceptions/{id}/approve | PUT | ✅ |
| exception-approve | /lesson-exceptions/{id}/reject | PUT | ✅ |
| reschedule-view | /lesson-exceptions/{id} | GET | ✅ |
| reschedule-view | /lesson-exceptions/{id}/reschedule | GET | ✅ |

### 2.5 已调用 API — 提醒

| 页面 | API 端点 | 方法 | 状态 |
|------|----------|:----:|:----:|
| reminder/list | /reminders | GET | ✅ |
| reminder/list | /reminders/unread-count | GET | ✅ |
| reminder/list | /reminders/read-all | PATCH | ✅ |
| reminder/detail | /reminders/{id}/read | PATCH | ✅ |

### 2.6 API 问题

| 问题 | 说明 | 严重度 |
|------|------|:------:|
| 生产域名未配置 | config.js TODO: 替换为实际生产域名 | P0 |
| dashboard 端数据字段名可能不匹配 | WXML 使用 `overview.today.totalLessons` 但后端可能返回不同结构 | P1 |

## 3. 页面完成度

### 3.1 完整页面（结构+样式+逻辑+配置）
所有 27 个已注册页面均拥有完整的 4 文件结构（.wxml + .wxss + .js + .json）：
- ✅ pages/login/login
- ✅ pages/index/index
- ✅ pages/teacher/courses
- ✅ pages/teacher/course-detail
- ✅ pages/teacher/classes
- ✅ pages/teacher/class-detail
- ✅ pages/teacher/students
- ✅ pages/teacher/student-detail
- ✅ pages/teacher/lesson-record
- ✅ pages/teacher/profile
- ✅ pages/teacher/my-exceptions/my-exceptions
- ✅ pages/teacher/leave-apply/leave-apply
- ✅ pages/student/index
- ✅ pages/student/classes
- ✅ pages/student/class-detail
- ✅ pages/student/attendance
- ✅ pages/student/lessons
- ✅ pages/student/profile
- ✅ pages/student/leave-apply/leave-apply
- ✅ pages/student/leave-records/leave-records
- ✅ pages/student/exception-detail/exception-detail
- ✅ pages/operation/dashboard/dashboard
- ✅ pages/operation/exception-list/exception-list
- ✅ pages/operation/exception-approve/exception-approve
- ✅ pages/operation/reschedule-view/reschedule-view
- ✅ pages/reminder/list
- ✅ pages/reminder/detail

### 3.2 不完整页面
- ⚠️ 无（所有页面均已实现完整逻辑）

### 3.3 占位/存根功能

| 位置 | 问题 | 说明 |
|------|------|------|
| login.js `onWechatLogin()` | 微信授权登录 | 弹出"微信授权登录待实现"提示 |
| teacher/courses.js `createCourse()` | 创建课程 | 弹出"功能开发中"提示 |
| student/leave-apply `onSelectDate()` | 日期选择器 | 使用 wx.showModal 弹窗替代真实 date picker |
| teacher/leave-apply `onSelectDate()` | 日期选择器 | 同上 |
| teacher/profile.js `loadOverview()` | 月度统计 | `monthLessons` 硬编码为 0，注释"后端暂无月度统计" |
| config.js | 生产域名 | TODO: 替换为实际生产域名 |

## 4. 用户流程断点

### 4.1 家长流程
```
登录 → 首页 → 班级列表 → 班级详情 → 出勤记录/课时记录
  ↓      ↓        ↓           ↓            ↓
  ✅     ✅       ✅          ✅           ✅

登录 → 首页 → 请假申请 → 提交 → 请假记录 → 异常详情
  ↓      ↓       ↓         ↓       ↓         ↓
  ✅     ✅      ✅        ✅      ✅        ✅
```

**断点**：
- [x] 无流程断点（全部页面已实现）
- ⚠️ 请假申请日期选择使用模拟弹窗而非原生 date picker
- ⚠️ 微信授权登录未实现

### 4.2 教师流程
```
登录 → 首页 → 课程列表 → 课程详情 → 班级列表
  ↓      ↓       ↓          ↓          ↓
  ✅     ✅      ✅         ✅         ✅

登录 → 首页 → 课时记录(4步引导) → 提交考勤
  ↓      ↓         ↓                ↓
  ✅     ✅        ✅               ✅

登录 → 首页 → 个人中心 → 请假申请 → 提交
  ↓      ↓       ↓          ↓         ↓
  ✅     ✅      ✅         ✅        ✅
```

**断点**：
- [x] 无流程断点
- ⚠️ 教师端请假（停课）日期使用模拟弹窗
- ⚠️ 创建课程功能未实现（"功能开发中"）

### 4.3 管理员流程
```
登录 → 首页 → 运营看板(Dashboard) → 数据导出
  ↓      ↓          ↓                  ↓
  ✅     ✅         ✅                 ✅

登录 → 首页 → 异常列表 → 异常审批 → 补课查看
  ↓      ↓       ↓          ↓          ↓
  ✅     ✅      ✅         ✅         ✅
```

**断点**：
- [x] 无流程断点
- ⚠️ 运营 Dashboard 依赖后端 5 个独立接口，若任一接口失败则整页报错
- ⚠️ 导出功能实现但安全校验仅检查 storage 中 role，有安全风险

## 5. 缺失资源

### 5.1 图标
| 资源 | 路径 | 状态 |
|------|------|:----:|
| 首页图标 | images/home.png | ✅ 存在 |
| 首页-激活 | images/home-active.png | ✅ 存在 |
| 课程图标 | images/course.png | ✅ 存在 |
| 课程-激活 | images/course-active.png | ✅ 存在 |
| 班级图标 | images/class.png | ✅ 存在 |
| 班级-激活 | images/class-active.png | ✅ 存在 |
| 默认头像 | images/default-avatar.png | ✅ 存在 |
| Logo | images/logo.png | ✅ 存在 |

### 5.2 组件
| 资源 | 状态 |
|------|:----:|
| components/ | ❌ 空目录 |

### 5.3 工具函数
| 文件 | 状态 | 说明 |
|------|:----:|------|
| utils/request.js | ✅ | 完整封装：GET/POST/PUT/DELETE，含超时、重试、token 过期处理 |
| utils/lesson-exception-api.js | ✅ | 请假/停课/补课/审批 API 封装 |
| utils/export.js | ✅ | 数据导出（文件保存） |

### 5.4 脚本
| 文件 | 状态 | 说明 |
|------|:----:|------|
| scripts/gen_images.py | ✅ | 图标生成脚本 |

## 6. 代码质量观察

### 6.1 安全机制
- ✅ 所有页面实现角色守卫（防止 Student 访问 Teacher 页面等）
- ✅ request.js 统一管理 Token（含过期自动跳转登录）
- ✅ 网络状态监听与错误提示
- ✅ 超时重试机制（默认 1 次）

### 6.2 用户体验
- ✅ 所有页面含 loading/error/empty 三态处理
- ✅ 下拉刷新（onPullDownRefresh）
- ✅ 上拉加载更多（课程列表/提醒列表分页）
- ✅ 骨架屏加载效果（首页）
- ✅ Toast 错误反馈
- ⚠️ 部分页面使用 wx.showModal 替代原生组件（日期选择）

### 6.3 代码组织
- ✅ app.json 注册 27 个页面，路径全部正确
- ✅ tabBar 配置 3 个 Tab（首页/课程/班级），均指向教师端页面
- ❌ 学生端无独立 TabBar 入口 — 学生/家长用户需通过首页导航进入
- ⚠️ 空 components 目录，未使用自定义组件

## 7. 优化建议

### 7.1 高优先级（P0）
1. **配置生产域名** — config.js 中的 TODO 项，上线前必须完成
2. **补全日期选择器** — 使用原生 `<picker mode="date">` 替换 wx.showModal 模拟

### 7.2 中优先级（P1）
1. **微信授权登录** — 实现 onWechatLogin 真实逻辑
2. **创建课程功能** — 完成 teacher/courses 的 createCourse
3. **月度统计 API** — 对接后端提供 teacher/profile 的月度课时和出勤率
4. **运营 Dashboard 容错** — 单个模块失败不应影响其他模块
5. **家长端 TabBar 入口** — 学生/家长角色下 TabBar 应展示适配的首页

### 7.3 低优先级（P2）
1. **自定义组件** — 将通用卡片/列表/表单抽象为 components
2. **动画效果** — 页面切换、列表加载过渡动画
3. **导出安全加固** — 导出按钮鉴权改用接口验证而非 localStorage
4. **empty 目录清理** — 删除 pages/teacher/students/ 和 lesson-record/ 等空目录

## 8. 结论

### 当前状态
| 指标 | 数值 |
|------|:----:|
| 页面总数 | 27 |
| 完整页面 | 27 |
| 不完整页面 | 0 |
| 占位功能 | 5 处（微信登录、创建课程、2个日期选择、月度统计） |
| 待办标记 | 1 处（config.js 生产域名） |
| 流程断点 | 0 |
| 缺失资源 | 1 处（空 components 目录） |

### 优化工作量估算
| 优先级 | 工作量 | 说明 |
|:------:|:------:|------|
| P0 | 0.5 天 | 域名配置 + 日期选择器修复 |
| P1 | 2 天 | 微信登录、创建课程、月度API、Dashboard容错、TabBar |
| P2 | 1 天 | 组件抽象、动画、安全加固、目录清理 |

**总体评估**：小程序前端代码质量较高，27 个页面全部完整实现且 API 调用齐全。主要问题在于少量占位功能和生产配置，无结构性缺失或流程断点。
