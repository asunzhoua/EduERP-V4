# 用户生命周期设计文档

> Phase 3 Batch 3.1 — User Lifecycle Research
> 创建时间：2026-07-23
> 状态：Draft v1.0

---

## 1. 学生生命周期

### 1.1 阶段定义

阶段 1：注册（Registration）
- 触发：管理员创建学生账号
- 状态：PENDING
- 动作：发送欢迎通知
- 前置条件：无
- 后置条件：学生记录创建，等待选班

阶段 2：选班（Enrollment）
- 触发：管理员分配班级
- 状态：ENROLLED
- 动作：创建合同、分配班级
- 前置条件：学生已注册（PENDING）
- 后置条件：学生绑定班级，合同生效

阶段 3：学习（Learning）
- 触发：课时开始
- 状态：ACTIVE
- 动作：记录出勤、更新进度
- 前置条件：学生已选班（ENROLLED）
- 后置条件：课时记录持续累积

阶段 4：出勤（Attendance）
- 触发：每次课时
- 状态：ATTENDING
- 动作：记录到课/缺勤/迟到/请假
- 前置条件：学生处于学习状态（ACTIVE）
- 后置条件：出勤记录写入

阶段 5：续费（Renewal）
- 触发：合同即将到期（提前 30 天）
- 状态：RENEWING
- 动作：发送续费提醒、创建新合同
- 前置条件：学生合同剩余课时 < 阈值
- 后置条件：新合同生效，状态回到 ACTIVE

阶段 6：结业（Graduation）
- 触发：合同结束或手动标记
- 状态：GRADUATED
- 动作：发送结业证书、归档记录
- 前置条件：合同到期或管理员手动操作
- 后置条件：学生记录归档，不可排课

阶段 7：休学（Suspension）
- 触发：家长申请或管理员标记
- 状态：SUSPENDED
- 动作：暂停课时、保留记录
- 前置条件：学生处于 ACTIVE 或 ENROLLED 状态
- 后置条件：课时冻结，可恢复为 ACTIVE

### 1.2 学生状态流转

PENDING → ENROLLED → ACTIVE → ATTENDING → RENEWING → GRADUATED
                                      ↓
                                  SUSPENDED → ACTIVE（恢复）

特殊流转：
- ACTIVE → SUSPENDED（休学）
- SUSPENDED → ACTIVE（复学）
- ACTIVE → GRADUATED（结业）
- ENROLLED → GRADUATED（未开始即结业）
- 任意状态 → GRADUATED（管理员强制结业）

---

## 2. 教师生命周期

### 2.1 阶段定义

阶段 1：入职（Onboarding）
- 触发：管理员创建教师账号
- 状态：PENDING
- 动作：发送欢迎通知、分配权限
- 前置条件：无
- 后置条件：教师记录创建，等待培训分配

阶段 2：培训（Training）
- 触发：管理员分配课程
- 状态：TRAINING
- 动作：分配课程、设置教学目标
- 前置条件：教师已入职（PENDING）
- 后置条件：教师绑定课程，可开始授课

阶段 3：授课（Teaching）
- 触发：课时开始
- 状态：ACTIVE
- 动作：记录课时、管理考勤、评估学生
- 前置条件：教师已培训（TRAINING）或管理员直接激活
- 后置条件：课时记录持续累积

阶段 4：管理（Management）
- 触发：分配班级
- 状态：MANAGING
- 动作：管理班级、跟踪学生进度
- 前置条件：教师处于授课状态（ACTIVE）
- 后置条件：教师成为班级班主任

阶段 5：离职（Offboarding）
- 触发：管理员标记离职
- 状态：INACTIVE
- 动作：转移班级、归档记录
- 前置条件：管理员手动操作
- 后置条件：教师不可排课，记录归档

### 2.2 教师状态流转

PENDING → TRAINING → ACTIVE → MANAGING → INACTIVE

特殊流转：
- PENDING → ACTIVE（跳过培训直接激活）
- ACTIVE → INACTIVE（离职）
- MANAGING → INACTIVE（离职，班级需转移）
- TRAINING → INACTIVE（培训期离职）

---

## 3. 数据模型

### 3.1 学生数据字段

studentId: string（主键，UUID）
studentCode: string（学号，唯一）
name: string（姓名）
phone: string（手机号）
parentPhone: string（家长手机号）
status: enum（PENDING / ENROLLED / ACTIVE / ATTENDING / RENEWING / GRADUATED / SUSPENDED）
enrollmentDate: datetime（选班日期）
graduationDate: datetime（结业日期，可空）
suspensionDate: datetime（休学日期，可空）
suspensionReason: string（休学原因，可空）
contractId: string（当前合同 ID，可空）
contractExpiryDate: datetime（合同到期日期，可空）
remainingLessons: int（剩余课时）
totalLessons: int（总课时）
classId: string（当前班级 ID，可空）
createdAt: datetime（创建时间）
updatedAt: datetime（更新时间）
createdBy: string（创建人）
notes: string（备注，可空）

### 3.2 教师数据字段

teacherId: string（主键，UUID）
teacherCode: string（工号，唯一）
name: string（姓名）
phone: string（手机号）
email: string（邮箱）
status: enum（PENDING / TRAINING / ACTIVE / MANAGING / INACTIVE）
onboardingDate: datetime（入职日期）
resignationDate: datetime（离职日期，可空）
resignationReason: string（离职原因，可空）
permissions: string[]（权限列表）
managedClassIds: string[]（管理的班级 ID 列表）
assignedCourseIds: string[]（分配的课程 ID 列表）
totalLessons: int（累计授课课时）
createdAt: datetime（创建时间）
updatedAt: datetime（更新时间）
createdBy: string（创建人）
notes: string（备注，可空）

### 3.3 状态变更日志

lifecycleLogId: string（主键，UUID）
entityType: enum（STUDENT / TEACHER）
entityId: string（学生/教师 ID）
fromStatus: enum（原状态）
toStatus: enum（新状态）
triggeredBy: string（触发人）
triggerReason: string（变更原因）
timestamp: datetime（变更时间）
metadata: json（附加信息，可空）

---

## 4. API 设计

### 4.1 学生 API

POST /students
- 功能：创建学生（注册）
- 权限：Admin / SuperAdmin
- 输入：name, phone, parentPhone
- 输出：studentId, studentCode, status=PENDING

POST /students/:code/enroll
- 功能：学生选班
- 权限：Admin / SuperAdmin
- 输入：classId, contractId, totalLessons
- 输出：updated student, status=ENROLLED

PATCH /students/:code/status
- 功能：更新学生状态
- 权限：Admin / SuperAdmin
- 输入：status, reason
- 输出：updated student

POST /students/:code/suspend
- 功能：休学
- 权限：Admin / SuperAdmin
- 输入：reason
- 输出：updated student, status=SUSPENDED

POST /students/:code/resume
- 功能：复学
- 权限：Admin / SuperAdmin
- 输入：无
- 输出：updated student, status=ACTIVE

POST /students/:code/renew
- 功能：续费
- 权限：Admin / SuperAdmin
- 输入：newContractId, additionalLessons
- 输出：updated student, status=ACTIVE

POST /students/:code/graduate
- 功能：结业
- 权限：Admin / SuperAdmin
- 输入：无
- 输出：updated student, status=GRADUATED

GET /students/:code/lifecycle
- 功能：获取学生生命周期日志
- 权限：Admin / SuperAdmin / Teacher（自己班级）
- 输出：lifecycle logs[]

### 4.2 教师 API

POST /teachers
- 功能：创建教师（入职）
- 权限：SuperAdmin
- 输入：name, phone, email
- 输出：teacherId, teacherCode, status=PENDING

POST /teachers/:code/activate
- 功能：激活教师（跳过培训）
- 权限：SuperAdmin
- 输入：permissions[]
- 输出：updated teacher, status=ACTIVE

POST /teachers/:code/assign-course
- 功能：分配课程
- 权限：SuperAdmin
- 输入：courseId
- 输出：updated teacher

POST /teachers/:code/assign-class
- 功能：分配管理班级
- 权限：SuperAdmin
- 输入：classId
- 输出：updated teacher, status=MANAGING

POST /teachers/:code/deactivate
- 功能：离职
- 权限：SuperAdmin
- 输入：reason, transferTeacherId（班级转移目标）
- 输出：updated teacher, status=INACTIVE

GET /teachers/:code/lifecycle
- 功能：获取教师生命周期日志
- 权限：SuperAdmin
- 输出：lifecycle logs[]

---

## 5. 权限设计

### 5.1 角色定义

SuperAdmin：系统超级管理员，拥有所有权限
Admin：管理员，可管理学生和教师
Teacher：教师，只能查看自己班级的学生信息

### 5.2 操作权限矩阵

学生注册：SuperAdmin, Admin
学生选班：SuperAdmin, Admin
学生状态更新：SuperAdmin, Admin
学生休学：SuperAdmin, Admin
学生复学：SuperAdmin, Admin
学生续费：SuperAdmin, Admin
学生结业：SuperAdmin, Admin
学生生命周期查看：SuperAdmin, Admin, Teacher（自己班级）

教师入职：SuperAdmin
教师激活：SuperAdmin
教师分配课程：SuperAdmin
教师分配班级：SuperAdmin
教师离职：SuperAdmin
教师生命周期查看：SuperAdmin

---

## 6. 通知设计

### 6.1 学生通知

注册成功：欢迎通知 → 家长手机号（短信/微信）
选班成功：班级分配通知 → 家长手机号
合同到期（30天）：续费提醒 → 家长手机号
合同到期（7天）：紧急续费提醒 → 家长手机号
续费成功：续费确认通知 → 家长手机号
休学确认：休学确认通知 → 家长手机号
复学确认：复学确认通知 → 家长手机号
结业：结业证书通知 → 家长手机号

### 6.2 教师通知

入职成功：欢迎通知 → 教师邮箱/手机
课程分配：新课程通知 → 教师
班级分配：新班级通知 → 教师
离职确认：离职确认通知 → 教师

### 6.3 通知渠道

微信模板消息（优先）
短信（备选）
站内消息（兜底）

---

## 7. 实现优先级

P0（MVP 必须）：
- 学生基础生命周期：注册 → 选班 → 学习 → 结业
- 学生状态流转：PENDING → ENROLLED → ACTIVE → GRADUATED
- 基础 API：POST /students, POST /students/:code/enroll, PATCH /students/:code/status
- 基础权限：Admin 可操作所有学生

P1（第二阶段）：
- 教师基础生命周期：入职 → 授课 → 离职
- 教师状态流转：PENDING → ACTIVE → INACTIVE
- 教师 API：POST /teachers, POST /teachers/:code/activate, POST /teachers/:code/deactivate
- 通知系统：注册通知、选班通知

P2（第三阶段）：
- 学生高级功能：休学、复学、续费
- 教师高级功能：培训、管理班级
- 完整通知系统：续费提醒、结业证书
- 生命周期日志查询 API

---

## 8. Decision Gate

以下业务规则需要 Owner 确认：

DG-001：续费提醒阈值
- 当前设计：合同剩余课时 < 5 次 或 到期前 30 天
- 需要确认：具体阈值是否合适

DG-002：休学保留期限
- 当前设计：无限期保留
- 需要确认：是否需要设置最大休学期限（如 6 个月）

DG-003：教师离职班级转移
- 当前设计：必须指定转移目标教师
- 需要确认：是否允许暂时不转移（班级冻结）

DG-004：学生强制结业
- 当前设计：管理员可从任意状态强制结业
- 需要确认：是否需要额外审批流程

DG-005：通知渠道优先级
- 当前设计：微信 > 短信 > 站内
- 需要确认：是否需要支持邮件通知

---

## 9. 附录

### 9.1 状态枚举定义

StudentStatus:
- PENDING：已注册，待选班
- ENROLLED：已选班，待开课
- ACTIVE：学习中
- ATTENDING：出勤中（课时进行中）
- RENEWING：续费中
- GRADUATED：已结业
- SUSPENDED：已休学

TeacherStatus:
- PENDING：已入职，待培训
- TRAINING：培训中
- ACTIVE：授课中
- MANAGING：管理中（班主任）
- INACTIVE：已离职

### 9.2 与现有系统的映射

学生模块对应：
- Student entity（kernel/domain）
- StudentService（application）
- StudentController（infrastructure）
- students 表（infrastructure/database）

教师模块对应：
- Teacher entity（kernel/domain）— 当前可能不存在，需新建或复用 User
- TeacherService（application）
- TeacherController（infrastructure）
- teachers 表（infrastructure/database）— 可能需新建

### 9.3 参考

- 现有学生 API：GET /students, GET /students/:code, POST /students
- 现有教师 API：GET /teachers, GET /teachers/:id
- 现有课时 API：POST /lessons, GET /lessons
- 现有合同 API：暂无（需新建）
