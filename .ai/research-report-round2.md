# Long Running Mission — Round 2 Research Report

**Date**: 2026-07-23
**Agent**: EOS-Research-Agent
**Scope**: 5-dimensional project state scan → identify next batch

---

## Mission Context

已完成 Batch A (operatedBy 修复)、Batch B (TS 错误修复)、Batch D (sitemap.json) 及 Seed 数据。本次扫描覆盖：

1. 前端 UX 细节
2. 后端 API 完整性
3. 测试覆盖
4. 文档同步
5. 代码清理

目标：识别下一个可推进的 Batch，依据证据排序优先级。

---

## Research Findings

### Dimension 1: 前端 UX 细节

#### F-001 — 学生端无 TabBar 底部导航
- **Conclusion**: 学生登录后通过 `wx.navigateTo` 跳转至 `/pages/student/index`，底部 TabBar 不可见。
- **Evidence ID**: E-2026-07-23-001
- **Source**: `miniapp/pages/login/login.js` line 39: `wx.navigateTo({ url: '/pages/student/index' })`
- **Verification Method**: 代码审查
- **Confidence Level**: Confirmed

#### F-002 — TabBar 仅覆盖 3 个教师页面
- **Conclusion**: `app.json` 的 TabBar list 只包含 index（首页）、teacher/courses（课程）、teacher/classes（班级），无任何学生端页面入口。
- **Evidence ID**: E-2026-07-23-002
- **Source**: `miniapp/app.json` tabBar.list
- **Verification Method**: 文档检查
- **Confidence Level**: Confirmed

#### F-003 — 图片资源目录完全为空
- **Conclusion**: `miniapp/images/` 目录为空文件夹，TabBar 引用的 6 个图标（home.png, home-active.png, course.png, course-active.png, class.png, class-active.png）、login 页的 logo.png、以及多处使用的 default-avatar.png 均不存在。
- **Evidence ID**: E-2026-07-23-003
- **Source**: `miniapp/images/` (glob 确认目录为空); `miniapp/app.json` lines 30-43 (TabBar 图标引用); `miniapp/pages/login/login.wxml` line 4 (logo.png); `miniapp/pages/index/index.wxml` line 5 (default-avatar.png)
- **Verification Method**: 文件系统检查
- **Confidence Level**: Confirmed

#### F-004 — 两处 WXML 文件头部注释路径与实际不符
- **Conclusion**: `teacher/student-detail.wxml` 和 `student/class-detail.wxml` 的头部注释分别声称位于 `index.wxml` 子目录下，但实际文件直接在父级目录。
  - `<!--pages/teacher/student-detail/index.wxml-->` → 实际位于 `pages/teacher/student-detail.wxml`
  - `<!--pages/student/class-detail/index.wxml-->` → 实际位于 `pages/student/class-detail.wxml`
- **Evidence ID**: E-2026-07-23-004
- **Source**: `miniapp/pages/teacher/student-detail.wxml` line 1; `miniapp/pages/student/class-detail.wxml` line 1
- **Verification Method**: 代码审查
- **Confidence Level**: Confirmed

#### F-005 — 页面标题一致性问题
- **Conclusion**: app.json 默认 navigationBarTitleText 为 "EduERP"，但各页面 JSON 配置中未见独立设置标题。登录页、首页、教师/学生各页面共享同一默认标题，缺乏差异化。
- **Evidence ID**: E-2026-07-23-005
- **Source**: `miniapp/app.json` window.navigationBarTitleText; 各页面 `.json` 文件均未覆盖 navigationBarTitleText
- **Verification Method**: 文档检查
- **Confidence Level**: Confirmed

---

### Dimension 2: 后端 API 完整性

#### F-006 — 三个 Controller 的 findAll() 返回空数组
- **Conclusion**: `EnrollmentController.findAll()`、`ContractController.findAll()`、`TeacherAssignmentController.findAll()` 均直接返回 `[]`（或 `return []`），未调用 Service 方法，未包装 ApiResponse。其中 `EnrollmentController.findAll()` 返回裸数组而非标准 `{code, message, data}` 格式。
- **Evidence ID**: E-2026-07-23-006
- **Source**: 
  - `backend/src/modules/teaching/enrollment/enrollment.controller.ts` line 30-33
  - `backend/src/modules/teaching/contract/contract.controller.ts` line 46-49
  - `backend/src/modules/teaching/teacher-assignment/teacher-assignment.controller.ts` line 38-41
- **Verification Method**: 代码审查
- **Confidence Level**: Confirmed

#### F-007 — 部分 Controller 使用硬编码 operator=0
- **Conclusion**: `LessonAttendanceController` 和 `LessonChangeRequestController` 中多处使用 `operator: 0` 或 `requestedBy: 0`，而非从 JWT 中提取当前用户 ID。
- **Evidence ID**: E-2026-07-23-007
- **Source**: 
  - `backend/src/modules/teaching/lesson-attendance/lesson-attendance.controller.ts` lines 40, 60, 29
  - `backend/src/modules/teaching/lesson-change-request/lesson-change-request.controller.ts` lines 21, 39, 43, 49
- **Verification Method**: 代码审查
- **Confidence Level**: Confirmed

#### F-008 — 学生端需要的 API 端点基本覆盖
- **Conclusion**: 学生端调用的 `GET /students/self`、`/students/self/contracts`、`/students/self/lessons` 以及教师端调用的 `/courses`、`/classes`、`/classes/:code/students`、`/enrollments/students/:code/enrollments` 均有实现。但 Enrollment controller 的 `findByStudent` 返回未包裹 ApiResponse。
- **Evidence ID**: E-2026-07-23-008
- **Source**: `backend/src/modules/student/student.controller.ts` lines 50-155; `backend/src/modules/teaching/enrollment/enrollment.controller.ts` lines 79-84
- **Verification Method**: 代码审查
- **Confidence Level**: Confirmed

#### F-009 — 微信授权登录未实现
- **Conclusion**: 登录页的微信授权按钮绑定了 `onWechatLogin` 方法，但仅显示 Toast "微信授权登录待实现"，无实际逻辑。
- **Evidence ID**: E-2026-07-23-009
- **Source**: `miniapp/pages/login/login.js` lines 62-64
- **Verification Method**: 代码审查
- **Confidence Level**: Confirmed

---

### Dimension 3: 测试覆盖

#### F-010 — 所有 Teaching 子模块均有测试文件
- **Conclusion**: 每个 teaching 子模块（course, class, contract, enrollment, lesson, lesson-attendance, lesson-change-request, teacher-assignment）均包含对应的 controller.spec.ts 和 service.spec.ts 测试文件。全局有 75 suites / 935 tests ALL PASS。
- **Evidence ID**: E-2026-07-23-010
- **Source**: 
  - `backend/src/modules/teaching/` 下各子模块的 `.spec.ts` 文件（共 18 个 spec 文件）
  - `.ai/PROJECT_STATE.md` 中 "75 suites / 935 tests ALL PASS"
- **Verification Method**: 文件系统检查 + 文档检查
- **Confidence Level**: Confirmed

#### F-011 — 新修复代码缺少针对性测试
- **Conclusion**: Batch A (operatedBy 修复)、Batch B (TS 错误修复) 的修复代码未见对应的回归测试用例。特别是 operatedBy 注入逻辑缺乏验证测试。
- **Evidence ID**: E-2026-07-23-011
- **Source**: 搜索 backend/src 下 spec 文件，未见针对 `req.user.sub` 注入或 operatorId 提取的专项测试
- **Verification Method**: 代码审查
- **Confidence Level**: Likely

---

### Dimension 4: 文档同步

#### F-012 — CHANGELOG.md 落后于当前项目状态
- **Conclusion**: CHANGELOG.md 仅记录到 v0.3.0 (Student Domain, 2026-07-07)，缺少 Teaching Domain Skeleton (Sprint 4.0)、Mock 开关关闭、Phase 4 业务流闭环等近期变更。
- **Evidence ID**: E-2026-07-23-012
- **Source**: `CHANGELOG.md` 全部内容
- **Verification Method**: 文档检查
- **Confidence Level**: Confirmed

#### F-013 — backend/README.md 目录结构与实际不符
- **Conclusion**: backend/README.md 所列 `src/modules/` 包含 student/teacher/parent/lesson/course/attendance/leave/finance/points/dashboard/system 共 11 个模块，但实际仅 identity/student/teaching 三个一级模块。该文档为早期愿景，未随重构更新。
- **Evidence ID**: E-2026-07-23-013
- **Source**: `backend/README.md` Project Structure 章节 vs 实际 `backend/src/modules/` 目录结构
- **Verification Method**: 文档检查 + 文件系统检查
- **Confidence Level**: Confirmed

---

### Dimension 5: 代码清理

#### F-014 — 源码中无 TODO/FIXME 残留
- **Conclusion**: 后端 src/ 目录和 miniapp 源码中搜索不到 TODO/FIXME 注释。app.js 中的 `// TODO: 部署时替换为生产环境 API 域名` 属于部署说明，非技术债务。
- **Evidence ID**: E-2026-07-23-014
- **Source**: 全局 grep `TODO|FIXME|HACK|XXX` 在 `backend/src/` 和 `miniapp/` 文件夹
- **Verification Method**: 代码搜索
- **Confidence Level**: Confirmed

#### F-015 — 图片资源缺失是最大的代码清理项
- **Conclusion**: 6 个 TabBar 图标 + 2 个通用图片文件缺失，属于直接影响用户体验的资源清理问题。
- **Evidence ID**: E-2026-07-23-015
- **Source**: 同 F-003 证据
- **Verification Method**: 文件系统检查
- **Confidence Level**: Confirmed

---

## Analysis

### 优先级排序逻辑

基于本次调研，按"影响面 × 修复成本"排列：

**P0 — 关键阻塞**
1. **F-003 / F-015**: 图片资源全部缺失 — 学生端从 Login 页开始即显示 broken image，TabBar 图标全部不可见。这是最小程序最直观的 Bug，也是启动后用户第一眼看到的问题。
2. **F-001**: 学生端无 TabBar — 学生登录后无法通过底部导航切换页面，严重影响学生端可用性。

**P1 — 重要但不阻塞**
3. **F-006**: 三个 findAll() 返回空数组 — 虽然前端当前可能不直接调用这些端点，但 API 契约完整性受影响。
4. **F-007**: operator=0 硬编码 — 与 Batch A 属于同一类问题，但不影响学生/教师主流程。
5. **F-004**: WXML 注释路径不一致 — 代码整洁度问题，不影响运行但影响可维护性。

**P2 — 技术债务**
6. **F-012**: CHANGELOG 落后 — 文档同步。
7. **F-013**: backend/README.md 过时 — 文档同步。
8. **F-009**: 微信授权登录未实现 — 属于未来功能，不阻塞当前 MVP。

**P3 — 低优先级**
9. **F-005**: 页面标题一致性 — 体验优化。
10. **F-011**: 新修复代码缺少测试 — 质量提升。

### 推荐 Batch C: 前端资源补全 + 学生端 TabBar

这是"影响面大、改动集中、风险低"的 Batch：

| 任务 | 关联 Finding |
|------|-------------|
| 补齐所有缺失图片资源（8 个文件）| F-003, F-015 |
| 为学生端补充 TabBar（新建学生端 tab 并调整导航逻辑）| F-001, F-002 |
| 修复两处 WXML 注释路径 | F-004 |
| 标准化页面标题 | F-005 |

**预计影响文件**: 约 6-10 个（app.json + 图片文件 + 2 个 WXML）

### 备选 Batch E: findAll() 空数组修复

如果希望优先保证 API 完整性：

| 任务 | 关联 Finding |
|------|-------------|
| EnrollmentController.findAll() 实现 | F-006 |
| ContractController.findAll() 实现 | F-006 |
| TeacherAssignmentController.findAll() 实现 | F-006 |
| operator=0 替换为 JWT 注入 | F-007 |

**预计影响文件**: 6 个（3 controller + 3 service）

---

## Risks

| Risk | Description | Related Finding |
|------|-------------|-----------------|
| R-001 | 学生端无 TabBar 导致用户无法导航，学生体验严重受损 | F-001, F-002 |
| R-002 | 图片资源缺失导致小程序启动即有视觉问题，影响专业度 | F-003, F-015 |
| R-003 | findAll() 空数组 + 裸返回格式未对齐 ApiResponse 标准，未来接入前端可能触发解析异常 | F-006 |
| R-004 | operator=0 硬编码使操作审计链路断裂（audit 日志中 operatedBy 全部为 0） | F-007 |
| R-005 | CHANGELOG 老化导致团队成员无法追踪项目真实进度 | F-012 |

---

## Unknowns

- 学生端 TabBar 的设计方案（哪些页面进入 TabBar，icon 风格）未经用户确认
- 缺失图片的具体设计资源（SVG/PNG 尺寸、风格）未定义
- findAll() 三个接口的业务需求是否当前有必要（前端当前是否调用这些端点）未验证
- operator=0 在 lesson-attendance / lesson-change-request 中是否影响主流程（当前 seed 数据已跳过该问题）未完全验证

---

## Recommendation

**建议优先推进 Batch C: 前端资源补全 + 学生端 TabBar**

依据：
1. **影响面最大** — 学生端登录后每一步都暴露在无 TabBar + 缺图的状态下
2. **改动集中** — 集中在 app.json + 图片资源 + 少量 JS/WXML，低风险
3. **无需后端配合** — 纯前端改动，可独立验证
4. **即刻可验证** — 改完即可在微信开发者工具中看到效果

**备选**: 如龙虾判断当前学生端非验收重点，可改推 Batch E (findAll 修复 + operator=0 审计修复) 作为后端完整性提升批次。
