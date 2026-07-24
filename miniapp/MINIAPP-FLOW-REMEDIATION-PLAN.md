# MINIAPP-FLOW-REMEDIATION-PLAN.md

> **Generated:** 2026-07-22 | **Agent:** EOS-Review-Agent
> **Status:** 经独立代码审计确认的修复计划
> **范围：** EduERP-V4 小程序业务流缺口修复

---

## Evidence Audit（证据审计摘要）

| Finding | 状态 | 说明 |
|---------|------|------|
| K1 — import 路径错误 | **PASS** | 代码确认 `pages/student/class-detail.js:1` 和 `pages/teacher/student-detail.js:1` 均使用 `../utils/request`，正确路径应为 `../../utils/request`。`utils/request.js` 位于 `miniapp/utils/`，从 `pages/*/` 目录需要两级 `../`。 |
| K2 — 班级数据字段缺失 | **PASS** | ClassEntity 不含 `courseName`、`endDate`、`currentStudents`、`completedLessons`、`schedule`。WXML（`teacher/classes.wxml`、`teacher/class-detail.wxml`）明确引用这些字段，后端 `class.service.ts` 的 `findAll`/`findByCode` 直接返回裸 `ClassEntity`，无 enrichment。 |
| K3 — 课程字段不匹配 | **PASS** | CourseEntity 有 `totalLessons` 但前端 WXML 引用 `lessonCount`；`enrolledClasses` 字段在 CourseEntity 中完全不存在。`courses.wxml` 和 `course-detail.wxml` 均引用这两个字段。 |
| K4 — 家长端 classes 页忽略 classCode | **PASS** | `student/classes.js:23` 用 `'CT' + c.contractCode` 伪造 classCode，忽略 `getSelfContracts` 已返回的真实 `classCode` 和 `teacherName`。 |
| K5 — 学生详情 enrollment 数据缺失 | **PASS** | EnrollmentEntity 仅含 `classCode/studentCode/contractCode/status/withdrawReason/enrolledBy/enrolledAt`。`student-detail.js` 期望的 `className/courseName/completedLessons/totalLessons` 均不存在。 |

---

## P0 — 致命阻塞（运行时崩溃）

### REM-001: 家长端 class-detail.js require 路径错误

- **Finding:** K1
- **确认:** ✅ 已确认
- **现象:** `require('../utils/request')` 从 `pages/student/class-detail.js` 解析为 `pages/utils/request`（不存在），运行时 `module not found` → 页面白屏崩溃
- **涉及文件:**
  - `miniapp/pages/student/class-detail.js` (行 1)
- **修复方案:** 改前端
- **修复内容:** 将 `require('../utils/request')` 改为 `require('../../utils/request')`
- **预估工作量:** 小（改 1 行）

### REM-002: 教师端 student-detail.js require 路径错误

- **Finding:** K1
- **确认:** ✅ 已确认
- **现象:** 同 REM-001，`require('../utils/request')` 路径错误 → 页面白屏崩溃
- **涉及文件:**
  - `miniapp/pages/teacher/student-detail.js` (行 1)
- **修复方案:** 改前端
- **修复内容:** 将 `require('../utils/request')` 改为 `require('../../utils/request')`
- **预估工作量:** 小（改 1 行）

---

## P1 — 严重数据空白（页面显示缺失/异常）

### REM-003: 教师端班级列表缺少 enrichment 字段

- **Finding:** K2
- **确认:** ✅ 已确认
- **现象:** `GET /classes` 返回裸 ClassEntity，前端 WXML（`teacher/classes.wxml`）引用 `courseName`、`endDate`、`currentStudents`、`completedLessons`、`schedule` 五个字段均为 `undefined`：
  - `courseName` → 显示空白（只有 `courseCode`，无 join）
  - `endDate` → 显示空白（实体无此字段）
  - `currentStudents` → 显示空白，进度条除以 0 可能异常
  - `completedLessons` → 显示 0/totalLessons，进度条始终 0%
  - `schedule` → 显示空白（需从 `dayOfWeek`+`startTime`+`endTime` 组装）
- **涉及文件:**
  - 后端：`backend/src/modules/teaching/class/class.service.ts`（`findAll`/`findByCode` 方法）
  - 前端：`miniapp/pages/teacher/classes.js`、`miniapp/pages/teacher/classes.wxml`
  - 前端：`miniapp/pages/teacher/class-detail.js`、`miniapp/pages/teacher/class-detail.wxml`
- **修复方案:** 改后端
- **修复内容:**
  1. 在 `class.service.ts` 的 `findAll` 和 `findByCode` 中，查询 ClassEntity 后进行 enrichment：
     - JOIN `course` 表获取 `courseName`
     - JOIN `enrollment` 表统计 `currentStudents`（`status=ACTIVE` 的 count）
     - 从 `dayOfWeek`/`startTime`/`endTime` 组装 `schedule` 字符串
     - `endDate`：可从 `startDate` + `totalLessons` * 周期推算，或在 ClassEntity 中新增字段
     - `completedLessons`：需 JOIN `lesson` 表统计已完成课时数
  2. 返回 enriched DTO 而非裸 Entity
- **预估工作量:** 大（涉及多表 join + 新增 DTO + 推算逻辑）

### REM-004: 教师端班级详情缺少 enrichment 字段

- **Finding:** K2（延伸）
- **确认:** ✅ 已确认
- **现象:** `GET /classes/:code` 同样返回裸 ClassEntity，`class-detail.wxml` 引用 `courseName`、`schedule`、`endDate`、`currentStudents`、`completedLessons` 均为空
- **涉及文件:**
  - 后端：`backend/src/modules/teaching/class/class.service.ts`（`findByCode` 方法）
  - 前端：`miniapp/pages/teacher/class-detail.js`、`miniapp/pages/teacher/class-detail.wxml`
- **修复方案:** 改后端（与 REM-003 共享 enrichment 逻辑）
- **修复内容:** 复用 REM-003 的 enrichment 方案，`findByCode` 返回同样的 enriched DTO
- **预估工作量:** 中（复用 REM-003 逻辑，无需重复设计）

### REM-005: 教师端课程列表字段名不匹配

- **Finding:** K3
- **确认:** ✅ 已确认
- **现象:**
  - WXML 引用 `item.lessonCount`，后端 CourseEntity 字段名为 `totalLessons`
  - WXML 引用 `item.enrolledClasses`，后端完全无此字段
  - 结果：课时数显示为 0，开班数量显示为 0
- **涉及文件:**
  - 后端：`backend/src/modules/teaching/course/course.service.ts`（需 enrichment）
  - 前端：`miniapp/pages/teacher/courses.js`、`miniapp/pages/teacher/courses.wxml`
- **修复方案:** 改后端（推荐）或改前端
- **修复内容:**
  - **方案 A（改后端）：** CourseService 返回 enriched DTO，字段名改为 `lessonCount`（alias `totalLessons`），新增 `enrolledClasses`（JOIN class 表统计）
  - **方案 B（改前端）：** WXML 中 `item.lessonCount` 改为 `item.totalLessons`，移除 `enrolledClasses` 展示或前端另外请求
- **推荐：** 方案 A（后端统一 enrich），预估工作量中
- **预估工作量:** 中

### REM-006: 教师端课程详情字段名不匹配

- **Finding:** K3（延伸）
- **确认:** ✅ 已确认
- **现象:** `course-detail.wxml` 引用 `course.lessonCount` 和 `course.enrolledClasses`，同 REM-005
- **涉及文件:**
  - 后端：`backend/src/modules/teaching/course/course.service.ts`
  - 前端：`miniapp/pages/teacher/course-detail.js`、`miniapp/pages/teacher/course-detail.wxml`
- **修复方案:** 改后端（复用 REM-005 方案）
- **预估工作量:** 小（复用 REM-005 enrichment）

### REM-007: 教师端学生详情 enrollment 数据缺失

- **Finding:** K5
- **确认:** ✅ 已确认
- **现象:** `GET /enrollments/students/:code/enrollments` 返回裸 EnrollmentEntity（仅含 classCode/studentCode/contractCode/status），前端期望 `className`、`courseName`、`completedLessons`、`totalLessons` 全部为 `undefined`：
  - 班级名称显示空白
  - 课程名称显示空白
  - 进度条始终 0%
- **涉及文件:**
  - 后端：`backend/src/modules/teaching/enrollment/enrollment.service.ts`（`findByStudentCode` 方法）
  - 后端：`backend/src/modules/teaching/enrollment/enrollment.controller.ts`（路由处理）
  - 前端：`miniapp/pages/teacher/student-detail.js`、`miniapp/pages/teacher/student-detail.wxml`
- **修复方案:** 改后端
- **修复内容:**
  1. `findByStudentCode` 返回 enriched DTO：
     - JOIN `class` 表获取 `className`（即 ClassEntity.name）
     - JOIN `course` 表获取 `courseName`（通过 class.courseCode → course.name）
     - 统计 `completedLessons`（需 JOIN lesson 或 lesson-attendance）
     - 填充 `totalLessons`（从 ClassEntity.totalLessons 获取）
  2. 或改前端：先获取 enrollment 的 classCode，再调用 `/classes/:code` 获取班级详情
- **预估工作量:** 中

---

## P2 — 数据错乱

### REM-008: 家长端 classes 页伪造 classCode

- **Finding:** K4
- **确认:** ✅ 已确认
- **现象:** `student/classes.js` 行 23 `classCode: 'CT' + c.contractCode` 伪造 classCode，而 `getSelfContracts` 后端已返回真实 `classCode` 和 `teacherName`：
  - 导航到 `class-detail?code=${classData.classCode}` 时传入伪造 code
  - `class-detail.js` 用该 code 查找匹配，用 `'CT' + c.contractCode === code` 才能命中（自洽但错误）
  - 如果未来 `class-detail.js` 改为使用真实 classCode 调 API，将彻底断裂
  - `teacherName` 始终显示空（后端已提供但前端忽略）
- **涉及文件:**
  - 前端：`miniapp/pages/student/classes.js`
  - 前端：`miniapp/pages/student/class-detail.js`（关联影响）
- **修复方案:** 改前端
- **修复内容:**
  1. `classes.js` 直接使用后端返回的 `c.classCode` 和 `c.teacherName`
  2. `class-detail.js` 同步修改，不再用 `'CT' + contractCode` 匹配
- **预估工作量:** 小（改前端 2 个文件）

---

## P3 — 改进项

### REM-009: 教师端 classes.js mock 数据字段与真实 API 不一致

- **Finding:** K2（间接）
- **确认:** ✅ 已确认
- **现象:** `teacher/classes.js` 的 `ENABLE_MOCK` 数据中包含 `courseName`、`endDate`、`currentStudents`、`completedLessons`、`schedule` 等字段，但真实 API 不返回这些字段。mock 数据给人"已实现"的错觉，隐藏了实际的数据空白。
- **涉及文件:**
  - `miniapp/pages/teacher/classes.js`（mock 数据块）
- **修复方案:** 改前端
- **修复内容:** mock 数据应与后端实际返回结构一致，或在 REM-003 完成后验证 mock 与真实数据对齐
- **预估工作量:** 小

### REM-010: 教师端 courses.js mock 数据字段名与后端不一致

- **Finding:** K3（间接）
- **确认:** ✅ 已确认
- **现象:** mock 数据用 `lessonCount` 和 `enrolledClasses`，而后端 CourseEntity 用 `totalLessons` 且无 `enrolledClasses`。mock 隐藏了字段名不匹配问题。
- **涉及文件:**
  - `miniapp/pages/teacher/courses.js`（mock 数据块）
- **修复方案:** 改前端
- **修复内容:** 待 REM-005 确定字段名后再对齐 mock
- **预估工作量:** 小

### REM-011: 教师端 lesson-record.js 引用 courseName 但列表 API 不返回

- **Finding:** K2（间接）
- **确认:** ✅ 已确认
- **现象:** `lesson-record.js` 加载班级列表后使用 `courseName` 字段展示（mock 数据有，真实 API 无）。
- **涉及文件:**
  - `miniapp/pages/teacher/lesson-record.js`
- **修复方案:** 改后端（随 REM-003 enrichment 一并解决）
- **预估工作量:** 小（已被 REM-003 覆盖）

---

## 修复优先级与依赖关系

```
P0（立即修复，无依赖）
├── REM-001: student class-detail.js require 路径
└── REM-002: teacher student-detail.js require 路径

P1（后端 enrichment，互相关联）
├── REM-003: 班级列表 enrichment ← 核心，影响 REM-004/REM-011
│   └── REM-004: 班级详情 enrichment（复用 REM-003）
├── REM-005: 课程列表字段对齐
│   └── REM-006: 课程详情字段对齐（复用 REM-005）
└── REM-007: 学生详情 enrollment enrichment

P2（前端修复）
└── REM-008: 家长端 classes.js 使用真实 classCode

P3（清理）
├── REM-009: 对齐 teacher classes mock 数据
├── REM-010: 对齐 teacher courses mock 数据
└── REM-011: lesson-record courseName（随 REM-003 解决）
```

---

## 工作量汇总

| 级别 | 任务数 | 预估总工时 |
|------|--------|-----------|
| P0 | 2 | **小**（各改 1 行，~10min） |
| P1 | 5 | **大**（后端 enrichment 为主体，~2-4h） |
| P2 | 1 | **小**（前端改 2 文件，~20min） |
| P3 | 3 | **小**（mock 数据对齐，随 P1 完成后处理） |
| **合计** | **11** | **约 3-5 小时** |

---

## 备注

1. **Research Agent 提到的 `team-list.js` 不存在** — 教师端无此文件，不影响业务流。
2. **P1 修复的核心是后端 enrichment** — REM-003/004/005/006/007/011 均涉及后端从裸 Entity 返回改为 enriched DTO，建议统一设计一个 `ClassSummaryDto` 和 `CourseSummaryDto`，避免每处重复 enrich 逻辑。
3. **P0 可立即修复** — 不依赖 P1，建议先行处理以消除崩溃风险。
