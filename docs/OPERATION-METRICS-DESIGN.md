# 运营指标体系设计文档

## 1. 概述

### 1.1 文档目的
本文档定义 EduERP-V4 系统的运营指标体系，覆盖学生、教师、机构三个维度的核心运营数据。为小程序前端 Dashboard、数据看板、运营报表提供统一的数据口径和计算标准。

### 1.2 适用范围
- 微信小程序教师端 Dashboard
- 微信小程序家长端 Dashboard
- 管理后台运营数据看板
- 数据导出与报表功能

### 1.3 版本信息
- 版本：v1.0
- 创建日期：2026-07-23
- 状态：初稿
- 作者：EOS AI Team

---

## 2. 学生指标体系

### 2.1 活跃学生数

#### 2.1.1 日活跃学生数（DAU）
- 指标名称：日活跃学生数
- 指标定义：当日有出勤记录的学生去重人数
- 计算公式：COUNT(DISTINCT studentCode) WHERE LessonAttendance.createTime = 当日 AND status IN (PRESENT, LATE, ONLINE)
- 数据来源：LessonAttendance 表（studentCode, status, createTime）+ Lesson 表（通过 lessonId 关联确认日期）
- 更新频率：实时（每次考勤记录更新时）
- 展示位置：教师端首页 / 管理后台首页
- 优先级：P0

#### 2.1.2 周活跃学生数（WAU）
- 指标名称：周活跃学生数
- 指标定义：本周（周一至周日）有出勤记录的学生去重人数
- 计算公式：COUNT(DISTINCT studentCode) WHERE LessonAttendance.createTime BETWEEN 本周一 AND 本周日 AND status IN (PRESENT, LATE, ONLINE)
- 数据来源：LessonAttendance 表（studentCode, status, createTime）
- 更新频率：每日更新
- 展示位置：教师端首页 / 管理后台首页
- 优先级：P0

#### 2.1.3 月活跃学生数（MAU）
- 指标名称：月活跃学生数
- 指标定义：本月有出勤记录的学生去重人数
- 计算公式：COUNT(DISTINCT studentCode) WHERE LessonAttendance.createTime BETWEEN 本月1日 AND 本月末 AND status IN (PRESENT, LATE, ONLINE)
- 数据来源：LessonAttendance 表（studentCode, status, createTime）
- 更新频率：每日更新
- 展示位置：教师端首页 / 管理后台首页
- 优先级：P0

### 2.2 学习次数

#### 2.2.1 总课时数
- 指标名称：学生总课时数
- 指标定义：学生已完成的课时总数（状态为 FINISHED 的课程）
- 计算公式：COUNT(LessonAttendance) WHERE studentCode = 当前学生 AND status IN (PRESENT, LATE, ONLINE, MAKEUP)
- 数据来源：LessonAttendance 表（studentCode, status）+ Lesson 表（通过 lessonId 关联，status = FINISHED）
- 更新频率：实时
- 展示位置：家长端首页 / 教师端学生详情
- 优先级：P0

#### 2.2.2 已完成课时数
- 指标名称：已完成课时数
- 指标定义：学生出勤且课程已结束的有效课时数
- 计算公式：COUNT(LessonAttendance) WHERE studentCode = 当前学生 AND Lesson.status = FINISHED AND LessonAttendance.status IN (PRESENT, LATE, ONLINE, MAKEUP)
- 数据来源：LessonAttendance 表 + Lesson 表（通过 lessonId 关联）
- 更新频率：实时
- 展示位置：家长端首页 / 教师端学生详情
- 优先级：P0

### 2.3 出勤趋势

#### 2.3.1 到课率
- 指标名称：到课率
- 指标定义：学生实际到课次数占应到课次的百分比
- 计算公式：(COUNT(status=PRESENT) + COUNT(status=LATE) + COUNT(status=ONLINE)) / COUNT(所有考勤记录) * 100%
- 数据来源：LessonAttendance 表（studentCode, status）
- 更新频率：实时
- 展示位置：家长端首页 / 教师端学生详情 / 管理后台
- 优先级：P0

#### 2.3.2 缺勤率
- 指标名称：缺勤率
- 指标定义：学生缺勤次数占应到课次的百分比
- 计算公式：COUNT(status=ABSENT) / COUNT(所有考勤记录) * 100%
- 数据来源：LessonAttendance 表（studentCode, status）
- 更新频率：实时
- 展示位置：家长端首页 / 教师端学生详情
- 优先级：P1

#### 2.3.3 迟到率
- 指标名称：迟到率
- 指标定义：学生迟到次数占应到课次的百分比
- 计算公式：COUNT(status=LATE) / COUNT(所有考勤记录) * 100%
- 数据来源：LessonAttendance 表（studentCode, status）
- 更新频率：实时
- 展示位置：教师端学生详情
- 优先级：P1

#### 2.3.4 请假率
- 指标名称：请假率
- 指标定义：学生请假次数占应到课次的百分比
- 计算公式：COUNT(status=LEAVE) / COUNT(所有考勤记录) * 100%
- 数据来源：LessonAttendance 表（studentCode, status）
- 更新频率：实时
- 展示位置：教师端学生详情
- 优先级：P1

### 2.4 学习完成情况

#### 2.4.1 课程进度
- 指标名称：课程进度百分比
- 指标定义：学生已完成课时占合同总课时的百分比
- 计算公式：completedLessons / totalLessons * 100%（从 Contract 表直接读取）
- 数据来源：Contract 表（completedLessons, totalLessons, studentCode）
- 更新频率：实时
- 展示位置：家长端首页 / 教师端学生详情
- 优先级：P0

#### 2.4.2 合同剩余课时
- 指标名称：合同剩余课时
- 指标定义：学生合同中尚未消耗的课时数
- 计算公式：remainingLessons（直接读取）或 totalLessons - completedLessons
- 数据来源：Contract 表（remainingLessons, totalLessons, completedLessons, studentCode）
- 更新频率：实时
- 展示位置：家长端首页 / 教师端学生详情
- 优先级：P0

### 2.5 新增学生数

#### 2.5.1 日新增学生
- 指标名称：日新增学生数
- 指标定义：当日新注册且角色为 STUDENT 的用户数
- 计算公式：COUNT(User) WHERE role = STUDENT AND DATE(createTime) = 当日
- 数据来源：User 表（role, createTime）
- 更新频率：实时
- 展示位置：管理后台首页
- 优先级：P1

#### 2.5.2 周新增学生
- 指标名称：周新增学生数
- 指标定义：本周新注册且角色为 STUDENT 的用户数
- 计算公式：COUNT(User) WHERE role = STUDENT AND createTime BETWEEN 本周一 AND 本周日
- 数据来源：User 表（role, createTime）
- 更新频率：每日更新
- 展示位置：管理后台首页
- 优先级：P1

#### 2.5.3 月新增学生
- 指标名称：月新增学生数
- 指标定义：本月新注册且角色为 STUDENT 的用户数
- 计算公式：COUNT(User) WHERE role = STUDENT AND createTime BETWEEN 本月1日 AND 本月末
- 数据来源：User 表（role, createTime）
- 更新频率：每日更新
- 展示位置：管理后台首页
- 优先级：P1

### 2.6 流失学生数

#### 2.6.1 流失学生定义
- 指标名称：流失学生数
- 指标定义：状态变为 INACTIVE 或 GRADUATED 的学生数
- 计算公式：COUNT(Student) WHERE status IN (INACTIVE, GRADUATED) AND updateTime BETWEEN 统计周期起始 AND 统计周期结束
- 数据来源：Student 表（status, updateTime）
- 更新频率：每日更新
- 展示位置：管理后台
- 优先级：P1

#### 2.6.2 流失率
- 指标名称：学生流失率
- 指标定义：流失学生数占期初活跃学生数的百分比
- 计算公式：本期流失学生数 / 期初活跃学生数 * 100%
- 数据来源：Student 表（status, updateTime, createTime）
- 更新频率：月度
- 展示位置：管理后台
- 优先级：P2

---

## 3. 教师指标体系

### 3.1 授课量

#### 3.1.1 总授课课时
- 指标名称：教师总授课课时
- 指标定义：教师负责的所有班级中，状态为 FINISHED 的课程总数
- 计算公式：COUNT(DISTINCT Lesson.id) WHERE TeacherAssignment.teacherUserId = 当前教师 AND TeacherAssignment.classCode = Lesson.classCode AND Lesson.status = FINISHED
- 数据来源：TeacherAssignment 表（teacherUserId, classCode）+ Lesson 表（classCode, status）
- 更新频率：实时
- 展示位置：教师端首页
- 优先级：P0

#### 3.1.2 月授课课时
- 指标名称：教师月授课课时
- 指标定义：当月状态为 FINISHED 的课程数
- 计算公式：COUNT(DISTINCT Lesson.id) WHERE TeacherAssignment.teacherUserId = 当前教师 AND Lesson.status = FINISHED AND Lesson.createTime BETWEEN 本月1日 AND 本月末
- 数据来源：TeacherAssignment 表 + Lesson 表（classCode, status, createTime）
- 更新频率：每日更新
- 展示位置：教师端首页
- 优先级：P0

#### 3.1.3 周授课课时
- 指标名称：教师周授课课时
- 指标定义：本周状态为 FINISHED 的课程数
- 计算公式：COUNT(DISTINCT Lesson.id) WHERE TeacherAssignment.teacherUserId = 当前教师 AND Lesson.status = FINISHED AND Lesson.createTime BETWEEN 本周一 AND 本周日
- 数据来源：TeacherAssignment 表 + Lesson 表（classCode, status, createTime）
- 更新频率：每日更新
- 展示位置：教师端首页
- 优先级：P1

### 3.2 班级数量

#### 3.2.1 负责班级数
- 指标名称：教师负责班级数
- 指标定义：教师当前负责的班级总数（状态为 ACTIVE 的班级）
- 计算公式：COUNT(DISTINCT TeacherAssignment.classCode) WHERE teacherUserId = 当前教师 AND Class.status = ACTIVE
- 数据来源：TeacherAssignment 表（teacherUserId, classCode）+ Class 表（classCode, status）
- 更新频率：实时
- 展示位置：教师端首页
- 优先级：P0

#### 3.2.2 新增班级数
- 指标名称：教师新增班级数
- 指标定义：本月教师新被分配的班级数
- 计算公式：COUNT(TeacherAssignment) WHERE teacherUserId = 当前教师 AND assignmentDate BETWEEN 本月1日 AND 本月末
- 数据来源：TeacherAssignment 表（teacherUserId, assignmentDate）
- 更新频率：每日更新
- 展示位置：教师端首页
- 优先级：P1

### 3.3 学生变化

#### 3.3.1 当前学生数
- 指标名称：教师当前学生数
- 指标定义：教师负责的所有活跃班级中的活跃学生总数（去重）
- 计算公式：COUNT(DISTINCT Enrollment.studentCode) WHERE TeacherAssignment.teacherUserId = 当前教师 AND TeacherAssignment.classCode = Enrollment.classCode AND Enrollment.status = ACTIVE AND Student.status = ACTIVE
- 数据来源：TeacherAssignment 表 + Enrollment 表（classCode, studentCode, status）+ Student 表（studentCode, status）
- 更新频率：实时
- 展示位置：教师端首页
- 优先级：P0

#### 3.3.2 新增学生数
- 指标名称：教师新增学生数
- 指标定义：本月教师负责班级中新加入的学生数
- 计算公式：COUNT(Enrollment) WHERE TeacherAssignment.teacherUserId = 当前教师 AND Enrollment.createTime BETWEEN 本月1日 AND 本月末 AND Enrollment.status = ACTIVE
- 数据来源：TeacherAssignment 表 + Enrollment 表（classCode, createTime, status）
- 更新频率：每日更新
- 展示位置：教师端首页
- 优先级：P1

#### 3.3.3 流失学生数
- 指标名称：教师流失学生数
- 指标定义：本月教师负责班级中退出的学生数
- 计算公式：COUNT(Enrollment) WHERE TeacherAssignment.teacherUserId = 当前教师 AND Enrollment.status = WITHDRAWN AND Enrollment.updateTime BETWEEN 本月1日 AND 本月末
- 数据来源：TeacherAssignment 表 + Enrollment 表（classCode, status, updateTime）
- 更新频率：每日更新
- 展示位置：教师端首页
- 优先级：P1

---

## 4. 机构指标体系

### 4.1 学员规模

#### 4.1.1 总学员数
- 指标名称：机构总学员数
- 指标定义：系统中所有学生角色的用户总数
- 计算公式：COUNT(User) WHERE role = STUDENT
- 数据来源：User 表（role）
- 更新频率：实时
- 展示位置：管理后台首页
- 优先级：P0

#### 4.1.2 活跃学员数
- 指标名称：机构活跃学员数
- 指标定义：状态为 ACTIVE 的学生总数
- 计算公式：COUNT(Student) WHERE status = ACTIVE
- 数据来源：Student 表（status）
- 更新频率：实时
- 展示位置：管理后台首页
- 优先级：P0

#### 4.1.3 新增学员数
- 指标名称：机构新增学员数
- 指标定义：本月新注册的学生数
- 计算公式：COUNT(User) WHERE role = STUDENT AND createTime BETWEEN 本月1日 AND 本月末
- 数据来源：User 表（role, createTime）
- 更新频率：每日更新
- 展示位置：管理后台首页
- 优先级：P0

### 4.2 课程规模

#### 4.2.1 总课程数
- 指标名称：机构总课程数
- 指标定义：系统中所有课程总数
- 计算公式：COUNT(Course) WHERE deleted = 0
- 数据来源：Course 表（deleted）
- 更新频率：实时
- 展示位置：管理后台首页
- 优先级：P0

#### 4.2.2 活跃课程数
- 指标名称：机构活跃课程数
- 指标定义：状态为 PUBLISHED 的课程数
- 计算公式：COUNT(Course) WHERE status = PUBLISHED AND deleted = 0
- 数据来源：Course 表（status, deleted）
- 更新频率：实时
- 展示位置：管理后台首页
- 优先级：P0

#### 4.2.3 新增课程数
- 指标名称：机构新增课程数
- 指标定义：本月新创建的课程数
- 计算公式：COUNT(Course) WHERE createTime BETWEEN 本月1日 AND 本月末 AND deleted = 0
- 数据来源：Course 表（createTime, deleted）
- 更新频率：每日更新
- 展示位置：管理后台首页
- 优先级：P1

### 4.3 运营趋势

#### 4.3.1 月度对比
- 指标名称：月度运营对比
- 指标定义：本月 vs 上月的关键指标变化（活跃学员数、新增学员数、总课时数、到课率）
- 计算公式：
  - 活跃学员变化 = 本月活跃学员数 - 上月活跃学员数
  - 新增学员变化 = 本月新增学员数 - 上月新增学员数
  - 总课时变化 = 本月总课时数 - 上月总课时数
  - 到课率变化 = 本月到课率 - 上月到课率
- 数据来源：Student 表 + User 表 + LessonAttendance 表 + Lesson 表
- 更新频率：月度
- 展示位置：管理后台运营看板
- 优先级：P1

#### 4.3.2 季度对比
- 指标名称：季度运营对比
- 指标定义：本季度 vs 上季度的关键指标变化
- 计算公式：同月度对比，统计周期改为季度
- 数据来源：Student 表 + User 表 + LessonAttendance 表 + Lesson 表
- 更新频率：季度
- 展示位置：管理后台运营看板
- 优先级：P2

#### 4.3.3 年度对比
- 指标名称：年度运营对比
- 指标定义：本年 vs 去年的关键指标变化
- 计算公式：同月度对比，统计周期改为年度
- 数据来源：Student 表 + User 表 + LessonAttendance 表 + Lesson 表
- 更新频率：年度
- 展示位置：管理后台运营看板
- 优先级：P2

---

## 5. 数据可用性分析

### 5.1 Student 表
- 可用指标：活跃学生数、流失学生数、新增学生数
- 可行性：✅ 完全可用
- 说明：status 字段直接支持活跃/流失判断，createTime 支持新增统计

### 5.2 User 表
- 可用指标：总学员数、新增学员数
- 可行性：✅ 完全可用
- 说明：role = STUDENT 可筛选学生用户，createTime 支持时间统计

### 5.3 Course 表
- 可用指标：总课程数、活跃课程数、新增课程数
- 可行性：✅ 完全可用
- 说明：status 字段支持课程状态筛选，deleted 软删除标记完整

### 5.4 Class 表
- 可用指标：活跃班级数、新增班级数
- 可行性：✅ 完全可用
- 说明：status 字段支持班级状态筛选

### 5.5 Enrollment 表
- 可用指标：学生 enrollment 状态、班级学生数
- 可行性：✅ 完全可用
- 说明：status 字段支持 ACTIVE/WITHDRAWN/COMPLETED 判断

### 5.6 Contract 表
- 可用指标：课程进度、合同剩余课时
- 可行性：✅ 完全可用
- 说明：completedLessons、remainingLessons、totalLessons 字段直接提供数据

### 5.7 Lesson 表
- 可用指标：总课时数、已完成课时数、授课量
- 可行性：✅ 完全可用
- 说明：status 字段支持 FINISHED 筛选，createTime 支持时间统计

### 5.8 LessonAttendance 表
- 可用指标：到课率、缺勤率、迟到率、请假率、活跃学生数
- 可行性：✅ 完全可用
- 说明：status 字段支持 PRESENT/ABSENT/LATE/LEAVE 等状态统计

### 5.9 TeacherAssignment 表
- 可用指标：教师负责班级数、教师学生数、教师授课量
- 可行性：✅ 完全可用
- 说明：teacherUserId + classCode 关联教师与班级，assignmentDate 支持时间统计

### 5.10 数据完整性总结
- 所有指标均可从现有数据库表计算
- 无需新增表或字段
- 关键关联路径：TeacherAssignment → Class → Lesson → LessonAttendance
- 关键关联路径：Enrollment → Student → Contract

---

## 6. 实现优先级

### 6.1 P0 — 必须实现（核心运营指标）

**家长端 P0：**
- 课程进度（Contract.completedLessons / totalLessons）
- 合同剩余课时（Contract.remainingLessons）
- 总课时数（LessonAttendance COUNT）
- 到课率（LessonAttendance 状态统计）

**教师端 P0：**
- 月授课课时（Lesson COUNT + TeacherAssignment）
- 负责班级数（TeacherAssignment COUNT DISTINCT）
- 当前学生数（Enrollment COUNT DISTINCT）

**机构端 P0：**
- 总学员数（User COUNT WHERE role=STUDENT）
- 活跃学员数（Student COUNT WHERE status=ACTIVE）
- 新增学员数（User COUNT + 时间筛选）
- 总课程数（Course COUNT）
- 活跃课程数（Course COUNT WHERE status=PUBLISHED）

**理由：** 这些是用户打开系统后第一眼需要看到的核心数据，直接影响用户对产品价值的感知。

### 6.2 P1 — 应该实现（运营分析指标）

**家长端 P1：**
- 缺勤率、迟到率、请假率
- 周活跃学生数、月活跃学生数

**教师端 P1：**
- 周授课课时
- 新增班级数
- 新增学生数、流失学生数

**机构端 P1：**
- 新增课程数
- 月度对比
- 流失学生数、流失率

**理由：** 这些指标支持 deeper 的运营分析，帮助发现趋势和问题，但不影响核心功能使用。

### 6.3 P2 — 可以实现（高级分析指标）

**机构端 P2：**
- 季度对比
- 年度对比

**理由：** 长期趋势分析对运营决策有价值，但优先级低于日常运营指标。

---

## 7. 附录

### 7.1 枚举值参考

**Student.status：**
- ACTIVE — 活跃
- PAUSED — 暂停
- GRADUATED — 毕业
- INACTIVE — 不活跃

**User.role：**
- STUDENT — 学生
- TEACHER — 教师
- ADMIN — 管理员
- STAFF — 员工

**User.status：**
- ACTIVE — 活跃
- INACTIVE — 不活跃
- LOCKED — 锁定

**Course.status：**
- DRAFT — 草稿
- PUBLISHED — 已发布
- ARCHIVED — 已归档

**Class.status：**
- DRAFT — 草稿
- ACTIVE — 活跃
- COMPLETED — 已完成
- CANCELLED — 已取消

**Enrollment.status：**
- ACTIVE — 活跃
- WITHDRAWN — 已退出
- COMPLETED — 已完成

**Contract.status：**
- PENDING — 待生效
- ACTIVE — 生效中
- COMPLETED — 已完成
- EXPIRED — 已过期
- CANCELLED — 已取消

**Lesson.status：**
- DRAFT — 草稿
- SCHEDULED — 已排课
- TEACHING — 授课中
- FINISHED — 已完成
- ARCHIVED — 已归档
- CANCELLED — 已取消

**LessonAttendance.status：**
- PRESENT — 到课
- ABSENT — 缺勤
- LATE — 迟到
- LEAVE — 请假
- MAKEUP — 补课
- ONLINE — 线上
- OFFLINE — 线下

**TeacherAssignment.role：**
- INSTRUCTOR — 主讲
- ASSISTANT — 助教

### 7.2 表关系图（文字描述）

**核心关联路径 1：教师 → 班级 → 课程 → 考勤**
```
TeacherAssignment.teacherUserId → User.id (教师)
TeacherAssignment.classCode → Class.classCode (班级)
Lesson.classCode → Class.classCode (课程属于班级)
LessonAttendance.lessonId → Lesson.id (考勤属于课程)
LessonAttendance.studentCode → Student.studentCode (考勤属于学生)
```

**核心关联路径 2：学生 → 报名 → 班级**
```
Enrollment.studentCode → Student.studentCode (报名属于学生)
Enrollment.classCode → Class.classCode (报名属于班级)
Enrollment.contractCode → Contract.contractCode (关联合同)
```

**核心关联路径 3：学生 → 合同 → 课程**
```
Contract.studentCode → Student.studentCode (合同属于学生)
Contract.courseCode → Course.courseCode (合同属于课程)
```

**核心关联路径 4：用户 → 学生**
```
Student.userId → User.id (学生关联用户账号)
```

### 7.3 统计口径说明

**"活跃"定义：**
- 学生活跃：Student.status = ACTIVE
- 课程活跃：Course.status = PUBLISHED
- 班级活跃：Class.status = ACTIVE
- 合同活跃：Contract.status = ACTIVE

**"新增"定义：**
- 基于 createTime 字段筛选
- 统计周期内创建的记录数

**"流失"定义：**
- 学生流失：Student.status 变为 INACTIVE 或 GRADUATED
- 基于 updateTime 字段筛选状态变更时间

**"到课"定义：**
- 有效到课状态：PRESENT, LATE, ONLINE, MAKEUP
- 无效到课状态：ABSENT, LEAVE, OFFLINE

**时间周期定义：**
- 日：DATE(createTime) = 当日
- 周：createTime BETWEEN 本周一 AND 本周日
- 月：createTime BETWEEN 本月1日 AND 本月末
- 季度：createTime BETWEEN 本季度首日 AND 本季度末日
- 年：createTime BETWEEN 本年1月1日 AND 本年12月31日

---

**文档结束**
