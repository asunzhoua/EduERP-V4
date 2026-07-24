# 家长端真实数据展示收敛报告

## 验证时间
2026-07-24

## Mission
M-EduOS-CORE-BUSINESS-DATA-CONSISTENCY-LONG-RUNNING-V1
Phase: 3
Batch: 3.1

## 验证范围
- 剩余课时
- 已完成课程
- 最近课程
- 出勤记录
- 学习记录

## 验证方法
- 静态代码审查（前端 6 个页面 JS + WXML + 后端 4 个 Controller）
- API 调用链路追踪（前端 → 后端 → DB 表）
- 数据一致性交叉验证

---

## 验证结果

### 1. 剩余课时
- 显示位置: 首页(index.wxml) + 班级列表(classes.wxml) + 班级详情(class-detail.wxml) + 个人中心(profile.wxml)
- API: GET /students/self/contracts
- 数据来源: Contract.remainingLessons ✅（后端 contract.repository.ts → contract 表 remaining_lessons 列）
- 签到后更新: ✅（onShow() 触发 loadData()，每次进入页面重新请求 API）
- 扣课联动: ✅（Phase 2 Batch 2.1 已实现签到自动扣课 → Contract.remainingLessons 实时更新）
- 前端计算: 仅 UI 展示层聚合（sum across contracts），核心数据来自后端
- Status: ✅ PASS

### 2. 已完成课程
- 显示位置: 班级详情页(class-detail.wxml)
- API: GET /classes/:code → class.service.enrichClass()
- 数据来源: lesson_repo.countByClassCodeAndStatus(classCode, FINISHED) ✅（Lesson 表 status=FINISHED 计数）
- 签到后更新: ✅（签到完成 → Lesson status → FINISHED → enrichClass 重新查询 → 数值更新）
- Status: ✅ PASS

### 3. 最近课程
- 显示位置: 首页(index.wxml) 最近课程列表 + 个人中心(profile.wxml) 最近3条
- API: GET /students/self/lessons（首页取前5条）+ GET /students/self/attendance（个人中心取前3条）
- 数据来源: LessonAttendance 表 JOIN Lesson 表 ✅（后端按 scheduledDate DESC 排序）
- 签到后更新: ✅（签到创建 Attendance 记录 → 下次 onShow 刷新 → 新记录出现）
- Status: ✅ PASS

### 4. 出勤记录
- 显示位置: 出勤记录页(attendance.wxml) + 课时记录页(lessons.wxml)
- API: GET /students/self/attendance + GET /students/self/lessons
- 数据来源: LessonAttendance 表 ✅（JOIN Lesson + Class + Course 获取完整上下文）
- 签到后更新: ✅（教师签到 → LessonAttendance 记录创建/更新 → 家长端 onShow 刷新）
- 后端返回字段: id, lessonDate, startTime, endTime, courseName, className, status ✅
- Status: ✅ PASS

### 5. 学习记录
- 显示位置: 课时记录页(lessons.wxml)
- API: GET /students/self/lessons
- 数据来源: LessonAttendance 表 JOIN Lesson 表 ✅（包含 lessonDate, startTime, endTime, status, className, courseName）
- 签到后更新: ✅
- 限制: 后端限制返回前 20 条（attendanceRecords.slice(0, 20)）— 设计合理，避免大数据集
- Status: ✅ PASS

---

## 各页面 API 调用链路总览

### 首页 (index.js)
```
GET /students/self        → Student 表（studentCode, name, gender, phone）
GET /students/self/contracts → Contract 表 + Enrollment + TeacherAssignment + User（教师名）
GET /students/self/lessons   → LessonAttendance + Lesson + Class + Course（前20条）
```

### 班级列表 (classes.js)
```
GET /students/self/contracts → 同首页（展示合同维度的课时进度）
```

### 班级详情 (class-detail.js)
```
GET /classes/:code → Class 表 + Course（课程名）+ TeacherAssignment + User（教师名）+ Lesson（已完成课时计数）
```

### 课时记录 (lessons.js)
```
GET /students/self/lessons → LessonAttendance + Lesson + Class + Course
```

### 出勤记录 (attendance.js)
```
GET /students/self/attendance → LessonAttendance + Lesson + Class + Course
```

### 个人中心 (profile.js)
```
GET /students/self            → Student 表
GET /students/self/contracts  → Contract 表（含教师名、课时进度）
GET /students/self/attendance → LessonAttendance + Lesson + Class + Course
```

---

## 数据源真实性验证

| 数据项 | 前端页面 | 后端API | DB表 | 是否前端计算 | 判定 |
|:-------|:---------|:--------|:-----|:------------|:-----|
| 剩余课时 | index/classes/profile | /students/self/contracts | Contract.remainingLessons | 仅聚合求和 | ✅ 真实 |
| 总课时 | index/classes/profile | /students/self/contracts | Contract.totalLessons | 仅聚合求和 | ✅ 真实 |
| 已上课时 | index | 前端 total-remaining | 派生值 | 简单减法 | ✅ 可接受 |
| 进度百分比 | index/classes/profile | 前端 (total-remaining)/total | 派生值 | 简单除法 | ✅ 可接受 |
| 已完成课时 | class-detail | /classes/:code | Lesson(FINISHED)计数 | 否 | ✅ 真实 |
| 最近课程 | index/profile | /students/self/lessons | LessonAttendance+Lesson | 否 | ✅ 真实 |
| 出勤状态 | attendance/lessons | /students/self/attendance | LessonAttendance.status | 否 | ✅ 真实 |
| 出勤率 | attendance/profile | 前端 present/total | 派生值 | 简单除法 | ✅ 可接受 |
| 教师姓名 | classes/class-detail/profile | /students/self/contracts | TeacherAssignment+User | 否 | ✅ 真实 |
| 合同状态 | profile | /students/self/contracts | Contract.status | 前端格式化 | ✅ 可接受 |
| 到期提醒 | profile | 前端计算 daysLeft | 派生自 Contract.validTo | 前端日期差 | ✅ 可接受 |

---

## 发现的问题

### ISSUE-001: self/lessons 硬限制 20 条（信息性）
- Severity: P3（信息性，非缺陷）
- Location: backend/src/modules/student/student.controller.ts:207
- 描述: `attendanceRecords.slice(0, 20)` 限制返回前 20 条课时记录
- Impact: 课时超过 20 条的学生无法在课时记录页看到全部历史
- Fix: 当前阶段可接受。后续可增加分页或"加载更多"功能
- Decision: DEFER（不阻塞当前 Batch）

### ISSUE-002: class-detail.js 引用 contractCode 但 API 不返回（信息性）
- Severity: P3（信息性，无可见影响）
- Location: miniapp/pages/student/class-detail.js:53
- 描述: 前端期望 `info.contractCode`，但 `GET /classes/:code` 不返回此字段
- Impact: `contractCode` 始终为空字符串，但当前 UI 未使用此字段，无可见影响
- Fix: 后续如需在班级详情页显示合同信息，需扩展 API 或从 contracts API 获取
- Decision: DEFER（不阻塞当前 Batch）

---

## 签到后数据实时更新验证

| 场景 | 数据变化链路 | 家长端感知方式 | 判定 |
|:-----|:------------|:-------------|:-----|
| 教师签到（PRESENT） | 签到 → LessonAttendance 创建 → Contract.remainingLessons 扣减 | onShow() 重新请求 API | ✅ 实时 |
| 教师签到（LATE） | 同上 + Lesson status → FINISHED | onShow() 重新请求 API | ✅ 实时 |
| 合同耗尽 | remainingLessons=0 → Contract.status → EXHAUSTED | onShow() 重新请求 API | ✅ 实时 |
| 请假记录 | LessonAttendance 创建（status=LEAVE） | onShow() 重新请求 API | ✅ 实时 |

---

## 前端计算合理性评估

以下前端计算属于 **UI 展示层转换**，不涉及核心业务逻辑，判定为合理：

1. **usedLessons = totalLessons - remainingLessons**（简单减法，数据源来自后端）
2. **overallProgress = usedLessons / totalLessons × 100**（简单百分比，数据源来自后端）
3. **attendanceRate = (present + late) / total × 100**（简单统计，数据源来自后端）
4. **合同到期天数 = (validTo - now) / 86400000**（日期差计算，数据源来自后端）
5. **合同状态文本映射**（ACTIVE → "有效"，EXPIRED → "已过期" 等，纯 UI 格式化）

以上均符合"核心业务数据来自后端，前端仅做展示转换"原则。

---

## 修复记录

无需修复。所有 5 项检查均 PASS。

---

## 结论
- Total Checks: 5
- Passed: 5
- Failed: 0
- Fixed: 0
- Deferred Issues: 2（P3 信息性，不阻塞）
- Status: ✅ ALL PASS

### 总结
家长端所有核心业务数据均来自真实后端 API，数据链路完整：
- 剩余课时 → Contract 表（签到自动扣减）
- 已完成课程 → Lesson 表（FINISHED 状态计数）
- 最近课程 → LessonAttendance + Lesson 表
- 出勤记录 → LessonAttendance 表
- 学习记录 → LessonAttendance + Lesson + Class + Course 表

前端不存在核心业务数据的前端计算（仅有 UI 展示层的简单聚合/格式化）。
签到后数据通过 onShow() 自动刷新机制实现实时更新。
家长端数据一致性验证通过。
