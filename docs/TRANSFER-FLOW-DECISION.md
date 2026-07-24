# 已知问题处理决策报告

## 决策时间
2026-07-24

---

## 问题 1：学生转班原子操作

### 当前状态
- 严重性: P2
- 问题描述: 学生转班需要两步操作（从A班退课 +  enroll到B班），当前不是原子操作。如果第一步成功但第二步失败，学生会处于无班状态。

### 代码现状分析
- Student 实体无 classCode 字段，学生与班级的关联通过 Enrollment 实体实现
- Enrollment 实体：classCode + studentCode + contractCode + status(ACTIVE/WITHDRAWN/COMPLETED)
- 当前转班流程 = withdraw(旧班) + enroll(新班)，两次独立 API 调用
- 无事务包裹，无回滚机制
- 唯一约束 (classCode, studentCode) 保证不会重复注册

### 评估
- 是否影响 MVP: ❌ 不影响
- 是否影响真实使用: ❌ 不影响（转班是低频操作，失败可手动重试）
- 是否需要立即开发: ❌ 不需要

### 决策
- 决策: 延迟到 MVP 后开发
- 理由:
  1. 转班是低频操作（一个学期几次），不是日常高频流程
  2. 即使第二步失败，数据状态是"学生无班"，operator 可立即发现并重试
  3. 不存在数据损坏风险（唯一约束保护），只是操作中断
  4. MVP 阶段优先保障核心流程（考勤、课时录入）的稳定性
  5. 实现原子转班需要新增事务管理 + 转班 API，工作量与收益不匹配

### 建议
- 如果立即开发（不推荐）:
  - 新增 POST /enrollments/transfer 接口
  - 使用 TypeORM QueryRunner 包裹两步操作为事务
  - 新增 transferReason 字段记录转班原因
  - 保留原 enrollment 记录（status=TRANSFERRED）而非删除

- 如果延迟开发（推荐）:
  - 在 operator 手册中说明转班操作步骤
  - 如果转班第二步失败，手动调用 enroll 接口重试
  - 记录到 Backlog，在 P2 阶段统一处理
  - 预计工作量：0.5天（含测试）

---

## 问题 2：薪酬结算周期聚合查询

### 当前状态
- 严重性: PARTIAL
- 问题描述: 薪酬模块完全未实现（无 Entity/Service/Controller/Module），但底层数据（Lesson、LessonAttendance）已完整。需要确认现有数据能否支持结算周期查询。

### 评估
- 当前数据是否支持: ✅ 支持（原始数据完整）
  - Lesson 实体：teacherId + scheduledDate + status(FINISHED) + classCode → 可查询"某教师某月上了多少节课"
  - LessonAttendance 实体：lessonId + studentCode + status(PRESENT/ABSENT) → 可查询"每节课有多少学生到课"
  - Enrollment 实体：classCode + studentCode → 可查询"某班有多少学生"
  - 数据链路完整：Teacher → Lesson → Attendance → Student

- 是否需要新增接口: ✅ 需要（轻量聚合接口）
  - 当前无按教师+时间范围的课时聚合查询
  - 现有接口：GET /classes/:code/lessons（按班级查课时），无按教师维度聚合

- 接口设计建议: 见下方

### 决策
- 决策: 设计轻量聚合接口，不做完整工资计算
- 理由:
  1. 底层数据完整，聚合查询只是 SELECT + GROUP BY
  2. 不实现工资计算规则（阶梯/固定/混合），只提供原始数据
  3. 为未来工资模块提供数据基础，但不绑定工资业务逻辑
  4. 工作量小（1个 Service 方法 + 1个 Controller 端点），风险低
  5. 真实运营中，Owner 可能需要手动核对教师课时数

### 建议

#### 接口设计

```
GET /teachers/:id/lesson-summary
  ?startDate=2026-07-01
  &endDate=2026-07-31

Response:
{
  "teacherId": 1,
  "period": { "start": "2026-07-01", "end": "2026-07-31" },
  "totalLessons": 24,
  "totalStudentAttendances": 192,
  "classes": [
    {
      "classCode": "CLS-001",
      "className": "三年级数学A班",
      "lessonCount": 12,
      "totalAttendances": 96,
      "avgAttendanceRate": 0.92
    },
    {
      "classCode": "CLS-002",
      "className": "四年级英语B班",
      "lessonCount": 12,
      "totalAttendances": 96,
      "avgAttendanceRate": 0.88
    }
  ]
}
```

#### 实现要点
- 查询条件：Lesson.status = FINISHED，Lesson.teacherId = :id，Lesson.scheduledDate BETWEEN :start AND :end
- 出勤统计：JOIN LessonAttendance，COUNT status=PRESENT
- 权限：SuperAdmin/Admin 可查所有教师，Teacher 只能查自己
- 不包含：工资计算、阶梯规则、结算周期管理
- 预计工作量：0.5天（含测试）

#### 实现优先级
- P2 — 非阻塞，但建议在下一个 Batch 实现
- 不依赖工资模块，可独立交付

---

## 总结

1. 学生转班原子操作：P2，延迟到 MVP 后。当前手动两步操作可接受，无数据损坏风险，转班是低频操作。
2. 薪酬结算周期聚合查询：底层数据完整，需新增一个轻量聚合接口（GET /teachers/:id/lesson-summary），只提供原始课时数据，不做工资计算。工作量 0.5 天，建议下一 Batch 实现。
