# Phase 1 Evidence

## 输出文件
- docs/ADMIN-DASHBOARD-DESIGN.md

## 指标数量
- 今日运营：4 个
  - 今日课程数量（lesson.scheduledDate = today）
  - 完成课程数量（lesson.status = FINISHED）
  - 请假数量（lesson_exceptions.exceptionType = LEAVE_SICK/LEAVE_PERSONAL）
  - 消耗课时（contract.totalLessons - contract.remainingLessons）
- 学员情况：3 个
  - 学员总数（student.status = ACTIVE）
  - 新增学生（student.createTime = today）
  - 剩余课时（contract.remainingLessons WHERE status = ACTIVE）
- 教师情况：2 个
  - 授课数量（lesson GROUP BY teacherId）
  - 工资统计（salary_record SUM amount）
- 财务情况：2 个
  - 收入（payment SUM amount）
  - 课时消耗价值（contract (totalLessons - remainingLessons) * unitPrice）
- **总计：11 个指标**

## API 数量
- 5 个接口（/dashboard/overview, /dashboard/lessons, /dashboard/students, /dashboard/teachers, /dashboard/finance）

## 数据来源
- lesson 表（课程）
- lesson_exceptions 表（请假）
- student 表（学员）
- contract 表（合同）
- salary_record 表（工资）
- payment 表（收费）

## Git Commit
- Hash: c270f826d42de6b7a71783d460e67b813a501c72

## 结论
Phase 1 指标设计完成。文档基于实际 TypeORM 实体结构编写（LessonEntity、Student、ContractEntity、LessonExceptionEntity、SalaryRecordEntity），数据字典中的 payment 表结构作为收入来源参考。所有指标均标注来源表与字段，避免中间统计表和前端计算。
