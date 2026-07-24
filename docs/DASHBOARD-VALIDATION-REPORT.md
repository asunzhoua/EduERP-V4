# Dashboard 验证报告

## 验证时间
2026-07-24

## 验证范围
- 管理员进入
- 查看数据
- 切换页面
- 异常状态

## 验证结果

### 1. 管理员进入
- 入口位置: 首页 `pages/index/index.wxml` 快捷入口区域 "📊 运营看板" 按钮
- 访问角色: Admin / SuperAdmin（`wx:if="{{role === 'Admin' || role === 'SuperAdmin'}}"` 控制可见性）
- 跳转逻辑: `wx.navigateTo({ url: '/pages/operation/dashboard' })` ✅
- 页面注册: `app.json` 第19行 `"pages/operation/dashboard"` ✅
- Dashboard 内部二次权限校验: `onLoad` 检查 `userInfo.role`，非管理员显示 "🔒 无访问权限" ✅
- 返回逻辑: `wx.switchTab({ url: '/pages/index/index' })` ✅（index 是 tabBar 页面）
- Status: ✅ PASS

### 2. 查看数据
- 页面显示: ✅ 骨架屏加载 → 指标卡片 + 趋势图表
- 数据加载: ✅ `Promise.all` 并行请求 `/analytics/institution` + `/analytics/institution/trend`
- 图表渲染: ✅ 纯 CSS 柱状图（heightPercent 计算 + animation-delay 动画）
- 空状态: ✅ 每个 Tab 独立空状态引导（学员/课程/趋势）
- 响应格式: 后端 `ApiResponse.success()` → `{ code: 0, data: result }` → request.js 检查 `code === 0` → 解包 `data` ✅
- 数据映射: 后端返回 `MetricItem[]`（`{ name, value, unit }` 数组）→ 前端 `processMetrics` 转为 key-value map ✅
- Status: ✅ PASS

### 3. 数据展示
- 统计数据: ✅ totalStudents / activeStudents / totalClasses / activeRate（前端计算活跃率）
- 趋势数据: ✅ enrollmentTrend（学员增长）+ lessonTrend（课时完成）
- 实时数据: ✅ 下拉刷新 `onPullDownRefresh` + 手动刷新按钮 `onManualRefresh`
- 数据格式化: ✅ 日期 MM/DD 短格式 + 趋势摘要（总计/日均/最高）
- 时间范围: ✅ 7天/30天 切换（segmented control）
- 指标说明: ✅ 每个指标卡片有 ℹ️ tooltip 点击展示说明文案
- Status: ✅ PASS

### 4. 页面切换
- Tab 切换: ✅ 3个 Tab（学员概览/课程概览/趋势分析）均有独立内容区域
  - Tab 0 (学员概览): 4个指标卡片 + 新增学员趋势柱状图
  - Tab 1 (课程概览): 2个指标卡片 + 课时完成趋势柱状图
  - Tab 2 (趋势分析): 学员增长 + 课时完成 双图表 + 趋势摘要
- 页面跳转: ✅ `wx.navigateTo` 进入，`wx.switchTab` 返回
- 返回逻辑: ✅ 无权限页面 "返回首页" 按钮 → `wx.switchTab`
- Status: ✅ PASS

### 5. 异常状态
- 网络错误: ✅ request.js 处理 timeout + 网络断开 + 自动重试（1次）
- 加载失败: ✅ error 状态显示 "⚠️ + 错误信息 + 重新加载按钮"
- 权限不足: ✅ 非管理员显示 "🔒 无访问权限 + 该页面仅对管理员开放 + 返回首页"
- 趋势独立错误: ✅ Tab 2 趋势数据有独立 `trendError` + `retryTrend` 按钮
- Token 过期: ✅ request.js 全局处理 `code === 2002` → 单例跳转登录
- Status: ✅ PASS

## 发现的问题

### ISSUE-001: activeStudents tooltip 描述与后端实际逻辑不匹配
- Severity: P2
- Location: `miniapp/pages/operation/dashboard.js:5`
- 问题: tooltip 描述为 "近7天内有登录记录或出勤记录的学员数量"，但后端 `getInstitutionMetrics` 实际返回的是 "当前处于 ACTIVE 在读状态的学员数量"（基于 enrollment.status = ACTIVE）
- Fix: 更新 tooltip 为 "当前处于在读状态的学员数量，反映实际在读规模。"
- Status: ✅ 已修复

### ISSUE-002: Enrollment trend 结束日期边界问题
- Severity: P2
- Location: `backend/src/modules/analytics/analytics.service.ts:462`
- 问题: `student.createTime` 是 DATETIME 类型，查询条件 `<= '2026-07-24'` 实际匹配到 `'2026-07-24 00:00:00'`，导致"今天"注册的学生被遗漏，趋势图最后一天始终为 0
- Fix: 改为 `< nextDay`（endDate + 1天），确保包含结束日期全天的数据
- Status: ✅ 已修复

## 修复记录
| Issue | File | Fix | Commit |
|-------|------|-----|--------|
| ISSUE-001 | miniapp/pages/operation/dashboard.js:5 | 更新 activeStudents tooltip 描述 | 待提交 |
| ISSUE-002 | backend/src/modules/analytics/analytics.service.ts:462 | enrollment trend 改用 < nextDay 包含全天数据 | 待提交 |

## 后端 API 验证

### GET /analytics/institution
- 权限: SuperAdmin, Admin ✅
- 返回: `{ metrics: [{ name, value, unit }] }` ✅
- 指标: totalStudents, activeStudents, totalCourses, totalClasses ✅
- 数据源: student 表（非删除）+ enrollment 表（ACTIVE 状态）+ course 表 + class 表 ✅

### GET /analytics/institution/trend?days=7|30
- 权限: SuperAdmin, Admin ✅
- 返回: `{ lessonTrend: TrendData[], enrollmentTrend: TrendData[] }` ✅
- lessonTrend: 按 scheduledDate（DATE 类型）分组统计每日课时数 ✅
- enrollmentTrend: 按 DATE(createTime) 分组统计每日新增学员数 ✅
- 日期范围: generateDateRange(days) 生成 [today-days+1, ..., today] ✅

## 结论
- Total Checks: 22
- Passed: 22
- Failed: 0
- Issues Found: 2（均为 P2）
- Issues Fixed: 2
- Tests: 992 tests / 80 suites ALL PASS
- Build: ✅ PASS (0 TS errors)
- Status: ✅ ALL PASS
