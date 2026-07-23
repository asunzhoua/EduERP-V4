# Evidence Summary — M-2026-07-25-EOS-MINIAPP-SCALE-READINESS-LONG-RUNNING-V1

## Phase 1 Batch 1.1 — 微信环境兼容扫描

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B1.1-001 | Fix | student/index.js: 移除 onShow 守卫，每次返回刷新数据 | miniapp/pages/student/index.js | ✅ PASS |
| B1.1-002 | Fix | student/attendance.js: .then → .finally，防止下拉刷新卡死 | miniapp/pages/student/attendance.js | ✅ PASS |
| B1.1-003 | Fix | student/lessons.js: .then → .finally，防止下拉刷新卡死 | miniapp/pages/student/lessons.js | ✅ PASS |
| B1.1-004 | Fix | teacher/courses.js: loadMore 失败时重置 hasMore，允许重试 | miniapp/pages/teacher/courses.js | ✅ PASS |
| B1.1-005 | Report | 完整扫描报告（15 页面 × 7 检查项） | docs/REAL-DEVICE-COMPATIBILITY-REPORT.md | ✅ PASS |

## 扫描结果摘要

- 扫描页面：15 个
- 检查项：7 项
- 发现问题：3 个低风险
- 已修复：3 个
- 测试状态：987 tests, 80 suites ALL PASS
- Commit SHA：38f4b09

## 7 项检查结果

1. **页面加载** — 15/15 页面均有 onLoad/loading/error 管理 ✅
2. **登录保持** — 三层防御（Storage + globalData + /auth/me 验证）✅
3. **Token失效** — 全局单例 handleTokenExpired + isLoggingOut 锁 ✅
4. **网络异常** — 预检 + 监听 + 重试 + 超时分类 ✅
5. **空数据** — 15/15 页面均有空状态 UI ✅
6. **长列表** — 修复 courses.js loadMore 失败后永久阻塞 ✅
7. **页面返回** — 修复 student/index.js 数据不刷新 + 下拉刷新卡死 ✅

---

## Phase 1 Batch 1.2 — 学生端稳定性检查

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B1.2-001 | Fix(P0) | index.js: loadData guard bug — 初始 loading=true 导致首次调用被拦截，页面永远卡在 loading。改用 _dataLoading 私有锁 | miniapp/pages/student/index.js | ✅ PASS |
| B1.2-002 | Fix(P0) | classes.js: 同 B1.2-001 相同 guard bug，同样修复 | miniapp/pages/student/classes.js | ✅ PASS |
| B1.2-003 | Fix(P1) | index.json + classes.json: 添加 enablePullDownRefresh:true（JS handler 存在但 JSON 配置缺失，下拉刷新不生效） | miniapp/pages/student/index.json, classes.json | ✅ PASS |
| B1.2-004 | Fix(P1) | index.wxml: wx:key='lessonDate' → wx:key='index'（lessonDate 不唯一导致渲染异常） | miniapp/pages/student/index.wxml | ✅ PASS |
| B1.2-005 | Fix(P2) | class-detail: 添加下拉刷新支持（onPullDownRefresh handler + enablePullDownRefresh config） | miniapp/pages/student/class-detail.js, class-detail.json | ✅ PASS |

### 扫描结果摘要

- 扫描页面：5 个（index / attendance / lessons / classes / class-detail）
- 检查项：5 大类（异常状态 / Loading / 错误恢复 / 数据一致性 / 用户体验）
- 发现问题：5 个（2×P0 + 2×P1 + 1×P2）
- 已修复：5 个
- 测试状态：987 tests, 80 suites ALL PASS
- Commit SHA：0fb2943

### 5 项检查结果

1. **异常状态** — 5/5 页面均有 error UI + retry 按钮 ✅（修复 index/classes guard bug 后 retry 可正常工作）
2. **Loading 状态** — 5/5 页面均有 loading spinner + 文案 ✅
3. **错误恢复** — request.js 三层防御（网络预检 + 自动重试 + 超时分类）+ 页面级 retry 按钮 ✅
4. **数据一致性** — index/classes 有 onShow 刷新；attendance/lessons 为叶子页面，onLoad 加载 ✅
5. **用户体验** — 修复下拉刷新配置缺失 + wx:key 不唯一问题 ✅

---

## Phase 2 Batch 2.1 — Backend Analytics Review

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B2.1-001 | Fix(P1) | getTeacherTrend: 合并 2 次 lessonRepository 查询为 1 次（消除重复 DB 查询） | analytics.service.ts | ✅ PASS |
| B2.1-002 | Fix(P1) | getStudentTrend: 合并 2 次 lessonAttendanceRepository 查询为 1 次（消除重复 DB 查询） | analytics.service.ts | ✅ PASS |
| B2.1-003 | Fix(P2) | Controller: 添加 days 参数验证（NaN 防护 + 范围限制 1-365） | analytics.controller.ts | ✅ PASS |
| B2.1-004 | Fix(P2) | 导出 MetricItem 接口修复 TS4053 编译错误 | analytics.service.ts | ✅ PASS |
| B2.1-005 | Fix(P2) | 测试 mock 泄漏修复（clearAllMocks → resetAllMocks + 重新初始化） | analytics.service.spec.ts | ✅ PASS |

### 扫描结果摘要

- 扫描文件：5 个（controller / service / module / controller.spec / service.spec）
- 检查项：5 大类（数据完整性 / 权限 / 查询性能 / 返回格式 / 错误处理）
- 发现问题：5 个（2×P1 + 3×P2）
- 已修复：5 个
- 测试状态：987 tests, 80 suites ALL PASS
- Build 状态：analytics 模块 0 errors（identity.module.ts 预存错误不在范围内）
- Commit SHA：fe81cdd

### 5 项检查结果

1. **数据完整性** — 学生 8 指标 + 教师 3 指标 + 机构 4 指标 + 3 个趋势端点 ✅ 完整
2. **权限** — 全局 JwtAuthGuard + RolesGuard，角色分配合理（学生/家长只能看自己，教师看自己，管理员看全部）✅
3. **查询性能** — 修复 getTeacherTrend 和 getStudentTrend 的重复查询（各减少 1 次 DB 查询）✅
4. **返回格式** — 统一 ApiResponse.success() 包装，MetricItem 结构一致 ✅
5. **错误处理** — 添加 days 参数 NaN 防护 + 范围限制，导出 MetricItem 修复编译错误 ✅

---

## Phase 2 Batch 2.2 — Operation Dashboard Basic Implementation

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B2.2-001 | New | Dashboard 页面逻辑（权限检查、数据加载、Tab切换、时间范围切换、趋势数据预处理） | miniapp/pages/operation/dashboard.js | ✅ PASS |
| B2.2-002 | New | Dashboard 页面配置（导航栏标题、下拉刷新） | miniapp/pages/operation/dashboard.json | ✅ PASS |
| B2.2-003 | New | Dashboard 页面结构（3个Tab、骨架屏、错误状态、空状态、纯CSS柱状图） | miniapp/pages/operation/dashboard.wxml | ✅ PASS |
| B2.2-004 | New | Dashboard 页面样式（指标卡片、柱状图、骨架屏动画） | miniapp/pages/operation/dashboard.wxss | ✅ PASS |
| B2.2-005 | Modify | 注册 pages/operation/dashboard 页面 | miniapp/app.json | ✅ PASS |
| B2.2-006 | Modify | 教师快捷入口新增「运营看板」（仅 Admin/SuperAdmin 可见） | miniapp/pages/index/index.wxml | ✅ PASS |
| B2.2-007 | Modify | 新增 goToDashboard() 导航方法 | miniapp/pages/index/index.js | ✅ PASS |

### 实现结果摘要

- 新增文件：4 个（dashboard.js/json/wxml/wxss）
- 修改文件：3 个（app.json / index.wxml / index.js）
- 总新增代码：775 行
- 功能：3 个 Tab（学员概览/课程概览/趋势分析）+ 时间范围选择（7天/30天）+ 纯CSS柱状图
- 权限控制：Admin/SuperAdmin 可见，其他角色显示无权限页面
- 数据策略：Promise.all 并行请求，Tab 切换不重请求，时间切换仅请求 trend
- 状态处理：骨架屏 + 错误重试 + 空状态 + 下拉刷新
- 后端修改：0（纯前端新增）
- 测试状态：987 tests, 80 suites ALL PASS
- Commit SHA：278a38a

### 验收结果

1. **Dashboard 页面可访问** — 页面注册到 app.json，入口添加到首页 ✅
2. **3 个 Tab 可切换** — 学员概览/课程概览/趋势分析，切换不重新请求 ✅
3. **数据正确显示** — 对接 /analytics/institution + /analytics/institution/trend ✅
4. **权限控制正确** — onLoad 检查 role，非 Admin 显示无权限 ✅
5. **测试通过** — 987 tests ALL PASS ✅
6. **Git commit + push** — 278a38a 已推送 ✅

---

## Phase 3 Batch 3.1 — 权限扫描与修复

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B3.1-001 | Fix(P1) | Analytics: 添加学生数据归属验证（Student/Parent 只能访问自己的 studentCode） | analytics.controller.ts | ✅ PASS |
| B3.1-002 | Fix(P2) | Reminder: 4个自助端点添加显式 @Roles 装饰器（findMyReminders/markAsRead/markAllAsRead/getUnreadCount） | reminder.controller.ts | ✅ PASS |
| B3.1-003 | Fix(P2) | Miniapp: 5个学生页面添加角色守卫（防止 Teacher 误入学生专属页面） | student/index.js, attendance.js, classes.js, lessons.js, class-detail.js | ✅ PASS |
| B3.1-004 | Test | 新增 5 个数据归属验证测试（Student 自有数据/越权拒绝/不存在拒绝/Parent 访问/Teacher 免检） | analytics.controller.spec.ts | ✅ PASS |

### 扫描结果摘要

- 扫描 Controller：13 个（全部有 @UseGuards + @Roles）
- 扫描 Service：数据隔离正确（self 端点使用 req.user.sub）
- 扫描 Miniapp 页面：15 个（全部有角色守卫或后端保护）
- 发现问题：3 类（1×P1 数据越权 + 2×P2 显式声明缺失）
- 已修复：3 类
- 测试状态：992 tests, 80 suites ALL PASS（新增 5 个测试）
- Commit SHA：c6ccfc3

### 扫描发现详情

**P1 — Analytics 数据越权（已修复）**
- 问题：`GET /analytics/student/:studentCode` 允许 Student/Parent 查询任意 studentCode
- 修复：添加 `verifyStudentAccess()` 方法，Student/Parent 只能查询 userId === req.user.sub 的学生
- 影响：2 个端点（getStudentMetrics + getStudentTrend）

**P2 — Reminder 缺少 @Roles（已修复）**
- 问题：4 个自助端点缺少显式 @Roles 装饰器（依赖 RolesGuard 默认放行）
- 修复：添加 @Roles('SuperAdmin', 'Admin', 'Teacher', 'Student', 'Parent')
- 影响：4 个端点

**P2 — 学生页面缺少前端角色守卫（已修复）**
- 问题：5 个学生页面没有前端角色守卫（后端 self 端点已保护，但 Teacher 访问会看到 404/空页面）
- 修复：添加 onLoad 角色检查，Teacher 重定向到首页
- 影响：5 个页面

---

## Phase 4 Batch 4.1 — 微信生产能力准备 Research

| Evidence ID | Type | Description | File | Status |
|:------------|:-----|:------------|:-----|:-------|
| B4.1-001 | Report | 微信生产能力接入计划文档（登录方案 + 订阅消息方案 + 架构支持度评估 + 第三方配置需求 + 实施计划 + Decision Gate） | docs/WECHAT-PRODUCTION-PLAN.md | ✅ PASS |

### Research 结果摘要

- 扫描文件：后端 auth 模块 + 前端 login 页面 + 配置文件 + 数据库 entity
- 评估维度：6 个（微信登录 / 订阅消息 / 架构支持度 / 第三方配置 / 实施计划 / Decision Gate）
- 关键发现：
  1. 数据库已预留 openid/unionid 字段 ✅
  2. 配置体系已预留 wechat.appid/secret ✅
  3. 前端已预留微信登录入口（placeholder）✅
  4. 后端认证体系完整，可扩展 ✅
  5. 订阅消息从零开始 ❌
  6. 最大阻塞项：AppID + AppSecret（需 Owner 配置）

### 文档内容覆盖

1. **微信登录方案** — 当前流程分析 + openid 绑定方案（3 场景）+ 用户关联设计 + 登录优化
2. **订阅消息方案** — 5 个模板设计 + 授权流程 + 发送逻辑 + 模板 ID 配置
3. **架构支持度** — 后端/前端/数据库三维评估，改动量预估
4. **第三方配置** — 微信公众平台 + 小程序后台 + 环境变量，分 P0-P3 优先级
5. **实施计划** — 3 阶段（基础配置 1 天 + 微信登录 2-3 天 + 订阅消息 3-5 天）
6. **Decision Gate** — 4 个 Owner 决策项 + 5 个第三方配置项

### 总工作量估算

- Phase 1（基础配置）：1 天
- Phase 2（微信登录）：2-3 天
- Phase 3（订阅消息）：3-5 天
- 总计：6-9 天

### 关键阻塞项

1. AppID + AppSecret（Owner 在微信公众平台获取）
2. 服务器域名白名单（Owner 配置）
3. 订阅消息模板（Owner 申请）
4. 隐私协议（Owner 配置）

- Commit SHA：e268bc0
