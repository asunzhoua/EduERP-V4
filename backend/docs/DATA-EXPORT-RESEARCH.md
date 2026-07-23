# 数据导出能力研究报告

**Phase 1 Batch 1.4 — 数据导出能力研究**
**日期**: 2026-07-24
**状态**: 研究完成，等待 Owner 决策

---

## 1. 现有代码分析

### 1.1 已有数据查询能力

**Analytics 模块**（`analytics.service.ts`，485 行）:
- 三级指标体系: student / teacher / institution
- 指标类型: DAU/WAU/MAU、出勤率、课时进度、续费率
- 趋势分析: 按天粒度的学习趋势 + 出勤趋势
- 已注入 8 个 Repository: LoginLog, Student, Enrollment, Lesson, LessonAttendance, TeacherAssignment, Course, Class

**Student 模块**（`student.controller.ts`，363 行）:
- CRUD + 分页查询（QueryStudentDto 支持筛选）
- 自助查询（Student/Parent 只能看自己数据）
- 批量导入（FileInterceptor + xlsx 解析）
- 已有数据: 学员基本信息、合同、考勤汇总、课时进度

**Teaching 模块**:
- Lesson Controller: 课时列表、详情、状态变更
- LessonAttendance Controller: 批量点名、确认出勤、单条修改
- 已有数据: 课时安排、出勤记录、班级课程关联

### 1.2 已有权限体系

**RolesGuard**（`roles.guard.ts`）:
- 基于 `@Roles()` 装饰器的角色控制
- 从 JWT token 提取 `user.role`
- 支持角色: SuperAdmin, Admin, Teacher, Parent, Student

**访问控制模式**（`analytics.controller.ts`）:
- `verifyStudentAccess()`: Student/Parent 只能访问自己数据，Admin/Teacher 可访问所有
- `verifyTeacherAccess()`: Teacher 只能访问自己数据，Admin 可访问所有
- 模式清晰，可直接复用到导出模块

### 1.3 已有实体清单（可导出数据源）

| 实体 | 路径 | 可导出字段 |
|:-----|:-----|:-----------|
| Student | modules/student/entities/student.entity.ts | 学员基本信息（姓名、性别、 phone、studentCode、状态等） |
| ClassEntity | modules/teaching/class/class.entity.ts | 班级信息（名称、课程、状态） |
| CourseEntity | modules/teaching/course/course.entity.ts | 课程信息（名称、课时数、价格） |
| LessonEntity | modules/teaching/lesson/lesson.entity.ts | 课时记录（日期、节次、状态） |
| LessonAttendanceEntity | modules/teaching/lesson-attendance/lesson-attendance.entity.ts | 出勤记录（状态、原因、备注） |
| EnrollmentEntity | modules/teaching/enrollment/enrollment.entity.ts | 报名记录（状态、剩余课时） |
| TeacherAssignmentEntity | modules/teaching/teacher-assignment/teacher-assignment.entity.ts | 教师分配（教师-班级关联） |
| ContractEntity | modules/teaching/contract/contract.entity.ts | 合同信息（金额、课时数、有效期） |
| User | modules/identity/entities/user.entity.ts | 用户账号信息 |
| Reminder | modules/reminder/entities/reminder.entity.ts | 提醒记录 |
| ImportHistory | modules/student/entities/import-history.entity.ts | 导入历史 |
| AuditLog | modules/student/entities/student-audit-log.entity.ts | 审计日志 |

### 1.4 已有依赖分析

**xlsx ^0.18.5** — 已安装 ✅
- 支持: .xlsx 读写、多 Sheet、样式（有限）、公式
- 用法: 项目已用于批量导入（Student 模块），可直接复用于导出
- 无需新增依赖即可实现 Excel 导出

**CSV 导出** — 无需额外依赖
- Node.js 原生可实现（字符串拼接或 stream）
- 或用 xlsx 包的 `XLSX.utils.sheet_to_csv()` 方法

**PDF 导出** — 需要新增依赖
- 可选: pdfkit / puppeteer / html-pdf
- 增加包体积和复杂度，MVP 阶段不建议

---

## 2. 导出格式对比分析

### 2.1 Excel (.xlsx)

**优点:**
- 多 Sheet 支持（一个文件包含多种数据）
- 支持表头样式、列宽、合并单元格
- 用户可直接用 Excel 做二次加工（筛选、透视表、图表）
- 教培行业用户最熟悉的格式
- xlsx 包已安装，零新增依赖

**缺点:**
- 文件体积较大（相比 CSV）
- 大数据量（>10万行）时生成较慢
- 流式生成支持有限（xlsx 包主要内存操作）

**适用场景:**
- 学员花名册、课程表、考勤汇总表
- 需要多 Sheet 的复合报表
- 用户需要二次加工的数据

**技术实现难度:** ★★☆☆☆（低 — 已有依赖，已有使用经验）

### 2.2 CSV (.csv)

**优点:**
- 文件体积极小（纯文本）
- 生成速度最快（可流式输出）
- 通用性最强（任何系统都能导入）
- 适合大数据量导出

**缺点:**
- 不支持多 Sheet
- 不支持样式/格式
- 中文编码问题（需 BOM 头或 UTF-8 标注）
- Excel 打开中文 CSV 可能乱码（需特殊处理）

**适用场景:**
- 系统间数据迁移
- 大数据量导出（>5000 行）
- 第三方系统导入

**技术实现难度:** ★☆☆☆☆（极低 — 原生支持）

### 2.3 PDF (.pdf)

**优点:**
- 格式固定，适合打印
- 专业外观
- 不可编辑（适合正式报告）

**缺点:**
- 需要新增依赖（pdfkit / puppeteer）
- 实现复杂度高（布局、分页、中文字体）
- 文件体积大
- 用户无法二次加工数据
- 教培场景需求不强

**适用场景:**
- 正式报告（学期报告、成绩单）
- 需要打印的文档
- 对外发送的正式文件

**技术实现难度:** ★★★★☆（高 — 需新增依赖 + 复杂布局）

### 2.4 格式推荐

**MVP 阶段推荐: Excel + CSV 双格式**

理由:
1. xlsx 已安装，Excel 导出零成本
2. CSV 作为补充，覆盖大数据量和系统对接场景
3. PDF 需求弱，投入产出比低，延后到 Phase 2
4. 教培机构用户最常用 Excel，CSV 作为技术补充

**Decision Gate #1**: 是否同意 MVP 只做 Excel + CSV，PDF 延后？

---

## 3. 技术方案设计

### 3.1 推荐方案: 统一导出服务 + 按类型分发

```
ExportController (API 入口)
    ↓
ExportService (统一调度)
    ↓
├── StudentExportHandler    → 学员数据查询 + 格式化
├── AttendanceExportHandler → 考勤数据查询 + 格式化
├── LessonExportHandler     → 课时数据查询 + 格式化
├── EnrollmentExportHandler → 报名数据查询 + 格式化
└── AnalyticsExportHandler  → 统计报表查询 + 格式化
    ↓
ExcelBuilder / CsvBuilder (格式转换)
    ↓
Stream Response (文件流直接返回)
```

**核心设计决策:**

**文件生成方式: 流式生成，直接返回**
- 不存临时文件（避免磁盘清理问题）
- 使用 NestJS 的 `@Res()` + `stream` 直接返回
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="xxx.xlsx"`

**理由:**
- 教培数据量通常 <5000 行，内存生成完全可行
- 无需文件清理机制
- 无状态，天然支持并发
- 简化部署（不需要临时目录权限）

### 3.2 为什么不用"生成临时文件 + 返回下载 URL"

- 增加复杂度（文件清理、过期机制、存储空间）
- 教培数据量小，不需要异步生成
- 增加一次 HTTP 请求（先获取 URL，再下载）
- 仅在数据量 >10 万行时才需要考虑

**Decision Gate #2**: 是否同意"流式生成 + 直接返回"方案？

---

## 4. API 设计

### 4.1 API 路径设计

**方案: 统一入口 + 类型参数**

```
POST /api/v1/export
```

选择 POST 而非 GET 的理由:
- 导出参数复杂（格式、类型、时间范围、筛选条件），GET URL 可能过长
- POST body 更灵活，支持复杂筛选条件
- 导出是"创建"行为（创建一次导出任务），语义上更适合 POST

### 4.2 请求参数设计

```typescript
// POST /api/v1/export
// Body:
{
  "format": "xlsx" | "csv",           // 导出格式（必填）
  "type": "students" | "attendance" | "lessons" | "enrollments" | "analytics",  // 导出类型（必填）
  "dateRange": {                       // 时间范围（可选，部分类型需要）
    "preset": "thisWeek" | "thisMonth" | "thisSemester" | "custom",
    "startDate": "2026-01-01",         // preset=custom 时必填
    "endDate": "2026-06-30"            // preset=custom 时必填
  },
  "filters": {                         // 筛选条件（可选）
    "classId": 1,                      // 按班级筛选
    "courseId": 2,                     // 按课程筛选
    "teacherId": 3,                    // 按教师筛选
    "status": "ACTIVE",               // 按状态筛选
    "studentCode": "STU001"           // 按学员编码筛选
  }
}
```

### 4.3 响应结构

**成功响应: 文件流**

```
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="students_20260724.xlsx"
Content-Length: 45678

<binary data>
```

**文件名规则:** `{type}_{YYYYMMDD}_{HHmmss}.{format}`
- 示例: `students_20260724_143052.xlsx`
- 示例: `attendance_20260724_143052.csv`

**错误响应: JSON**

```json
{
  "success": false,
  "code": 40001,
  "message": "不支持的导出格式",
  "data": null
}
```

### 4.4 错误码设计

| 错误码 | HTTP Status | 含义 | 触发条件 |
|:-------|:------------|:-----|:---------|
| 40001 | 400 | 不支持的导出格式 | format 不是 xlsx/csv |
| 40002 | 400 | 不支持的导出类型 | type 不在枚举范围 |
| 40003 | 400 | 时间范围无效 | startDate > endDate |
| 40004 | 400 | 缺少必要参数 | 必填字段缺失 |
| 40301 | 403 | 无权导出该数据 | 角色权限不足 |
| 40401 | 404 | 无数据可导出 | 筛选条件匹配 0 条记录 |
| 42901 | 429 | 导出频率限制 | 1 分钟内重复导出 |
| 50001 | 500 | 导出失败 | 服务端异常 |

### 4.5 频率限制

- 同一用户同一类型：1 分钟内最多 1 次
- 使用内存 Map 记录（`Map<string, number>`，key = `${userId}:${type}`）
- 不需要 Redis（单实例足够，教培场景并发低）

**Decision Gate #3**: 频率限制策略是否合理？1 分钟间隔是否太短/太长？

---

## 5. 权限设计

### 5.1 角色 × 数据类型 权限矩阵

| 导出类型 | SuperAdmin | Admin | Teacher | Parent | Student |
|:---------|:-----------|:------|:--------|:-------|:--------|
| students（学员花名册） | ✅ 全部 | ✅ 全部 | ✅ 自己班级 | ❌ | ❌ |
| attendance（考勤记录） | ✅ 全部 | ✅ 全部 | ✅ 自己班级 | ✅ 自己孩子 | ✅ 自己 |
| lessons（课时记录） | ✅ 全部 | ✅ 全部 | ✅ 自己班级 | ✅ 自己孩子 | ✅ 自己 |
| enrollments（报名记录） | ✅ 全部 | ✅ 全部 | ❌ | ✅ 自己孩子 | ✅ 自己 |
| analytics（统计报表） | ✅ 全部 | ✅ 全部 | ✅ 自己数据 | ❌ | ❌ |

### 5.2 数据过滤逻辑

**Admin/SuperAdmin:**
- 无数据过滤，导出全量数据
- 可通过 filters 参数主动筛选

**Teacher:**
- 自动注入 `teacherId = req.user.sub`
- 查询逻辑: 先查 TeacherAssignment → 获取关联的 classId 列表 → 数据查询加 `WHERE classId IN (...)`
- 即使前端传了其他 teacherId 的 filters，后端也强制限定在自己班级范围

**Parent:**
- 自动注入 `userId = req.user.sub`
- 查询逻辑: 先查 StudentParent → 获取关联的 studentCode 列表 → 数据查询加 `WHERE studentCode IN (...)`
- 只能导出自己孩子的数据

**Student:**
- 自动注入 `userId = req.user.sub`
- 查询逻辑: 先查 Student（userId 匹配）→ 获取 studentCode → 数据查询加 `WHERE studentCode = ?`
- 只能导出自己的数据

### 5.3 实现方案

**后端拦截（强制） + 前端隐藏（辅助）**

- 后端: ExportService 统一处理权限过滤，不信任前端传入的筛选条件
- 前端: 根据角色隐藏不可用的导出选项（UX 优化，非安全措施）
- 关键: 后端是唯一的权限判定层，前端只是辅助

**复用现有模式:**
- 复用 `verifyStudentAccess()` 的思路（Student/Parent 只能访问自己数据）
- 复用 `verifyTeacherAccess()` 的思路（Teacher 只能访问自己数据）
- 在 ExportService 中统一实现，不分散到各 Handler

**Decision Gate #4**: 权限矩阵是否符合预期？Teacher 是否需要导出学员花名册的权限？

---

## 6. 各导出类型详细设计

### 6.1 学员花名册导出（students）

**数据来源:** Student + Enrollment + TeacherAssignment

**Excel 格式:**
- Sheet 1: 学员基本信息
  - 列: 学员编码、姓名、性别、年龄、手机号、状态、报名时间、剩余课时、所属班级、授课教师
- 可选 Sheet 2: 学员课时明细（按学员分组）

**筛选支持:** classId, status, teacherId

**权限过滤:** Teacher → 只包含自己班级的学员

### 6.2 考勤记录导出（attendance）

**数据来源:** LessonAttendance + Lesson + Class + Student

**Excel 格式:**
- Sheet 1: 考勤汇总
  - 列: 日期、班级、课程、节次、学员编码、学员姓名、出勤状态、原因、备注
- 可选 Sheet 2: 学员出勤统计（出勤率、缺勤次数、请假次数）

**筛选支持:** classId, dateRange, studentCode, status

**权限过滤:** Teacher → 只包含自己班级的考勤

### 6.3 课时记录导出（lessons）

**数据来源:** Lesson + Class + Course + TeacherAssignment

**Excel 格式:**
- Sheet 1: 课时列表
  - 列: 日期、班级、课程、节次、状态、计划课时、实际课时、授课教师、备注

**筛选支持:** classId, courseId, teacherId, dateRange

**权限过滤:** Teacher → 只包含自己班级的课时

### 6.4 报名记录导出（enrollments）

**数据来源:** Enrollment + Student + Course + Class

**Excel 格式:**
- Sheet 1: 报名列表
  - 列: 学员编码、学员姓名、课程名称、班级名称、状态、总课时、已上课时、剩余课时、报名日期、合同金额

**筛选支持:** status, classId, courseId

**权限过滤:** Parent/Student → 只包含自己的报名记录

### 6.5 统计报表导出（analytics）

**数据来源:** 复用 AnalyticsService 的查询逻辑

**Excel 格式:**
- Sheet 1: 指标汇总
  - 总学员数、活跃学员数、总课程数、总班级数、出勤率、续费率
- Sheet 2: 趋势数据
  - 日期、日活跃学员数、课时数、出勤率

**筛选支持:** dateRange

**权限过滤:** Teacher → 只包含自己班级的统计数据

---

## 7. 前端交互设计

### 7.1 导出按钮位置

**列表页右上角**（与页面标题同行）

```
┌─────────────────────────────────────────┐
│ 学员管理                    [📤 导出]    │
├─────────────────────────────────────────┤
│ 筛选条件...                              │
│ ...                                      │
```

**各列表页导出入口:**
- 学员列表页 → 导出学员花名册
- 考勤记录页 → 导出考勤记录
- 课时列表页 → 导出课时记录
- 报名管理页 → 导出报名记录
- 数据看板页 → 导出统计报表

### 7.2 导出选项弹窗

点击"导出"按钮后弹出选项弹窗:

```
┌──────────────────────────────┐
│ 📤 导出数据                   │
├──────────────────────────────┤
│ 导出格式:                     │
│ ○ Excel (.xlsx)  ● CSV (.csv)│
│                               │
│ 时间范围:                     │
│ ● 本月  ○ 本学期  ○ 自定义    │
│                               │
│ 筛选条件:                     │
│ 班级: [全部 ▼]               │
│ 状态: [全部 ▼]               │
│                               │
│      [取消]    [确认导出]      │
└──────────────────────────────┘
```

**交互细节:**
- 默认选中 Excel 格式（教培用户最常用）
- 时间范围默认"本月"（最常用场景）
- 筛选条件根据当前列表的筛选状态预填充
- 自定义时间范围显示日期选择器

### 7.3 导出进度提示

**小数据量（<1000 行）:**
- 不显示进度条
- 按钮变为 loading 状态（旋转图标 + "导出中..."）
- 通常 <2 秒完成

**大数据量（>1000 行）:**
- 显示进度提示: "正在导出 XXX 条数据..."
- 禁用导出按钮防止重复点击
- 预计时间提示: "预计需要 X 秒"

### 7.4 下载完成提示

**成功:**
- Toast 提示: "导出成功，文件已下载"
- 文件名显示: "students_20260724.xlsx"

**失败:**
- Toast 提示: 错误信息（如"无数据可导出"、"导出失败，请重试"）
- 恢复导出按钮状态

**空数据:**
- 弹窗提示: "当前筛选条件下没有数据，请调整筛选条件后再导出"
- 不生成空文件

---

## 8. 实施计划

### Phase 1: 基础导出框架（P0 — 3 人天）

| 任务 | 人天 | 说明 |
|:-----|:-----|:-----|
| ExportModule 搭建 | 0.5 | Module + Controller + Service 骨架 |
| 统一导出接口 | 0.5 | POST /api/v1/export + 参数校验 |
| ExcelBuilder | 0.5 | xlsx 封装，支持多 Sheet + 样式 |
| CsvBuilder | 0.3 | CSV 生成 + BOM 头处理 |
| 权限过滤中间件 | 0.5 | 角色判断 + 数据范围过滤 |
| 文件流响应 | 0.3 | Stream Response + Content-Disposition |
| 频率限制 | 0.2 | 内存 Map 实现 |
| 单元测试 | 0.2 | Builder + 权限逻辑测试 |

### Phase 2: 数据类型实现（P0 — 4 人天）

| 任务 | 人天 | 说明 |
|:-----|:-----|:-----|
| StudentExportHandler | 1 | 学员花名册导出 |
| AttendanceExportHandler | 1 | 考勤记录导出 |
| LessonExportHandler | 0.5 | 课时记录导出 |
| EnrollmentExportHandler | 0.5 | 报名记录导出 |
| 集成测试 | 1 | 各类型导出端到端测试 |

### Phase 3: 前端实现（P1 — 3 人天）

| 任务 | 人天 | 说明 |
|:-----|:-----|:-----|
| 导出按钮组件 | 0.5 | 通用导出按钮 + 弹窗 |
| 导出选项弹窗 | 0.5 | 格式/范围/筛选选择 |
| 下载处理 | 0.5 | Blob 下载 + 进度 + 错误处理 |
| 各列表页集成 | 1 | 5 个列表页接入导出 |
| 角色适配 | 0.5 | 不同角色显示不同选项 |

### Phase 4: 增强功能（P2 — 2 人天）

| 任务 | 人天 | 说明 |
|:-----|:-----|:-----|
| AnalyticsExportHandler | 1 | 统计报表导出 |
| 导出历史记录 | 0.5 | 记录导出操作（审计） |
| 大数据量优化 | 0.5 | 流式查询 + 分批生成 |

### 总计: 12 人天

| 阶段 | 人天 | 优先级 | 说明 |
|:-----|:-----|:-------|:-----|
| Phase 1: 基础框架 | 3 | P0 | 必须先完成 |
| Phase 2: 数据类型 | 4 | P0 | 核心功能 |
| Phase 3: 前端 | 3 | P1 | 可后续迭代 |
| Phase 4: 增强 | 2 | P2 | 按需实现 |

---

## 9. 工作量估算汇总

| 项目 | 人天 | 累计 |
|:-----|:-----|:-----|
| 后端框架 + Builder | 3 | 3 |
| 5 种数据类型实现 | 4 | 7 |
| 前端交互 | 3 | 10 |
| 增强功能 | 2 | 12 |
| **总计** | **12** | **12** |

**MVP 最小集（Phase 1 + 2）: 7 人天**
- 后端框架 + 学员/考勤/课时三种核心导出
- 不含前端（可用 API 直接测试）

**完整交付（Phase 1-3）: 10 人天**
- 含前端交互
- 可用状态

---

## 10. 风险与注意事项

### 10.1 中文编码问题
- CSV 导出必须添加 BOM 头（`\uFEFF`），否则 Excel 打开中文乱码
- Excel 导出无此问题（xlsx 原生支持 Unicode）

### 10.2 大数据量风险
- 当前教培场景数据量通常 <5000 行，内存生成无压力
- 如果未来数据量增长，需要切换为流式查询（TypeORM cursor）+ 分批写入
- 建议: Phase 4 再处理，当前不需要过度设计

### 10.3 并发导出
- 教培场景并发极低（通常 <10 个管理员同时操作）
- 内存 Map 频率限制足够
- 不需要 Redis / 消息队列

### 10.4 文件命名
- 中文文件名在 HTTP Header 中需要 URL 编码
- 使用 `Content-Disposition: attachment; filename*=UTF-8''...` 格式
- 或使用英文文件名 + 时间戳（更简单可靠）

### 10.5 安全性
- 导出操作应记录审计日志（谁在什么时间导出了什么数据）
- 敏感字段（手机号、身份证号）是否需要脱敏 — Decision Gate
- 导出文件不应包含密码、token 等敏感信息

**Decision Gate #5**: 手机号等敏感字段导出时是否需要脱敏？

---

## 11. Decision Gate 汇总

| 编号 | 问题 | 选项 | 建议 |
|:-----|:-----|:-----|:-----|
| DG-1 | MVP 格式范围 | A: Excel+CSV+PDF / B: Excel+CSV / C: 仅 Excel | 建议 B（PDF 延后） |
| DG-2 | 文件生成方式 | A: 流式直接返回 / B: 临时文件+URL | 建议 A（简单可靠） |
| DG-3 | 频率限制间隔 | A: 30秒 / B: 1分钟 / C: 5分钟 | 建议 B（1分钟） |
| DG-4 | Teacher 导出权限 | A: 只能导出自己班级 / B: 可导出全部学员花名册 | 建议 A（安全优先） |
| DG-5 | 敏感字段脱敏 | A: 不脱敏 / B: 手机号中间4位脱敏 / C: 可选 | 建议 C（Admin 不脱敏，Teacher 脱敏） |
| DG-6 | 实施优先级 | A: 先学员+考勤 / B: 先学员+考勤+课时 / C: 全部一起 | 建议 B（核心三种） |
| DG-7 | 前端是否 MVP 必须 | A: 后端先行 / B: 前后端同步 | 建议 A（后端先行，前端 Phase 3） |

---

## 12. 技术实现参考

### 12.1 xlsx 包使用示例

```typescript
import * as XLSX from 'xlsx';

// 创建工作簿
const workbook = XLSX.utils.book_new();

// 创建工作表
const data = [
  ['学员编码', '姓名', '性别', '状态'],  // 表头
  ['STU001', '张三', '男', '在读'],
  ['STU002', '李四', '女', '休学'],
];
const sheet = XLSX.utils.aoa_to_sheet(data);

// 设置列宽
sheet['!cols'] = [
  { wch: 12 },  // 学员编码
  { wch: 10 },  // 姓名
  { wch: 6 },   // 性别
  { wch: 8 },   // 状态
];

// 添加到工作簿
XLSX.utils.book_append_sheet(workbook, sheet, '学员列表');

// 生成 Buffer
const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
```

### 12.2 CSV 导出示例

```typescript
function buildCsv(headers: string[], rows: string[][]): Buffer {
  const BOM = '\uFEFF';  // BOM 头，解决 Excel 中文乱码
  const headerLine = headers.join(',');
  const dataLines = rows.map(row =>
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  );
  const csv = BOM + headerLine + '\n' + dataLines.join('\n');
  return Buffer.from(csv, 'utf-8');
}
```

### 12.3 NestJS 文件流响应

```typescript
@Post('export')
async exportData(@Body() dto: ExportDto, @Res() res: Response) {
  const { buffer, filename, contentType } = await this.exportService.export(dto);

  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
  });

  res.send(buffer);
}
```

---

## 13. 总结

### 推荐方案
- **格式**: Excel + CSV（MVP），PDF 延后
- **生成方式**: 流式生成 + 直接返回（无临时文件）
- **权限**: 后端强制过滤，复用现有 RolesGuard 模式
- **API**: 统一入口 POST /api/v1/export
- **实施**: 4 Phase，MVP 7 人天，完整 12 人天

### 优势
1. 零新增依赖（xlsx 已安装）
2. 复用现有权限体系（RolesGuard + verifyAccess 模式）
3. 复用现有数据查询逻辑（AnalyticsService + Repository）
4. 架构简单（无临时文件、无消息队列、无 Redis）
5. 渐进式实施（可分阶段交付）

### 下一步
等待 Owner 决策 7 个 Decision Gate 后，进入 Phase 1 实施。
