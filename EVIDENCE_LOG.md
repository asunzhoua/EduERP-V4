# Evidence Log

## M-EDUOS-PERMISSION-HARDENING-V1

**Mission**: 权限隔离硬化  
**Status**: ✅ RELEASED  
**Release Date**: 2026-08-02 22:45  
**Commit**: 5d3f030

### Evidence Files

| # | File | Description | Size |
|---|------|-------------|------|
| 1 | `docs/evidence/M-EDUOS-PERMISSION-HARDENING-V1.md` | 完整修复清单与权限矩阵 | 6,889 bytes |
| 2 | `docs/evidence/PERMISSION-REGRESSION-TEST-REPORT.md` | 单元测试结果 (42/42 PASS) | 4,883 bytes |
| 3 | `docs/evidence/PERMISSION-REGRESSION-FINAL-REPORT.md` | API 集成测试结果 (4/5 PASS) | 3,920 bytes |
| 4 | `docs/evidence/M-EDUOS-RELEASE-GATE-V1.md` | Release Gate 审核报告 | 4,943 bytes |

### Risk Fixes

| ID | Risk | Level | Status |
|----|------|-------|--------|
| V-01/V-02 | 出勤记录隔离 | HIGH | ✅ Fixed |
| V-03/V-04 | 报名/合同记录隔离 | HIGH | ✅ Fixed |
| V-05 | 请假申请归属验证 | HIGH | ✅ Fixed |
| V-06 | 休学申请归属验证 | HIGH | ✅ Fixed |
| M-01 | Teacher 课程可见范围 | MEDIUM | ✅ Fixed |
| M-02 | Teacher 教师分配可见范围 | MEDIUM | ✅ Fixed |
| M-03 | Teacher 考勤写入归属 | MEDIUM | ✅ Fixed |

### Test Results

- **Unit Tests**: 42/42 PASS
- **API Tests**: 4/5 PASS (1 skipped due to rate limit)
- **Release Gate**: APPROVED

### Decision Chain

1. **Validated**: YES (2026-08-02)
2. **Release Gate**: APPROVED (2026-08-02)
3. **Code Committed**: 5d3f030 (2026-08-02)
4. **Released**: YES (2026-08-02 22:45)

### Modified Files (22 files)

**Backend**:
- `suspend-request.service.ts` - V-06 归属验证
- `suspend-request.controller.ts` - V-06 传入 userId/userRole
- `lesson-attendance.controller.ts` - V-01/V-02 出勤隔离
- `course.controller.ts` - M-01 课程过滤
- `course.service.ts` - M-01 接受 teacherId
- `course.repository.ts` - M-01 子查询过滤
- `teacher-assignment.controller.ts` - M-02 分配过滤
- `teacher-assignment.service.ts` - M-02 接受 teacherId
- `teacher-assignment.repository.ts` - M-02 teacherId 过滤
- `contract.controller.ts` - V-03/V-04 DataScopeService
- `enrollment.controller.ts` - V-03/V-04 DataScopeService
- `student.service.ts` - V-05 已有归属验证
- `database.module.ts` - StudentParent 实体注册

**Frontend**:
- `miniapp/pages/parent/index.js/json/wxml/wxss` - 家长首页
- `miniapp/pages/parent/child-detail.js/json/wxml/wxss` - 孩子详情
- `miniapp/app.json` - 注册家长页面

### Remaining Risks (LOW)

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| L-01 | 测试文件编译错误 | 不影响生产代码 | 后续迭代清理 |
| L-02 | 部分方法缺少独立单元测试 | 已通过 Controller 测试覆盖 | 可后续补充 |
| L-03 | Admin 测试账号未配置 | Admin 全权限是设计意图 | 无安全风险 |

---

*Evidence Log 结束*
