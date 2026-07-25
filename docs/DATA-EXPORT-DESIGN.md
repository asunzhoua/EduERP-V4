# Data Export Design

## 概述

管理员数据导出能力，支持学生、课程、课时消耗、工资、财务五类业务事实数据的导出。
仅限管理员（SuperAdmin / Admin）角色访问，仅导出已存在的事实数据，不创建新的业务真值。

---

## 导出范围

### 1. 学生数据导出

**数据来源**：`student`、`enrollment`、`contract` 表

**导出字段**：

| 字段 | 来源表 | 说明 |
|------|--------|------|
| studentCode | student | 学生编号 |
| studentName | student | 学生姓名（`student.name`） |
| gender | student | 性别 |
| birthDate | student | 出生日期 |
| phone | student | 联系电话 |
| email | student | 电子邮箱 |
| school | student | 就读学校 |
| grade | student | 年级 |
| tags | student | 标签 |
| status | student | 学生状态（ACTIVE / PAUSED / GRADUATED / INACTIVE） |
| enrollmentDate | enrollment | 报名日期（`enrollment.enrolledAt`） |
| classCode | enrollment | 班级编号 |
| enrollmentStatus | enrollment | 报名状态 |
| contractCode | contract | 合同编号 |
| subject | contract | 科目 |
| totalLessons | contract | 总课时 |
| remainingLessons | contract | 剩余课时 |
| unitPrice | contract | 单价 |
| totalAmount | contract | 合同总金额 |
| contractStatus | contract | 合同状态（ACTIVE / EXHAUSTED / EXPIRED / REFUNDED / FROZEN） |
| validFrom | contract | 合同生效日期 |
| validTo | contract | 合同失效日期 |
| note | student / contract | 备注 |

**SQL 示例**：
```sql
SELECT
  s.studentCode,
  s.name AS studentName,
  s.gender,
  s.birthDate,
  s.phone,
  s.email,
  s.school,
  s.grade,
  s.tags,
  s.status,
  e.enrolledAt AS enrollmentDate,
  e.classCode,
  e.status AS enrollmentStatus,
  c.contractCode,
  c.subject,
  c.totalLessons,
  c.remainingLessons,
  c.unitPrice,
  c.totalAmount,
  c.status AS contractStatus,
  c.validFrom,
  c.validTo,
  COALESCE(s.note, c.note) AS note
FROM student s
LEFT JOIN enrollment e ON s.studentCode = e.studentCode
LEFT JOIN contract c ON e.contractCode = c.contractCode
WHERE s.deleted = false
```

---

### 2. 课程记录导出

**数据来源**：`lesson`、`lesson_attendance` 表

**导出字段**：

| 字段 | 来源表 | 说明 |
|------|--------|------|
| lessonId | lesson | 课程 ID |
| classCode | lesson | 班级编号 |
| courseCode | lesson | 课程编号 |
| lessonNumber | lesson | 课时序号 |
| status | lesson | 课程状态（DRAFT / SCHEDULED / CONFIRMED / FINISHED / CANCELLED） |
| scheduledDate | lesson | 计划上课日期 |
| startTime | lesson | 开始时间 |
| endTime | lesson | 结束时间 |
| teacherId | lesson | 教师 ID |
| actualStartTime | lesson | 实际上课时间 |
| actualEndTime | lesson | 实际下课时间 |
| isMakeup | lesson | 是否补课 |
| cancelledReason | lesson | 取消原因 |
| studentCode | lesson_attendance | 学生编号 |
| attendanceStatus | lesson_attendance | 考勤状态（PRESENT / ABSENT / LATE / LEAVE / SICK / MAKEUP / ONLINE / OFFLINE） |
| workflowState | lesson_attendance | 考勤工作流状态 |
| checkInTime | lesson_attendance | 签到时间 |
| reason | lesson_attendance | 考勤原因 |
| note | lesson_attendance | 考勤备注 |

**SQL 示例**：
```sql
SELECT
  l.id AS lessonId,
  l.classCode,
  l.courseCode,
  l.lessonNumber,
  l.status,
  l.scheduledDate,
  l.startTime,
  l.endTime,
  l.teacherId,
  l.actualStartTime,
  l.actualEndTime,
  l.isMakeup,
  l.cancelledReason,
  la.studentCode,
  la.status AS attendanceStatus,
  la.workflowState,
  la.checkInTime,
  la.reason,
  la.note
FROM lesson l
LEFT JOIN lesson_attendance la ON l.id = la.lessonId
ORDER BY l.scheduledDate, l.startTime
```

---

### 3. 课时消耗导出

**数据来源**：`contract`、`lesson_attendance` 表

**核心原则**：课时消耗不是独立事件，而是 lesson 完成（FINISHED）且考勤状态为可扣减时，系统对合同剩余课时的自然扣减。

可扣减考勤状态：`PRESENT`、`LATE`、`ONLINE`、`OFFLINE`

**导出字段**：

| 字段 | 来源表 | 说明 |
|------|--------|------|
| contractCode | contract | 合同编号 |
| studentCode | contract | 学生编号 |
| subject | contract | 科目 |
| totalLessons | contract | 总课时 |
| remainingLessons | contract | 当前剩余课时 |
| consumedLessons | 计算 | 已消耗课时（totalLessons - remainingLessons） |
| consumedRatio | 计算 | 消耗比例（consumedLessons / totalLessons） |
| contractStatus | contract | 合同状态 |
| lessonId | lesson_attendance | 消耗来源课程 ID |
| attendanceStatus | lesson_attendance | 考勤状态 |
| lessonDate | lesson | 课程日期（需 JOIN lesson 表） |
| deductedAt | lesson_attendance | 扣减时间（workflowState 变为 CONFIRMED / LOCKED 的时间） |

**SQL 示例**：
```sql
SELECT
  c.contractCode,
  c.studentCode,
  c.subject,
  c.totalLessons,
  c.remainingLessons,
  (c.totalLessons - c.remainingLessons) AS consumedLessons,
  CASE WHEN c.totalLessons > 0
    THEN (c.totalLessons - c.remainingLessons) / c.totalLessons
    ELSE 0
  END AS consumedRatio,
  c.status AS contractStatus,
  la.lessonId,
  la.status AS attendanceStatus,
  l.scheduledDate AS lessonDate,
  la.updatedAt AS deductedAt
FROM contract c
JOIN enrollment e ON c.contractCode = e.contractCode
JOIN lesson_attendance la ON e.studentCode = la.studentCode
  AND e.classCode = la.classCode
  AND la.status IN ('PRESENT', 'LATE', 'ONLINE', 'OFFLINE')
JOIN lesson l ON la.lessonId = l.id
  AND l.status = 'FINISHED'
ORDER BY c.contractCode, l.scheduledDate
```

---

### 4. 工资记录导出

**数据来源**：`salary_record`、`user` 表

**导出字段**：

| 字段 | 来源表 | 说明 |
|------|--------|------|
| id | salary_record | 记录 ID |
| teacherId | salary_record | 教师 ID |
| teacherName | user | 教师姓名 |
| teacherMobile | user | 教师手机号 |
| lessonId | salary_record | 关联课程 ID |
| lessonDate | salary_record | 课程日期 |
| duration | salary_record | 课程时长（分钟） |
| salaryRuleId | salary_record | 薪资规则 ID |
| ruleVersion | salary_record | 规则版本号 |
| amount | salary_record | 金额 |
| status | salary_record | 状态（PENDING / CONFIRMED / PAID） |
| attendanceId | salary_record | 关联考勤 ID |
| notes | salary_record | 备注 |
| createTime | salary_record | 创建时间 |
| updateTime | salary_record | 更新时间 |

**SQL 示例**：
```sql
SELECT
  sr.id,
  sr.teacherId,
  u.name AS teacherName,
  u.mobile AS teacherMobile,
  sr.lessonId,
  sr.lessonDate,
  sr.duration,
  sr.salaryRuleId,
  sr.ruleVersion,
  sr.amount,
  sr.status,
  sr.attendanceId,
  sr.notes,
  sr.createTime,
  sr.updateTime
FROM salary_record sr
LEFT JOIN user u ON sr.teacherId = u.id
WHERE u.deleted = false
ORDER BY sr.lessonDate DESC, sr.teacherId
```

---

### 5. 财务记录导出

**数据来源**：`payment`、`contract` 表（及 `lesson_attendance` 计算）

**说明**：当前系统中 Payment / Ledger 实体尚未实现，财务导出设计为预留。

#### 5.1 收入记录（Payment）

预留字段：

| 字段 | 来源表 | 说明 |
|------|--------|------|
| paymentCode | payment | 付款编号 |
| contractCode | payment | 关联合同编号 |
| studentCode | payment | 学生编号 |
| amount | payment | 付款金额 |
| paymentMethod | payment | 付款方式 |
| paidAt | payment | 付款时间 |
| status | payment | 付款状态 |
| createdBy | payment | 操作人 |

#### 5.2 课时消耗价值（基于 Contract + Attendance 计算）

| 字段 | 来源表 | 说明 |
|------|--------|------|
| contractCode | contract | 合同编号 |
| subject | contract | 科目 |
| studentCode | contract | 学生编号 |
| totalAmount | contract | 合同总金额 |
| totalLessons | contract | 总课时 |
| unitPrice | contract | 单价 |
| remainingLessons | contract | 剩余课时 |
| consumedLessons | 计算 | 已消耗课时（totalLessons - remainingLessons） |
| consumedValue | 计算 | 已消耗价值（consumedLessons × unitPrice） |
| remainingValue | 计算 | 剩余价值（remainingLessons × unitPrice） |

**SQL 示例**：
```sql
SELECT
  c.contractCode,
  c.subject,
  c.studentCode,
  c.totalAmount,
  c.totalLessons,
  c.unitPrice,
  c.remainingLessons,
  (c.totalLessons - c.remainingLessons) AS consumedLessons,
  ROUND((c.totalLessons - c.remainingLessons) * c.unitPrice, 2) AS consumedValue,
  ROUND(c.remainingLessons * c.unitPrice, 2) AS remainingValue
FROM contract c
WHERE c.status IN ('ACTIVE', 'EXHAUSTED', 'FROZEN')
ORDER BY c.studentCode
```

---

## 导出格式

### CSV（通用格式）
- 默认格式
- UTF-8 BOM 编码（兼容 Excel 中文）
- 逗号分隔，字段含逗号时双引号包裹
- 首行为列标题
- 支持 `Content-Type: text/csv`

### Excel（.xlsx）
- 支持多 Sheet 分页导出
- 列宽自适应
- 日期格式化为 `YYYY-MM-DD`
- 金额保留两位小数
- 支持 `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## API 设计

### GET /export/students

导出学生数据。

**权限**：SuperAdmin, Admin

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 否 | 导出格式：`csv`（默认）或 `excel` |
| startDate | string | 否 | 开始日期（基于 enrollment.enrolledAt） |
| endDate | string | 否 | 结束日期 |
| status | string | 否 | 学生状态过滤 |
| contractStatus | string | 否 | 合同状态过滤 |
| subject | string | 否 | 科目过滤 |
| fields | string | 否 | 自定义字段列表（逗号分隔），默认全部 |

**响应**：

- `200`：文件流
  - CSV：`Content-Type: text/csv`，文件名 `students_export_{timestamp}.csv`
  - Excel：`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`，文件名 `students_export_{timestamp}.xlsx`
- `403`：无权限

---

### GET /export/lessons

导出课程及考勤记录。

**权限**：SuperAdmin, Admin

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 否 | `csv`（默认）或 `excel` |
| startDate | string | 否 | 开始日期（基于 lesson.scheduledDate） |
| endDate | string | 否 | 结束日期 |
| classCode | string | 否 | 班级编号过滤 |
| status | string | 否 | 课程状态过滤 |
| attendanceStatus | string | 否 | 考勤状态过滤 |

**响应**：

- `200`：文件流
  - 文件名：`lessons_export_{timestamp}.csv` / `.xlsx`
- `403`：无权限

---

### GET /export/consumption

导出课时消耗记录。

**权限**：SuperAdmin, Admin

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 否 | `csv`（默认）或 `excel` |
| startDate | string | 否 | 开始日期（基于 lesson.scheduledDate） |
| endDate | string | 否 | 结束日期 |
| contractCode | string | 否 | 合同编号过滤 |
| studentCode | string | 否 | 学生编号过滤 |
| subject | string | 否 | 科目过滤 |

**响应**：

- `200`：文件流
  - 文件名：`consumption_export_{timestamp}.csv` / `.xlsx`
- `403`：无权限

---

### GET /export/salary

导出工资明细。

**权限**：SuperAdmin, Admin

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 否 | `csv`（默认）或 `excel` |
| startDate | string | 否 | 开始日期（基于 salary_record.lessonDate） |
| endDate | string | 否 | 结束日期 |
| teacherId | number | 否 | 教师 ID 过滤 |
| status | string | 否 | 工资状态过滤（PENDING / CONFIRMED / PAID） |

**响应**：

- `200`：文件流
  - 文件名：`salary_export_{timestamp}.csv` / `.xlsx`
- `403`：无权限

---

### GET /export/finance

导出财务汇总记录。

**权限**：SuperAdmin, Admin

**参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 否 | `csv`（默认）或 `excel` |
| startDate | string | 否 | 开始日期 |
| endDate | string | 否 | 结束日期 |
| subject | string | 否 | 科目过滤 |
| contractCode | string | 否 | 合同编号过滤 |

**响应**：

- `200`：文件流
  - 文件名：`finance_export_{timestamp}.csv` / `.xlsx`
- `403`：无权限

---

## 权限控制

- **接口级别**：所有导出接口使用 `@Roles('SuperAdmin', 'Admin')` 装饰器
- **角色限制**：
  - SuperAdmin：完全访问所有导出
  - Admin：完全访问所有导出
  - Teacher：禁止访问任何导出接口
  - Parent：禁止访问任何导出接口
- **数据范围**：Admin 导出时按校区/数据范围隔离（如已实现 campusId 过滤）

**实现示例**：
```typescript
@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  @Get('students')
  @Roles('SuperAdmin', 'Admin')
  async exportStudents(@Query() query: ExportQueryDto): Promise<StreamableFile> {
    // ...
  }
}
```

---

## 性能考虑

### 大数据量分页导出
- 默认单次导出上限：100,000 行
- 超量时自动分页为多个文件（`_part1.csv`、`_part2.csv`）
- 或使用流式响应逐批推送

### 异步导出（可选增强）
- 对于超过 50,000 行的导出请求，异步生成：
  1. 客户端请求 → `202 Accepted`，返回 `taskId`
  2. 服务端后台生成文件
  3. 客户端轮询 `/export/tasks/{taskId}` 获取状态
  4. 生成完成后通过 `/export/tasks/{taskId}/download` 下载

### 文件流式传输
- 使用 Node.js `StreamableFile` 或 `Response.stream`
- 不将完整数据集加载到内存中
- 数据库层面使用游标（cursor）或流式查询

### 查询优化
- 利用已有数据库索引（studentCode, contractCode, classCode, lessonId 等均有索引）
- 日期范围过滤使用索引列
- 避免 N+1 查询

---

## 安全考虑

### 敏感数据脱敏
- **手机号**：导出时中间四位脱敏（`138****1234`）
- **邮箱**：@ 前用户名部分脱敏（`us****@example.com`）
- **地址/备注**：含个人身份信息字段需在配置中标记为脱敏字段
- 脱敏规则可通过配置开关控制（允许管理员导出明文时需额外确认）

### 导出日志记录
- 每次导出操作记录到 `export_log` 表或已有审计日志表
- 记录内容：操作人、操作时间、导出类型、格式、过滤条件、行数
- 日志不可删除，仅可追加

**日志结构**：
```typescript
interface ExportLog {
  id: number;
  userId: number;          // 操作人
  exportType: string;       // students / lessons / consumption / salary / finance
  format: string;          // csv / excel
  filters: object;         // 过滤条件（JSON）
  rowCount: number;        // 导出行数
  fileSize: number;        // 文件大小（字节）
  ip: string;              // 请求 IP
  createdAt: Date;
}
```

### 文件大小限制
- 单次导出文件最大：50 MB
- 超过限制时自动拆分为多个文件
- 导出文件临时存储时间：30 分钟自动清理
- 异步导出文件保留时间：2 小时

### 其他安全措施
- 导出接口限流：每分钟每用户 5 次请求
- 导出文件使用 UUID 命名，避免路径遍历
- 导出文件存放于公开不可访问的目录（如 `storage/exports/`）
- 所有导出接口强制 HTTPS

---

## 后续扩展

- **自定义导出模板**：允许管理员选择字段、排序、聚合方式
- **定时导出**：通过 cron job 每日/每周自动导出并发送邮件
- **导出到云存储**：支持直接写入阿里云 OSS / AWS S3 并返回预签名 URL
- **多语言列名**：支持导出列名中文化
- **数据校验文件**：附带 SHA256 校验文件，保证导出数据完整性
- **报表格式**：支持 PDF 格式导出财务报表
- **Payment / Ledger 接入**：待 Payment 和 Ledger 实体实现后，在财务导出中增加收入明细和账务流水

---

## 附录：数据表清单

| 序号 | 表名 | 所属模块 | 导出类型 |
|------|------|----------|----------|
| 1 | student | Student | 学生数据 |
| 2 | enrollment | Teaching | 学生数据 |
| 3 | contract | Teaching | 学生数据、课时消耗、财务 |
| 4 | lesson | Teaching | 课程记录、课时消耗 |
| 5 | lesson_attendance | Teaching | 课程记录、课时消耗 |
| 6 | course | Teaching | 课程记录（关联） |
| 7 | class | Teaching | 课程记录（关联） |
| 8 | salary_record | Salary | 工资记录 |
| 9 | user | Identity | 工资记录（教师信息） |
| 10 | payment | Finance（预留） | 财务记录 |
| 11 | ledger | Finance（预留） | 财务记录（预留） |

**合计：11 个表（其中 9 个已实现，2 个预留）**
