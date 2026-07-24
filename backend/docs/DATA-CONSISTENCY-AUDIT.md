# 数据模型真实关系审计报告

生成时间：2026-07-24
审计范围：EduERP-V4 后端 src/ 目录所有教学相关 Entity 和 Service
审计方法：静态代码分析（逐文件扫描）

---

## 1. 当前数据库关系

### 1.1 关联方式总览

所有实体之间采用「业务编码引用」方式关联，不使用 TypeORM 的 @ManyToOne/@OneToMany/@JoinColumn 装饰器（唯一例外：student-parent.entity.ts）。

具体关联关系如下：

(1) Course → Class
- 关联字段：ClassEntity.courseCode → CourseEntity.courseCode
- 关联类型：逻辑引用（无外键约束）
- 关系基数：一个 Course 对应多个 Class（1:N）
- 源文件：src/modules/teaching/class/class.entity.ts 第 27 行
- 风险：ClassEntity.courseCode 是 varchar(20)，无 @Index 单独索引，无外键约束

(2) Class → Enrollment
- 关联字段：EnrollmentEntity.classCode → ClassEntity.classCode
- 关联类型：逻辑引用（无外键约束）
- 关系基数：一个 Class 对应多个 Enrollment（1:N）
- 源文件：src/modules/teaching/enrollment/enrollment.entity.ts 第 17 行
- 索引：classCode 有 @Index()

(3) Enrollment → Student
- 关联字段：EnrollmentEntity.studentCode → Student.studentCode
- 关联类型：逻辑引用（无外键约束）
- 关系基数：一个 Student 对应多个 Enrollment（1:N）
- 源文件：src/modules/teaching/enrollment/enrollment.entity.ts 第 21 行
- 索引：studentCode 有 @Index()
- 唯一约束：@Unique(['classCode', 'studentCode']) 防止重复报名

(4) Class → Lesson
- 关联字段：LessonEntity.classCode → ClassEntity.classCode
- 关联类型：逻辑引用（无外键约束）
- 关系基数：一个 Class 对应多个 Lesson（1:N）
- 源文件：src/modules/teaching/lesson/lesson.entity.ts 第 18 行
- 索引：classCode 有 @Index()
- 唯一约束：@Unique(['classCode', 'lessonNumber'])

(5) Lesson → LessonAttendance
- 关联字段：LessonAttendanceEntity.lessonId → LessonEntity.id
- 关联类型：逻辑引用（无外键约束）
- 关系基数：一个 Lesson 对应多个 Attendance（1:N，每学生一条）
- 源文件：src/modules/teaching/lesson-attendance/lesson-attendance.entity.ts 第 24 行
- 索引：lessonId 有 @Index()
- 唯一约束：@Unique(['lessonId', 'studentCode'])

(6) Contract → Enrollment
- 关联字段：EnrollmentEntity.contractCode → ContractEntity.contractCode
- 关联类型：逻辑引用（无外键约束）
- 关系基数：一个 Contract 对应一个 Enrollment（1:1，当前设计）
- 源文件：src/modules/teaching/enrollment/enrollment.entity.ts 第 25 行
- 索引：contractCode 有 @Index()

(7) Student → StudentParent → User（家长）
- 关联字段：StudentParent.studentId → Student.id，StudentParent.parentId → User.id
- 关联类型：显式 @ManyToOne + @JoinColumn（唯一有外键的实体）
- 关系基数：多对多（一个学生多个家长，一个家长多个学生）
- 源文件：src/modules/student/entities/student-parent.entity.ts 第 23-32 行
- 删除策略：onDelete: 'CASCADE'

### 1.2 课时余额存储位置

课时余额（remainingLessons）唯一存储在 Contract 表中。

源文件：src/modules/teaching/contract/contract.entity.ts 第 36 行
- contract.totalLessons：合同总课时
- contract.remainingLessons：剩余课时
- 无 totalHours/remainingHours 字段（课时以"节"为单位，不是"小时"）

### 1.3 关键发现：无外键约束

除 student-parent 外，所有实体间关联均为「逻辑引用」：
- 不使用 TypeORM 关系装饰器
- 数据库层面无 FOREIGN KEY 约束
- 数据完整性完全依赖应用层校验
- 删除操作可能产生孤儿数据（如删除 Course 后 Class 的 courseCode 变成悬空引用）

---

## 2. 当前扣课逻辑位置

### 2.1 扣课逻辑状态：未实现

经过全面扫描，当前代码库中不存在实际的扣课（deduct/consume）逻辑。

具体发现：
- grep 搜索 "deduct"、"consume"、"扣课"、"扣减"：在 .service.ts 文件中无匹配
- grep 搜索 "remainingLessons =" 赋值操作：仅在 contract.service.ts 第 56 行出现一次（创建时初始化）
- grep 搜索 "transaction"、"queryRunner"、"@Transaction"：在 .service.ts 文件中无匹配
- grep 搜索 "EventEmitter"、"emit("、".on("：在 .service.ts 文件中无匹配

### 2.2 已定义的扣课基础设施（设计层，非实现层）

(1) DEDUCTIBLE_STATUSES 常量
- 位置：src/modules/teaching/lesson-attendance/enums/attendance-status.enum.ts 第 22-27 行
- 内容：PRESENT, LATE, ONLINE, OFFLINE 触发扣课；ABSENT, LEAVE, MAKEUP 不扣课
- 状态：已定义，已测试（spec.ts 有 4 个测试用例），但无消费方代码

(2) 事件类（已定义，未发布）
- ContractExhaustedEvent：src/events/finance/contract-exhausted.event.ts
  - 包含 remainingLessons、totalDeducted 字段
  - 设计意图：课时耗尽时通知
- ContractExpiredEvent：src/events/finance/contract-expired.event.ts
  - 包含 remainingLessons 字段
  - 设计意图：合同过期时通知
- AttendanceConfirmedEvent：src/events/lesson/attendance-confirmed.event.ts
  - 包含 lessonId
  - 设计意图：出勤确认后触发扣课

(3) EventBusService（已实现，但无扣课订阅者）
- 位置：src/events/event-bus.service.ts
- 能力：publish() 发布事件、subscribe() 订阅事件
- 当前订阅者：无扣课相关订阅

### 2.3 扣课预期流程（从代码设计推断）

预期流程（未实现）：
1. 出勤确认（Attendance → CONFIRMED 状态）
2. 发布 AttendanceConfirmedEvent
3. 扣课服务监听事件，查找关联的 Contract
4. 检查 Contract.status === ACTIVE
5. 检查 DEDUCTIBLE_STATUSES 确认是否需要扣课
6. contract.remainingLessons -= 1
7. 如果 remainingLessons === 0，发布 ContractExhaustedEvent

---

## 3. 当前课时计算来源

### 3.1 合同层面的课时

- 总课时来源：ContractEntity.totalLessons（用户创建时输入）
  - 源文件：src/modules/teaching/contract/contract.entity.ts 第 33 行
- 剩余课时来源：ContractEntity.remainingLessons（创建时 = totalLessons）
  - 源文件：src/modules/teaching/contract/contract.service.ts 第 56 行
- 已消耗课时来源：无显式字段，需通过 totalLessons - remainingLessons 计算
- 计算缓存：无

### 3.2 班级层面的课时进度

- 总课时来源：ClassEntity.totalLessons（用户创建班级时输入）
  - 源文件：src/modules/teaching/class/class.entity.ts 第 39 行
- 已完成课时来源：实时查询 Lesson 表，统计 status = FINISHED 的数量
  - 源文件：src/modules/teaching/class/class.service.ts 第 273 行
  - 源文件：src/modules/teaching/class/class.service.ts 第 289 行（enrichClass 方法）
  - 查询方式：this.lessonRepo.countByClassCodeAndStatus(classCode, LessonStatus.FINISHED)
- 进度计算：completedLessons / totalLessonsSum * 100
  - 源文件：src/modules/analytics/analytics.service.ts 第 157-158 行

### 3.3 学生层面的课时展示

- 来源：直接从 Contract 读取 totalLessons 和 remainingLessons
  - 源文件：src/modules/student/student.controller.ts 第 152-153 行
- 展示方式：API 直接返回 Contract 字段，无额外计算

### 3.4 课程层面的课时

- 总课时来源：CourseEntity.totalHours（小时）+ CourseEntity.totalLessons（节数）
  - 源文件：src/modules/teaching/course/course.entity.ts 第 33-36 行
- 这是课程模板的元数据，与具体班级的课时独立

---

## 4. 是否存在重复数据源

### 4.1 totalLessons 字段重复（3 处存储）

(1) CourseEntity.totalLessons — 课程模板的总课时数
  - 源文件：src/modules/teaching/course/course.entity.ts 第 36 行
(2) ClassEntity.totalLessons — 班级的总课时数
  - 源文件：src/modules/teaching/class/class.entity.ts 第 39 行
(3) ContractEntity.totalLessons — 合同的总课时数
  - 源文件：src/modules/teaching/contract/contract.entity.ts 第 33 行

分析：
- 三处 totalLessons 含义不同（课程定义 vs 班级计划 vs 合同购买）
- 创建时各自独立赋值，无自动同步机制
- 可能出现不一致：Course.totalLessons=20，但 Contract.totalLessons=50（购买了更多课时）
- 这是设计决策（允许灵活定价），不是 Bug，但需要文档说明

### 4.2 无显式数据冗余

- remainingLessons 仅在 Contract 表中存储（单一数据源）✅
- 出勤状态仅在 LessonAttendance 表中存储（单一数据源）✅
- 报名状态仅在 Enrollment 表中存储（单一数据源）✅
- 合同状态仅在 Contract 表中存储（单一数据源）✅

### 4.3 计算值无缓存

- completedLessons（班级维度）：每次请求实时查询 Lesson 表
  - 源文件：src/modules/teaching/class/class.service.ts 第 289 行
- courseProgress（学生维度）：每次请求实时计算
  - 源文件：src/modules/analytics/analytics.service.ts 第 147-158 行
- 无 Redis 缓存、无内存缓存、无物化视图

---

## 5. 是否存在状态不一致风险

### 5.1 高风险：扣课逻辑未实现（P0）

风险描述：
- Contract.remainingLessons 创建后永远不会减少
- 出勤确认后不会触发扣课
- 合同可以永远使用，即使课时已用完

影响范围：
- 财务数据不准确（无法追踪已消耗课时）
- 无法检测课时耗尽
- 无法触发 ContractExhaustedEvent

当前状态：设计已完成（DEDUCTIBLE_STATUSES、Event 类、EventBus 均已就绪），但扣课 Service 未编写。

### 5.2 高风险：无事务保护（P0）

风险描述：
- 全局搜索 transaction/queryRunner/@Transaction：在 .service.ts 中零匹配
- 所有写操作都是单条 save()，无原子性保证
- 并发场景下可能出现数据不一致

具体风险场景：
(1) 扣课并发（未来风险）
  - 两个出勤确认同时触发扣课
  - 两个请求同时读取 remainingLessons = 5
  - 两个请求都写入 remainingLessons = 4
  - 实际消耗 2 节，但只减少了 1 节
  - 解决方案：需要 SELECT ... FOR UPDATE 或乐观锁

(2) 报名 + 合同状态检查（当前风险）
  - EnrollmentService.enroll() 先检查 Contract.status === ACTIVE
  - 然后创建 Enrollment
  - 两步操作无事务保护
  - 如果在检查和创建之间 Contract 被冻结，Enrollment 仍然创建成功
  - 源文件：src/modules/teaching/enrollment/enrollment.service.ts 第 63-97 行

(3) 出勤批量录入（当前风险）
  - batchRollCall() 使用 for 循环逐条 save()
  - 如果第 3 条失败，前 2 条已持久化
  - 无回滚机制
  - 源文件：src/modules/teaching/lesson-attendance/lesson-attendance.service.ts（batchRollCall 方法）

### 5.3 中风险：逻辑引用导致孤儿数据（P1）

风险描述：
- 所有实体间关联为逻辑引用（无外键约束）
- 删除操作不会级联，可能产生孤儿数据

具体场景：
(1) 删除 Course 后，Class 的 courseCode 变成悬空引用
(2) 删除 Class 后，Enrollment 的 classCode 变成悬空引用
(3) 删除 Lesson 后，LessonAttendance 的 lessonId 变成悬空引用
(4) 删除 Student 后，Enrollment 的 studentCode 变成悬空引用

当前缓解措施：
- 所有实体都有 deleted 字段（软删除标记）
- 软删除不会产生真正的孤儿数据
- 但如果硬删除（DELETE FROM），则会产生孤儿数据

### 5.4 中风险：状态机转换无原子性（P1）

风险描述：
- 多个状态机（Contract、Enrollment、Lesson、Attendance）各自独立
- 跨状态机操作无原子性保证

具体场景：
(1) Lesson → FINISHED + Attendance → CONFIRMED
  - 课程完成和出勤确认是两个独立操作
  - 可能出现 Lesson 已 FINISHED 但 Attendance 仍 PENDING
  - 或 Attendance 已 CONFIRMED 但 Lesson 仍 TEACHING

(2) Contract → EXHAUSTED + Enrollment → WITHDRAWN
  - 合同耗尽和报名退出是两个独立操作
  - 可能出现合同已耗尽但报名仍 ACTIVE
  - 或报名已退出但合同仍 ACTIVE

### 5.5 低风险：completedLessons 计算不一致（P2）

风险描述：
- analytics.service.ts 第 147 行：统计所有 Lesson（不区分状态）
- class.service.ts 第 289 行：只统计 status = FINISHED 的 Lesson
- 两个地方对"已完成课时"的定义不同

具体代码：
- analytics.service.ts：const completedLessons = await this.lessonRepository.count({ where: { classCode: In(classCodes) } });
  - 问题：没有 .andWhere('status = FINISHED')，统计的是所有 Lesson（包括 DRAFT、SCHEDULED）
- class.service.ts：this.lessonRepo.countByClassCodeAndStatus(cls.classCode, LessonStatus.FINISHED)
  - 正确：只统计 FINISHED 状态的 Lesson

影响：学生进度面板显示的 courseProgress 可能偏高（包含了未完成的课时）。

---

## 6. 总结与建议

### 6.1 关键发现

(1) 扣课逻辑完全未实现（P0 — 阻塞性问题）
  - 设计已完成（DEDUCTIBLE_STATUSES、Event 类、EventBus）
  - 实现为零（无扣课 Service、无事件订阅、无事务保护）
  - 影响：财务数据无法追踪，合同课时永不减少

(2) 无事务保护（P0 — 阻塞性问题）
  - 全局零使用 transaction/queryRunner
  - 并发场景下数据不一致风险极高
  - 影响：扣课、报名、批量操作均可能部分失败

(3) 无外键约束（P1 — 设计决策）
  - 除 student-parent 外，所有关联为逻辑引用
  - 依赖应用层校验，数据库层面无保护
  - 影响：硬删除会产生孤儿数据

(4) completedLessons 计算不一致（P2 — Bug）
  - analytics.service.ts 统计所有 Lesson（包括未完成）
  - class.service.ts 只统计 FINISHED 的 Lesson
  - 影响：学生进度显示不准确

### 6.2 优先级建议

P0（立即处理）：
- 实现扣课逻辑（ContractDeductionService）
- 添加事务保护（关键写操作使用 QueryRunner）
- 修复 analytics.service.ts 的 completedLessons 计算

P1（近期处理）：
- 评估是否添加外键约束（或至少添加应用层级联检查）
- 实现扣课并发控制（乐观锁或 SELECT FOR UPDATE）
- 添加扣课审计日志（记录每次扣课的详细信息）

P2（后续优化）：
- 考虑引入 Redis 缓存 completedLessons（减少数据库查询）
- 统一"已完成课时"的定义（所有地方只统计 FINISHED 状态）
- 添加数据一致性检查任务（定期扫描孤儿数据）

---

## 附录：实体关系图（文本描述）

Course (1) ──courseCode──→ (N) Class
Class (1) ──classCode──→ (N) Enrollment
Student (1) ──studentCode──→ (N) Enrollment
Contract (1) ──contractCode──→ (1) Enrollment
Class (1) ──classCode──→ (N) Lesson
Lesson (1) ──lessonId──→ (N) LessonAttendance
Student (1) ──studentId──→ (N) StudentParent ──parentId──→ (1) User

所有箭头均为逻辑引用（无外键约束），除 StudentParent 外。
