# ISS-010 Evidence Report

> **Issue**: EnrollmentService 重新报名崩溃
> **Date**: 2026-07-17
> **Status**: ✅ RESOLVED

---

## Problem Analysis

### Symptom
当学生从班级退课（WITHDRAWN）后重新报名时，系统崩溃。

### Root Cause
`EnrollmentEntity` 有唯一约束 `@Unique(['classCode', 'studentCode'])`。

原代码逻辑：
```typescript
if (existing) {
  if (existing.status === EnrollmentStatus.ACTIVE) {
    throw new BadRequestException(...);
  }
  // If previous enrollment was WITHDRAWN, allow re-enrollment
}

// 创建新记录 - 导致唯一约束冲突！
const enrollment = new EnrollmentEntity();
```

当 `existing.status === WITHDRAWN` 时，代码继续创建新 EnrollmentEntity，但 `(classCode, studentCode)` 组合已存在，触发数据库唯一约束错误。

---

## Solution

**修复策略**: UPDATE 现有记录而非 INSERT 新记录。

```typescript
if (existing) {
  if (existing.status === EnrollmentStatus.ACTIVE) {
    throw new BadRequestException(...);
  }
  // UPDATE existing record instead of INSERT
  existing.status = EnrollmentStatus.ACTIVE;
  existing.contractCode = input.contractCode;
  existing.withdrawReason = null;
  existing.enrolledBy = 0;

  const saved = await this.enrollmentRepo.save(existing);
  return saved;
}
```

---

## Code Changes

| File | Change |
|:-----|:-------|
| `enrollment.service.ts` | WITHDRAWN 状态下更新现有记录而非创建新记录 |

---

## Verification

```
Test Suites: 41 passed, 41 total
Tests:       433 passed, 433 total
Status:      ✅ ALL PASS
```

---

## Evidence

- ✅ 代码修改完成
- ✅ 测试全部通过
- ✅ 逻辑正确性验证

---

*ISS-010 Resolved by Long Mission v2.0*