# MiniApp Real Data Scan Report

**Project:** EduERP-V4 Miniapp  
**Scan Date:** 2026-07-22  
**Scanner:** EOS-Research-Agent  
**Mission:** Phase 1 — Identify all Mock data, placeholder logic, and unconnected data chains in the miniapp frontend.  
**Scope:** `pages/`, `utils/`, `app.js`, `app.json` — JS/JSON analysis only. No code modification.

---

## Mission Context

验证微信小程序前端是否已连接到真实后端 API，识别所有 Mock 数据降级路径、未实现功能、以及数据链路断开点。目的是在微信双端联调前清理所有虚假数据路径。

---

## Research Findings

### Section 1: Login Page — `pages/login/login.js`

**F-001**
- Conclusion: 微信授权登录功能未实现，仅为占位 Toast
- Evidence ID: E-2026-07-22-001
- Source: `pages/login/login.js`, 第 54-57 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-002**
- Conclusion: 登录接口 `post('/auth/login')` 已连接到真实 API（通过 `utils/request.js` 封装）
- Evidence ID: E-2026-07-22-002
- Source: `pages/login/login.js`, 第 30-51 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Login):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| POST | `/auth/login` | Yes (via request.js) | None |

---

### Section 2: Index Page — `pages/index/index.js`

**F-003**
- Conclusion: 仪表盘接口 `get('/teacher/dashboard')` 已连接到真实 API，无 Mock 降级路径
- Evidence ID: E-2026-07-22-003
- Source: `pages/index/index.js`, 第 65 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-004**
- Conclusion: API 失败时仅使用 0 值默认显示，无硬编码 Mock 数据（界面可保持空白但无虚假数据）
- Evidence ID: E-2026-07-22-004
- Source: `pages/index/index.js`, 第 76-88 行 (catch 块)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Index):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/teacher/dashboard` | Yes | None (defaults to 0) |

---

### Section 3: Courses Page — `pages/teacher/courses.js`

**F-005** ⚠️
- Conclusion: `ENABLE_MOCK = true` — Mock 开关已启用，API 失败时自动降级到 3 条硬编码课程数据
- Evidence ID: E-2026-07-22-005
- Source: `pages/teacher/courses.js`, 第 4-5 行 (`ENABLE_MOCK = true`), 第 100-123 行 (`mockCourses` 数组定义), 第 134-135 行 (mock 数据赋值)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-006** ⚠️
- Conclusion: `createCourse()` 功能未实现，仅显示 "功能开发中" Toast
- Evidence ID: E-2026-07-22-006
- Source: `pages/teacher/courses.js`, 第 201-204 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-007**
- Conclusion: `loadMore()` 分页加载无 Mock 降级路径，API 失败时仅回退页码
- Evidence ID: E-2026-07-22-007
- Source: `pages/teacher/courses.js`, 第 175-179 行 (catch 块)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-008**
- Conclusion: `goToCourseDetail()` 导航到课程详情页时，navigation fail 回调显示 "详情页开发中"
- Evidence ID: E-2026-07-22-008
- Source: `pages/teacher/courses.js`, 第 192-196 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Courses):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/courses` (page, pageSize) | Yes (via request.js) | YES — 3 条硬编码课程 |
| GET | `/courses` (loadMore) | Yes | None |

---

### Section 4: Course Detail Page — `pages/teacher/course-detail.js`

**F-009**
- Conclusion: 课程详情接口 `get('/courses/${code}')` 已连接到真实 API，无 Mock 降级
- Evidence ID: E-2026-07-22-009
- Source: `pages/teacher/course-detail.js`, 第 30-31 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-010**
- Conclusion: 无 `ENABLE_MOCK` 常量，catch 块仅显示错误信息，无 Mock 降级
- Evidence ID: E-2026-07-22-010
- Source: `pages/teacher/course-detail.js`, 第 33-38 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Course Detail):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/courses/{code}` | Yes | None |

---

### Section 5: Classes Page — `pages/teacher/classes.js`

**F-011** ⚠️
- Conclusion: `ENABLE_MOCK = true` — Mock 开关已启用，API 失败时自动降级到 3 条硬编码班级数据
- Evidence ID: E-2026-07-22-011
- Source: `pages/teacher/classes.js`, 第 4-5 行 (`ENABLE_MOCK = true`), 第 56-101 行 (`mockClasses` 数组定义, 14 个字段), 第 110-111 行 (mock 数据赋值)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-012**
- Conclusion: `goToClassDetail()` 导航失败时显示 "详情页开发中"
- Evidence ID: E-2026-07-22-012
- Source: `pages/teacher/classes.js`, 第 148-152 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Classes):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/classes` (status filter) | Yes | YES — 3 条硬编码班级 |

---

### Section 6: Class Detail Page — `pages/teacher/class-detail.js`

**F-013**
- Conclusion: 班级详情和班级学生两个接口已连接到真实 API，无 Mock 降级
- Evidence ID: E-2026-07-22-013
- Source: `pages/teacher/class-detail.js`, 第 29-31 行 (`Promise.all` 并发请求)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Class Detail):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/classes/{code}` | Yes | None |
| GET | `/classes/{code}/students` | Yes | None |

---

### Section 7: Students Page — `pages/teacher/students.js`

**F-014** ⚠️
- Conclusion: `ENABLE_MOCK = true` — Mock 开关已启用，API 失败时自动降级到 3 条硬编码学生数据
- Evidence ID: E-2026-07-22-014
- Source: `pages/teacher/students.js`, 第 5 行 (`ENABLE_MOCK = true`), 第 56-69 行 (mock 数据赋值及硬编码数组)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Students):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/classes/{classCode}/students` | Yes | YES — 3 条硬编码学生 |
| GET | `/students` (keyword filter) | Yes | YES — 同上 |

---

### Section 8: Student Detail Page — `pages/teacher/student-detail.js` (STUB)

**F-015** 🚨
- Conclusion: 该页面为空的骨架页面，无任何 API 调用、无业务逻辑、无数据绑定 — 注册在 `app.json` 中但完全无功能
- Evidence ID: E-2026-07-22-015
- Source: `pages/teacher/student-detail.js`, 第 1-66 行 (整个文件)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-016** 🚨
- Conclusion: 同路径下存在一个完整实现的 `pages/teacher/student-detail/index.js`，但它不被 WeChat 路由系统识别（`app.json` 中注册的是 `pages/teacher/student-detail`），导致该实现不可达
- Evidence ID: E-2026-07-22-016
- Source: `pages/teacher/student-detail/index.js`, 第 1-91 行 (被孤立的实现); `app.json`, 第 15 行 (`"pages/teacher/student-detail"`)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Student Detail — 孤立实现):** (注：以下属于 `index.js` 中的实现，但当前不可达)
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/students` (studentCode) | Yes (in index.js) | YES — 硬编码学生数据 |
| GET | `/enrollments/students/{code}/enrollments` | Yes (in index.js) | YES — 硬编码班级数据 |

---

### Section 9: Lesson Record Page — `pages/teacher/lesson-record.js`

**F-017** ⚠️
- Conclusion: `ENABLE_MOCK = true` — Mock 开关已启用，存在 **两处** Mock 降级路径：
  1. 加载班级列表失败 → 2 条硬编码班级数据 (line 99)
  2. 加载学生列表失败 → 3 条硬编码学生数据 (line 137)
- Evidence ID: E-2026-07-22-017
- Source: `pages/teacher/lesson-record.js`, 第 5 行 (`ENABLE_MOCK = true`), 第 99-109 行 (班级 Mock), 第 137-153 行 (学生 Mock)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-018**
- Conclusion: 课时提交使用真实 API `post('/lessons', payload)`，提交失败时无 Mock 降级，有重试机制
- Evidence ID: E-2026-07-22-018
- Source: `pages/teacher/lesson-record.js`, 第 370-386 行 (提交逻辑)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Lesson Record):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/classes` (status=ACTIVE) | Yes | YES — 2 条硬编码班级 |
| GET | `/classes/{classCode}/students` | Yes | YES — 3 条硬编码学生 |
| POST | `/lessons` (submit) | Yes | None |

---

### Section 10: Student Index Page — `pages/student/index.js`

**F-019**
- Conclusion: 学生端三个接口使用 `.catch()` 链式降级，API 失败时静默返回 null/[] 而非硬编码 Mock 数据
- Evidence ID: E-2026-07-22-019
- Source: `pages/student/index.js`, 第 30-32 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Student Index):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/students/self` | Yes | Silent `null` via `.catch()` |
| GET | `/students/self/contracts` | Yes | Silent `[]` via `.catch()` |
| GET | `/students/self/lessons` | Yes | Silent `[]` via `.catch()` |

---

### Section 11: Student Classes Page — `pages/student/classes.js`

**F-020** ⚠️
- Conclusion: `classCode` 从 `contractCode` 人工派生（`'CT' + c.contractCode`），注释明确标注为 "mock class code from contract" — 说明 contract 数据中缺少真实 `classCode` 字段
- Evidence ID: E-2026-07-22-020
- Source: `pages/student/classes.js`, 第 27 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-021**
- Conclusion: `teacherName` 被硬编码为空字符串 `''`，说明学生端合同数据接口不返回教师名称
- Evidence ID: E-2026-07-22-021
- Source: `pages/student/classes.js`, 第 29 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-022**
- Conclusion: API 失败时无 Mock 降级、无 Toast 提示，仅将 error 设为消息字符串
- Evidence ID: E-2026-07-22-022
- Source: `pages/student/classes.js`, 第 33-42 行 (catch 块)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Student Classes):**
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/students/self/contracts` | Yes | None |

---

### Section 12: Student Class Detail — `pages/student/class-detail.js` (STUB)

**F-023** 🚨
- Conclusion: 此为空的骨架页面，无任何 API 调用、无业务逻辑 — 注册在 `app.json` 中但完全无功能
- Evidence ID: E-2026-07-22-023
- Source: `pages/student/class-detail.js`, 第 1-66 行 (整个文件)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-024** 🚨
- Conclusion: 同路径下存在完整实现的 `pages/student/class-detail/index.js`，但 WeChat 路由系统不会加载它，导致该实现不可达
- Evidence ID: E-2026-07-22-024
- Source: `pages/student/class-detail/index.js`, 第 1-91 行; `app.json`, 第 16 行 (`"pages/student/class-detail"`)
- Verification Method: 代码审查
- Confidence Level: Confirmed

**API Calls (Student Class Detail — 孤立实现):** (注：以下属于 `index.js` 中的实现，当前不可达)
| Method | Path | Connected | Mock Fallback |
|--------|------|-----------|---------------|
| GET | `/students/self/contracts` | Yes (in index.js) | YES — 硬编码 classInfo 数据 |

---

### Section 13: Infrastructure — `app.js`

**F-025**
- Conclusion: `baseUrl` 硬编码为 `http://localhost:3000/api/v1` — 仅适用于本地开发环境，上线前需替换为生产域名
- Evidence ID: E-2026-07-22-025
- Source: `app.js`, 第 5 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-026**
- Conclusion: `checkLoginStatus()` 使用原始 `wx.request` 而非统一的 `utils/request.js` 封装，存在 Token 处理不一致的风险
- Evidence ID: E-2026-07-22-026
- Source: `app.js`, 第 16-27 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

---

### Section 14: Infrastructure — `utils/request.js`

**F-027**
- Conclusion: 请求封装完整支持 GET/POST/PUT/DELETE，统一处理 Token 注入、错误码 2002（Token 过期自动跳转登录）、网络错误 Toast
- Evidence ID: E-2026-07-22-027
- Source: `utils/request.js`, 第 1-84 行
- Verification Method: 代码审查
- Confidence Level: Confirmed

**F-028**
- Conclusion: 所有页面（除 app.js 的 checkLoginStatus）均通过 `utils/request.js` 发起请求，API 调用路径一致
- Evidence ID: E-2026-07-22-028
- Source: 各页面文件 import 语句 (`require('../../utils/request')`)
- Verification Method: 代码审查
- Confidence Level: Confirmed

---

## Analysis

### 1. Mock 覆盖情况总览

| 页面 | ENABLE_MOCK | Mock 数据类型 | 风险等级 |
|------|------------|--------------|---------|
| `pages/teacher/courses.js` | `true` | 3 条硬编码课程 | 🔴 高 |
| `pages/teacher/classes.js` | `true` | 3 条硬编码班级（14 字段） | 🔴 高 |
| `pages/teacher/students.js` | `true` | 3 条硬编码学生 | 🔴 高 |
| `pages/teacher/lesson-record.js` | `true` | 2 种 Mock（班级+学生） | 🔴 高 |
| `pages/teacher/student-detail/index.js` | 无开关，硬编码 | 学生+班级数据 | 🟡 中 |
| `pages/student/class-detail/index.js` | 无开关，硬编码 | classInfo 数据 | 🟡 中 |
| 其他 7 个页面 | 无 | 无 | 🟢 低 |

**关键发现：** 4 个页面存在 `ENABLE_MOCK = true` 的全局开关。生产环境中若忘记关闭，所有后端请求失败都会静默降级到虚假数据，用户和开发者都不会察觉后端故障。

### 2. 数据链路断开点（Finding F-015, F-016, F-023, F-024）

存在**两对** stub/impl 分裂问题：
- `teacher/student-detail.js`（空壳）vs `teacher/student-detail/index.js`（有实现）
- `student/class-detail.js`（空壳）vs `student/class-detail/index.js`（有实现）

WeChat 小程序路由按 `app.json` 中 `pages/teacher/student-detail` 加载 `pages/teacher/student-detail.js`（空壳）。`index.js` 中的完整实现永远不会被执行。这是一个**架构级阻断问题** — 点击学生详情会看到空白页面。

### 3. 未实现功能（Finding F-001, F-006, F-008, F-012）
- 微信授权登录（F-001）：仅占位 Toast
- 创建课程（F-006）：仅占位 Toast
- 课程详情页导航失败提示（F-008/F-012）：意味着后端路由也可能未就绪

### 4. 数据完整性问题（Finding F-020, F-021）
- 学生端合同数据缺少 `classCode` 字段，前端人工拼接（`'CT' + contractCode`）
- 学生端合同数据缺少 `teacherName` 字段，前端硬编码为空

这两个问题说明学生端 API 接口 `GET /students/self/contracts` 返回的数据结构不完整，无法支撑前端展示需求。

### 5. 基础设施问题（Finding F-025, F-026）
- `baseUrl` 硬编码 `localhost:3000` — 需要在构建/部署时替换
- `checkLoginStatus` 绕过统一的 request 封装 — Token 过期处理不一致

---

## Risks

| Risk ID | Description | Related Findings |
|---------|-------------|-----------------|
| R-001 | **Mock 数据静默降级风险** — 生产环境若忘记关闭 `ENABLE_MOCK`，后端故障时用户看到虚假数据，无任何告警 | F-005, F-011, F-014, F-017 |
| R-002 | **页面空白阻断** — 学生详情页和学生端班级详情页在真实路由中为空的骨架页面，用户点击后将看到空白页 | F-015, F-016, F-023, F-024 |
| R-003 | **Mock 数据与真实数据结构不同步** — 硬编码 Mock 数组字段结构可能与后端 API 实际返回不一致 | F-005 (courses.js), F-011 (classes.js), F-014 (students.js), F-017 (lesson-record.js) |
| R-004 | **后端接口数据缺失** — `GET /students/self/contracts` 不返回 `classCode` 和 `teacherName`，前端需后端补充 | F-020, F-021 |
| R-005 | **基础 URL 硬编码** — `localhost:3000` 不可用于生产环境 | F-025 |
| R-006 | **Token 校验绕过统一封装** — `checkLoginStatus` 使用原始 `wx.request`，Token 过期行为与业务页面不一致 | F-026 |

---

## Unknowns

以下为未验证的假设，需要进一步确认：

- **Unknown-001:** `GET /courses` API 返回的数据结构是否包含 `items`、`total` 字段？当前前端解析 `data.items` 和 `data.total`（见 courses.js 第 83/89 行）
- **Unknown-002:** `GET /classes` API 返回的数据结构 — 前端解析 `data.items`（见 classes.js 第 35 行），但后端是否如此返回？
- **Unknown-003:** `teacher/student-detail/index.js` 和 `student/class-detail/index.js` 这两个被孤立的实现文件是否为开发中未完成的迁移工作？还是旧版本遗留？
- **Unknown-004:** 后端 `GET /students/self/contracts` 接口的完整响应结构 — 当前前端假设了 `contractCode`、`subject`、`totalLessons`、`remainingLessons`、`status` 等字段，需要确认接口实际返回
- **Unknown-005:** 后端 `GET /enrollments/students/{code}/enrollments` 接口是否存在？被参考于 `teacher/student-detail/index.js` 第 36 行，但该文件不可达且未验证后端实现

---

## Recommendation

基于 Facts，排除推测：

1. **立即关闭所有 `ENABLE_MOCK` 开关**（F-005, F-011, F-014, F-017）：
   - 将 4 个文件的 `ENABLE_MOCK` 改为 `false` 或删除 Mock 分支代码
   - 使 API 失败时用户能感知到真实错误状态

2. **修复 Stub/Impl 分裂问题**（F-015/F-016, F-023/F-024）：
   - 将 `pages/teacher/student-detail/index.js` 的内容合并到 `pages/teacher/student-detail.js`
   - 将 `pages/student/class-detail/index.js` 的内容合并到 `pages/student/class-detail.js`
   - 或修改 `app.json` 路由路径指向 `index` 子路径（但 WeChat 不支持文件夹级路由，需合并文件）

3. **补充后端接口缺失字段**（F-020, F-021）：
   - 在 `GET /students/self/contracts` 返回中增加 `classCode` 和 `teacherName` 字段

4. **替换 `baseUrl` 为可配置方式**（F-025）：
   - 使用环境变量或构建时注入，替换 `localhost:3000`

5. **统一 Token 校验方式**（F-026）：
   - 将 `app.checkLoginStatus()` 改为通过 `utils/request.js` 的 `get('/auth/me')` 调用

---

*Report generated by EOS-Research-Agent | Evidence-based scan — no assumptions, no guesses.*
