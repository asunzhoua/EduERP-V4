# EduERP V4 — Web 管理后台（admin-web）实施方案

> 日期：2026-08-07
> 需求来源：用户发现 `admin-web/` 与 `frontend/` 均为空目录，质疑「后台管理页面没有做」
> 设计依据：`docs/08-Web/WebDashboardDesign.md`（架构冻结）、`docs/06-Permission/PermissionDesign.md`
> 决策：用户选择「先出详细实施方案」——本文档仅规划，不写代码；待确认门批准后进入阶段 B

---

## 一、目标与范围

在 `admin-web/`（空占位目录）新建**电脑端 Web 管理后台**，覆盖设计文档定义的 12 菜单 + 登录 + 通用能力（搜索/导出/日志）。同时补齐后端缺口接口（教师管理、积分商城、系统设置、操作日志）。

**范围外**（本次不做）：
- `frontend/` 目录用途未定义，保持空占位。
- 业务计算（课时/工资/积分）全部在服务器，前端仅展示，符合设计文档「禁止前端计算」原则。
- 微信小程序端功能不动（本次不改 miniapp）。

---

## 二、现状（证据，file:line）

### 2.1 两个空目录
- `admin-web/`、`frontend/` 均为空目录；`git ls-files` 无跟踪、`git log` 无历史、无 `.gitignore` 条目 → 从未实现过任何 Web 前端。

### 2.2 设计文档（WebDashboardDesign.md）
- 「Web 后台是整个系统唯一的电脑端」，面向管理员/老板，负责配置/管理/统计/查询（:10-42）。
- 左侧固定 12 菜单：首页/学生管理/教师管理/班级管理/课程管理/报名收费/课时管理/请假审批/工资管理/积分商城/数据中心/系统设置（:103-126）。
- 首页固定 12 数据卡：今日收入/课时/签到/请假/报名、本月收入/支出/利润、老师/学生人数、待审批、库存提醒，60 秒自动刷新（:66-101, :554）。
- 核心约束：无物理删除只有停用（:487-505）；所有操作记录日志（:507-528）；按菜单逐页开发，一个页面一个任务（:574-597）；前端禁止计算课时/工资/积分（:600-638）。

### 2.3 后端 API 现状（全部 controller 路由已枚举）
**已具备（✅）**：
- 登录：`auth/login|me|refresh`（identity/auth.controller.ts:30-120）
- 首页数据：`dashboard/summary|overview|lessons|students|teachers|finance`（dashboard.controller.ts:22-58）
- 学生：`students` CRUD + `self/*` + `contracts` + 家长绑定（student.controller.ts:44-410）
- 班级：`classes` CRUD + 教师分配（class.controller.ts:36-163）
- 课程：`courses` CRUD（course.controller.ts:34-96）
- 报名/合同：`enrollments`、`contracts`（enrollment.controller.ts:25-88, contract.controller.ts:26-104）
- 课时/考勤：`lessons`、`lesson-attendance`（lesson.controller.ts:38-166, lesson-attendance.controller.ts:34-225）
- 请假/异常审批：`admin/leave-requests`、`lesson-exceptions`、`suspend-requests`（leave-request.controller.ts:31-87, lesson-exception.controller.ts:47-243, suspend-request.controller.ts:31-87）
- 工资：`salary/records|statistics|rules`（salary.controller.ts:28-116）
- 数据中心：`analytics/*`（analytics.controller.ts:11-84）
- 导出：`export/students|lessons|consumption|salary|finance`（export.controller.ts:25-97）
- 家长管理：`auth/admin/parents`（auth.controller.ts:76-91）

**缺口（❌ / ⚠️）**：
| 缺口 | 说明 |
|------|------|
| 教师管理 CRUD | 教师是 User(role=Teacher)（identity.entity.ts UserRoles.TEACHER），仅 teacher-assignment 与 teachers/me/*，**无 admin 教师列表/新增/修改/停用/详情** |
| 积分商城 | 仅有 `points-granted.event.ts` 事件，**无商品/库存/兑换 API** |
| 系统设置 | **无任何 settings/config 模块**（仅 salary/rules 工资规则子项） |
| 操作日志查询 | 仅 `student-audit-log.entity.ts`、`course-audit-log.entity.ts` 两个审计实体，**无统一操作日志查询 API** |
| 学生/教师详情聚合 | 剩余课时、本月工资等聚合字段需后端补接口或字段 |

### 2.4 权限模型（PermissionDesign.md）
- 6 角色：SuperAdmin（唯一，全部）、Admin（老板/校长，校区全部管理）、Teacher（只看自己）、Parent、另有财务/教务类角色（:60-68）。
- 四层权限：菜单权限 + 数据权限（SQL 自动加 Tenant/TeacherID 过滤）+ 按钮权限 + 审批权限（:74-160）。
- 约束：接口必须校验 Token+角色+数据范围；禁止前端写权限判断为唯一依据；新增页面必须同步权限节点（:184-200）。

### 2.5 小程序运营端（功能参考，已实现）
- `miniapp/pages/operation/` 5 页：dashboard（经营概览，复用 dashboard/summary）、parent-manage、exception-list、exception-approve、reschedule-view。
- Admin/SuperAdmin 可见（student/index.js:244/259/402）。可作为 Web 后台同功能页面的 UI 与数据映射参考。

---

## 三、技术选型（推荐）

| 项 | 选择 | 理由 |
|----|------|------|
| 框架 | Vue 3 + TypeScript | 中后台生态成熟、TS 类型安全 |
| 构建 | Vite | 快、配置简单 |
| UI 组件库 | Ant Design Vue 4 | 中后台组件齐全（表格/表单/抽屉/权限） |
| 状态 | Pinia | 轻量、官方推荐 |
| 路由 | Vue Router 4 + 权限守卫 | 按角色过滤菜单/路由 |
| HTTP | Axios 封装（拦截器统一 token/错误） | 与小程序 request.js 同风格 |
| 图表 | ECharts | 数据中心趋势图 |
| 导出 | 按钮触发后端 `/export/*` | 符合「服务器计算」原则 |

> 备选：React + Ant Design。若团队更熟 React 可换，方案其余部分不变。**待确认门时与用户确认。**

---

## 四、admin-web 项目结构

```
admin-web/
├── src/
│   ├── api/            # 每个模块一个文件（student.ts / teacher.ts / ...）
│   ├── router/         # 路由表 + 权限守卫（meta.roles）
│   ├── stores/         # Pinia：auth（token/user/menus）、app（布局状态）
│   ├── layouts/        # MainLayout：侧边菜单 + 顶栏 + 面包屑
│   ├── views/          # 按菜单分目录，一个页面一个目录
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── students/   # list + detail
│   │   ├── teachers/   # list + detail
│   │   ├── classes/
│   │   ├── courses/
│   │   ├── enrollment/
│   │   ├── lessons/
│   │   ├── leave-approve/
│   │   ├── salary/
│   │   ├── point-shop/
│   │   ├── data-center/
│   │   ├── settings/
│   │   └── audit-log/
│   ├── components/     # SearchBar / PageTable / StatusTag / Money / ExportButton
│   └── utils/          # request.ts / auth.ts / format.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 五、功能清单（页面 ↔ API 映射）

| # | 页面 | 设计要点 | 前端 | 后端 API |
|---|------|---------|------|---------|
| 1 | 登录 | 账号+密码+验证码(可关)，按角色进对应后台 | Login.vue | ✅ auth/login, auth/me |
| 2 | 首页 | 12 数据卡，60s 自动刷新 | Dashboard.vue | ✅ dashboard/summary + finance + analytics |
| 3 | 学生列表 | 姓名/手机/班级/剩余课时/状态，新增/修改/停用/详情，禁删 | StudentList.vue | ✅ students (GET/POST/PUT/PATCH status) |
| 4 | 学生详情 | 9 模块（基本/报名/课时/反馈/请假/积分/收费/日志/附件） | StudentDetail.vue | ✅ 部分 + ⚠️ 反馈/积分/附件需补 |
| 5 | 教师列表 | 姓名/手机/授课数/本月工资/状态 | TeacherList.vue | ❌ 需新增 admin/teachers CRUD |
| 6 | 教师详情 | 基本信息/授课/工资/学生/课时/日志 | TeacherDetail.vue | ❌ 需新增 |
| 7 | 班级管理 | 新增/修改/停用 | ClassList.vue | ✅ classes CRUD |
| 8 | 课程管理 | 新增/修改/停用 | CourseList.vue | ✅ courses CRUD |
| 9 | 报名收费 | 选学生/课程/课时包/收费/生成订单 | Enrollment.vue | ✅ enrollments + contracts |
| 10 | 课时管理 | 全部课时查看，课时修正(必填原因+日志) | LessonList.vue | ✅ lessons + attendance |
| 11 | 请假审批 | 4 状态，审批同步所有端 | LeaveApprove.vue | ✅ admin/leave-requests + lesson-exceptions |
| 12 | 工资管理 | 老师/课时/工资模式/金额/状态，服务器算 | Salary.vue | ✅ salary/records + rules |
| 13 | 积分商城 | 商品/上下架/库存/兑换记录 | PointShop.vue | ❌ 需新增积分 API |
| 14 | 数据中心 | 今日/本周/本月/自定义；收入/支出/利润/课时/请假/报名/续费/积分 | DataCenter.vue | ✅ analytics + dashboard |
| 15 | 系统设置 | 校区/课程/工资规则/课时规则/消息模板/系统参数 | Settings.vue | ⚠️ salary/rules 已有，其余需新增 |
| 16 | 操作日志 | 时间/人员/操作/修改前/后/原因 | AuditLog.vue | ❌ 需新增统一查询 |
| 17 | 导出 | Excel 导出 | 各列表导出按钮 | ✅ export/* |
| 18 | 全局搜索 | 姓名/手机号/编号统一搜索 | 各列表 SearchBar | 部分支持 query |

---

## 六、后端需补接口清单（阶段 B 的一部分）

1. **教师管理**：`GET/POST/PUT /admin/teachers`、`PATCH /admin/teachers/:id/status`（停用）、`GET /admin/teachers/:id`（详情，聚合授课数/本月工资）——基于 User(role=Teacher)。
2. **积分商城**：`points` 商品 CRUD、上下架、库存增减、兑换记录查询（复用现有 points-granted 事件）。
3. **系统设置**：`settings` 模块（校区信息/课程设置/课时规则/消息模板/系统参数；工资规则并入 salary/rules）。
4. **操作日志**：`GET /admin/audit-logs` 统一查询（聚合现有 student/course 审计实体，按时间/人员/操作类型过滤）。
5. **详情聚合**：学生剩余课时、教师本月工资等字段由后端聚合返回。

> 后端补接口遵循既有 DDD 架构（modules/*/controller + use-case + repository），权限走 Roles 装饰器 + 数据范围。

---

## 七、里程碑（按设计文档「一个页面一个任务」）

| 里程碑 | 内容 | 后端依赖 |
|--------|------|---------|
| M0 脚手架 | Vite+Vue3+TS+AntD+Pinia+Router+登录+布局+权限守卫 | ✅ 无新增 |
| M1 首页 | 12 数据卡 + 60s 刷新 | ✅ dashboard |
| M2 学生管理 | 列表/新增/修改/停用/详情(9 模块，先做已有数据部分) | ✅ students |
| M3 教师管理 | 列表/详情/新增/修改/停用 | ❌ 补 admin/teachers |
| M4 班级+课程 | 两个管理页 | ✅ classes/courses |
| M5 报名收费+课时 | 报名下单 + 课时查看/修正 | ✅ enrollments/lessons |
| M6 请假审批+工资 | 审批流 + 工资查看 | ✅ leave/salary |
| M7 积分商城 | 商品/库存/兑换 | ❌ 补 points |
| M8 数据中心+系统设置 | 统计图表 + 设置页 | ⚠️ 补 settings |
| M9 操作日志+导出+搜索 | 全局能力收口 | ⚠️ 补 audit-logs |
| M10 收尾 | 构建、联调、部署、验收 | ✅ |

> MVP 建议：M0–M2（脚手架+首页+学生管理）先上线验证流程，后续里程碑逐个推进。

---

## 八、可验证目标清单

| # | 行为 | 验证方式 |
|---|------|---------|
| 1 | admin-web 项目可启动，登录页正常 | `npm run dev` → 浏览器打开 → 登录页渲染 |
| 2 | 用 Admin 账号登录进入后台 | auth/login 返回 token → auth/me 角色 → 跳 Dashboard |
| 3 | 首页 12 数据卡正确显示 | dashboard/summary 数据渲染，60s 自动刷新 |
| 4 | 学生管理：列表/新增/修改/停用/详情 | 页面操作 → 数据回写后端 students 接口 |
| 5 | 教师管理可用（含后端补接口） | admin/teachers CRUD 联调通过 |
| 6 | 请假审批 4 状态流转 | approve/reject → 状态同步 |
| 7 | 工资/课时/积分页面只展示服务器结果 | 前端无计算逻辑（code review 确认） |
| 8 | 权限：Teacher/Parent 登录被拒或仅见授权菜单 | 路由守卫 + 后端 Roles 双重校验 |
| 9 | 所有操作记录日志 | 操作后 audit-logs 有记录 |
| 10 | 构建通过 | `npm run build` 0 错误 |

---

## 九、风险与对策

| 风险 | 对策 |
|------|------|
| 后端缺口较大（教师/积分/设置/日志） | 里程碑拆分，前端与后端补接口并行；MVP 只依赖现有 API |
| 设计文档功能与现有数据模型不完全匹配（如反馈/附件/积分） | 详情页先做已有数据模块，缺数据源的在后续迭代补 |
| 「禁止前端计算业务」原则易被违反 | code review + 工时/工资/积分一律走后端接口 |
| 权限只在前端控制会被绕过 | 前端菜单/按钮权限仅作体验，后端 Roles+数据范围是安全底线 |
| 大列表性能 | 分页 + 服务端搜索 + 必要的懒加载 |
| 验证码（设计文档要求，可关闭） | 后端补 captcha 开关接口（或用简单验证码实现），默认可关 |

---

## 十、后续动作

1. 【确认门】用户审批本方案 + Mimo 审核 + 最终执行方案。
2. 批准后：M0 脚手架 → 按里程碑逐页 TDD 开发（一个页面一个任务）。
3. 每次里程碑结束：构建 + 联调 + 更新本计划验证清单。

---

## 十一、Mimo V2.5 审核意见与主模型处理决定

> 审核原文：`docs/superpowers/plans/2026-08-07-admin-web-mimo-review.md`

| # | Mimo 意见 | 处理决定 |
|---|-----------|---------|
| ① | 验证码后端是否已有接口？若无比 M0 前做 | **采纳**：M0 确认后端是否有 captcha 接口；验证码设计为「可关闭」，默认关闭，M0 并行补 captcha 接口（简单实现） |
| ② | 密码重置/修改、租户隔离校验 | **采纳**：补密码修改接口（auth 若无）；租户隔离后端已处理（单校区，数据范围按登录身份，前端不传租户/教师 ID） |
| ③ | 前端路由守卫策略不明 | **采纳**：静态路由 + `meta.roles` 过滤 + 登录后按 `/auth/me` 返回角色生成侧边菜单 |
| ④ | 按钮级权限实现方式 | **采纳**：后端返回权限点 + 前端 `v-permission` 指令双保险（前端仅体验，后端 Roles 是安全底线） |
| ⑤ | 缺需求澄清与变更控制流程 | **采纳**：新增「契约对齐与变更控制」：接口以 Swagger/OpenAPI 为准，前后端契约不一致由主模型裁决 |
| ⑥ | 性能基线缺失 | **采纳**：关键列表接口 P95 < 300ms、首屏 < 2s |
| ⑦ | 大数据量导出需异步 | **采纳**：导出超过阈值改异步生成 + 下载链接，前端轮询 |
| ⑧ | 操作日志聚合复杂，建议新建 operation_log 表 | **采纳**：新建统一 `operation_log` 表埋点 + 查询 API，而非聚合旧审计实体 |
| ⑨ | Pinia 增加 global store | **采纳**：增加 `stores/global.ts`（校区/枚举/字典等全局数据） |
| ⑩ | CSS 方案未明确 | **采纳**：M0 定 AntD Vue 主题定制（less 变量覆盖） |
| ⑪ | TS strict + API 类型共享 | **采纳**：开启 strict；用 `openapi-typescript` 从 Swagger 生成 `api.d.ts` |
| ⑫ | 小程序/Web 技术栈不一致 | **采纳**：记入「技术债与范围外清单」 |
| ⑬ | M3/M7 前端阻塞，需 Mock 并行 | **采纳**：依赖新接口的里程碑强制「先对齐 OpenAPI 契约 → 前端 MSW Mock → 前后端并行 → 联调」 |
| ⑭ | 里程碑按业务域合并 | **采纳**：重构为 M0–M6（见十二） |
| ⑮ | 验收标准缺量化 | **采纳**：关键项补具体步骤（60s 刷新自动化/观察；权限用测试用例） |
| ⑯ | 学生详情 9 模块需逐项列 API | **采纳**：细化子模块 API 映射（见十二 附录） |
| ⑰ | 操作日志需新建表（同 ⑧） | **采纳** |
| ⑱ | 导出覆盖范围核对 | **采纳**：现有 export 覆盖 students/lessons/consumption/salary/finance；班级/课程/积分商城导出列入待补 |
| ⑲ | 数据范围：前端何时传过滤参数 | **采纳**：明确「前端不传租户/教师 ID，后端按登录身份自动限定数据范围」 |
| ⑳ | M0 前加前端技术方案评审 | **采纳**：确认门后、M0 内先产出技术设计（路由/权限/API 类型/组件规范）并自审 |
| ㉑ | 里程碑重构（同 ⑭） | **采纳** |
| ㉒ | 接口契约 + Mock 规范（同 ⑬） | **采纳** |
| ㉓ | 非功能需求：性能/监控/部署 | **采纳**：补性能指标、Sentry 监控、构建部署方式 |
| ㉔ | 建立技术债清单 | **采纳**：新增「技术债与范围外清单」 |

**结论**：24 条全部采纳（Mimo 意见与本项目约束（DDD 后端、服务器计算、双保险权限）一致，无冲突项）。

---

## 十二、最终执行方案（阶段 B 顺序）

### M0 · 脚手架与规范（含技术评审）
- 建 `admin-web/`：Vite + Vue3 + TS(strict) + AntD Vue 4 + Pinia(auth/app/global) + Vue Router 4。
- 登录页（账号+密码，验证码可关）+ `/auth/login` + `/auth/me` → 静态路由 + meta.roles 过滤 + 侧边菜单生成。
- 技术设计自审：CSS(less 主题覆盖)、`openapi-typescript` 生成 API 类型、request 封装（token 注入/统一错误）、`v-permission` 指令。
- 后端：确认/补 captcha 接口（可关）；确认/补 auth 改密码接口。
- 验收：`npm run dev` 可登录 Admin；`npm run build` 0 错。

### M1 · 最小闭环（首页 + 学生管理）
- 首页 12 数据卡（dashboard/summary + finance），60s 自动刷新。
- 学生列表（students GET）+ 新增(POST) + 修改(PUT) + 停用(PATCH status) + 详情（先做基本资料/报名/课时/请假/收费，反馈/积分/附件待补）。
- 验收：Admin 登录 → 首页 12 卡数据正确 → 学生 CRUD 可用（禁删除）。

### M2 · 业务域 A（教师 + 班级 + 课程）
- 教师列表/详情/新增/修改/停用 —— **先对齐 admin/teachers OpenAPI 契约 → MSW Mock → 后端补接口**。
- 班级管理（classes CRUD）+ 课程管理（courses CRUD）。
- 验收：三模块 CRUD 联调通过；教师停用后不可登录/不可排课（后端校验）。

### M3 · 业务域 B（报名收费 + 课时 + 请假审批）
- 报名收费：选学生/课程/课时包 → 生成订单 → enrollments/contracts。
- 课时管理：全部课时查看 + 课时修正（必填原因，写 operation_log）。
- 请假审批：admin/leave-requests + lesson-exceptions，4 状态流转。
- 验收：报名下单生成合同+课时；课时修正留痕；审批同步所有端。

### M4 · 业务域 C（工资 + 数据中心 + 系统设置）
- 工资管理：salary/records + rules 查看（服务器计算，前端零计算）。
- 数据中心：analytics + dashboard 图表（ECharts），今日/本周/本月/自定义。
- 系统设置：**先对齐 settings OpenAPI 契约 → Mock → 后端补接口**（校区/课程/课时/消息/参数；工资规则并入 salary/rules）。
- 验收：工资只读展示；统计图表正确；设置项保存后立即生效。

### M5 · 增值与收尾能力（积分商城 + 操作日志 + 导出 + 权限细化）
- 积分商城：**先对齐 points OpenAPI 契约 → Mock → 后端补接口**（商品/上下架/库存/兑换记录）。
- 操作日志：**后端新建 operation_log 表 + 埋点 + 查询 API**，前端审计列表。
- 导出：对接现有 export/*，大数据量改异步下载；核对班级/课程/商城导出。
- 权限细化：按钮级 v-permission + 后端权限点；验证 Teacher/Parent 被拒。
- 验收：商城商品上下架；日志可查；导出 Excel；越权访问被拒。

### M6 · 联调、优化与部署
- 全量联调、构建（dist）、部署（Nginx 反代后端）、性能验证（P95 < 300ms、首屏 < 2s）、Sentry 接入。
- 验收：`npm run build` 0 错 + 生产环境冒烟通过。

### 附录 A：学生详情 9 模块 API 映射
| 模块 | API | 状态 |
|------|-----|------|
| 基本资料 | GET students/:id | ✅ |
| 报名记录 | GET students/:code/contracts | ✅ |
| 课时记录 | GET students/self/lessons（按学生） | ✅ |
| 课程反馈 | 待补 | ❌ |
| 请假记录 | GET students/self/leave-requests / admin/leave-requests | ✅ |
| 积分记录 | 待补（积分模块一并补） | ❌ |
| 收费记录 | GET contracts + finance | ✅ |
| 操作日志 | operation_log 新建后查询 | ⚠️ |
| 附件 | 待补 | ❌ |

### 附录 B：技术债与范围外清单
- 小程序（原生）与 Web（Vue3）技术栈不一致 → 未来统一组件/工具层成本。
- 学生反馈、附件、积分记录数据源缺失 → 后续迭代补。
- `frontend/` 目录用途未定义，保持空占位。
- 积分商城、系统设置、教师 CRUD、操作日志统一表为后端新增项，随里程碑推进。
