# P1 扣课 rollback 台账 · 方案（A1，待 Mimo 审核）

背景：Release Freeze ACTIVE，仅 P0/P1。本方案是 2026-08-06 P1 fixes（A2 科目匹配扣课）遗留的 [Important] 产品验收项：取消出勤还课时按**科目**恢复，不是还到**原扣除的合同**。产品决策已由用户确认：
1. **精确还课**：扣课时在考勤行记录 contractId，取消时精确还到原合同；旧数据（无台账）回退按科目恢复。
2. **加重复扣课保护**：仅当考勤行 `deductedContractId` 为空时才扣课。

## 已确认的现状（file:line）

- 扣课入口：`lesson-attendance.service.ts:194-201`（recordAttendance）、`:280-290`（batchRollCall）。两者都在 `resolveLessonSubject` 后调 `deductLessonFromContract(studentCode, subject)`。
- `deductLessonFromContract`（`:335-387`）：`contractRepo.findActiveByStudentCodeAndSubject`（`contract.repository.ts:27-35`，validFrom ASC 先到期先扣）→ `remainingLessons -= 1` → 0 时 EXHAUSTED → save → 返回 `LessonDeductionResult`（`:65-71`：studentCode/contractCode/previousRemaining/newRemaining/statusChanged）。
- `cancelByLessonId`（`:456-491`）：对每个可扣状态考勤调 `rollbackLessonDeduction(record.studentCode, subject)`（`:475`），然后 `deleteByLessonId`。
- `rollbackLessonDeduction`（`:497-550`）：`findActiveByStudentCodeAndSubject` → 无则同 subject EXHAUSTED、validFrom DESC（`:510-514`）→ `remainingLessons += 1` → EXHAUSTED 恢复 ACTIVE。
- 考勤实体 `lesson-attendance.entity.ts`：无任何合同引用列；表名 `lesson_attendance`，`@Unique(['lessonId','studentCode'])`。
- 合同实体 `contract.entity.ts`：id bigint PK、contractCode、studentCode、subject、remainingLessons、status、validFrom。`contract.repository.ts:19-21` 已有 `findOneById`。
- schema：`synchronize:false`（`typeorm-cli.config.ts:16`）。新增列需 migration 文件 + dev DB 手动 ALTER（lesson.topic 先例：`1786060800000-AddLessonTopicColumn.ts` 建文件，dev 库手动 ALTER，migration 不运行）。
- e2e 跑真实 dev 库（`test/business-scenario.e2e-spec.ts`）；TypeORM SELECT 会选全部实体列 → dev DB 缺新列则全部 lesson_attendance 查询失败。
- e2e 场景 2 的 sidestep（`business-scenario.e2e-spec.ts:722-724`）是**扣课侧**缺口（合同耗尽后该扣哪个），不属于本次 rollback 侧任务，不动。

## 方案

### 1. 实体加列（`lesson-attendance.entity.ts`）

```ts
@Column({ type: 'bigint', nullable: true })
deductedContractId: number | null;
```

位置：`status` / `checkInTime` 附近（可空列，旧行为 NULL）。无 relation 定义，仅存 id。

### 2. migration 文件（新建）

`src/migrations/<ts>-AddDeductedContractIdColumn.ts`，模板照 `1786060800000-AddLessonTopicColumn.ts`：

```sql
up:   ALTER TABLE `lesson_attendance` ADD COLUMN `deductedContractId` bigint NULL;
down: ALTER TABLE `lesson_attendance` DROP COLUMN `deductedContractId`;
```

dev 库手动执行同款 ALTER（同步 `synchronize:false` 的事实）；migration 文件作为 fresh/non-dev 库的记录，不运行。

### 3. 服务层改动（`lesson-attendance.service.ts`）

1. `LessonDeductionResult`（`:65`）加 `contractId: number;`。
2. `deductLessonFromContract` 返回对象加 `contractId: contract.id`（`:380-386`）。签名不变。
3. `recordAttendance`（`:194-201`）：
   - 守卫：`isFirstCheckIn && !entity.deductedContractId && DEDUCTIBLE_STATUSES.has(...)`。
   - 捕获 result，非空时 `saved.deductedContractId = result.contractId; await this.attendanceRepo.save(saved);`（第二次保存写台账）。
   - `.catch(err => { this.logger.warn(...); return null; })` 保持扣课失败不阻断出勤。
4. `batchRollCall`（`:280-290`）：把 `studentsToDeduct` 数组改为直接遍历 `results`：
   - 对每个 `entity.status` 可扣且 `!entity.deductedContractId` 的：deduct → result 非空时 `entity.deductedContractId = result.contractId` 收进 `toLedgerSave`。
   - 循环后 `if (toLedgerSave.length) await this.attendanceRepo.saveAll(toLedgerSave)`（一次批量写台账，避免 N+1）。
   - `studentsToDeduct`（`:228/:267-269`）随之成为死代码，删除。
5. `cancelByLessonId`（`:475`）：改调 `rollbackLessonDeduction(record, subject)`（传考勤行，台账可用）。
6. `rollbackLessonDeduction`（`:497`）：签名改为 `(record: LessonAttendanceEntity, subject: Subject)`。逻辑（A3 采纳 Mimo 状态守卫）：
   - ① 台账精确恢复：`record.deductedContractId` 非空 → `contractRepo.findOneById(...)`；仅当合同存在、`studentCode` 匹配**且 status ∈ {ACTIVE, EXHAUSTED}** 才走台账恢复；否则视为无效台账 → 回退。
   - ② 回退（无台账旧数据 / 台账无效）：`findActiveByStudentCodeAndSubject` → 无则同 subject EXHAUSTED + validFrom DESC（现逻辑，保持）。**守卫理由**：`contract-status.enum.ts:1-7` 有 EXPIRED/REFUNDED/FROZEN；对 REFUNDED 合同执行 `+1` 或 EXHAUSTED→ACTIVE 恢复会复活已退费合同，污染数据。非 ACTIVE/EXHAUSTED 一律走回退，行为与现状等价。
   - ③ 恢复执行：`remainingLessons += 1`；EXHAUSTED→ACTIVE（不变）。
   - 需 import `ContractEntity`（作局部变量类型）。

### 4. 测试（`lesson-attendance.service.spec.ts`）

- 基础 mock `mockContractRepo`（`:45-49`）加 `findOneById: jest.fn().mockResolvedValue(null)`。
- `deductLessonFromContract` 用例（`:820-856`）：断言 result 含 `contractId`。
- `rollbackLessonDeduction` 用例（`:858-978`）：全部改传 mock 考勤行（`{ studentCode, deductedContractId }`）；无台账用例自然走回退分支，逻辑等价。
- 新增用例：
  - 台账精确还课：`record.deductedContractId` 有值 → `findOneById` 被调、恢复该合同、其余合同不动。
  - 台账 id 不存在 → 回退 `findActiveByStudentCodeAndSubject` + warn。
  - 台账指向他人合同 → 回退 `findActiveByStudentCodeAndSubject`。
  - 台账合同 EXHAUSTED → 恢复 ACTIVE +1。
  - 台账合同 REFUNDED/EXPIRED → 回退按科目（不复活已退费合同）。
  - `recordAttendance` 扣课成功 → `saved.deductedContractId` 已设、第二次 save 被调。
  - `recordAttendance` 已设台账 → 不重复扣课（`deductLessonFromContract` 不被调）。
  - `batchRollCall` → 台账批量写入、`saveAll` 被调。

### 5. dev 库 ALTER（验证前置）

```sql
ALTER TABLE lesson_attendance ADD COLUMN deductedContractId bigint NULL;
```

在 `EduOS` 库执行（MySQL root，`.env.dev` 凭据）。

## 可验证目标清单

| # | 行为 | 验证方式 |
|---|------|---------|
| L1 | 扣课成功时考勤行记录 deductedContractId | service.spec：recordAttendance/batchRollCall 后 saved.deductedContractId === contract.id |
| L2 | 已有台账的考勤不重复扣课 | service.spec：deductedContractId 已设时 recordAttendance 不调 deduct |
| L3 | 取消出勤精确还到原合同 | service.spec：rollback 用 record.deductedContractId 调 findOneById 并恢复该合同 |
| L4 | 台账指向他人合同 → 回退按科目 | service.spec：findOneById 返回他人合同 → 走 findActiveByStudentCodeAndSubject |
| L5 | 无台账旧数据 → 按科目回退 | service.spec：record 无 deductedContractId → 现逻辑等价（active → EXHAUSTED fallback） |
| L6 | 原合同 EXHAUSTED → 恢复 ACTIVE | service.spec：ledger 合同 EXHAUSTED，rollback 后 ACTIVE +1 |
| L7 | 台账合同非 ACTIVE/EXHAUSTED → 回退按科目 | service.spec：ledger 合同 REFUNDED/EXPIRED → 走 findActiveByStudentCodeAndSubject，不复活退费合同 |
| L8 | e2e 不回归 | business-flow 24/24 + business-scenario 32/32 GREEN（dev DB 已 ALTER；分开跑） |
| L9 | migration 存在且 build 通过 | migration 文件创建；`npm run build` exit 0 |

## 验证命令

- `cd backend && npm run build`
- `npx jest src/modules/teaching/lesson-attendance/lesson-attendance.service.spec.ts --silent`
- `npx jest src/modules/teaching/lesson-attendance/lesson-attendance.controller.spec.ts --silent`（回归）
- e2e 分开跑：`npx jest --config ./test/jest-e2e.json business-flow` / `business-scenario`
- grep guard：`grep -rn "sun123456" backend/` 应为空

## 风险与缓解

1. **schema 变更**（新 nullable 列 + dev ALTER + migration 文件）：Release Freeze 仅 P0/P1；可空列向后兼容，属 P1 正确性修复所需。dev 库 ALTER 是 e2e 前置，漏了则全部 lesson_attendance 查询失败 → 验证命令先 ALTER 再跑 e2e。
2. **考勤写入放大**：recordAttendance 第二次 save、batch 多一次 saveAll → 量级小，可接受。
3. **rollback 签名变更**影响 6 处单测 + 直接调用方（仅 cancelByLessonId）→ 机械替换，TDD 后全量跑该 spec。
4. **台账合同已删/他人**：findOneById 空或 studentCode 不符 → 回退按科目，不丢课时（防御分支 + 用例）。
5. **重复扣课保护改变行为**：仅影响「已扣课又重签」路径（当前 API 无 revert 端点，防御性）。e2e 每次签到都是新建 PENDING 记录，不受影响。
6. **e2e 并行竞态**：business-flow/business-scenario 分开跑（已知问题，非本次引入）。

## 范围外

- 不触碰 src/shared、src/kernel、src/cli、src/test-toolkit。
- 不运行 migration（只建文件 + dev 手动 ALTER，照 lesson.topic 先例；`typeorm:migration:run` 会连带跑 4 个旧 pending migration，lesson.topic 会因列已存在而失败）。
- 不动扣课侧的「合同耗尽后该扣哪个」缺口（e2e 场景 2 sidestep），另立任务。
- 不引入 token 黑名单 / 新表 / 合同 relation / FK 约束（本仓库全库无 FK，台账写路径集中在 deductLessonFromContract 两调用点，应用层保证）。
- 不做扣课时 remainingLessons 快照 / 独立 ledger 表 / Redis 幂等锁 / cancelByLessonId 事务化（详见下方 A3 处理结论，记入遗留）。

---

## A3 最终审核结论（Mimo 意见逐条处理）

**采纳：**
1. **rollback 状态守卫**（Mimo §1b/2c）：台账合同 status 非 {ACTIVE, EXHAUSTED} 时不直接恢复，回退按科目。理由：`contract-status.enum.ts:1-7` 含 EXPIRED/REFUNDED/FROZEN，对 REFUNDED 合同 `+1`/恢复会复活退费合同。已并入 §3.6 + 用例 + L7。
2. **补充测试**（Mimo §2b/2c）：台账 id 不存在、台账指向他人合同、台账合同 REFUNDED/EXPIRED 三条回退路径全覆盖。

**拒绝（附理由）：**
1. **remainingLessons 快照**（Mimo §1a）：产品决策是「精确还到原合同」而非「还原到原数值」；现状 rollback 本就是 `+1`，台账只提升合同精确度，不引入新假设。快照属中期 ledger 表范畴，本次不做。
2. **独立 `lesson_deduction_ledger` 表 + operationType + 快照 + 旧数据反向填充**（Mimo §3.1）：新实体 + repo + module 接线 + migration + 回填任务，是中期项目而非 P1 冻结期修复；「结构简洁」原则下 nullable 列是最小正确实现。**记为中期 tech-debt 遗留**。
3. **Redis/分布式锁幂等**（Mimo §3.3）：本栈无 Redis，全库无锁，单机构教培低并发；与现状一致，记遗留。
4. **cancelByLessonId 事务化**（Mimo §2e）：现状即「部分失败跳过 + 删考勤」，本次不改变，记遗留。
5. **FK 约束**（Mimo §4a）：全库无 FK，台账写路径集中在 deductLessonFromContract 两个调用点，应用层保证足够。
6. **migration:run 统一管理**（Mimo §4c）：先例（lesson.topic）即「建文件 + 手动 ALTER + 不运行」；migration:run 会连带旧 pending migration 失败。保持先例。
