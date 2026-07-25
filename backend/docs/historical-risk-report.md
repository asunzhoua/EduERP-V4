# Historical Risk Report

## 审计内容
检查 `lesson.completed` 事件重复发射导致的历史数据风险。

## 检查结果

### salary_record 表检查
```sql
SELECT lessonId, COUNT(*) as count
FROM salary_record
GROUP BY lessonId
HAVING COUNT(*) > 1;
```

**结果**: 0 rows — `salary_record` 表当前无数据（系统仍在开发阶段，工资模块未部署）。

### lesson_events 表检查
`lesson_events` 表不存在。系统使用 EventBusService（EventEmitter2）进行内存事件分发，未持久化事件日志。

## 结论
- **重复 SalaryRecord**: 0 条
- **重复 lesson.completed 事件**: 无法检查（无事件持久化表）
- **风险评估**: 低 — 系统尚未投产，无历史数据污染
- **建议**: 生产中建议增加事件持久化表（如 `event_store`），便于 future audit

---

*报告生成时间: 2026-07-25*
*审计人: code agent*
