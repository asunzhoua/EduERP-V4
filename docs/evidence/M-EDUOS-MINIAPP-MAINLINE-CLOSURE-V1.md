# M-EDUOS-MINIAPP-MAINLINE-CLOSURE-V1 Evidence Report

> EduOS 小程序主线收口验证 — 从"可用"走向"稳定可交付"
>
> 验证日期：2026-07-31 16:3x (Asia/Shanghai)
> 验证人：AI Agent (code)
> Mission ID：M-EDUOS-MINIAPP-MAINLINE-CLOSURE-V1
> 公网 API：`http://ddns.257758.xyz:8443/api/v1`（HTTP，直连无代理 `--noproxy "*"`）
> 项目根目录：`C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4`
> 后端源码：`backend/`（NestJS，运行于 192.168.31.10:3000，路由器 8443 转发）
> 小程序源码：`miniapp/`
> 数据库：MySQL `eduos`（localhost:3306，后端同机）

---

## 0. 执行摘要

| Step | 状态 | 说明 |
|:-----|:----:|:-----|
| Step 1: 配置安全检查 | ⚠️ **NEEDS_FIX** | 无内网/公网 IP 残留 ✅；config.js 在 .gitignore 但**仍被 git 跟踪**（ignore 失效） |
| Step 2: 三条核心业务流 | ✅ **PASS** | Student/Teacher/Parent 全部接口可达（10/10 端点 HTTP 200）；学生业务 404 为数据缺失非链路问题 |
| Step 3: 权限隔离 | ✅ **PASS** | 3/3 跨角色访问全部 403 |
| Step 4: 数据绑定 | ⚠️ **NEEDS_FIX** | val_student 未绑定学生 ❌、val_teacher 无教学数据 ❌、val_parent 已绑定 1 孩子 ✅ |
| Step 5: 空数据处理 | ⚠️ **NEEDS_FIX** | 页面空态模板齐备，但存在 3 个缺陷（见 §5） |
| Step 6: 证据归档 | ✅ **COMPLETED** | 本文件 |

> **总体结论：接口/链路层稳定可交付（PASS）；UI 数据范围与账号绑定层存在 4 项待修复项（非 P0，不阻断基础可用性，但影响"稳定可交付"达成）。**

---

## 1. Step 1 — 配置安全检查

```
Step: 配置安全检查
Status: NEEDS_FIX
Evidence:
- localhost 残留（允许）: config.js development baseUrl=http://localhost:3000/api/v1 ✅（符合预期）
  config.example.js 注释明确"仅允许 localhost / 127.0.0.1" ✅
- 内网 IP 残留（禁止）: miniapp/ 全目录正则扫描 192.168.* / 10.* / 172.16-31.* → 0 匹配 ✅
- 公网域名/IP 残留（禁止）: 扫描 ddns.257758.xyz / 60.178.162.168 / 85.234.83.61 → 0 匹配 ✅
- 任意 IP 字面量: 全目录扫描 → 仅 config.example.js 注释中的 127.0.0.1（允许）✅
- config.js 是否已加入 .gitignore: .gitignore:114 "miniapp/config.js" ✅ 条目存在
  ⚠️ 但 git ls-files 确认 miniapp/config.js 仍被跟踪（commit b3f9375 "Phase 1 Batch A — environment configuration cleanup"）
  → .gitignore 对已跟踪文件不生效，本地填写真实 IP 后有被误提交风险 ❌ NEEDS_FIX
```

### 1.1 当前 config.js 内容（工作树 = HEAD，均干净）

```javascript
// miniapp/config.js
const ENV = 'development' // 部署时改为 'production'
const configs = {
  development: { baseUrl: 'http://localhost:3000/api/v1', debug: true },
  production:  { baseUrl: 'https://your-production-domain.com/api/v1', debug: false } // TODO 占位
}
module.exports = configs[ENV]
```

### 1.2 结论

- 无敏感残留（内网 IP / 公网域名 / 公网 IP 全部为 0）
- **唯一问题**：`config.js` 已被 git 跟踪（b3f9375 提交），.gitignore 条目形同虚设。修复：`git rm --cached miniapp/config.js` 后再提交一次（保留工作树文件，仅取消跟踪）。
- 建议将 miniapp/docs/ 及 repo docs/evidence 历史报告纳入 .gitignore（历史报告含敏感值，SECURITY-HISTORY-CLEANUP-V1 遗留建议未闭环）。

---

## 2. Step 2 — 三条核心业务流验证

> 全部请求直连 `http://ddns.257758.xyz:8443/api/v1`（`--noproxy "*"`）
> 执行脚本：`scripts/mission_mainline_closure.ps1`（输出见 `scripts/mission_mainline_result.txt`）

### 2.1 Student Flow ✅（接口链路全通）

```
Step: Student Flow
Status: PASS（链路/接口 4/4 HTTP 200；业务 404 为账号未绑定数据，非接口缺陷）
Evidence:
- POST /auth/login (val_student) → HTTP 200, code=0, JWT 签发, role=Student, name=验证学生
- GET /students/self/lessons    → HTTP 200, code=404 "未找到关联的学生信息"（接口正常，账号未绑定学生）
- GET /students/self/contracts  → HTTP 200, code=404 同上
- GET /students/self/attendance → HTTP 200, code=404 同上
```

| # | 端点 | HTTP | code | 响应摘要 | 结果 |
|:-:|:-----|:----:|:----:|----------|:----:|
| 1 | POST /auth/login | **200** | 0 | JWT 签发，role=Student，name=验证学生 | ✅ |
| 2 | GET /students/self/lessons | **200** | 404 | "未找到关联的学生信息" | ✅ 接口可达（业务 404） |
| 3 | GET /students/self/contracts | **200** | 404 | 同上 | ✅ 接口可达（业务 404） |
| 4 | GET /students/self/attendance | **200** | 404 | 同上 | ✅ 接口可达（业务 404） |

> 说明：`student.controller.ts` getSelfLessons/getSelfContracts/getSelfAttendance 均为 `findByUserId(userId)` → 未命中返回 `ApiResponse.error(404,'未找到关联的学生信息')`。val_student 无学生记录（DB 证据见 §4），404 是**预期业务行为**，链路正常。

### 2.2 Teacher Flow ✅

```
Step: Teacher Flow
Status: PASS（4/4 HTTP 200，code=0）
Evidence:
- POST /auth/login (val_teacher) → HTTP 200, code=0, JWT, role=Teacher
- GET /teachers/me/courses  → HTTP 200, code=0, data=[] （TD-001 保持修复）
- GET /teachers/me/classes  → HTTP 200, code=0, data=[]
- GET /teachers/me/students → HTTP 200, code=0, data=[]
```

| # | 端点 | HTTP | code | 响应摘要 | 结果 |
|:-:|:-----|:----:|:----:|----------|:----:|
| 1 | POST /auth/login | **200** | 0 | JWT 签发，role=Teacher | ✅ |
| 2 | GET /teachers/me/courses | **200** | 0 | `[]` | ✅ TD-001 无回归 |
| 3 | GET /teachers/me/classes | **200** | 0 | `[]` | ✅ |
| 4 | GET /teachers/me/students | **200** | 0 | `[]` | ✅ |

> 说明：`teacher.controller.ts` 三个 me 端点通过 `dataScopeService.getTeacherCourseCodes(user.sub)` 等查 teacher_assignment，val_teacher 无任何 assignment → 全部返回 `[]`（code=0）。**scoped 端点行为正确**。

### 2.3 Parent Flow ✅

```
Step: Parent Flow
Status: PASS（4/4 HTTP 200，code=0；childId 从 my-children 动态取得 = 6）
Evidence:
- POST /auth/login (val_parent) → HTTP 200, code=0, JWT, role=Parent
- GET /students/my-children       → HTTP 200, code=0, 1 条孩子：验证测试-小明 (id=6, ST2026070001)
- GET /students/6/courses         → HTTP 200, code=0, data=[]
- GET /students/6/attendance      → HTTP 200, code=0, data=[]
```

| # | 端点 | HTTP | code | 响应摘要 | 结果 |
|:-:|:-----|:----:|:----:|----------|:----:|
| 1 | POST /auth/login | **200** | 0 | JWT 签发，role=Parent | ✅ |
| 2 | GET /students/my-children | **200** | 0 | 1 条：验证测试-小明（id=6） | ✅ |
| 3 | GET /students/6/courses | **200** | 0 | `[]`（孩子暂无课程） | ✅ |
| 4 | GET /students/6/attendance | **200** | 0 | `[]`（孩子暂无出勤） | ✅ |

> 说明：`getMyChildren` → `studentService.getChildrenByUserId(27)` 命中 student_parent 关联；childId=6 的 courses/attendance 端点按孩子维度正确返回空数组。

### 2.4 Step 2 汇总

- 端点总数：10/10 全部 HTTP 200（其中学生 3 个业务 404，属数据绑定问题）
- 链路：公网 8443 → 路由器转发 → 本地 NestJS 全程连通
- 结论：**Step 2 PASS（接口层）**

---

## 3. Step 3 — 权限隔离验证

```
Step: 权限隔离
Status: PASS（3/3 强制拒绝）
Evidence:
- Student → GET /teachers/me/courses → HTTP 403 "权限不足，无法访问该资源" ✅
- Teacher → POST /students          → HTTP 403 同上 ✅
- Parent  → GET /students（全量）    → HTTP 403 同上 ✅
```

| # | 请求角色 | 目标端点 | 预期 | 实际 | 结果 |
|:-:|:--------:|:---------|:----:|:----:|:----:|
| 1 | Student | GET /teachers/me/courses | 403 | **403** | ✅ |
| 2 | Teacher | POST /students | 403 | **403** | ✅ |
| 3 | Parent | GET /students（全量） | 403 | **403** | ✅ |

> 说明：403 响应体为标准 RBAC 拒绝格式（`{"code":403,"message":"权限不足，无法访问该资源","error":"Forbidden"}`）。与上轮 7/7 强制拒绝结论一致，本轮按 Mission 要求抽查 3/3 通过。
> 备注：Teacher 对 GET /students、GET /courses、GET /classes 拥有设计内只读权限（源码 `@Roles('SuperAdmin','Admin','Teacher')`），见 §5 数据范围问题。

---

## 4. Step 4 — 数据绑定检查

> 依据：API 行为 + 数据库直查（MySQL eduos）

```
Step: 数据绑定
Status: NEEDS_FIX（val_student 未绑定 ❌ / val_teacher 无教学数据 ❌ / val_parent 已绑定 ✅）
Evidence:
- val_student (user id=26): DB student 表无 userId=26 的记录（现有 student: id=6 ST2026070001 userId=NULL, id=8 ST2026070003 userId=NULL）
  → /students/self/* 全部业务 404 "未找到关联的学生信息" ❌ 未关联学生记录
- val_teacher (user id=25): DB teacher_assignment 表无 teacherId=25 的记录（现有 assignment: teacherId=1×1, teacherId=2×2）
  → /teachers/me/courses|classes|students 全部返回空 [] ❌ 无教师教学数据
- val_parent (user id=27): DB student_parent 有 parentId=27 → studentId=6（验证测试-小明 ST2026070001，relation=父亲，isPrimary=1）
  → /students/my-children 返回 1 条孩子 ✅ 已关联家长记录和孩子
```

| 账号 | 用户 id | DB 关联证据 | API 佐证 | 状态 |
|:----|:------:|:-----------|:--------|:----:|
| val_student | 26 | student 表无 userId=26 | self/* 404 | ❌ 未绑定（待修复） |
| val_teacher | 25 | teacher_assignment 无 teacherId=25 | me/* 空 [] | ❌ 无教学数据（待修复） |
| val_parent | 27 | student_parent 关联 studentId=6 | my-children 1 条 | ✅ 已绑定 |

### 4.1 待修复项（数据绑定）

| # | 项 | 影响 | 修复建议 |
|:-:|:---|:-----|:---------|
| B-1 | val_student 未关联学生记录 | 学生端全部业务数据无法展示（课时/合同/出勤 404） | 将 student 表某条记录（或新建验证学生）的 userId 设为 26；或建立 users.id ↔ student.userId 关联 |
| B-2 | val_teacher 无 teacher_assignment | 教师端课程/班级/学生全空，无法覆盖真实数据路径 | 为 teacherId=25 创建 teacher_assignment（可复用现有 CL2026070001/CL2026070002 等班级） |
| B-3 | student.userId 全为 NULL（id=6/8） | 学生账号与学籍记录脱节；家长接口 getChildContracts 等依赖关联 | 数据迁移计划（MINIAPP-DATA-MIGRATION-PLAN.md）推进，补齐 userId 映射 |

---

## 5. Step 5 — 空数据场景检查

```
Step: 空数据处理
Status: NEEDS_FIX（模板齐备，3 个缺陷）
Evidence:
- 学生无课程: pages/student/lessons.wxml 有 "暂无课时记录" 空态 ✅（真空数组时）
  ❌ 未绑定学生时 code=404 → utils/request.js 任何非 0 业务码 reject → 页面显示 "加载失败，请稍后重试"（误导，非空态）
- 教师无班级: pages/teacher/classes.wxml 有 "暂无班级 / 请先创建班级" 空态 ✅（模板存在）
  ❌ 但 classes.js 调用全量 GET /classes（非 /teachers/me/classes）→ val_teacher 实际看到全系统 5 个班级，空态永不触发
- 家长无孩子: ❌ 小程序无家长专属页面（app.json 无 pages/parent/*）
  → 家长登录后被路由到 /pages/student/index（学生页），显示 "暂无合同信息/暂无课时记录"，无"未绑定孩子"提示
```

### 5.1 各页面空态核查明细

| 页面 | 数据源 | 空态模板 | 实际行为（val_* 账号） | 判定 |
|:----|:-------|:---------|:------------------------|:----:|
| student/lessons | /students/self/lessons | ✅ "暂无课时记录" | 未绑定学生 → 404 → "加载失败" | ⚠️ 误导提示 |
| student/index | /students/self/* | ✅ "暂无合同信息"/"暂无课时记录"（.catch 兜底） | 404 被吞 → 空列表展示 | ⚠️ 静默空 |
| student/attendance | /students/self/attendance | （见 wxml 空态） | 未绑定学生 → 404 → "加载失败" | ⚠️ 误导提示 |
| teacher/courses | **/courses（全量）** | ✅ "暂无课程" | 返回全系统 8 门课程 | ❌ 数据范围错误 |
| teacher/classes | **/classes（全量）** | ✅ "暂无班级" | 返回全系统 5 个班级 | ❌ 数据范围错误 |
| teacher/students | /teachers/me/students | （见 wxml 空态） | 空 [] | ✅ |
| parent（无） | — | — | 无页面；路由至学生页 | ❌ 缺页 |

### 5.2 核心缺陷

1. **D-1（数据范围）**：教师端课程/班级页使用全量端点 `GET /courses`、`GET /classes`（Teacher 有只读权限），而非 scoped 端点 `GET /teachers/me/courses|classes`。实测 val_teacher 可见**全部 8 门课程、5 个班级**（含其他教师/管理员的 CL2026070001/0002 等）。虽属 RBAC 设计内读权限（同 GET /students），但与教师"我的课程/班级"语义不符，且令空态失效。→ 小程序应改调 `/teachers/me/*`。
2. **D-2（未绑定提示）**：`utils/request.js` 对任何非 0 业务码统一 toast + reject，未区分 404 业务码。未绑定学生的 404 被展示为"加载失败，请稍后重试"，应映射为"账号未关联学生，请联系管理员"。
3. **D-3（家长缺页）**：后端家长 API 完整（my-children / childId/courses / childId/attendance），但小程序无家长页面。家长登录后复用学生页（调 /students/self/* 必然 404），无法查看孩子数据。→ 需新增家长端页面或家长模式视图。
4. **D-4（欢迎语）**：student/index.wxml 欢迎语模板为家长版（`{{studentInfo.name ? studentInfo.name + ' 家长' : '家长'}}`、"孩子：xxx"），学生登录同样显示"xx 家长"。

---

## 6. 未完成项清单

| 编号 | 优先级 | 项 | 类别 | 说明 |
|:----:|:------:|:---|:-----|:-----|
| B-1 | P1 | val_student 绑定学生记录 | 数据 | student.userId=26 或新建验证学生 |
| B-2 | P1 | val_teacher 分配教学数据 | 数据 | teacher_assignment teacherId=25 |
| B-3 | P2 | student.userId 数据迁移 | 数据 | 现有 2 条学生记录 userId 均为 NULL |
| D-1 | P1 | 教师端改用 /teachers/me/* scoped 端点 | UI/权限 | 当前全量 /courses /classes 泄露全系统数据 |
| D-2 | P2 | request.js 区分业务 404 提示 | UI | 未绑定学生显示"账号未关联学生"而非"加载失败" |
| D-3 | P1 | 新增家长端页面 | UI | 家长角色当前无页面（缺 my-children 视图） |
| D-4 | P3 | 修正学生首页欢迎语模板 | UI | "xx 家长"文案错误 |
| C-1 | P1 | `git rm --cached miniapp/config.js` | 安全 | .gitignore 条目已存在但文件仍被跟踪 |
| C-2 | P3 | 历史报告文档纳入 .gitignore | 安全 | docs/evidence 旧报告含敏感值（SECURITY-CLEANUP 遗留） |

## 7. 后续建议

1. **数据准备**（使"稳定可交付"成立）：补 B-1/B-2 数据，使三个测试账号可完整走通业务数据路径（非空）。建议在 DB 层做一次性验证数据脚本（scripts/seed_validation_data.sql）。
2. **小程序改版**：教师端 3 个 Tab 页全部切换到 `/teachers/me/*` scoped 端点（后端已就绪，仅前端调用点未改）；新增家长端页面对接 my-children / childId/courses / childId/attendance。
3. **错误语义**：request.js 增加 code=404 业务映射，页面区分"数据为空"与"账号未绑定"。
4. **安全闭环**：`git rm --cached miniapp/config.js`；提交前检查（SECURITY-COMMIT-GUARD-V1 的 pre-commit 钩子）保留。
5. **HTTPS**：当前公网为 HTTP 明文（8443），生产建议启用 HTTPS（443）。
6. **回归**：下次版本迭代后重跑 `scripts/mission_mainline_closure.ps1` 全量回归（10 端点 + 3 隔离 + 3 绑定）。

## 8. 附件

### 附件 A：本次验证关键输出（scripts/mission_mainline_result.txt 摘要）

```
STEP=Student_login HTTP=200 code=0 JWT role=Student name=验证学生
STEP=Student_lessons HTTP=200 code=404 "未找到关联的学生信息"
STEP=Student_contracts HTTP=200 code=404 同上
STEP=Student_attendance HTTP=200 code=404 同上
STEP=Teacher_login HTTP=200 code=0 JWT role=Teacher
STEP=Teacher_courses HTTP=200 code=0 data=[]
STEP=Teacher_classes HTTP=200 code=0 data=[]
STEP=Teacher_students HTTP=200 code=0 data=[]
STEP=Parent_login HTTP=200 code=0 JWT role=Parent
STEP=Parent_children HTTP=200 code=0 1条: 验证测试-小明(id=6,ST2026070001)
STEP=Parent_child_courses HTTP=200 code=0 data=[]
STEP=Parent_child_attendance HTTP=200 code=0 data=[]
STEP=Iso_Student_GET_teacher_courses HTTP=403
STEP=Iso_Teacher_POST_students HTTP=403
STEP=Iso_Parent_GET_students HTTP=403
STEP=Bind_Student_me HTTP=200 (user id=26)
STEP=Bind_Teacher_me HTTP=200 (user id=25)
STEP=Bind_Parent_me HTTP=200 (user id=27)
```

### 附件 B：数据范围复验（scripts/check_ui_endpoints.ps1 摘要）

```
Teacher token → GET /courses?page=1&pageSize=5 → HTTP 200, total=8（全系统课程，非仅本人）
Teacher token → GET /classes?pageSize=5        → HTTP 200, total=5（全系统班级，含其他教师班级）
```

### 附件 C：测试账号

| 角色 | 用户名 | 密码 | 绑定状态 |
|:----|:-------|:-----|:---------|
| Student | val_student | Student123 | ❌ 未绑定学生记录 |
| Teacher | val_teacher | Teacher123 | ❌ 无教学数据 |
| Parent | val_parent | Parent123 | ✅ 绑定 1 孩子（id=6） |

### 附件 D：关联文档

- `docs/evidence/M-EDUOS-MINIAPP-PUBLIC-8443-LOCAL-TEST-V1-FINAL.md` — 上轮公网 8443 验证（本报告链路部分沿用其结论）
- `docs/evidence/M-EDUOS-SECURITY-HISTORY-CLEANUP-V1.md` — 历史敏感信息清除（C-1/C-2 来源）
- `miniapp/MINIAPP-DATA-MIGRATION-PLAN.md` — 数据迁移计划（B-3 来源）
- 源码：`backend/src/modules/teaching/teacher/teacher.controller.ts`、`backend/src/modules/student/student.controller.ts`、`backend/src/common/services/data-scope.service.ts`、`miniapp/utils/request.js`、`miniapp/pages/teacher/courses.js`、`miniapp/pages/teacher/classes.js`

---

*报告生成时间：2026-07-31 16:40 Asia/Shanghai*
*验证人：AI Agent (code)*
*Mission ID: M-EDUOS-MINIAPP-MAINLINE-CLOSURE-V1*
*状态：✅ **COMPLETED — 接口层 PASS；4 项 P1 待修复项（数据绑定 ×2、UI 数据范围 ×1、家长页面 ×1）***
