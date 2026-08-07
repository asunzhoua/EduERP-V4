# 方案：注册入口 + 管理员开户 + 班级页修复 + 角色菜单修复 + 综合看板

日期：2026-08-06
状态：待确认门

## 一、目标

1. 小程序增加「账号密码注册」入口（免短信），家长可自助注册。
2. 管理员可给家长开账户，并在开户时一并绑定孩子。
3. 修复「管理员点击班级 Tab 后全部显示加载失败」。
4. 修复「管理员看到学习选项」——SuperAdmin 角色菜单/守卫漏洞。
5. 升级现有运营看板页为综合看板：总班级、总学生、总教师、总课时、本日/本周/本月/本年课时消耗。

## 二、现状（证据）

### 后端

- **无任何注册/建号接口**。auth 仅 login/wechat-login/refresh/logout/revoke-session/me（`identity/auth/auth.controller.ts`）。用户只能靠 seed 创建（`database/seeds/seed.service.ts:160-289`）。
- **User 实体**（`identity/entities/user.entity.ts:26-82`）：`username`(unique)、`mobile`(unique, NOT NULL)、`password`(bcrypt, select:false)、`role`(string)、`status`。**mobile 必填** → 注册表单需收集手机号。
- `user_role` 表**无运行时使用**（grep 只命中实体文件）→ 建号只需写 `user` 表。
- `UserRepository.save(entity)` 可复用（`identity/user.repository.ts:17-19`）。
- 家长-孩子绑定：`POST /students/:id/parents {parentId}`（`student.controller.ts:381-391`），`linkParent`（`student.service.ts:270-286`），**前提是家长 User 已存在**。
- **班级接口全部 200**（实测 admin/SuperAdmin 调 `/classes`、`/classes/:code/students`、`/classes/:code/lessons`、`/courses`、`/students`、`/teacher-assignments` 均 200）。
- **班级页 400 根因**（后端运行日志实证）：
  `GET /api/v1/classes?status=undefined → 400`
  `GET /api/v1/courses?page=2&pageSize=20&keyword=undefined → 400`
  `QueryClassDto.status` 有 `@IsEnum(ClassStatus)`（`teaching/class/dto/query-class.dto.ts:27-29`）。小程序把 `undefined` 序列化成字符串 `"undefined"` → 校验 400 → 页面 catch → "加载失败"。
- **看板模块已存在**：`/dashboard/{overview,lessons,students,teachers,finance}`（`dashboard/dashboard.controller.ts`，`@Roles('SuperAdmin','Admin')`）。`getOverview` 返回今日/学员/教师/财务（`dashboard.service.ts:59-181`）。**缺**：总班级数、总教师数、总课时数、本日/本周/本月/本年消耗。
- **消耗统计已有模式**：`analytics.service.ts:660-767 getConsumptionStatistics`，按 `attendance.checkInTime` 落在日期区间 + `status IN (PRESENT,LATE,ONLINE,OFFLINE)` 计数（`DEDUCTIBLE_STATUSES`）。
- **登录日志 device 超长**：`login_log.device` 是 `varchar(200)`（`identity/entities/login-log.entity.ts:30-31`），miniapp 的 UA 约 250+ 字符 → `Data too long for column 'device'`（日志 294-296 行实证），登录仍 200 但日志失败。

### 小程序

- **seed 的 admin 是 SuperAdmin**，但 `role.js` 只认 `Admin`：
  - `utils/role.js:8-12` ROLES 无 SuperAdmin；`isTeacherOrAbove`（:36-38）只查 Teacher/Admin；`setupTabBarByRole`（:100-154）对 SuperAdmin 两个分支都不进 → tabBar 不被重写 → 第 4 Tab 保持默认「学习」。
  - `pages/student/index.js:19,31` 守卫只挡 `role === 'Teacher'`，**不挡 Admin/SuperAdmin** → 管理员点「学习/个人」Tab 进孩子学习页。
- **班级页 bug**：`pages/teacher/classes.js:43-45` `params.status = this.data.filter === 'ALL' ? undefined : ...` → 默认 ALL 时发 `status=undefined` → 400。
- **课程页同病**：`pages/teacher/courses.js` 发送 `keyword: undefined`（日志 `courses?page=2...keyword=undefined → 400`）。
- **登录页无注册入口**：`pages/login/login.wxml` 只有登录 + 微信授权登录按钮。
- **运营看板页**：`pages/operation/dashboard/dashboard.wxml` 只渲染 `overview` 各字段；`dashboard.js` 并行拉 5 个接口但不展示 `lessons/students/teachers/finance`；`dashboard.js:19` 权限判断写的是 `role === 'ADMIN'`（大写）永不为真 → 导出按钮永不显示。

## 三、方案

### M1 家长注册 + 管理员开户（后端 + 小程序）

**后端**：
- `POST /auth/register`（公开）：`RegisterDto {username, password, name, mobile}`。bcrypt.hash 后 `userRepository.save`，`role='Parent'`, `status=ACTIVE`。用户名/手机号冲突 → ConflictException。返回安全字段，不自动登录。
- `POST /auth/admin/parents`（SuperAdmin/Admin）：`CreateParentDto {username, password, name, mobile, studentId}`。创建 Parent User + 写 `student_parent` 关联（studentId, parentId, relation='father' 默认）。一并完成「开户并绑定」。
- `GET /auth/admin/parents`（SuperAdmin/Admin）：分页列出家长用户，供管理员把自助注册的家长绑定到孩子。
- **守卫（Mimo 高优先级，已核实）**：`POST /students/:id/parents` 已带 `@Roles('SuperAdmin','Admin')`（`student.controller.ts:381-382` 实证）→ 管理员绑定入口无需改；新路由 `POST/GET /auth/admin/parents` 显式 `@Roles('SuperAdmin','Admin')`。
- `login_log.device` 修复：`createLoginLog` 里 `device` 截断到 200 字符（顺带修，避免注册/登录链路每次写日志报错）。
- 位置：`identity/auth/auth.service.ts` 加 `register()` / `adminCreateParent()` / `listParents()`；`auth.controller.ts` 加 3 个路由；新增 `dto/register.dto.ts`、`dto/create-parent.dto.ts`。AuthService 注入 `StudentParentRepository` + `DataSource`（forFeature 补丁，参照扣课任务 precedent）。
- **原子性（Mimo 必改）**：`adminCreateParent()` 用 `dataSource.transaction()` 包裹「建 Parent 用户 + 写 student_parent」，任一步失败整体回滚，避免"有用户无绑定"脏数据。
- **审计（Mimo 建议）**：开户成功后写一条 `createLoginLog(...,'ADMIN_CREATE_PARENT',...)` + logger 行（参照 A1 revoke-session 审计先例）。
- **注册 UX（Mimo 建议）**：注册成功返回登录页并回填用户名、清空密码。

**小程序**：
- 登录页加「注册账号」入口 → 新页面 `pages/register/register`（用户名/密码/姓名/手机号），提交 `POST /auth/register` → 成功后返回登录页并回填用户名。
- 管理员个人中心（`pages/teacher/profile`）快捷入口加「家长开户」（`role` 为 Admin/SuperAdmin 才显示）→ 新页面 `pages/operation/parent-manage/parent-manage`：
  - Tab「开户」：表单（用户名/密码/姓名/手机号）+ 学生选择器 → `POST /auth/admin/parents`。
  - Tab「绑定」：家长列表 + 学生选择器 → 复用 `POST /students/:id/parents`。
- app.json 注册新页面。

### M2 班级页 / 课程页 400 修复（纯小程序，根因修复）

根因：小程序 `get()/post()` 把 `undefined` 值序列化成字符串 `"undefined"`，后端 `@IsEnum`/校验 → 400。

- `utils/request.js`：`get()`/`post()` 在发起请求前统一剔除值为 `undefined`/`null`/空串的键（一处根因修复覆盖所有页面，避免逐页排查遗漏）。
- `pages/teacher/classes.js`：ALL 时不再带 `status` 参数（`GET /classes` 200）。
- `pages/teacher/courses.js`：`keyword` 为空时不再带（分页 200）。
- 回归：`node --check` + DevTools 走通班级/课程列表 + 翻页。

### M3 管理员「学习选项」修复（纯小程序）

- `utils/role.js`：ROLES 加 `SUPER_ADMIN: 'SuperAdmin'`；`isTeacherOrAbove` 纳入 SuperAdmin；`setupTabBarByRole` 因此对 SuperAdmin 生效 → 管理员 tabBar 显示 首页/课程/班级/个人。
- `pages/student/index.js` 守卫：挡 Teacher/Admin/SuperAdmin → reLaunch 到 `/pages/teacher/profile`（个人中心）。
- `pages/operation/dashboard/dashboard.js:19`：`role === 'ADMIN'` → `['Admin','SuperAdmin'].includes(role)`（顺带修导出按钮）。

### M4 综合看板（后端 + 小程序，口径按 Mimo 修订）

**口径区分（Mimo 必改）**：合同维度（静态合同数据）与实际出勤维度（动态考勤数据）分开展示，字段名不同，避免「总消耗」与「本年消耗」互相矛盾的误解。

**后端**：
- `GET /dashboard/summary`（SuperAdmin/Admin），`DashboardService.getSummary()`：
  - 行1（总量）：`totalClasses`（class count, deleted:false）、`totalStudents`（student count, deleted:false）、`totalTeachers`（user role='Teacher' count）
  - 行2（合同维度）：`totalContractHours = SUM(contract.totalLessons)`（全量合同，含非活动）、`consumedContractHours = SUM(totalLessons - remainingLessons)`、`remainingContractHours = SUM(remainingLessons)`
  - 行3（实际出勤维度）：`attendance: {today, week, month, year}` —— attendance `status IN (PRESENT,LATE,ONLINE,OFFLINE)` + `checkInTime` 落在对应区间聚合（复用 `DEDUCTIBLE_STATUSES` + 区间查询模式，与 analytics 一致）。
- DashboardService 注入 `LessonAttendanceRepository`（forFeature）。

**小程序**：
- `pages/operation/dashboard/dashboard.js` 追加拉 `/dashboard/summary`。
- `dashboard.wxml` 顶部加「综合概览」区块：行1 总班级/总学生/总教师；行2 合同总课时/合同已消耗/合同剩余；行3 实际出勤消耗 今日/本周/本月/本年 4 卡。保留原有区块。

## 四、可验证目标清单

| # | 行为 | 验证方式 |
|---|------|---------|
| G1 | 家长自助注册：`POST /auth/register` 创建 Parent 用户，用户名/手机号重复返回冲突 | 单测 + curl 实测 |
| G2 | 注册后登录成功；登录日志 device 不再超长报错 | 单测 + 实测日志 |
| G3 | 管理员开户+绑定：`POST /auth/admin/parents` 建家长并写 student_parent | 单测 + curl 实测 |
| G4 | 管理员可列出家长，把已有家长绑定到孩子（复用 linkParent） | 单测 + curl |
| G5 | `GET /dashboard/summary` 返回三组口径：总量（班级/学生/教师）+ 合同维度（总课时/已消耗/剩余）+ 实际出勤（今日/本周/本月/本年消耗） | 单测 + curl 实测（对照 DB 数） |
| G6 | 请求工具统一剔除 `undefined`：`GET /classes`（无 status）200 且列表正常 | request.js 修复 + DevTools 实测 |
| G7 | 课程页 `keyword=undefined` 被剔除，翻页请求 200 | DevTools 实测 |
| G8 | SuperAdmin 登录后 tabBar 显示 首页/课程/班级/个人，点第 4 Tab 进个人中心而非学习页 | 小程序角色逻辑修复 + DevTools 实测 |
| G9 | 运营看板页顶部出现综合概览，导出按钮对管理员可见 | DevTools 实测 |
| G10 | 全量后端单测 + e2e 保持 GREEN；build exit 0 | `npm run test` / `test:e2e` 输出 |

## 五、步骤（bite-size TDD）

**后端 TDD（每步 RED→GREEN）**：
- T1 register：`auth.service.spec` 先写失败测试（创建成功/用户名重复/手机号重复）→ 实现 `register()` → 绿灯。
- T2 adminCreateParent：`auth.service.spec` 写「建户+绑定」「studentId 不存在」→ 实现。
- T3 listParents + bind：`auth.service.spec` / `student.service.spec` → 实现。
- T4 device 截断：`auth.service.spec` 断言 createLoginLog 截断 → 实现。
- T5 dashboard summary：`dashboard.service.spec` 写聚合断言（对照 mock 数据）→ 实现 `getSummary()` + DTO + 路由 + forFeature。
- T6 编译 + 全量单测 + e2e（先 scenario 后 flow，规避已知跨套件污染）。

**小程序（node --check + DevTools 手动验证）**：
- T7 request.js 剔除 undefined 参数（根因）+ classes.js/courses.js 复核（G6/G7）。
- T8 role.js + student/index.js 守卫 + dashboard.js 权限（G8）。
- T9 注册页（G1 前端）→ DevTools 走通注册+登录。
- T10 家长管理页（G3/G4 前端）→ DevTools 走通开户+绑定。
- T11 看板页升级（G5/G9 前端）→ DevTools 目验综合概览。

## 六、验证

- 后端：`npm run build`（exit 0）、`npm run test`（单测全绿）、`npm run test:e2e`（business-scenario 32/32 → business-flow 24/24，按序跑）。
- 小程序：`node --check` 每个改动的 js；DevTools 手动走通注册/登录/班级页/个人中心/运营看板。
- 冒烟：curl 实测新接口，输出对照 DB 数值。

## 七、风险与决策

- **e2e 跨套件污染**：新增接口不触碰 e2e 场景数据；仍按「先 scenario 后 flow」跑（已知 tech-debt）。
- **Release Freeze（P0/P1 only）**：本任务为用户显式新增需求（注册、看板）+ P1 级 bug（班级页 400、角色菜单错乱），超出既有 freeze 范围，属产品决策放行。
- **mobile 必填**：User.mobile NOT NULL → 注册表单收集手机号（不做短信验证）。若希望免手机号需 schema 变更（migration），本方案不做。
- **公开注册接口防滥用（记录，本次不做）**：`POST /auth/register` 为公开接口，无限流/验证码。用户已确认免短信、仅家长注册；上线前建议补基础限流（per-IP 频率限制）防批量注册。记为范围外。
- **多租户唯一性（tech-debt 记录）**：`username`/`mobile` 为数据库全局唯一。当前单校区架构（全局管理员），若未来多校区/多租户需加 `campusId` 联合唯一，本次不重构。
- **单校区假设**：`POST /auth/admin/parents` 及看板统计均按「全系统管理员/单校区」设计，不做学生归属/数据权限校验；若未来有区域划分需引入。
- **「已消耗课时」口径**：总已消耗 = 全量合同 `SUM(total-remaining)`；分时段消耗 = attendance 按 checkInTime 落在区间（与 analytics 一致，非 scheduledDate）。说明见上。
- **跨模块 DI**：AuthService 注入 StudentParentRepository、DashboardService 注入 LessonAttendanceRepository，需 forFeature 补丁（参照扣课任务 precedent，app boot 验证）。
- **未提交工作区**：扣课台账 + 跳过打标两批改动仍在工作区未 commit，本次改动叠加在同一工作区，最终由用户统一提交。

## 八、范围外（本次不做，仅记录）

- 教师/学生自助注册（用户确认仅家长）。
- 家长自助绑定孩子（由管理员绑定）。
- 短信/图形验证码（用户确认免短信）。
- 看板分校区/多校区聚合、趋势图（本次为快照数字）。
