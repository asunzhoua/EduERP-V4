# BACKEND-CLASS-DATA-SOURCE-REPORT

## Mission Context

**目的：** 调查教师端班级列表（`/classes`）和班级详情（`/classes/:code`）API 缺失的 5 个字段的数据来源，为后续 enrichment 改造提供依据。

**缺失字段：**
| # | 字段 | 前端使用位置 |
|---|------|------------|
| 1 | courseName | classes.wxml, class-detail.wxml |
| 2 | endDate | classes.wxml, class-detail.wxml |
| 3 | currentStudents | classes.wxml, class-detail.wxml |
| 4 | completedLessons | classes.wxml, class-detail.wxml |
| 5 | schedule | classes.wxml, class-detail.wxml |

**当前 API 返回：** `ClassService.findByCode()` 和 `findAll()` 直接返回原始 `ClassEntity`，无任何跨表关联或计算字段。

---

## Research Findings

### F-001: courseName — 课程名称

```
F-001
Conclusion: 课程名称存在于 CourseEntity.name，通过 ClassEntity.courseCode 关联。
        当前 ClassEntity 无 courseName 字段，API 返回值中无此数据。
Evidence ID: E-2026-07-22-001
Source:
  - backend/src/modules/teaching/class/class.entity.ts (line 26: courseCode: string)
  - backend/src/modules/teaching/course/course.entity.ts (line 25: name: string)
  - backend/src/modules/teaching/class/class.service.ts (findAll/findByCode 仅返回 ClassEntity)
  - miniapp/pages/teacher/classes.js (mock 数据字段: courseName)
  - miniapp/pages/teacher/class-detail.wxml (line 39: {{classInfo.courseName}})
Verification Method: 代码审查
Confidence Level: Confirmed
```

| 属性 | 值 |
|------|-----|
| 当前状态 | ❌ 缺失 |
| 数据来源 Entity | `CourseEntity` (course 表) |
| 关联键 | `ClassEntity.courseCode` → `CourseEntity.courseCode` |
| 目标字段 | `CourseEntity.name` |
| 获取方式 | **LEFT JOIN** `course` ON `class.courseCode = course.courseCode`；或 Service 层组合查询（先查 Class 再按 courseCode 批量查 Course） |
| 是否为计算字段 | ❌ 否，直接 SELECT |
| 跨表需求 | ✅ 是，1 个跨表 |

---

### F-002: endDate — 结课日期

```
F-002
Conclusion: 系统中不存在 endDate 字段或计算逻辑。ClassEntity 含有 startDate、totalLessons、
        dayOfWeek 等排课信息但无 endDate。需从排课数据推导或从最末课时日期获取。
Evidence ID: E-2026-07-22-002
Source:
  - backend/src/modules/teaching/class/class.entity.ts (字段清单: startDate, totalLessons, dayOfWeek, startTime, endTime)
  - grep 搜索 "endDate" 结果: 整个 teaching 模块无匹配
  - miniapp/pages/teacher/classes.wxml (line 31: {{item.startDate}} ~ {{item.endDate}})
  - miniapp/pages/teacher/class-detail.wxml (line 62: {{classInfo.endDate}})
Verification Method: 代码审查 + 全文搜索
Confidence Level: Confirmed
```

| 属性 | 值 |
|------|-----|
| 当前状态 | ❌ 缺失（无存储字段，无计算逻辑） |
| 数据来源 Entity | 无直接来源；可推导自 **方案A**: `LessonEntity.scheduledDate`（查班级最后一节课的日期）；**方案B**: 通过 `ClassEntity.startDate + dayOfWeek + totalLessons` 算法计算 |
| 获取方式 | **方案A**: 查 `lesson` 表 `WHERE classCode = X ORDER BY lessonNumber DESC LIMIT 1`，取 `scheduledDate` |
| 是否为计算字段 | ✅ 是，必须计算 |
| 跨表需求 | ✅ 方案A 查 lesson 表；方案B 纯计算（无需跨表但算法复杂） |

**方案对比：**
| 方案 | 精度 | 复杂度 | 风险 |
|------|------|--------|------|
| A: 从 Lesson 取末课日期 | 精确（反映实际排课） | 低（一次查询） | 如果没排课则无数据 |
| B: 从 startDate + dayOfWeek + totalLessons 推算 | 理论值（可能不精确） | 高（需周历计算） | 跳过节假日/调课不准确 |
| C: 新增 endDate 存储字段 | 最可靠 | 最低（运行态） | 需 schema migration + 创建/更新时填充 |

---

### F-003: currentStudents — 当前在籍学生数

```
F-003
Conclusion: 当前在籍学生数可通过 EnrollmentRepository.countActiveByClassCode() 获取。
        EnrollmentEntity 已支持按 classCode + status=ACTIVE 计数。
        当前 API 返回值中未包含此字段。
Evidence ID: E-2026-07-22-003
Source:
  - backend/src/modules/teaching/enrollment/enrollment.entity.ts (classCode, status: EnrollmentStatus)
  - backend/src/modules/teaching/enrollment/enrollment.repository.ts (line 49-52: countActiveByClassCode)
  - backend/src/modules/teaching/class/class.service.ts (未注入 EnrollmentService)
  - miniapp/pages/teacher/classes.wxml (line 53: {{item.currentStudents}})
  - miniapp/pages/teacher/class-detail.wxml (line 66: {{classInfo.currentStudents}})
Verification Method: 代码审查
Confidence Level: Confirmed
```

| 属性 | 值 |
|------|-----|
| 当前状态 | ❌ 缺失（但 Repository 已有计数方法） |
| 数据来源 Entity | `EnrollmentEntity` (enrollment 表) |
| 关联键 | `ClassEntity.classCode` → `EnrollmentEntity.classCode` |
| 条件 | `status = 'ACTIVE'` |
| 获取方式 | `enrollmentRepo.countActiveByClassCode(classCode)` — 已实现，直接调用 |
| 是否为计算字段 | ✅ 是（统计计数） |
| 跨表需求 | ✅ 需注入 EnrollmentService |

---

### F-004: completedLessons — 已完成课时数

```
F-004
Conclusion: 已完成课时为 LessonEntity 中 status=FINISHED 的计数。
        LessonRepository 目前有 countByClassCode（总数）但无私 FILTER 状态的方法。
        需新增或扩展 Repository 方法按 status 过滤。
Evidence ID: E-2026-07-22-004
Source:
  - backend/src/modules/teaching/lesson/lesson.entity.ts (classCode, status: LessonStatus)
  - backend/src/modules/teaching/lesson/lesson.repository.ts (line 36-38: countByClassCode 仅统计总数)
  - backend/src/modules/teaching/lesson/enums/lesson-status.enum.ts (FINISHED = 'FINISHED')
  - miniapp/pages/teacher/classes.wxml (line 35: {{item.completedLessons || 0}}/{{item.totalLessons}})
Verification Method: 代码审查
Confidence Level: Confirmed
```

| 属性 | 值 |
|------|-----|
| 当前状态 | ❌ 缺失（Repository 无按状态计数方法） |
| 数据来源 Entity | `LessonEntity` (lesson 表) |
| 关联键 | `ClassEntity.classCode` → `LessonEntity.classCode` |
| 条件 | `status = 'FINISHED'`（已完成） |
| 获取方式 | 需新增 `lessonRepo.countFinishedByClassCode(classCode)` 或通用 `countByClassCodeAndStatus(classCode, status)` |
| 是否为计算字段 | ✅ 是（统计计数） |
| 跨表需求 | ✅ 需注入 LessonService |

**已有 LessonRepository 方法：**
- `countByClassCode(classCode)` → 总数（无状态过滤）
- `findByClassCode(classCode)` → 返回所有 lesson（可在 service 层 filter，但大数据量不推荐）

**建议扩展方法：**
```typescript
// 在 LessonRepository 中新增
async countByClassCodeAndStatus(classCode: string, status: LessonStatus): Promise<number> {
  return this.repo.count({ where: { classCode, status } });
}
```

---

### F-005: schedule — 上课时间描述

```
F-005
Conclusion: 系统中无 schedule 字段。ClassEntity 含有 dayOfWeek (int[])、
        startTime、endTime 三个字段可组合生成描述字符串（如"周六 09:00-11:00"）。
Evidence ID: E-2026-07-22-005
Source:
  - backend/src/modules/teaching/class/class.entity.ts (line 39: dayOfWeek: number[], line 42: startTime: string, line 45: endTime: string)
  - grep 搜索 "schedule" 结果: teaching 模块无匹配字段
  - dayOfWeek 取值: 测试用例显示 [6]=周六, [1,3,5]=周一三五
  - miniapp/pages/teacher/classes.wxml (line 14: {{item.schedule}})
  - miniapp/pages/teacher/class-detail.wxml (line 35: {{classInfo.schedule}})
Verification Method: 代码审查 + 全文搜索 + 测试用例分析
Confidence Level: Confirmed
```

| 属性 | 值 |
|------|-----|
| 当前状态 | ❌ 缺失（但原始数据在 ClassEntity 中可用） |
| 数据来源 | `ClassEntity.dayOfWeek` + `startTime` + `endTime` |
| 获取方式 | Service 层计算：将 `dayOfWeek` int[] 映射为中文星期名，拼接 `startTime-endTime` |
| 是否为计算字段 | ✅ 是（字符串拼接 + 映射） |
| 跨表需求 | ❌ 否，ClassEntity 本身就有所有原始数据 |

**dayOfWeek 编号规则（从测试用例和 DTO 验证确认）：**
| 值 | 星期 | 中文 |
|----|------|------|
| 0 | Sunday | 周日 |
| 1 | Monday | 周一 |
| 2 | Tuesday | 周二 |
| 3 | Wednesday | 周三 |
| 4 | Thursday | 周四 |
| 5 | Friday | 周五 |
| 6 | Saturday | 周六 |

**计算示例：**
- `dayOfWeek=[6], startTime='09:00', endTime='11:00'` → `"周六 09:00-11:00"`
- `dayOfWeek=[1,3,5], startTime='14:00', endTime='15:30'` → `"周一,周三,周五 14:00-15:30"`

---

## Analysis

### 数据获取依赖性拓扑

```
class_core (ClassEntity)
  ├── courseName         ──→ CourseService.findByCode()        [跨 service]
  ├── endDate            ──→ LessonService / 排课计算          [跨 service 或计算]
  ├── currentStudents    ──→ EnrollmentService.countActive()   [跨 service]
  ├── completedLessons   ──→ LessonService (需加方法)          [跨 service]
  └── schedule           ──→ 本 Service 计算                   [纯计算]
```

### 当前局限性

1. **ClassService 未注入任何关联 Service** — 目前只注入了 `ClassRepository`、`ClassCodeGeneratorService`、`TeacherAssignmentService`。
2. **Controller 返回原始 Entity** — `GET /classes` 和 `GET /classes/:code` 直接返回 ClassEntity，不做任何 enrich。
3. **无 Response DTO** — 没有 `ClassDetailResponse` 或 `ClassListItemResponse` 这样的结构体来组织跨表数据。
4. **无统一聚合层** — 没有专门为前端定制的聚合 Service。

### 批量查询 vs N+1

在 `findAll()`（班级列表）场景中，如果用逐条查询的方式获取每个班级的关联数据，会产生 N+1 问题：
```
20 个班级 → 1 次班级查询 + 20 次 course 查询 + 20 次 enrollment 查询 + 20 次 lesson 查询 = 61 次 SQL
```

**建议批量获取方案：**
- 收集所有班级的 `courseCode` → 1 次 `courseRepo.findByCodes(codes)` 批量查课程
- 收集所有班级的 `classCode` → 1 次 `enrollmentRepo.countActiveByClassCodes(codes)` 批量查在籍数
- 收集所有班级的 `classCode` → 1 次 `lessonRepo.countFinishedByClassCodes(codes)` 批量查完成课时
- schedule 字段直接计算，无需查库
- endDate 可走批量查末课日期或由前端计算

---

## Risks

| Risk ID | 描述 | 关联 Finding | 严重度 | 缓解方案 |
|---------|------|-------------|--------|---------|
| R-001 | **N+1 查询性能风险**: findAll 每返回一个班级都需要额外查询 course/enrollment/lesson 表，可能导致大量 SQL 查询 | F-001, F-003, F-004 | 高 | 使用批量查询 (IN 子句) 替代逐条查询 |
| R-002 | **endDate 无确切来源**: 如果采用末课日期方案，班级尚未排课时 endDate 为空 | F-002 | 中 | 降级为 startDate + totalLessons * 7（按周估算） |
| R-003 | **completedLessons 计数口径**: LessonStatus.FINISHED 和 ARCHIVED 是否都应算作"已完成"，需与产品确认 | F-004 | 低 | 确认业务语义，在 Repository 层统一 |
| R-004 | **schedule 格式变更**: 如果前端需要的格式与计算格式不一致，需额外调整 | F-005 | 低 | 与前端约定格式，建议在 Service 层统一格式化 |
| R-005 | **缺少 Response DTO**: 当前无响应结构体，直接扩展 ClassEntity 会引入耦合 | F-001~F-005 | 中 | 创建独立的 Response DTO，避免污染 Entity |

---

## Unknowns

| # | 未验证项 | 原因 |
|---|---------|------|
| U-001 | endDate 的精确业务含义 — 是"理论结课日期"还是"实际上完最后一课的日期"？ | 需与产品/运营确认 |
| U-002 | completedLessons 是否包含 DRAFT 和 CANCELLED 之外的已完成状态？FINISHED 和 ARCHIVED 是否都算"已完成"？ | 需确认业务口径 |
| U-003 | schedule 的时间格式是否须包含"HH:mm-HH:mm"格式？是否支持跨天课程（如 22:00-01:00）？ | 需与前端对齐格式规范 |
| U-004 | 教师端是否只需查看自己教授的班级？还是查看所有班级？ | 影响列表过滤逻辑（当前 TeacherAssignmentService 已存在但未被用于过滤） |

---

## Recommendation

### 整体方案：ClassResponse Enrichment Layer

**方案定位：** 在 ClassService 之上增加一个 **enrichment layer**（或直接在 controller 调用多 service），将 5 个字段注入 API 响应。

**架构建议：**

```
ClassController
  └── GET /classes        ──→ ClassService.findAll() → enrichClasses(items)
  └── GET /classes/:code  ──→ ClassService.findByCode() → enrichClass(item)
```

**enrichClasses 流程（批量）：**
1. 从 ClassEntity 列表提取 `classCode[]` 和 `courseCode[]`
2. `CourseRepository.findByCodes(courseCodes)` → Map<courseCode, courseName>
3. `EnrollmentRepository.countActiveByClassCodes(classCodes)` → Map<classCode, count>
4. `LessonRepository.countByClassCodesAndStatus(classCodes, FINISHED)` → Map<classCode, count>
5. 对每个 ClassEntity:
   - courseName = map.get(courseCode)
   - currentStudents = enrollmentMap.get(classCode) ?? 0
   - completedLessons = lessonMap.get(classCode) ?? 0
   - schedule = formatSchedule(dayOfWeek, startTime, endTime)
   - endDate = lookup or compute

### 分字段工作量估算

| 字段 | 后端改动量 | 涉及文件 | 预估工时 |
|------|-----------|---------|---------|
| **courseName** | 低 | ClassService + (可选) CourseRepository 加批量查询方法 | 0.5h |
| **endDate** | 中 | ClassService + LessonRepository 加查询末课方法 + 降级逻辑 | 1-2h |
| **currentStudents** | 低 | ClassService + EnrollmentRepository 已有方法 | 0.5h |
| **completedLessons** | 低 | LessonRepository 加 `countByClassCodeAndStatus()` | 0.5h |
| **schedule** | 低 | ClassService 加格式化函数 + 中文星期映射表 | 0.5h |
| **Response DTO** | 低 | 新增 `ClassDetailResponse` / `ClassListItemResponse` | 0.5h |
| **合计** | **低-中** | 约 4-6 个文件改动 | **4-5h** |

### 实施优先级建议

1. **P0** — courseName + schedule（纯计算/单表关联，无歧义）
2. **P0** — currentStudents + completedLessons（Repository 已有或少量扩展）
3. **P1** — endDate（需明确业务语义后再实施）
4. **P1** — Response DTO（长期可维护性）

---

## Appendix A: 关键实体关系图

```
class (ClassEntity)
  ├── classCode      ──→ enrollment.classCode      (1:N)
  ├── classCode      ──→ lesson.classCode          (1:N)
  ├── courseCode     ──→ course.courseCode         (N:1)
  ├── dayOfWeek      → 用于计算 schedule
  ├── startTime      → 用于计算 schedule
  └── endTime        → 用于计算 schedule

course (CourseEntity)
  └── name           → courseName

enrollment (EnrollmentEntity)
  ├── classCode
  ├── status         → ACTIVE 才计入 currentStudents
  └── studentCode

lesson (LessonEntity)
  ├── classCode
  ├── status         → FINISHED 才计入 completedLessons
  └── scheduledDate  → 可用于推导 endDate
```

## Appendix B: 当前 API 响应结构（待改造）

```json
// GET /classes 当前返回
{
  "items": [
    {
      "id": 1,
      "classCode": "CL2026070001",
      "courseCode": "CS2026070001",
      "name": "周六上午班",
      "status": "ACTIVE",
      "startDate": "2026-07-15",
      "totalLessons": 24,
      "defaultDuration": 90,
      "dayOfWeek": [6],            // 原始 int 数组
      "startTime": "09:00",
      "endTime": "11:00",
      "maxStudents": 20,
      // ❌ 缺失以下字段:
      // "courseName": "数学思维训练",
      // "endDate": "2026-08-15",
      // "currentStudents": 12,
      // "completedLessons": 8,
      // "schedule": "周六 09:00-11:00"
    }
  ],
  "total": 1
}
```

---

*Report generated by EOS-Research-Agent | 2026-07-22*
*Evidence-first analysis. All conclusions are backed by source code review.*
