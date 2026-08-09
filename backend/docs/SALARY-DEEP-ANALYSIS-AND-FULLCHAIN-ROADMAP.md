# 教师工资结算深度分析：行业规则 + 全链路接口预留

> 分析时间：2026-08-09
> 定位：后期拓展模块的前置设计文档。P1 至 P4 为规划契约；**P0 已于 2026-08-09 按 TDD 落地**（G1、G5 语义修正），下文相应行已标 ✅。
> 前文：本文与 `SALARY-MODEL-DESIGN.md`、`SALARY-DATABASE-DESIGN.md`、`SALARY-CALCULATION-DESIGN.md`、`SALARY-API-DESIGN.md` 一脉相承，是在其基础上对**行业规则覆盖度**与**全链路扩展接口**的补全。

---

## 一、现状盘点（证据）

### 1.1 已实现的薪资能力

| 能力 | 载体 | 证据 |
|------|------|------|
| 8 种规则类型 | `SalaryRuleType` | `src/modules/salary/enums/salary.enums.ts:15` |
| 规则精确匹配（courseType/teacherLevel 打分 0-4） | `scoreRule` | `services/salary-calculator.service.ts:121` |
| 课时费计算（纯函数，可单测） | `computeLessonFee` | `services/salary-calculator.service.ts:57` |
| 月度结算（幂等，先查重再插） | `SalarySettlementService.settle` | `services/salary-settlement.service.ts:69` |
| 每课明细 + 底薪/按天/绩效聚合（`DEDUCTION` 枚举保留，生成能力由 P3 以教师维度重引入） | `SalaryRecordSource` | `entities/salary-record.entity.ts:57` / `enums/salary.enums.ts:35` |
| 无规则兜底（needsReview 不静默丢失） | `needsReview` | `services/salary-settlement.service.ts:179` |
| 规则快照 + 计算过程审计 | `detail` JSON + `ruleVersion` | `entities/salary-record.entity.ts:92` / `services/salary-settlement.service.ts:392` |
| 状态机 PENDING→APPROVED→PAID，PAID 锁定 | `SalaryRecordStatus` | `salary.service.ts:146` |
| 规则有效期 | `effectiveFrom/effectiveTo` | `dto/salary-rule-config.dto.ts:160` |
| 教师自查 / 管理员全查 + 统计 | controller | `salary.controller.ts:40` `salary.controller.ts:60` |
| 幂等唯一索引 | `uk_salary_record_teacher_month_source_lesson` | `migrations/1786500000000-AddSalaryConfigColumns.ts:41` |

### 1.2 已识别缺口（证据 + 严重度）

| # | 缺口 | 证据 | 影响 | 严重度 |
|---|------|------|------|--------|
| G1 | `MONTHLY`、`PER_DAY` 在计算器里落到 `unsupported-type`（amount=0） | 旧证据：`salary-calculator.service.ts:64/107` | ✅ **P0 已修复（2026-08-09）**：结算层跳过 PER_DAY/MONTHLY 的单课 LESSON_FEE（`salary-settlement.service.ts:192`），由 BASE/DAY 聚合记录承载，不再产生 0 元明细 | ✅ |
| G2 | 无自动结算调度，只能手动 `POST /salary/settle` | 全模块无 `@Cron`/`@Interval`（grep 确认） | 每月需人工触发，易漏 | 🟡 |
| G3 | 无结算窗口锁定 | `settle` 每次全量重算当月；PAID 后仍可能被课时/考勤回流影响 | 历史数据可被补录篡改语义 | 🔴 |
| G4 | 无调整项（补发/追扣） | `SalaryRecordSource` 无 ADJUSTMENT | 上月漏发/多发无法留痕修正 | 🟡 |
| G5 | 扣款语义偏差：`lateCount/absentCount` 统计的是**学生**迟到/缺勤记录（lesson_attendance 为逐学生记录） | 旧证据：`salary-settlement.service.ts` 的 DEDUCTION 块（已删除） | ✅ **P0 已修复（2026-08-09）**：移除学生考勤代理扣款，不再生成 DEDUCTION 记录；教师维度扣款由 P3 `teacherLateDeduction`/`teacherAbsentDeduction` 引入 | ✅ |
| G6 | 缺行业规则：取消课保底、试听课不计费/半价、续费/转介绍提成、教师请假扣款 | `SalaryRuleConfigDto` 无对应字段 | 覆盖不到常见的激励/约束场景 | 🟡 |
| G7 | 无发放链：个税/社保、工资条、银行代发、发放批次 | 无 `salary_payroll`/`salary_slip`/税字段 | PAID 后没有发放载体 | 🔴 |
| G8 | 教师薪资档案单薄 | `user.entity.ts:52` 仅 `teacherLevel`，无 hireDate/聘用形式/薪资卡/社保 | 规则匹配与发放缺基础档案 | 🟡 |

---

## 二、行业规则深度分析（教培行业薪酬惯例）

### 2.1 主流薪酬模式 → 现有覆盖度映射

| 行业模式 | 典型适用 | 行业计算公式 | 现有规则类型 | 覆盖度 |
|----------|----------|--------------|--------------|--------|
| 纯课时费 | 兼职/外聘 | 单课时单价 × 完成课时数 | `PER_LESSON`/`PART_TIME`/`OUTING` | ✅ 完整 |
| 底薪 + 课时费 | 全职 | 底薪 + 单价 × 课时数 | `config.baseSalary` + `PER_LESSON` | ✅ 完整 |
| 底薪 + 阶梯课时费 | 激励型 | 底薪 + Σ(各档课时 × 档单价) | `TIER` | ✅ 完整（边际档模型，与设计文档一致） |
| 按人头发费 | 班课/一对多 | 到课人数 × 每人单价 | `PER_HEAD` | ✅ 完整 |
| 按天/场次 | 外出课/短期营 | 每天固定费用 | `PER_DAY` | ✅ P0 已修复：仅按天 DAY 记录，无 0 元明细 |
| 固定月薪 | 管理岗/助教 | 每月固定金额 | `MONTHLY` | ✅ P0 已修复：仅 1 条 BASE 记录，无 0 元明细 |
| 提成/分成 | 平台/合伙型 | 学费收入 × 比例，或续费/转介绍提成 | ❌ 无 | 🔴 缺口（G6） |

### 2.2 行业关键惯例 → 能力映射

| 行业惯例 | 说明 | 现有能力 | 扩展点 |
|----------|------|----------|--------|
| 课耗计薪 | 以**实际上课核销**（FINISHED）计薪，非排课 | ✅ `settle` 只取 `status=FINISHED`（`salary-settlement.service.ts:73`） | — |
| 课耗与续费联动 | 教师续费提成次月发放，与当月结算分离 | ❌ | 新 `source=COMMISSION` + Contract/Renewal 数据源 |
| 取消课保底费 | 机构当天临时取消，教师仍得 50%-100% 保底 | ❌ | `config.cancelGuarantee`（按取消提前量分级） |
| 试听/体验课 | 试听课不计费或半价 | ❌ | `config.trialPolicy`（`free`/`half`/按课型） |
| 补课（MAKEUP） | 学生缺课补课教师照常计费 | ✅ `lesson.isMakeup` 可读 | 补课可配不同单价 |
| 满勤/全勤奖 | 全月无迟到、无请假、到课率达标 | ✅ `bonus.fullAttendance`（`salary-settlement.service.ts:313`） | 与请假/异常联动 |
| 课时目标奖 | 当月课时达阈值奖励 | ✅ `bonus.lessonTarget` | — |
| 教师迟到/缺课扣款 | 按教师维度扣 | ❌ P0 已移除学生考勤代理错误语义（G5） | P3：`teacherAttendance` 数据源（请假/异常模块关联）+ `teacherLateDeduction`/`teacherAbsentDeduction` |
| 法定节假日/调休 | 影响计薪工作日 | ❌ | 工作日历配置 |
| 发放周期 | 次月发上月工资，核算窗口 | ✅ 按 `month` 结算 | 窗口锁定（G3）+ 自动调度（G2） |
| 工资条 | 教师可见明细（课时/单价/底薪/奖罚/实发） | ✅ `my-records` 已按人隔离 | 生成 H5/PDF + 微信订阅推送 |
| 个税/社保（全职） | 税前/税后、五险一金代扣 | ❌ | `grossAmount/taxAmount/netAmount` 字段 + 代扣规则 |
| 调整项 | 补发/追扣上月 | ❌ | `source=ADJUSTMENT`（G4） |
| 离职结算 | 离职当月结算到离职日 | ❌ | `settle` 加 `effectiveTo` 截断 + 教师档案 hireDate/resignDate |
| 多校区隔离 | 规则与成本按校区统计 | 🟡 `User.campusId` 存在（`user.entity.ts:63`），salary 未用 | 规则加 `campusId`，报表按校区聚合 |
| 薪资保密 | 教师只见自己 | ✅ `my-records` 强制 `teacherId=req.user.sub`（`salary.controller.ts:45`） | — |
| 历史规则快照 | 改规则不影响已结算月份 | ✅ `ruleSnapshot` + `ruleVersion` | — |

### 2.3 结论：现有系统的架构骨架是行业级、可扩展的

- 规则引擎（type + config JSON + 精确匹配打分）+ 幂等结算 + 快照审计 + needsReview 兜底 + 状态机，四件套**完整**，扩行业规则是**加枚举值/加 config 字段/加 switch 分支**，不改骨架。
- 真正的缺口集中在**发放链（G7）**与**上游数据源（续费提成、教师考勤、取消保底）**，这两块需要新表与新接口，本文第四节给出预留形态。

---

## 三、目标架构：全链路数据流（分层）

```
┌─ 上游数据源层 ────────────────────────────────────────────────┐
│  User.teacherLevel/档案(hireDate·聘用形式·薪资卡·社保)         │  ← 待扩展
│  TeacherAssignment（PRIMARY/SUBSTITUTE/ASSISTANT 角色）        │
│  Lesson.status=FINISHED（课耗·计薪驱动）                       │
│  LessonAttendance（出勤 → 满勤/绩效）                          │
│  Course.type / Course.price（课型单价·提成基数）               │
│  Contract / Renewal（续费 → 提成）                            │  ← 待扩展
│  Exception / Leave（教师请假 → 扣款/不计费）                  │  ← 待扩展
└───────────────┬───────────────────────────────────────────────┘
                ▼
┌─ 规则配置层 ──────────────────────────────────────────────────┐
│  SalaryRule（type + config + courseType/teacherLevel + 有效期）│
│  + 待扩展：取消保底 · 试听 · 提成 · 教师扣款 · 工作日历         │
└───────────────┬───────────────────────────────────────────────┘
                ▼
┌─ 结算引擎层 ──────────────────────────────────────────────────┐
│  SalarySettlementService.settle(month, teacherId)（幂等）      │
│  + 待扩展：dry-run 试算 · 自动调度 Cron · 窗口锁定 · 离职截断    │
└───────────────┬───────────────────────────────────────────────┘
                ▼
┌─ 记录层 ──────────────────────────────────────────────────────┐
│  SalaryRecord（LESSON_FEE/BASE/DAY/BONUS/DEDUCTION + detail）  │
│  + 待扩展：ADJUSTMENT · COMMISSION · gross/net/tax · campusId  │
└───────────────┬───────────────────────────────────────────────┘
                ▼
┌─ 审批与发放层 ────────────────────────────────────────────────┐
│  PENDING → APPROVED → PAID（PAID 锁定）                       │
│  + 待扩展：工资条 · 发放批次 · 银行代发导出                    │
└───────────────┬───────────────────────────────────────────────┘
                ▼
┌─ 消费层 ──────────────────────────────────────────────────────┐
│  教师端 my-records / my-statistics（已有）                    │
│  管理端 records / statistics / rules / settle（已有）         │
│  + 待扩展：工资条 · 人力成本报表 · 课耗核对 · 按校区统计        │
└───────────────────────────────────────────────────────────────┘
```

---

## 四、全链路接口预留清单

原则：**现有接口保持稳定不改语义**；扩展一律**新增端点/新增枚举值/新增可空字段**，全部 additive，不破坏已结算数据。

### 4.1 现有接口（已实现，作为全链路的稳定地基，勿破坏）

| 方法 | 路径 | 角色 | 职责 |
|------|------|------|------|
| GET | `/salary/rules` | 全 | 规则列表（可 `activeOnly`） |
| POST/PUT/DELETE | `/salary/rules[/:id]` | Admin/SuperAdmin | 规则 CRUD（软删） |
| POST | `/salary/settle` | Admin/SuperAdmin | 手动月度结算（幂等） |
| GET | `/salary/records` / `/salary/my-records` | Admin / Teacher | 记录查询（teacherId 隔离） |
| GET | `/salary/statistics` / `/salary/my-statistics` | Admin / Teacher | 月度统计 |
| PUT | `/salary/records/:id/status` | Admin/SuperAdmin | 审批流转 |

### 4.2 预留扩展接口（形态先定，不落实现）

**结算引擎层：**

| 方法 | 路径 | 职责 |
|------|------|------|
| POST | `/salary/settle/preview` | dry-run 试算：只算不落库，返回待生成明细，供核算前核对。`SettleDto` 加 `dryRun:boolean` 即可复用 |
| POST | `/salary/settle/:month/lock` / `unlock` | 锁定结算窗口：锁定后该月补录课时/改考勤 → 标记差异（见 4.3 reconciliation），不直接改已结算记录 |
| POST | `/salary/settle/auto` | 开关自动结算（内部 Cron 触发 `settle`，默认关闭） |

**记录与调整层：**

| 方法 | 路径 | 职责 |
|------|------|------|
| POST | `/salary/records/:id/adjust` | 对已结算记录追加调整项（补发/追扣），写 `source=ADJUSTMENT`，不改原记录（保留审计） |
| GET | `/salary/reports/lesson-reconciliation?month=` | 应排课 vs 已结算课 vs 异常（课时/考勤回流差异检测，支撑 G3 锁定） |

**发放与报表层：**

| 方法 | 路径 | 职责 |
|------|------|------|
| PUT | `/salary/teachers/:id/payment-info` | 维护教师薪资档案（卡号/户名/聘用形式/社保基数），补齐 G8 |
| GET | `/salary/slips/:month` (Teacher) / `/salary/slips?month=` (Admin) | 工资条（H5/PDF），教师仅本人 |
| POST | `/salary/payroll/batch` | 按月份把 APPROVED → PAID，生成发放批次号（新增 `salary_payroll` 表） |
| GET | `/salary/payroll/:month/export?format=csv` | 银行代发文件导出 |
| GET | `/salary/reports/cost?year=&month=&campusId=` | 人力成本聚合报表（按月/校区/课型） |

### 4.3 预留枚举 / 字段 / 表（additive）

**枚举：**
- `SalaryRecordSource` 增加：`ADJUSTMENT`（调整项）、`COMMISSION`（提成）、`REIMBURSEMENT`（报销）。`salary.enums.ts:35`
- `SalaryRuleType` 已含 8 种，未来可加 `SPLIT`（分成）等。`salary.enums.ts:15`

**`salary_record` 表新增可空字段（全部 `NULL` 默认，不迁改已有数据）：**
`campusId`、`grossAmount`（应发）、`taxAmount`（个税）、`netAmount`（实发）、`paidAt`、`payrollBatchId`、`settleBatchId`

**新增表：**
`teacher_payment_info`（教师薪资档案）、`salary_payroll`（发放批次）、`salary_slip`（工资条）、`salary_adjustment`（调整项）

**`SalaryRuleConfigDto` 新增可选字段（`salary-rule-config.dto.ts` 加可选属性 + `validateRuleConfig` 加对应 `assertNumber`/分支即可）：**
`cancelGuarantee`（取消课保底，按取消提前量）、`trialPolicy`（试听 free/half）、`commissionRate`（续费/转介绍提成率）、`teacherLateDeduction`/`teacherAbsentDeduction`（教师维度扣款）

### 4.4 现有代码里已预留的扩展钩子

| 钩子 | 位置 | 怎么接 |
|------|------|--------|
| `computeLessonFee` 的 switch | `salary-calculator.service.ts:64` | 新增规则类型加一个 case（纯函数，无副作用） |
| `scoreRule` 打分 | `salary-calculator.service.ts:121` | 加新匹配维度（如 campusId、课程大类）只加一个计分条件 |
| `settle` 幂等 key | `salary-settlement.service.ts:381` | 新 `source` 复用 `recordKey`，天然防重 |
| `detail` JSON 审计 | `entities/salary-record.entity.ts:92` | 任何新计算字段直接进 JSON，无需改表 |
| `needsReview` 兜底 | `salary-settlement.service.ts:179` | "规则没配全也能先跑"，异常不静默丢失 |
| DTO + config 强校验 | `salary-rule-config.dto.ts` / `rule-config.util.ts` | 每个新字段加 `assertNumber`/`assertTiers` |

---

## 五、扩展实现路线图（分期，每期自含可验证目标）

> 每期内部按 TDD 推进（先失败测试 → 最小实现）。当前为规划，**未获确认前不写代码**。

| 期 | 内容 | 关闭的缺口 | 可验证目标（示例） |
|----|------|-----------|-------------------|
| P0 | **补全现有 8 类型语义**：MONTHLY/PER_DAY 不再产生 0 元 LESSON_FEE 明细；移除学生考勤代理扣款（教师维度扣款由 P3 引入） | G1、G5 | ✅ **已完成（2026-08-09）**：MONTHLY 教师当月 = 1 条 BASE 记录、0 条明细；PER_DAY 教师 = 按天 DAY 记录、0 条 0 元明细；学生 LATE/ABSENT 不再生成 DEDUCTION |
| P1 | **结算工程化**：dry-run 试算 + 自动调度 Cron + 窗口锁定 + 课耗核对 | G2、G3 | `settle` 加 dryRun 参数不落库；月定时任务自动结算；锁定月补录课时 → reconciliation 报差异 |
| P2 | **调整项 + 教师薪资档案**：ADJUSTMENT 记录、teacher_payment_info | G4、G8 | 对已结算记录追加调整项不改原记录；档案维护接口读写正确 |
| P3 | **行业规则扩展**：取消课保底、试听 policy、教师请假扣款（关联 Exception/Leave）、提成（关联 Contract/Renewal） | G6 | 各新 config 字段校验通过；试听不计费/半价正确；提成次月结算 |
| P4 | **发放链**：gross/tax/net、工资条、发放批次、银行代发导出、人力成本报表 | G7 | 发放批次幂等；工资条教师仅本人；导出文件列正确 |

---

## 六、风险与治理

| 风险 | 治理 |
|------|------|
| 历史规则变更影响已结算月份 | 已用 `ruleSnapshot`+`ruleVersion` 锁定（现状满足）；PAID 后禁止改规则语义 |
| 结算后课时/考勤回流改工资 | P1 窗口锁定 + reconciliation 差异检测，锁定月差异走调整项而非改原记录 |
| MONTHLY/PER_DAY 明细 0 元记录污染统计 | ✅ P0 已修复（结算层不再生成）；统计口径按 source 过滤仍有效 |
| 扣款语义（学生 vs 教师考勤）被误读 | ✅ P0 已移除错误语义；P3 新扣款走教师维度 |
| 薪资敏感数据越权 | 现有 `my-records` 强制 `teacherId=req.user.sub`（`salary.controller.ts:45`）；新增接口一律沿用 `req.user.sub` + DataScope 校验 |
| 金额精度 | 全链路 `decimal(10,2)`，计算 `round2`；发放/税字段同精度 |

---

## 七、结论

1. **骨架已行业级**：规则引擎 + 幂等结算 + 快照审计 + needsReview + 状态机，无需重做。
2. **四大缺口**：结算工程化（G2/G3）、调整项与档案（G4/G8）、行业规则扩展（G6）、发放链（G7）。
3. **全链路接口已预留**：现有 8 个端点作为稳定地基；新增 11 个端点 + 4 个枚举值 + 7 个表字段 + 4 张新表，全部 additive。
4. **下一步**：本文档确认后，按 P0 → P4 分期 TDD 实施；每期自含可验证目标，验收后再进下一期。
