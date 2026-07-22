# BACKEND-CONTRACT-ENRICHMENT-PLAN

## 1. 审查摘要

本报告基于 Research Agent 的 BACKEND-CLASS-DATA-SOURCE-REPORT.md 进行独立验证。通过代码审查确认了所有 5 个字段的数据来源，并给出了具体的实现方案。

### 1.1 验证结论

| 字段 | Research 结论 | 验证结果 | 修正/补充 |
|------|--------------|----------|----------|
| courseName | CourseEntity.name，通过 courseCode 关联 | ✅ 准确 | 需新增批量查询方法 |
| endDate | 系统无此字段，需推算 | ✅ 准确 | 推荐方案A（末课日期）或方案B（startDate + totalLessons） |
| currentStudents | EnrollmentEntity 统计 ACTIVE，countActiveByClassCode 已存在 | ✅ 准确 | 需新增批量查询方法 |
| completedLessons | LessonEntity FINISHED 状态统计，需新增方法 | ✅ 准确 | 需新增 countByClassCodeAndStatus 方法 |
| schedule | ClassEntity 已有 dayOfWeek+startTime+endTime，只需格式化 | ✅ 准确 | 需实现中文星期映射和格式化函数 |

### 1.2 关键发现

1. **ClassService 未注入任何关联 Service** — 当前只注入了 ClassRepository、ClassCodeGeneratorService、TeacherAssignmentService。
2. **ClassController 已注入 EnrollmentService** — 但未在 findAll/findByCode 中使用。
3. **LessonRepository 缺少按状态计数方法** — 只有 countByClassCode（总数）。
4. **EnrollmentRepository 已有 countActiveByClassCode 方法** — 可直接使用。
5. **前端期望的 schedule 格式** — 类似 "周六 09:00-11:00" 或 "周一,周三,周五 14:00-15:30"。

---

## 2. 字段级验证详情

### 2.1 courseName

**Research 结论：** 课程名称存在于 CourseEntity.name，通过 ClassEntity.courseCode 关联。

**代码验证：**
- `ClassEntity.courseCode` (line 26): ✅ 存在，类型 string
- `CourseEntity.name` (line 25): ✅ 存在，类型 string
- `CourseService.findByCode()` (line 80): ✅ 存在，返回 CourseEntity

**N+1 风险评估：** 
- 在 findAll 场景中，如果逐条调用 `courseService.findByCode()`，确实会产生 N+1 问题。
- **建议：** 新增 `CourseRepository.findByCodes(courseCodes[])` 批量查询方法。

**实现方案：**
```typescript
// CourseRepository 新增方法
async findByCodes(courseCodes: string[]): Promise<CourseEntity[]> {
  return this.repo.find({ where: { courseCode: In(courseCodes) } });
}
```

### 2.2 endDate

**Research 结论：** 系统中不存在 endDate 字段或计算逻辑。

**代码验证：**
- ClassEntity 字段列表: ✅ 确认无 endDate 字段
- 已有字段: startDate, totalLessons, dayOfWeek, startTime, endTime
- LessonEntity.scheduledDate: ✅ 存在，可用于推算

**推算方案评估：**

| 方案 | 精确度 | 复杂度 | 推荐场景 |
|------|--------|--------|----------|
| A: 查末课日期 | 高（反映实际排课） | 低 | 已排课的班级 |
| B: startDate + totalLessons * 7 | 中（按周估算） | 中 | 未排课的班级 |
| C: startDate + totalLessons * defaultDuration/60 | 低 | 高 | 不推荐 |

**推荐方案：** 采用混合方案
1. 优先查询 Lesson 表获取末课日期（方案A）
2. 如果未排课，降级为 startDate + totalLessons * 7 天（方案B）

**实现方案：**
```typescript
// LessonRepository 新增方法
async findMaxScheduledDateByClassCode(classCode: string): Promise<string | null> {
  const result = await this.repo
    .createQueryBuilder('l')
    .select('MAX(l.scheduledDate)', 'maxDate')
    .where('l.classCode = :classCode', { classCode })
    .getRawOne();
  return result?.maxDate ?? null;
}
```

### 2.3 currentStudents

**Research 结论：** EnrollmentEntity 统计 ACTIVE 状态，repository 已有 countActiveByClassCode 方法。

**代码验证：**
- `EnrollmentRepository.countActiveByClassCode()` (line 49-52): ✅ 存在，实现正确
- EnrollmentStatus.ACTIVE: ✅ 存在
- ClassController 已注入 EnrollmentService: ✅ 但未在 findAll/findByCode 中使用

**批量场景性能：**
- 在 findAll 场景中，如果逐条调用 `enrollmentService.countActiveByClassCode()`，会产生 N+1 问题。
- **建议：** 新增 `EnrollmentRepository.countActiveByClassCodes(classCodes[])` 批量查询方法。

**实现方案：**
```typescript
// EnrollmentRepository 新增方法
async countActiveByClassCodes(classCodes: string[]): Promise<Map<string, number>> {
  const results = await this.repo
    .createQueryBuilder('e')
    .select('e.classCode', 'classCode')
    .addSelect('COUNT(*)', 'count')
    .where('e.classCode IN (:...classCodes)', { classCodes })
    .andWhere('e.status = :status', { status: EnrollmentStatus.ACTIVE })
    .groupBy('e.classCode')
    .getRawMany();
  
  const map = new Map<string, number>();
  results.forEach(r => map.set(r.classCode, parseInt(r.count, 10)));
  return map;
}
```

### 2.4 completedLessons

**Research 结论：** LessonEntity FINISHED 状态统计，需新增 countByClassCodeAndStatus 方法。

**代码验证：**
- `LessonEntity.status` (line 25): ✅ 存在，类型 LessonStatus
- LessonStatus.FINISHED: ✅ 存在
- `LessonRepository.countByClassCode()` (line 36-38): ✅ 存在，但无状态过滤

**已确认的 LessonStatus 值：**
- DRAFT, SCHEDULED, TEACHING, FINISHED, ARCHIVED, CANCELLED

**业务口径确认：**
- completedLessons 应统计 status = FINISHED 的课时
- ARCHIVED 是否计入？建议：不计入（ARCHIVED 表示归档，可能包含异常课时）
- **建议：** 在 Repository 层统一过滤 FINISHED 状态

**实现方案：**
```typescript
// LessonRepository 新增方法
async countByClassCodeAndStatus(classCode: string, status: LessonStatus): Promise<number> {
  return this.repo.count({ where: { classCode, status } });
}

// 批量查询方法
async countFinishedByClassCodes(classCodes: string[]): Promise<Map<string, number>> {
  const results = await this.repo
    .createQueryBuilder('l')
    .select('l.classCode', 'classCode')
    .addSelect('COUNT(*)', 'count')
    .where('l.classCode IN (:...classCodes)', { classCodes })
    .andWhere('l.status = :status', { status: LessonStatus.FINISHED })
    .groupBy('l.classCode')
    .getRawMany();
  
  const map = new Map<string, number>();
  results.forEach(r => map.set(r.classCode, parseInt(r.count, 10)));
  return map;
}
```

### 2.5 schedule

**Research 结论：** ClassEntity 已有 dayOfWeek+startTime+endTime 原始字段，只需 Service 层格式化。

**代码验证：**
- `ClassEntity.dayOfWeek` (line 39): ✅ 存在，类型 number[]
- `ClassEntity.startTime` (line 42): ✅ 存在，类型 string
- `ClassEntity.endTime` (line 45): ✅ 存在，类型 string

**dayOfWeek 编号规则（从测试用例确认）：**
| 值 | 星期 | 中文 |
|----|------|------|
| 0 | Sunday | 周日 |
| 1 | Monday | 周一 |
| 2 | Tuesday | 周二 |
| 3 | Wednesday | 周三 |
| 4 | Thursday | 周四 |
| 5 | Friday | 周五 |
| 6 | Saturday | 周六 |

**前端期望格式（从 classes.wxml line 35 和 class-detail.wxml line 33 确认）：**
- 单天: "周六 09:00-11:00"
- 多天: "周一,周三,周五 14:00-15:30"

**实现方案：**
```typescript
// ClassService 新增方法
private formatSchedule(dayOfWeek: number[], startTime: string, endTime: string): string {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const sortedDays = [...dayOfWeek].sort((a, b) => a - b);
  const dayStr = sortedDays.map(d => dayNames[d]).join(',');
  return `${dayStr} ${startTime}-${endTime}`;
}
```

---

## 3. 确切实现方案

### 3.1 需要修改的文件

| 文件 | 改动类型 | 具体改动 |
|------|----------|----------|
| `CourseRepository` | 新增方法 | `findByCodes(courseCodes[])` |
| `EnrollmentRepository` | 新增方法 | `countActiveByClassCodes(classCodes[])` |
| `LessonRepository` | 新增方法 | `countByClassCodeAndStatus()`, `countFinishedByClassCodes()`, `findMaxScheduledDateByClassCode()` |
| `ClassService` | 新增方法 | `enrichClasses()`, `enrichClass()`, `formatSchedule()`, `computeEndDate()` |
| `ClassController` | 修改方法 | `findAll()`, `findOne()` 调用 enrich 方法 |
| `ClassModule` | 修改配置 | 注入 CourseService, EnrollmentService, LessonService |

### 3.2 新增方法清单

#### 3.2.1 CourseRepository
```typescript
// 新增批量查询方法
async findByCodes(courseCodes: string[]): Promise<CourseEntity[]> {
  if (!courseCodes.length) return [];
  return this.repo.find({ where: { courseCode: In(courseCodes) } });
}
```

#### 3.2.2 EnrollmentRepository
```typescript
// 新增批量统计方法
async countActiveByClassCodes(classCodes: string[]): Promise<Map<string, number>> {
  if (!classCodes.length) return new Map();
  
  const results = await this.repo
    .createQueryBuilder('e')
    .select('e.classCode', 'classCode')
    .addSelect('COUNT(*)', 'count')
    .where('e.classCode IN (:...classCodes)', { classCodes })
    .andWhere('e.status = :status', { status: EnrollmentStatus.ACTIVE })
    .groupBy('e.classCode')
    .getRawMany();
  
  const map = new Map<string, number>();
  results.forEach(r => map.set(r.classCode, parseInt(r.count, 10)));
  return map;
}
```

#### 3.2.3 LessonRepository
```typescript
// 新增按状态计数方法
async countByClassCodeAndStatus(classCode: string, status: LessonStatus): Promise<number> {
  return this.repo.count({ where: { classCode, status } });
}

// 新增批量统计完成课时方法
async countFinishedByClassCodes(classCodes: string[]): Promise<Map<string, number>> {
  if (!classCodes.length) return new Map();
  
  const results = await this.repo
    .createQueryBuilder('l')
    .select('l.classCode', 'classCode')
    .addSelect('COUNT(*)', 'count')
    .where('l.classCode IN (:...classCodes)', { classCodes })
    .andWhere('l.status = :status', { status: LessonStatus.FINISHED })
    .groupBy('l.classCode')
    .getRawMany();
  
  const map = new Map<string, number>();
  results.forEach(r => map.set(r.classCode, parseInt(r.count, 10)));
  return map;
}

// 新增查询末课日期方法
async findMaxScheduledDateByClassCode(classCode: string): Promise<string | null> {
  const result = await this.repo
    .createQueryBuilder('l')
    .select('MAX(l.scheduledDate)', 'maxDate')
    .where('l.classCode = :classCode', { classCode })
    .getRawOne();
  return result?.maxDate ?? null;
}

// 新增批量查询末课日期方法
async findMaxScheduledDateByClassCodes(classCodes: string[]): Promise<Map<string, string>> {
  if (!classCodes.length) return new Map();
  
  const results = await this.repo
    .createQueryBuilder('l')
    .select('l.classCode', 'classCode')
    .addSelect('MAX(l.scheduledDate)', 'maxDate')
    .where('l.classCode IN (:...classCodes)', { classCodes })
    .groupBy('l.classCode')
    .getRawMany();
  
  const map = new Map<string, string>();
  results.forEach(r => map.set(r.classCode, r.maxDate));
  return map;
}
```

#### 3.2.4 ClassService
```typescript
// 新增格式化方法
private formatSchedule(dayOfWeek: number[], startTime: string, endTime: string): string {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const sortedDays = [...dayOfWeek].sort((a, b) => a - b);
  const dayStr = sortedDays.map(d => dayNames[d]).join(',');
  return `${dayStr} ${startTime}-${endTime}`;
}

// 新增计算结课日期方法
private computeEndDate(startDate: string, totalLessons: number): string {
  const start = new Date(startDate);
  // 假设每周上1次课，每课时1周
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + totalLessons * 7);
  return endDate.toISOString().split('T')[0];
}

// 新增 enrich 方法（批量）
async enrichClasses(classes: ClassEntity[]): Promise<any[]> {
  if (!classes.length) return [];
  
  // 1. 收集所有 code
  const classCodes = classes.map(c => c.classCode);
  const courseCodes = [...new Set(classes.map(c => c.courseCode))];
  
  // 2. 批量查询关联数据
  const [courses, enrollmentCounts, lessonCounts, endDateMap] = await Promise.all([
    this.courseRepo.findByCodes(courseCodes),
    this.enrollmentRepo.countActiveByClassCodes(classCodes),
    this.lessonRepo.countFinishedByClassCodes(classCodes),
    this.lessonRepo.findMaxScheduledDateByClassCodes(classCodes),
  ]);
  
  // 3. 创建 courseCode -> courseName 映射
  const courseNameMap = new Map<string, string>();
  courses.forEach(c => courseNameMap.set(c.courseCode, c.name));
  
  // 4. 组装返回数据
  return classes.map(cls => ({
    ...cls,
    courseName: courseNameMap.get(cls.courseCode) ?? '',
    currentStudents: enrollmentCounts.get(cls.classCode) ?? 0,
    completedLessons: lessonCounts.get(cls.classCode) ?? 0,
    schedule: this.formatSchedule(cls.dayOfWeek, cls.startTime, cls.endTime),
    endDate: endDateMap.get(cls.classCode) ?? this.computeEndDate(cls.startDate, cls.totalLessons),
  }));
}

// 新增 enrich 单个方法
async enrichClass(cls: ClassEntity): Promise<any> {
  const [course, currentStudents, completedLessons, endDate] = await Promise.all([
    this.courseRepo.findOneByCode(cls.courseCode),
    this.enrollmentRepo.countActiveByClassCode(cls.classCode),
    this.lessonRepo.countByClassCodeAndStatus(cls.classCode, LessonStatus.FINISHED),
    this.lessonRepo.findMaxScheduledDateByClassCode(cls.classCode),
  ]);
  
  return {
    ...cls,
    courseName: course?.name ?? '',
    currentStudents,
    completedLessons,
    schedule: this.formatSchedule(cls.dayOfWeek, cls.startTime, cls.endTime),
    endDate: endDate ?? this.computeEndDate(cls.startDate, cls.totalLessons),
  };
}
```

#### 3.2.5 ClassController
```typescript
// 修改 findAll 方法
@Get()
@Roles('SuperAdmin', 'Admin', 'Teacher')
@ApiOperation({ summary: 'List all classes (paginated, filterable)' })
async findAll(@Query() query: QueryClassDto): Promise<ApiResponse> {
  const result = await this.classService.findAll(query);
  const enrichedItems = await this.classService.enrichClasses(result.items);
  return ApiResponse.success({ items: enrichedItems, total: result.total });
}

// 修改 findOne 方法
@Get(':code')
@Roles('SuperAdmin', 'Admin', 'Teacher')
@ApiOperation({ summary: 'Get class by classCode' })
async findOne(@Param('code') code: string): Promise<ApiResponse> {
  const cls = await this.classService.findByCode(code);
  const enriched = await this.classService.enrichClass(cls);
  return ApiResponse.success(enriched);
}
```

#### 3.2.6 ClassModule
```typescript
// 修改 imports 数组，添加相关模块
@Module({
  imports: [
    TypeOrmModule.forFeature([ClassEntity]),
    CourseModule,
    EnrollmentModule,
    LessonModule,
    TeacherAssignmentModule,
  ],
  // ... 其他配置
})
```

---

## 4. 执行顺序（按依赖关系排列）

### 阶段 1: Repository 层扩展（无依赖）
1. CourseRepository 新增 `findByCodes()` 方法
2. EnrollmentRepository 新增 `countActiveByClassCodes()` 方法
3. LessonRepository 新增三个方法：
   - `countByClassCodeAndStatus()`
   - `countFinishedByClassCodes()`
   - `findMaxScheduledDateByClassCode()` 和 `findMaxScheduledDateByClassCodes()`

### 阶段 2: Module 配置（依赖阶段1）
4. 修改 ClassModule imports，添加 CourseModule、EnrollmentModule、LessonModule

### 阶段 3: Service 层实现（依赖阶段1-2）
5. ClassService 新增 `formatSchedule()` 方法
6. ClassService 新增 `computeEndDate()` 方法
7. ClassService 新增 `enrichClasses()` 方法（批量）
8. ClassService 新增 `enrichClass()` 方法（单个）

### 阶段 4: Controller 层集成（依赖阶段3）
9. 修改 ClassController.findAll() 调用 enrichClasses()
10. 修改 ClassController.findOne() 调用 enrichClass()

---

## 5. 工作量评估

| 阶段 | 任务 | 预估工时 | 备注 |
|------|------|----------|------|
| 1 | Repository 层扩展 | 1.5h | 3个文件，5个新方法 |
| 2 | Module 配置 | 0.5h | 依赖关系配置 |
| 3 | Service 层实现 | 2h | 核心逻辑，包含格式化和 enrich |
| 4 | Controller 层集成 | 0.5h | 修改现有方法 |
| 5 | 测试验证 | 1.5h | 单元测试 + 集成测试 |
| **合计** | | **6h** | |

### 3.3 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| N+1 查询性能 | 高 | 使用批量查询（IN 子句）替代逐条查询 |
| endDate 无排课数据 | 中 | 降级为 startDate + totalLessons * 7 天估算 |
| completedLessons 口径不一致 | 低 | 明确只统计 FINISHED 状态，排除 ARCHIVED |
| schedule 格式不匹配 | 低 | 与前端对齐格式，建议在 Service 层统一 |
| Response DTO 缺失 | 中 | 建议后续新增 ClassDetailResponse/ClassListItemResponse |

---

## 6. 验证检查清单

实现完成后，需验证以下内容：

- [ ] courseName 正确显示课程名称
- [ ] endDate 正确计算或获取结课日期
- [ ] currentStudents 正确统计 ACTIVE 状态学生数
- [ ] completedLessons 正确统计 FINISHED 状态课时数
- [ ] schedule 正确格式化为 "周X HH:mm-HH:mm"
- [ ] 批量查询无 N+1 性能问题
- [ ] 单个查询正确返回所有 enrich 字段
- [ ] 未排课班级 endDate 正确降级处理
- [ ] 前端页面正确显示所有字段

---

*Plan generated by EOS-Review-Agent | 2026-07-22*
*Based on BACKEND-CLASS-DATA-SOURCE-REPORT.md with independent verification*