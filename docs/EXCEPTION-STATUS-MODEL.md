# 异常业务状态模型设计

## 设计时间
2026-07-25

## 审计现状（基于代码库）

### AttendanceStatus（已完整 7/7）
文件: `src/modules/teaching/lesson-attendance/enums/attendance-status.enum.ts`
- PRESENT — 正常签到，扣课
- ABSENT — 缺勤，不扣课
- LATE — 迟到，扣课
- LEAVE — 请假，不扣课（已有）
- MAKEUP — 补课，不重复扣课（已有）
- ONLINE — 线上课，扣课
- OFFLINE — 线下课（与 PRESENT 同义，扣课）

扣课集合 `DEDUCTIBLE_STATUSES` = { PRESENT, LATE, ONLINE, OFFLINE } 已正确隔离。

### EnrollmentStatus（缺口 3/4）
文件: `src/common/enums/enrollment-status.enum.ts`
现有: ACTIVE, WITHDRAWN, COMPLETED
缺失: SUSPEND — 需新增

### ChangeRequestType（缺口 4/5）
文件: `src/common/enums/change-request-type.enum.ts`
现有: RESCHEDULE, TEACHER_CHANGE, CANCEL, REOPEN
缺失: LEAVE — 需新增

### 测试覆盖需要同步更新
文件: `src/common/enums/common-enums.spec.ts`
- EnrollmentStatus 长度断言: 3 → 4
- ChangeRequestType 长度断言: 4 → 5

---

## 状态总览

| 状态 | 扣课 | 教师统计 | 家长端 | 合同影响 |
|------|:----:|:--------:|:------:|:--------:|
| PRESENT (正常签到) | 扣课 | 计入 | 可查看 | 正常 |
| ABSENT (缺勤) | 不扣 | 不计 | 可查看 | 正常 |
| LATE (迟到) | 扣课 | 计入 | 可查看 | 正常 |
| LEAVE (请假) | 不扣 | 不计 | 可申请/查看 | 正常 |
| SICK (病假 LEAVE 子类型) | 不扣 | 不计 | 可申请/查看 | 正常 |
| MAKEUP (补课) | 不重复扣 | 计入 | 可查看安排 | 正常 |
| SUSPEND (停课) | 不扣 | 不计 | 可申请/查看 | 冻结课时 |
| CANCELLED (取消) | 回滚 | 不计 | 可查看 | 回滚 |

## 状态定义详表

### 1. LEAVE（请假）
- 子类型: SICK（病假）、PERSONAL（事假）
- 扣课: 不扣课
- 教师统计: 不计入授课量
- 家长端: 可提交申请 + 查看
- 合同: 正常（不计入消耗）
- 注意: AttendanceStatus 已有 LEAVE，ChangeRequestType 需新增 LEAVE

### 2. SUSPEND（停课）
- 子类型: SHORT_TERM（短期，如 1-4 周）、LONG_TERM（长期，如 1 个月以上）
- 扣课: 不扣课，合同冻结
- 教师统计: 不计入
- 家长端: 可提交申请 + 查看
- 合同: 暂停剩余课时计数，冻结期间不计入有效期
- EnrollmentStatus 新增 SUSPEND

### 3. MAKEUP（补课）
- AttendanceStatus 已有 MAKEUP，LessonEntity 已有 isMakeup 字段
- 扣课: 不重复扣课（不包含在 DEDUCTIBLE_STATUSES 中）
- 教师统计: 计入授课量（教师正常拿课时费）
- 合同: 不计入消耗（原课已扣，补课不重复）

### 4. CANCELLED（取消）
- 后端已有取消逻辑，事务回滚完整
- 扣课: 回滚（已扣的退还）
- 教师统计: 不计入
- 合同: 回滚至取消前状态

## 状态流转图

```
                  ┌─────────────────────────────────────┐
                  │              ACTIVE                  │
                  │  (正常上课中，有 Attendance 记录)     │
                  └──────┬──────────────┬───────────────┘
                         │              │
                    LEAVE/SUSPEND   正常签到
                     (不扣课)        PRESENT/LATE
                         │          ONLINE/OFFLINE
                         │              │
                    ┌────▼────┐    ┌────▼────┐
                    │ SUSPEND │    │ ATTEND  │
                    │ 停课    │    │ 已签到   │
                    └────┬────┘    └────┬────┘
                         │              │
                         解除停课      MAKEUP(补课)
                         │              │
                    ┌────▼────┐    ┌────▼────┐
                    │ ACTIVE  │    │ MAKEUP  │
                    └─────────┘    │ 补课完成 │
                                   └─────────┘
```

## 建议变更清单（5 项）

1. [EnrollmentStatus] 新增 SUSPEND 枚举值
2. [ChangeRequestType] 新增 LEAVE 枚举值
3. [common-enums.spec.ts] 更新长度断言: EnrollmentStatus 3→4, ChangeRequestType 4→5
4. [前端] 签到页增加 LEAVE/SICK/MAKEUP 签到选项
5. [新增 API] 家长请假提交接口 + 管理员审核请假/停课接口
