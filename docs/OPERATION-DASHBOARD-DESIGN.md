# 运营 Dashboard 页面设计文档

## 1. 概述

### 1.1 文档目的
定义微信小程序「运营 Dashboard」页面的完整设计方案，包括页面结构、数据来源、交互逻辑、技术实现和优先级规划。

### 1.2 版本信息
- 版本：v1.0
- 创建日期：2026-07-23
- 状态：初稿
- 所属 Mission：M-2026-07-25-EOS-MINIAPP-OPERATION-V1-LONG-RUNNING
- 所属 Batch：Phase 2 / Batch 2.2

---

## 2. 页面定位

### 2.1 目标用户
- 机构管理员（Admin / SuperAdmin 角色）

### 2.2 核心功能
- 运营数据可视化：将学员、课程、课时等核心数据以直观方式呈现
- 趋势分析：支持 7 天 / 30 天时间范围切换，查看增长趋势
- 快速决策：通过数据概览帮助管理员掌握机构运营状态

### 2.3 访问路径
- 入口 1：小程序首页（pages/index/index）→ 管理员角色可见「运营看板」快捷入口 → 跳转至 pages/operation/dashboard
- 入口 2：TabBar 新增第 4 个 Tab「运营」（仅 Admin/SuperAdmin 角色可见）

### 2.4 页面路径
- `pages/operation/dashboard`

### 2.5 权限控制
- 仅 Admin / SuperAdmin 角色可访问
- 其他角色访问时显示「无权限」提示页
- 权限校验逻辑：
  - 前端：onLoad 时检查 `app.globalData.userInfo.role`
  - 后端：API 层已有 `@Roles('SuperAdmin', 'Admin')` 守卫

---

## 3. 页面结构

### 3.1 整体布局
- 顶部：页面标题「运营看板」+ 时间范围选择器（7天 / 30天）
- 中部：Tab 切换栏（学员概览 / 课程概览 / 趋势分析）
- 底部：Tab 对应内容区域（支持下拉刷新）

### 3.2 三个 Tab 定义

#### Tab 1：学员概览
展示学员维度的核心运营数据。

#### Tab 2：课程概览
展示课程维度的核心运营数据。

#### Tab 3：趋势分析
展示时间维度的增长趋势图表。

---

## 4. Tab 1 — 学员概览

### 4.1 数据卡片区域

#### 4.1.1 核心指标卡片（第一行，2 列）
- 总学员数
  - 数值 + 单位「人」
  - 数据来源：`GET /api/v1/analytics/institution` → metrics[name=totalStudents].value
- 活跃学员数
  - 数值 + 单位「人」
  - 数据来源：`GET /api/v1/analytics/institution` → metrics[name=activeStudents].value

#### 4.1.2 辅助指标卡片（第二行，2 列）
- 总班级数
  - 数值 + 单位「个」
  - 数据来源：`GET /api/v1/analytics/institution` → metrics[name=totalClasses].value
- 活跃率
  - 百分比（活跃学员数 / 总学员数 × 100%）
  - 计算方式：前端计算，activeStudents / totalStudents × 100

### 4.2 新增学员趋势图
- 图表类型：折线图
- X 轴：日期（最近 7 天或 30 天）
- Y 轴：新增学员数
- 数据来源：`GET /api/v1/analytics/institution/trend?days=7|30` → enrollmentTrend[]
- 数据格式：`[{ date: "2026-07-17", value: 2 }, ...]`

### 4.3 学员状态分布
- 图表类型：环形图（饼图变体）
- 分类：
  - 在读（ACTIVE）：有活跃 enrollment 的学员
  - 休学（PAUSED）：status = PAUSED 的学员
  - 结业（GRADUATED）：status = GRADUATED 的学员
- 数据来源：
  - 在读数：`GET /api/v1/analytics/institution` → metrics[name=activeStudents].value
  - 休学/结业数：需后端新增接口或前端从总数推算
  - ⚠️ Decision Gate：当前后端 `getInstitutionMetrics()` 不返回学员状态分布明细，需要新增 API 或扩展现有 API

### 4.4 数据请求策略
- 页面加载时一次性请求 `GET /api/v1/analytics/institution` + `GET /api/v1/analytics/institution/trend?days=7`
- 切换时间范围时仅重新请求 trend 接口
- 数据缓存在 Page data 中，Tab 切换不重新请求

---

## 5. Tab 2 — 课程概览

### 5.1 数据卡片区域

#### 5.1.1 核心指标卡片（第一行，2 列）
- 总课程数
  - 数值 + 单位「个」
  - 数据来源：`GET /api/v1/analytics/institution` → metrics[name=totalCourses].value
- 总班级数
  - 数值 + 单位「个」
  - 数据来源：`GET /api/v1/analytics/institution` → metrics[name=totalClasses].value

#### 5.1.2 辅助指标卡片（第二行，2 列）
- 活跃课程数
  - 数值 + 单位「个」
  - ⚠️ Decision Gate：当前后端 `getInstitutionMetrics()` 不返回活跃课程数（status=PUBLISHED），需要扩展 API
- 课程利用率
  - 百分比（活跃课程数 / 总课程数 × 100%）
  - 计算方式：前端计算

### 5.2 课时完成趋势图
- 图表类型：柱状图
- X 轴：日期（最近 7 天或 30 天）
- Y 轴：每日课时数
- 数据来源：`GET /api/v1/analytics/institution/trend?days=7|30` → lessonTrend[]
- 数据格式：`[{ date: "2026-07-17", value: 5 }, ...]`

### 5.3 课程状态分布
- 图表类型：环形图
- 分类：
  - 进行中（ACTIVE 班级关联的课程）
  - 已结束（COMPLETED 班级关联的课程）
- 数据来源：
  - ⚠️ Decision Gate：当前后端无课程状态分布 API，需要新增

### 5.4 数据请求策略
- 复用 Tab 1 已请求的 institution metrics 数据
- 仅额外请求 trend 数据（如果 Tab 1 已请求相同 days 参数则复用）

---

## 6. Tab 3 — 趋势分析

### 6.1 学员增长趋势
- 图表类型：折线图
- X 轴：日期
- Y 轴：新增学员数
- 数据来源：`GET /api/v1/analytics/institution/trend?days=7|30` → enrollmentTrend[]
- 交互：支持 7天 / 30天 切换（复用顶部时间选择器）

### 6.2 课时完成趋势
- 图表类型：折线图
- X 轴：日期
- Y 轴：每日课时数
- 数据来源：`GET /api/v1/analytics/institution/trend?days=7|30` → lessonTrend[]
- 交互：支持 7天 / 30天 切换

### 6.3 综合趋势面板
- 布局：上下排列两个图表
- 每个图表高度：200rpx（适配小程序屏幕）
- 图表间距：20rpx

### 6.4 数据请求策略
- 复用已请求的 trend 数据
- 切换时间范围时重新请求 `GET /api/v1/analytics/institution/trend?days=7|30`
- 三个 Tab 共享同一份 trend 数据

---

## 7. 数据来源汇总

### 7.1 现有 API 映射

数据项 → API 端点 → 响应字段

- 总学员数 → `GET /api/v1/analytics/institution` → `metrics[name=totalStudents].value`
- 活跃学员数 → `GET /api/v1/analytics/institution` → `metrics[name=activeStudents].value`
- 总课程数 → `GET /api/v1/analytics/institution` → `metrics[name=totalCourses].value`
- 总班级数 → `GET /api/v1/analytics/institution` → `metrics[name=totalClasses].value`
- 新增学员趋势 → `GET /api/v1/analytics/institution/trend?days=N` → `enrollmentTrend[]`
- 课时完成趋势 → `GET /api/v1/analytics/institution/trend?days=N` → `lessonTrend[]`

### 7.2 需要新增的 API（Decision Gate）

以下数据项当前后端不支持，需要新增或扩展：

1. 活跃课程数（status=PUBLISHED 的课程数）
   - 方案 A：扩展 `getInstitutionMetrics()` 增加 activeCourses 指标
   - 方案 B：新增 `GET /api/v1/analytics/institution/courses` 接口
   - 推荐：方案 A（改动最小）

2. 学员状态分布（在读/休学/结业各多少人）
   - 方案 A：扩展 `getInstitutionMetrics()` 增加 studentStatusDistribution 指标
   - 方案 B：新增 `GET /api/v1/analytics/institution/student-distribution` 接口
   - 推荐：方案 A（改动最小）

3. 课程状态分布（进行中/已结束各多少门）
   - 方案 A：扩展 `getInstitutionMetrics()` 增加 courseStatusDistribution 指标
   - 方案 B：新增 `GET /api/v1/analytics/institution/course-distribution` 接口
   - 推荐：方案 A（改动最小）

### 7.3 API 请求汇总

页面完整加载需要 2 次 API 调用：
1. `GET /api/v1/analytics/institution` — 获取所有静态指标
2. `GET /api/v1/analytics/institution/trend?days=7|30` — 获取趋势数据

切换时间范围时仅需重新请求第 2 个接口。

---

## 8. 交互设计

### 8.1 Tab 切换
- 使用微信小程序自定义 Tab 组件（非原生 tabBar）
- Tab 栏固定在页面顶部（导航栏下方）
- 选中态：蓝色下划线 + 文字加粗
- 切换动画：无（直接切换内容，保证性能）
- 默认选中：学员概览

### 8.2 时间范围选择
- 位置：页面右上角（导航栏内或紧挨导航栏）
- 形式：Segmented Control（分段控件）
- 选项：7天 / 30天
- 默认值：7天
- 切换行为：
  - 更新页面标题区域的时间标签
  - 重新请求 trend 接口
  - 更新所有趋势图表
  - 显示 loading 状态（图表区域骨架屏）

### 8.3 下拉刷新
- 启用 `enablePullDownRefresh: true`
- 刷新行为：重新请求 institution + trend 两个接口
- 刷新完成后自动停止刷新动画

### 8.4 空状态处理
- 数据为空时（如新机构无学员）：
  - 指标卡片显示「0」
  - 图表区域显示空状态插图 + 文案「暂无数据」
  - 不显示错误提示

### 8.5 加载状态
- 首次加载：全页面骨架屏（Skeleton）
- Tab 切换：不显示 loading（数据已缓存）
- 时间范围切换：图表区域骨架屏
- 下拉刷新：原生下拉刷新动画

### 8.6 错误处理
- API 请求失败：
  - 显示错误提示卡片（红色图标 + 错误文案 + 重试按钮）
  - 不影响已加载的其他数据
  - 支持局部重试（仅重新请求失败的接口）
- Token 过期：自动跳转登录页（由 request.js 统一处理）

---

## 9. 技术实现

### 9.1 图表组件选型

#### 方案 A：wx-charts（推荐）
- 库名：wx-charts（微信小程序原生图表库）
- 优点：轻量、无依赖、适配小程序 Canvas
- 缺点：功能有限，复杂图表支持不足
- 适用场景：折线图、柱状图、环形图

#### 方案 B：ECharts for WeChat
- 库名：echarts-for-wechat（ec-canvas 组件）
- 优点：功能强大、图表类型丰富、交互性好
- 缺点：包体积大（~500KB），加载慢
- 适用场景：复杂图表、大数据量

#### 方案 C：纯 CSS 实现（MVP 阶段）
- 不引入第三方库
- 用 CSS + View 模拟简单柱状图和进度条
- 优点：零依赖、加载快
- 缺点：无法实现折线图、环形图
- 适用场景：P0 阶段快速上线

#### 推荐决策
- P0 阶段：方案 C（纯 CSS），先上线核心数据卡片
- P1 阶段：引入方案 A（wx-charts），补充趋势图表
- P2 阶段：如需复杂交互，升级到方案 B（ECharts）

⚠️ Decision Gate：引入图表库（wx-charts 或 ECharts）需要主人确认。
- 理由：会增加小程序包体积
- 影响：首屏加载时间
- 建议：先用纯 CSS 实现 MVP，后续按需引入

### 9.2 页面文件结构
```
miniapp/pages/operation/
├── dashboard.js        — 页面逻辑
├── dashboard.json      — 页面配置
├── dashboard.wxml      — 页面结构
└── dashboard.wxss      — 页面样式
```

### 9.3 页面配置（dashboard.json）
```json
{
  "navigationBarTitleText": "运营看板",
  "enablePullDownRefresh": true,
  "backgroundTextStyle": "dark"
}
```

### 9.4 数据缓存策略
- 缓存位置：Page data（页面级）
- 缓存粒度：
  - institutionData：静态指标（总学员数等），缓存至下次页面加载
  - trendData：趋势数据，按 days 参数缓存（7天/30天各一份）
- 缓存失效：
  - 页面 onUnload 时清除
  - 下拉刷新时强制更新
  - 时间范围切换时仅更新 trend 部分
- 本地存储：不使用 wx.setStorageSync（运营数据不需要跨会话缓存）

### 9.5 错误处理
- 网络错误：request.js 统一处理 toast 提示
- 业务错误：检查 res.data.code，非 0 则显示错误卡片
- 数据异常：指标值为 null/undefined 时显示「--」
- 图表渲染失败：降级显示纯数字列表

### 9.6 性能优化
- 数据请求并行化：Promise.all 同时请求 institution + trend
- 图表懒渲染：Tab 切换时才渲染对应图表
- 避免重复请求：Tab 间共享数据，不重复调用 API
- 图片优化：空状态插图使用 base64 内联或本地图片

---

## 10. 实现优先级

### 10.1 P0 — 必须实现（核心数据展示）
- 学员概览 Tab
  - 总学员数、活跃学员数、总班级数、活跃率
  - 新增学员趋势图（纯 CSS 柱状图版本）
- 页面框架
  - Tab 切换
  - 时间范围选择器
  - 下拉刷新
  - 空状态处理
- 权限控制
  - 仅 Admin/SuperAdmin 可见

### 10.2 P1 — 应该实现（完整运营视图）
- 课程概览 Tab
  - 总课程数、总班级数
  - 课时完成趋势图（纯 CSS 柱状图版本）
- 趋势分析 Tab
  - 学员增长趋势（折线图，需引入 wx-charts）
  - 课时完成趋势（折线图）

### 10.3 P2 — 可以实现（高级分析）
- 学员状态分布环形图
- 课程状态分布环形图
- 活跃课程数指标（需后端扩展 API）
- ECharts 升级（复杂交互图表）

### 10.4 实现依赖关系
```
P0 学员概览
  ├── 依赖：GET /analytics/institution ✅ 已有
  ├── 依赖：GET /analytics/institution/trend ✅ 已有
  └── 依赖：纯 CSS 柱状图 ✅ 可自实现

P1 课程概览
  ├── 依赖：GET /analytics/institution ✅ 已有（复用）
  ├── 依赖：GET /analytics/institution/trend ✅ 已有（复用）
  └── 依赖：纯 CSS 柱状图 ✅ 可自实现

P1 趋势分析
  ├── 依赖：GET /analytics/institution/trend ✅ 已有（复用）
  └── 依赖：wx-charts 图表库 ⚠️ 需引入

P2 状态分布
  ├── 依赖：后端扩展 API ⚠️ Decision Gate
  └── 依赖：wx-charts 环形图 ⚠️ 需引入
```

---

## 11. Decision Gate 汇总

以下事项需要主人确认后执行：

### DG-1：图表库引入
- 问题：是否引入第三方图表库（wx-charts 或 ECharts）？
- 影响：小程序包体积增加 100-500KB
- 建议：P0 阶段用纯 CSS，P1 阶段引入 wx-charts
- 状态：待决策

### DG-2：后端 API 扩展
- 问题：是否扩展 `getInstitutionMetrics()` 增加活跃课程数、学员状态分布、课程状态分布？
- 影响：后端代码修改 + 新增测试
- 建议：P0 阶段不扩展（用现有数据），P2 阶段按需扩展
- 状态：待决策

### DG-3：TabBar 入口
- 问题：是否在 TabBar 新增「运营」Tab？
- 影响：TabBar 从 3 个变为 4 个（微信小程序最多 5 个）
- 建议：新增 Tab，但仅对 Admin/SuperAdmin 角色显示（需动态 tabBar 实现）
- 替代方案：在首页快捷入口中添加「运营看板」卡片（无需动态 tabBar）
- 状态：待决策

---

## 12. 页面原型（文字描述）

### 12.1 整体布局
```
┌─────────────────────────────────┐
│  运营看板          [7天|30天]    │  ← 导航栏 + 时间选择器
├─────────────────────────────────┤
│  学员概览 | 课程概览 | 趋势分析  │  ← Tab 切换栏
├─────────────────────────────────┤
│                                 │
│  ┌──────┐  ┌──────┐            │
│  │总学员 │  │活跃   │            │  ← 指标卡片（2列）
│  │ 128人 │  │ 96人  │            │
│  └──────┘  └──────┘            │
│  ┌──────┐  ┌──────┐            │
│  │总班级 │  │活跃率 │            │  ← 指标卡片（2列）
│  │ 12个  │  │ 75%   │            │
│  └──────┘  └──────┘            │
│                                 │
│  新增学员趋势                    │  ← 图表标题
│  ┌─────────────────────────┐    │
│  │  ▂▅▇▅▃▂▁               │    │  ← 折线图/柱状图
│  │  07-17    07-23         │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

### 12.2 学员状态分布（P2）
```
│  学员状态分布                    │
│  ┌─────────────────────────┐    │
│  │      ╭─────╮            │    │
│  │     / 在读  \           │    │
│  │    |  75%   |          │    │
│  │     \       /           │    │
│  │      ╰─────╯            │    │
│  │  ● 在读 96  ● 休学 12   │    │
│  │  ● 结业 20              │    │
│  └─────────────────────────┘    │
```

---

## 13. 验收标准

### 13.1 功能验收
- [ ] 页面可正常打开，Admin 角色可见入口
- [ ] 非 Admin 角色显示无权限提示
- [ ] 三个 Tab 可正常切换
- [ ] 指标数据正确显示（与 API 返回值一致）
- [ ] 时间范围切换正常（7天/30天）
- [ ] 下拉刷新正常
- [ ] 空状态正确显示
- [ ] 错误状态可重试

### 13.2 性能验收
- [ ] 首屏加载 < 2 秒
- [ ] Tab 切换无延迟
- [ ] 图表渲染流畅
- [ ] 无内存泄漏（多次切换 Tab 后检查）

### 13.3 兼容性验收
- [ ] iOS 微信客户端正常显示
- [ ] Android 微信客户端正常显示
- [ ] 不同屏幕尺寸适配正常

---

## 14. 附录

### 14.1 相关文档
- 运营指标体系设计：`docs/OPERATION-METRICS-DESIGN.md`
- 后端 Analytics Controller：`backend/src/modules/analytics/analytics.controller.ts`
- 后端 Analytics Service：`backend/src/modules/analytics/analytics.service.ts`
- 小程序首页：`miniapp/pages/index/index.js`

### 14.2 API 响应格式参考

`GET /api/v1/analytics/institution` 响应：
```json
{
  "code": 0,
  "data": {
    "metrics": [
      { "name": "totalStudents", "value": 128, "unit": "人" },
      { "name": "activeStudents", "value": 96, "unit": "人" },
      { "name": "totalCourses", "value": 24, "unit": "个" },
      { "name": "totalClasses", "value": 12, "unit": "个" }
    ]
  }
}
```

`GET /api/v1/analytics/institution/trend?days=7` 响应：
```json
{
  "code": 0,
  "data": {
    "lessonTrend": [
      { "date": "2026-07-17", "value": 5 },
      { "date": "2026-07-18", "value": 8 },
      { "date": "2026-07-19", "value": 3 },
      { "date": "2026-07-20", "value": 0 },
      { "date": "2026-07-21", "value": 6 },
      { "date": "2026-07-22", "value": 7 },
      { "date": "2026-07-23", "value": 4 }
    ],
    "enrollmentTrend": [
      { "date": "2026-07-17", "value": 2 },
      { "date": "2026-07-18", "value": 1 },
      { "date": "2026-07-19", "value": 0 },
      { "date": "2026-07-20", "value": 3 },
      { "date": "2026-07-21", "value": 1 },
      { "date": "2026-07-22", "value": 2 },
      { "date": "2026-07-23", "value": 1 }
    ]
  }
}
```

---

**文档结束**
