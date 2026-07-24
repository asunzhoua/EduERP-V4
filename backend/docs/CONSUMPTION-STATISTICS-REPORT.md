# 课时消耗统计报告

## 验证时间
2026-07-24

## 检查范围
- Contract 数据（ContractEntity — totalLessons, remainingLessons, status）
- Lesson 数据（LessonEntity — status = FINISHED）
- Attendance 数据（LessonAttendanceEntity — checkInTime, status IN DEDUCTIBLE_STATUSES）
- 统计接口（GET /api/v1/analytics/consumption-statistics）

## 实现内容
1. 新增接口: GET /api/v1/analytics/consumption-statistics?days=30
2. 支持功能:
   - 总消耗课时: ✅ (totalConsumed = SUM(totalLessons - remainingLessons) WHERE status = ACTIVE)
   - 剩余课时: ✅ (totalRemaining = SUM(remainingLessons) WHERE status = ACTIVE)
   - 总课时: ✅ (totalLessons = SUM(totalLessons) WHERE status = ACTIVE)
   - 已完成课次: ✅ (completedLessons = COUNT WHERE status = FINISHED)
   - 消耗趋势: ✅ (consumptionTrend — 按日统计签到扣课数量)
   - 按学生统计: ✅ (byStudent — 按 studentCode 分组)
   - 按课程统计: ✅ (byCourse — 按 subject 分组)

## 数据来源
- Contract: ✅ (ContractEntity — 从 ACTIVE 状态合同读取)
- Lesson: ✅ (LessonEntity — FINISHED 状态计数)
- Attendance: ✅ (LessonAttendanceEntity — DEDUCTIBLE_STATUSES 签到记录)

## 扣课状态定义
- PRESENT: 到课 → 扣课
- LATE: 迟到 → 扣课
- ONLINE: 线上 → 扣课
- OFFLINE: 线下 → 扣课
- ABSENT: 缺勤 → 不扣课
- LEAVE: 请假 → 不扣课
- MAKEUP: 补课 → 不扣课

## API 验证
- 返回真实数据: ✅ (所有数据来自数据库查询，无模拟数据)
- 签到后更新: ✅ (consumed = totalLessons - remainingLessons，签到时 remainingLessons 已减少)
- 权限控制: ✅ (仅 SuperAdmin, Admin 可访问)
- 参数验证: ✅ (days 默认 7，范围 1-365)

## 代码变更
- 文件: analytics.module.ts (添加 ContractEntity 到 forFeature)
- 文件: analytics.service.ts (添加 contractRepository 注入 + getConsumptionStatistics 方法)
- 文件: analytics.controller.ts (添加 GET consumption-statistics 端点)
- 测试: src/modules/analytics/analytics.service.spec.ts (6 个新测试)
- 测试: src/modules/analytics/analytics.controller.spec.ts (2 个新测试)

## 测试验证
- Build: ✅ PASS (0 TS errors, npx nest build 成功)
- 测试: ✅ ALL PASS (81 suites, 1035 tests)
- 新增测试: 8 个 (6 service + 2 controller)

## 技术细节
- consumed 计算: totalLessons - remainingLessons (从 Contract 表直接读取，不新增字段)
- 趋势统计: 基于 lesson_attendance.checkInTime + DEDUCTIBLE_STATUSES 过滤
- 分组统计: 基于 contract 表 studentCode/subject 分组
- 空数据处理: COALESCE 确保 NULL 返回 0

## 结论
- Status: ✅ COMPLETED
- Phase 1 Batch 1.2 完成
- 所有数据来自真实数据库查询
- 无模拟数据、无虚构数据
