# admin-web 模块拆分 + 工作台式首页仪表盘 设计文档（2026-08-09）

> 范围：只规划导航重组 + 重构首页 Dashboard。其他 11 个既有路由视图不动，只做归类标注。
> 前置输入：能力缺口清单（`2026-08-09-webadmin-capability-gaps.md`）+ 能力级映射表（隔离工作区）。
> 架构原则：**一份后端业务契约，多端共享**（管理后台 / 教师端 / 家长端复用同一套聚合与领域端点），这是本规划对「多端契约」思路的自有重写表达，不涉及任何第三方端点命名。

---

## 一、导航模块拆分（8 大模块）

现状 12 个路由（`src/router/index.ts` L16-95）归入 8 大模块，标注 保留/改名/合并/预留：

| 模块 | 现有路由（来源） | 动作 | 规划说明 |
|---|---|---|---|
| 1. 工作台 | `dashboard` | **改名+重构** | 现为静态 12 卡网格 → 工作台式（4 组统计卡 + 时间维度 + 趋势图 + 待办面板），见第二节 |
| 2. 招生/销售 | `enrollments`（报名收费） | 改名 | 归入招生/销售；缺口：意向学员/试听/跟进（P0，见缺口清单） |
| 3. 教务 | `students`、`students/:id`、`classes`、`courses`、`lessons`、`leave-requests`、`teachers` | 合并 | 学员/班级/课程/课时/请假/教师归入教务域 |
| 4. 财务 | `salary` | 保留 | 缺口：收款/学员账户资金/支付方式（P0/P1） |
| 5. 统计分析 | `analytics` | 保留 | 数据中心 |
| 6. 组织/校区 | — | 预留 | 单校区现状；多校区/转学为缺口（P1） |
| 7. 系统设置 | `settings` | 保留 | 账号/基础设置/导入扩展 |
| 8. 营销 | `points-mall` | 并入+预留 | 积分商城为营销模块首个已实现子项；其余营销能力（P2）仅占位，本迭代不设计内部结构 |

> 说明：`points-mall`（积分商城）已实现，归入营销模块作为先落地子项；营销模块其余部分保持占位，避免范围蔓延。

导航实现：`layouts/MainLayout.vue` 菜单按 8 大模块分组渲染，路由文件保持不变（仅 `dashboard` 视图重构），不改路由路径，避免破坏现有链接。

---

## 二、工作台式首页仪表盘

### 2.1 布局

```
┌──────────────────────────────────────────────────────────┐
│  工作台           时间维度: (今日) 本周 本月 本年 全部      │
├──────────────────────────────────────────────────────────┤
│  [教务] 学员总数  班级总数  教师总数  剩余课时             │
│  [招生] 报名数    新增学员  新签合同额(¥)                 │
│  [财务] 收入(¥)  支出(¥)  利润(¥)                        │
│  [消课] 消课课时  上课课时  请假次数  剩余课时             │
├───────────────────────────────┬──────────────────────────┤
│  趋势折线（ECharts，近 30 日）  │  待办面板                 │
│  消课 / 考勤 / 财务 三组        │  待审批请假 · 库存提醒    │
└───────────────────────────────┴──────────────────────────┘
```

每组统计卡点击跳对应模块（保留现有跳转）。每 60 秒轮询保持不变。

### 2.2 接口设计（演进既有 `/dashboard/cards`）

**`GET /dashboard/cards?timeType=day|week|month|year|all`**（默认 `month`；非法/缺失 → `month`）

- `timeType` 语义（写入 DTO 注释）：
  - `day` = 今日 0 点起；`week` = 本周一 0 点起；`month` = 本月 1 号 0 点起；`year` = 本年 1 月 1 日 0 点起；`all` = 不设时间过滤（全量聚合，单校级数据量可控）。
- 响应结构（前端零计算，后端复用既有聚合方法）：

```jsonc
{
  "timeType": "month",
  "groups": {
    "teaching":   { "title": "教务", "metrics": [ {"key":"studentCount","label":"学员总数","value":120,"link":"/students"}, ... ] },
    "recruitment":{"title": "招生", "metrics": [ {"key":"enrollmentCount","label":"报名数","value":8}, {"key":"newStudentCount","label":"新增学员","value":5}, {"key":"contractAmount","label":"新签合同额","value":36000,"money":true} ] },
    "finance":    { "title": "财务", "metrics": [ {"key":"income","label":"收入","value":36000,"money":true}, {"key":"expense","label":"支出","value":9000,"money":true}, {"key":"profit","label":"利润","value":27000,"money":true} ] },
    "consumption":{ "title": "消课", "metrics": [ {"key":"consumedLessons","label":"消课课时","value":210}, {"key":"scheduledLessons","label":"上课课时","value":260}, {"key":"leaveCount","label":"请假次数","value":6} ] }
  },
  "trends": [
    { "name":"consumption","title":"消课","data":[{"date":"2026-07-11","value":9}, ...30 点] },
    { "name":"attendance",  "title":"考勤","data":[ ...30 点] },
    { "name":"finance",     "title":"财务","data":[ ...30 点] }
  ],
  "todos": [
    { "key":"leave","label":"待审批请假","count":2,"link":"/leave-requests" },
    { "key":"stock","label":"库存提醒","count":1,"link":"/points-mall" }
  ]
}
```

### 2.3 指标 ↔ 数据源 与 口径

| 组 | 指标 | 数据源 | 口径/时间窗口 |
|---|---|---|---|
| 教务 | 学员总数 | `studentRepo.count(deleted=false)` | 存量（不受 timeType 影响） |
| 教务 | 班级总数 | `classRepo.count(deleted=false)` | 存量 |
| 教务 | 教师总数 | `userRepo.count(role=Teacher)` | 存量 |
| 教务 | 剩余课时 | 活跃合同 `remainingLessons` 求和 | 存量 |
| 招生 | 报名数 | `enrollmentRepo.count(enrolledAt ∈ 窗口)` | 窗口聚合 |
| 招生 | 新增学员 | `studentRepo.count(createTime ∈ 窗口)` | 窗口聚合 |
| 招生 | 新签合同额 | `sumContractAmount(窗口)` | 窗口聚合（收入口径 = 新签合同总额，见风险 2） |
| 财务 | 收入 | 同「新签合同额」（**占位口径**：EduERP 无真实收支流水，仅合同金额） | 窗口聚合 |
| 财务 | 支出 | `salaryRepo.amount` 求和 ∈ 窗口 | 窗口聚合（工资记录） |
| 财务 | 利润 | 收入 − 支出 | 派生（后端计算） |
| 消课 | 消课课时 | `attendanceRepo` DEDUCTIBLE 状态 ∈ 窗口 | 实际出勤消耗数 |
| 消课 | 上课课时 | `lessonRepo` scheduledDate ∈ 窗口 | 排课课时数 |
| 消课 | 请假次数 | `leaveRequestRepo` leaveDate ∈ 窗口 | 请假单数 |
| 趋势·消课 | 近 30 日每日消课量 | 同消课课时按日分组 | 固定 30 日每日序列 |
| 趋势·考勤 | 近 30 日每日出勤数 | 考勤记录按日分组 | 固定 30 日 |
| 趋势·财务 | 近 30 日每日新签合同额 | `sumContractAmount` 按日 | 固定 30 日 |
| 待办·请假 | 待审批请假数 | `leaveRequestRepo` PENDING | 存量 |
| 待办·库存 | 低库存商品数 | `pointsMallService.getLowStockCount()` | 存量 |

> 趋势说明：三组折线统一为**近 30 日每日序列**，与时间维度解耦（避免响应结构复杂度与 N+1 查询）；如需更长跨度，走既有 `/analytics/*/trend?days=` 接口。此取舍写入文档，避免误以为趋势随时间维度缩放。

### 2.4 数据需求 ↔ 能力 交叉核对表（Mimo T2-1）

| 数据需求 | 现有能力 | 缺口能力 | 结论 |
|---|---|---|---|
| 学员/班级/教师/课时/考勤/请假/合同/工资/积分 | 全部存在（对应控制器） | — | 直接落地 |
| 收入（真实收支） | 无 Payment/Ledger | 收款/学员账户资金（P0/P1） | **占位口径**：收入=新签合同总额，标注不编造 |
| 报名/意向学员/试听 | 报名(contract/enrollment) | 意向学员/试听（P0） | 报名用 enrollment 计数；意向/试听暂不上首页 |
| 续费预警 | 存在（`/contracts/renewal-warnings`） | — | 可后续加入待办 |
| 趋势图 | 存在（analytics 聚合方法） | — | 复用聚合，工作台内聚一次请求 |

---

## 三、技术要点

### 3.1 echarts 按需引入（避免 ~1MB 全量）

`src/views/dashboard` 内静态 import 并按需注册：

```ts
import { LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer } from 'echarts/core'
import { use } from 'echarts/core'
use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
```

Vite tree-shake 后体积可控；不额外拆 chunk，不写全量 `import * as echarts`。

### 3.2 后端演进而非兼容垫片

`/dashboard/cards` 是首页唯一消费者，直接演进加 `timeType` 参数并扩展响应结构（4 组 + 趋势 + 待办），**不做旧结构兼容**。原 12 卡字段被工作台结构取代；`api/dashboard.ts` 类型同步重写。

### 3.3 TDD 契约

- 后端：`timeType` 只接受 `day|week|month|year|all`；非法/缺失默认 `month`（DTO + spec）。spec 用 **mock 固定 `now`** 构造各时间窗口，不依赖真实日期。
- 前端：组件测试覆盖「切换 timeType 触发重载」「数据渲染」「图表容器存在」。

---

## 四、可验证目标

| # | 行为 | 验证方式 |
|---|---|---|
| D1 | 8 大模块树文档 + 12 路由对照 | 本文件第一节；与 router/index.ts 逐条核对 |
| D2 | 工作台指标↔数据源映射表 | 本文件 2.3；每指标有实体/方法来源 |
| D3 | 交叉核对表 | 本文件 2.4；覆盖全部首页数据需求 |
| D4 | 后端 `timeType` 契约 | spec：day/week/month/year/all + 非法回退 + 默认 month |
| D5 | 前端重构 | 组件测试通过；浏览器实跑：切换时间刷新、ECharts 渲染、待办显示、卡片跳转 |

---

## 风险

1. **收入口径占位**：EduERP 无真实收支流水，财务组收入 = 新签合同总额（标注口径），不编造余额数据。
2. **趋势与时间维度解耦**：折线固定近 30 日，与统计卡时间维度不同步，文档已注明；如需联动走既有趋势接口。
3. **echarts 新依赖**：走 `/check-dep` 确认 `echarts@^5` 与现有 Vue3/Vite 兼容后再引入。
