# P1 扣课跳过打标（contract-exhaustion deduction gap）· 方案（A1，待 Mimo 审核）

背景：Release Freeze ACTIVE，仅 P0/P1。本任务是 2026-08-06 P1 fixes 遗留的 tracked leftover「合同耗尽后该扣哪个」（e2e 场景 2.4 sidestep，`business-scenario.e2e-spec.ts:720-749`）——产品决策已由用户确认：**打标可见**（学生可扣状态出勤但无合同可扣时，考勤行打标，后端 API + 家长小程序 UI 可见；不阻断、不建欠课时台账、不发事件）。

## 已确认的现状（file:line）

- 可扣状态：`DEDUCTIBLE_STATUSES = {PRESENT, LATE, ONLINE, OFFLINE}`（`attendance-status.enum.ts:23-28`）。
- `deductLessonFromContract`（`lesson-attendance.service.ts:394-447`）：`findActiveByStudentCodeAndSubject`（`contract.repository.ts:27-35`，ACTIVE + validFrom ASC）→ 无则 warn + return null（`:404-409`）；`remainingLessons <= 0` 守卫 return null（`:412-417`）；否则 `remainingLessons -= 1`、0 时 EXHAUSTED、save、返回 `LessonDeductionResult`（`:439-446`）。
- `recordAttendance` 扣课块（`:203-224`）：守卫 `isFirstCheckIn && !entity.deductedContractId && DEDUCTIBLE_STATUSES.has(...)` → `resolveLessonSubject` → `deductLessonFromContract(...).catch(() => null)` → 有 result 写 `deductedContractId` + 二次 save。**跳过时静默**（无字段、无提示）。
- `batchRollCall` 扣课块（`:309-339`）：subject 一次解析（`:310-313`）→ 遍历可扣实体 deduct（catch→null）→ 有 result 写台账进 `ledgerUpdates` → `saveAll`。**跳过时静默**。
- `resolveLessonSubject`（`:363-381`）：class→course 链，查不到 return null + warn。
- 考勤实体（`lesson-attendance.entity.ts`）：已有 `deductedContractId`（`:60-62`，nullable bigint）。
- 家长 self/attendance 映射（`student.controller.ts:255-266`）：返回 `{id, lessonDate, ..., status}`，**无扣课字段**。`findByLessonId`/`findByStudentCode`（`lesson-attendance.service.ts:644-651`）返回实体 → TypeORM 全列 → 新列自动带出。
- DB 现状：`status` 列是 `enum('PRESENT',...)`（SHOW COLUMNS 实证）；`synchronize:false`（`typeorm-cli.config.ts:16`），加列需 migration 文件 + dev 手动 ALTER（`1786096800000-AddDeductedContractIdColumn.ts` 先例）。
- 小程序家长出勤页（`miniapp/pages/student/attendance.wxml`）：`attendance-item` 渲染日期 + 课程/班级 + 状态徽标（`attendance-status status-{{item.status}}`）。
- e2e 场景 2.4（`business-scenario.e2e-spec.ts:720-749`）：用 ABSENT 绕过「PRESENT 遇到耗尽合同」；注释（`:722-724`）写的是 A2 之前的「student-level 会扣到原合同」——**已过时**，A2 后是 subject-matched，PRESENT 在 ENGLISH 班只查 ENGLISH 合同，不会碰原 MATH 合同。

## 方案

### 1. 新枚举（新建 `enums/deduction-skip-reason.enum.ts`）

```ts
export enum DeductionSkipReason {
  NO_ACTIVE_CONTRACT = 'NO_ACTIVE_CONTRACT',
  NO_SUBJECT = 'NO_SUBJECT',
}
```

- `NO_ACTIVE_CONTRACT`：有 subject 但该科目无可扣合同（无合同 / 全 EXHAUSTED / REFUNDED 等）。
- `NO_SUBJECT`：class/course 链断裂解析不出 subject（配置错误）。

### 2. 实体加列（`lesson-attendance.entity.ts`）

`deductedContractId` 旁加：

```ts
@Column({ type: 'enum', enum: DeductionSkipReason, nullable: true })
deductionSkippedReason: DeductionSkipReason | null;
```

可空列，旧行为 NULL。无 relation。**只打一次**：扣课只在首次 check-in（守卫 `isFirstCheckIn && !deductedContractId`），打标同理，后续不补扣不清除（点快照，非流式）。

### 3. migration 文件（新建）+ dev ALTER

`src/migrations/<ts>-AddDeductionSkippedReasonColumn.ts`，照 `1786096800000-AddDeductedContractIdColumn.ts` 模板：

```sql
up:   ALTER TABLE `lesson_attendance` ADD COLUMN `deductionSkippedReason` enum('NO_ACTIVE_CONTRACT','NO_SUBJECT') NULL;
down: ALTER TABLE `lesson_attendance` DROP COLUMN `deductionSkippedReason`;
```

dev 库手动执行同款 ALTER；migration 文件作 fresh/non-dev 库记录，不 run（先例一致）。

### 4. 服务层（`lesson-attendance.service.ts`）

**`recordAttendance`（`:203-224`）**：`.catch(() => null)` 改为 `try/catch`，区分「业务跳过」（返回 null）与「异常」（catch），业务跳过才打标：

```ts
if (isFirstCheckIn && !entity.deductedContractId && DEDUCTIBLE_STATUSES.has(input.status)) {
  const subject = await this.resolveLessonSubject(entity.classCode);
  if (subject) {
    try {
      const result = await this.deductLessonFromContract(input.studentCode, subject);
      if (result) {
        saved.deductedContractId = result.contractId;
        await this.attendanceRepo.save(saved);
      } else {
        saved.deductionSkippedReason = DeductionSkipReason.NO_ACTIVE_CONTRACT;
        await this.attendanceRepo.save(saved);
      }
    } catch (err) {
      this.logger.warn(`Lesson deduction failed for student ${input.studentCode}: ${err.message}`);
    }
  } else {
    saved.deductionSkippedReason = DeductionSkipReason.NO_SUBJECT;
    await this.attendanceRepo.save(saved);
  }
}
```

**`batchRollCall`（`:309-339`）**：同构改 `try/catch`；subject 为 null → 可扣实体标 `NO_SUBJECT`；deduct 返回 null → 标 `NO_ACTIVE_CONTRACT`；`ledgerUpdates` 复用为「状态有变需 save」集合（`deductedContractId` 或 `deductionSkippedReason` 任一被设），一次 `saveAll`。

需 import `DeductionSkipReason`。

### 5. 家长 self/attendance 映射（`student.controller.ts:255-266`）

映射对象加 `deductionSkippedReason: a.deductionSkippedReason || null`。`findByLessonId`/`findByStudentCode` 返回实体自动带出，无需改。

### 6. 小程序 UI（`miniapp/pages/student/attendance.wxml` + `.wxss`）

`attendance-item` 的状态徽标旁加条件徽标：

```xml
<view wx:if="{{item.deductionSkippedReason}}" class="deduction-skip-badge">未扣课时</view>
```

`.wxss` 加 `.deduction-skip-badge`（小号橙色/琥珀标签，紧邻状态徽标）。教师端 class-detail 只算 attendanceRate、无逐学生状态行，本次不加（范围外）。

### 7. e2e 场景 2.4 更新（`business-scenario.e2e-spec.ts:720-749`）

把 ABSENT 改为 **PRESENT**，恢复被绕过的断言：

- 考勤记 PRESENT（lesson 创建成功）。
- 该考勤 `deductionSkippedReason === 'NO_ACTIVE_CONTRACT'`（查 GET lesson attendance 断言）。
- ENGLISH 小合同仍 EXHAUSTED / 0（subject-matched，`findActiveByStudentCodeAndSubject` 只认 ACTIVE）。
- 原 MATH 合同仍 ACTIVE / 8（不被误扣——A2 已保证 subject 匹配，顺带验证 A2 行为）。

删掉过时注释（`:722-725`）。

## 可验证目标清单

| # | 行为（要做什么） | 验证方式（怎么证明做对） |
|---|----------------|------------------------|
| V1 | 可扣状态 + 无合同 → 考勤行 `deductionSkippedReason = NO_ACTIVE_CONTRACT` | service.spec：recordAttendance/batchRollCall 后 saved.deductionSkippedReason === 'NO_ACTIVE_CONTRACT'，二次 save/saveAll 被调 |
| V2 | subject 解析失败 → `NO_SUBJECT` | service.spec：resolveLessonSubject 返回 null → NO_SUBJECT 被设 |
| V3 | 扣课成功 / 非可扣状态 / 已扣过 → 不打标 | service.spec：三者 deductionSkippedReason 为 null；已设 deductedContractId 不重复 deduct |
| V4 | deduct 抛异常 → 不打标（catch 只 warn） | service.spec：mock deduct reject → 无 flag、无 save 写 flag |
| V5 | 实体列 + migration + dev ALTER | build exit 0；dev DB SHOW COLUMNS 含 deductionSkippedReason |
| V6 | 家长 self/attendance 返回 deductionSkippedReason | student.controller.spec / e2e：映射含字段 |
| V7 | 小程序家长出勤页显示「未扣课时」徽标 | wxml 条件渲染 + wxss；手动/截图验证 |
| V8 | e2e 场景 2.4 更新为 PRESENT 并断言 flag + 合同不动 | business-scenario 32/32 + business-flow 24/24 GREEN（先 scenario 后 flow，分开跑） |
| V9 | 全量回归 | unit suite + build exit 0；grep guard 变更文件 CLEAN |

## 验证命令

- `cd backend && npm run build`
- `npx jest src/modules/teaching/lesson-attendance/lesson-attendance.service.spec.ts --silent`
- `npx jest src/modules/teaching/lesson-attendance/lesson-attendance.controller.spec.ts --silent`（回归）
- `npx jest src/modules/student/student.controller.spec.ts --silent`（回归，self/attendance 映射）
- e2e 分开跑：`npx jest --config ./test/jest-e2e.json business-scenario` 再 `business-flow`（先 scenario 后 flow，已知跨套件污染见记忆）
- grep guard：`grep -n "sun123456"` 变更文件应空

## 风险与缓解

1. **schema 变更**（新可空 enum 列 + dev ALTER + migration 文件）：向后兼容，P1 正确性所需；e2e 前置 ALTER。
2. **recordAttendance/batchRollCall 二次写放大**：与 `deductedContractId` 台账同一路径，量级不变，可接受。
3. **`.catch`→`try/catch` 语义变化**：原本异常与业务跳过同返 null；改后异常不打标。是修复而非回归（异常本就该由 logger 记录，业务跳过才该打标）。影响 6 处既有单测的 mock 形态，TDD 后全量跑 spec。
4. **e2e 场景 2.4 断言改动**：A2 后 subject-matched 保证原合同不被扣（已实证 `contract.repository.ts:27-35`）；删过时注释。
5. **打标不自动清除**：扣课只在首次 check-in，打标即点快照；后续加合同不回溯（超 P1 冻结范围，记遗留）。

## 范围外

- 不触碰 src/shared、src/kernel、src/cli、src/test-toolkit。
- 不运行 migration（只建文件 + dev 手动 ALTER，先例一致）。
- 不做欠课时台账 / 补扣 / 事件提醒 / 阻断签到（产品已选打标可见）。
- 教师端 class-detail 无逐学生状态行，不加徽标（本次家长/学生端即可见）。
- 不引入 Redis/锁/事务化/FK（现状即无，与上一计划一致）。
