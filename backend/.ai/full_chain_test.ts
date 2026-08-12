/**
 * 全链路集成测试：教师端扣课 → 月度结算(工资记录) → 工资条 → 发放批次(管理端结算) → 发放联动 → PAID 锁定
 *
 * 在隔离测试库 EduOS_chain_test 中真实建表(synchronize) + 真实服务类跑通，
 * 验证金额在每一环正确传递。跑完自动删库，不碰开发/生产数据。
 *
 * 运行：cd backend && node -r ts-node/register/transpile-only -r tsconfig-paths/register .ai/full_chain_test.ts
 */
import 'reflect-metadata';
import * as mysql from 'mysql2/promise';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { User, UserStatus } from '@modules/identity/entities/user.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonStatus } from '@modules/teaching/lesson/enums/lesson-status.enum';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { AttendanceWorkflowState } from '@modules/teaching/lesson-attendance/enums/attendance-workflow-state.enum';
import { AttendanceSource } from '@modules/teaching/lesson-attendance/enums/attendance-source.enum';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Subject } from '@common/enums/subject.enum';
import { CourseType } from '@modules/teaching/course/enums/course-type.enum';
import { CourseStatus } from '@modules/teaching/course/enums/course-status.enum';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { SalaryRuleEntity } from '@modules/salary/entities/salary-rule.entity';
import { TeacherSalaryProfileEntity } from '@modules/salary/entities/teacher-salary-profile.entity';
import { OutingRecordEntity } from '@modules/salary/entities/outing-record.entity';
import { SalarySlipEntity } from '@modules/salary/entities/salary-slip.entity';
import { SalaryPayrollEntity, PayrollStatus } from '@modules/salary/entities/salary-payroll.entity';
import { SalaryConfigEntity } from '@modules/salary/entities/salary-config.entity';
import { SalaryTaxPolicyEntity } from '@modules/salary/entities/salary-tax-policy.entity';
import { SalaryInsurancePolicyEntity } from '@modules/salary/entities/salary-insurance-policy.entity';
import {
  SalaryRuleType,
  SalaryRecordStatus,
  TeacherEmploymentType,
} from '@modules/salary/enums/salary.enums';
import { SalarySettlementService } from '@modules/salary/services/salary-settlement.service';
import { SalarySlipService } from '@modules/salary/services/salary-slip.service';
import { SalaryPayrollService } from '@modules/salary/services/salary-payroll.service';
import { SalaryConfigService } from '@modules/salary/services/salary-config.service';
import { TaxPolicyService } from '@modules/salary/services/tax-policy.service';
import { InsurancePolicyService } from '@modules/salary/services/insurance-policy.service';
import { ExcelWriter } from '@modules/export/utils/excel-writer.util';

const DB_NAME = 'EduOS_chain_test';
const DB = { host: 'localhost', port: 3306, user: 'root', password: 'root' };
const MONTH = '2026-08';
const SID = Date.now() % 100000;

const ENTITIES = [
  User,
  LessonEntity,
  LessonAttendanceEntity,
  CourseEntity,
  SalaryRecordEntity,
  SalaryRuleEntity,
  TeacherSalaryProfileEntity,
  OutingRecordEntity,
  SalarySlipEntity,
  SalaryPayrollEntity,
  SalaryConfigEntity,
  SalaryTaxPolicyEntity,
  SalaryInsurancePolicyEntity,
];

let passCount = 0;
let failCount = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log(`  ✅ ${name}`);
  } else {
    failCount++;
    console.error(`  ❌ ${name}`, detail === undefined ? '' : JSON.stringify(detail));
  }
}
function ok(name: string) {
  passCount++;
  console.log(`  ✅ ${name}`);
}

async function db(sql: string) {
  const c = await mysql.createConnection(DB);
  await c.query(sql);
  await c.end();
}

async function main() {
  await db(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await db(
    `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );

  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'mysql',
        host: DB.host,
        port: DB.port,
        username: DB.user,
        password: DB.password,
        database: DB_NAME,
        charset: 'utf8mb4',
        synchronize: true,
        entities: ENTITIES,
      }),
      TypeOrmModule.forFeature(ENTITIES),
    ],
    providers: [
      SalarySettlementService,
      SalarySlipService,
      SalaryPayrollService,
      SalaryConfigService,
      TaxPolicyService,
      InsurancePolicyService,
      ExcelWriter,
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  const userRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));
  const lessonRepo = moduleRef.get<Repository<LessonEntity>>(getRepositoryToken(LessonEntity));
  const attRepo = moduleRef.get<Repository<LessonAttendanceEntity>>(getRepositoryToken(LessonAttendanceEntity));
  const courseRepo = moduleRef.get<Repository<CourseEntity>>(getRepositoryToken(CourseEntity));
  const profileRepo = moduleRef.get<Repository<TeacherSalaryProfileEntity>>(getRepositoryToken(TeacherSalaryProfileEntity));
  const configRepo = moduleRef.get<Repository<SalaryConfigEntity>>(getRepositoryToken(SalaryConfigEntity));
  const taxRepo = moduleRef.get<Repository<SalaryTaxPolicyEntity>>(getRepositoryToken(SalaryTaxPolicyEntity));
  const insRepo = moduleRef.get<Repository<SalaryInsurancePolicyEntity>>(getRepositoryToken(SalaryInsurancePolicyEntity));
  const recordRepo = moduleRef.get<Repository<SalaryRecordEntity>>(getRepositoryToken(SalaryRecordEntity));
  const slipRepo = moduleRef.get<Repository<SalarySlipEntity>>(getRepositoryToken(SalarySlipEntity));
  const payrollRepo = moduleRef.get<Repository<SalaryPayrollEntity>>(getRepositoryToken(SalaryPayrollEntity));

  const settleSvc = moduleRef.get(SalarySettlementService);
  const slipSvc = moduleRef.get(SalarySlipService);
  const payrollSvc = moduleRef.get(SalaryPayrollService);
  const configSvc = moduleRef.get(SalaryConfigService);

  // ─── 0. 数据准备（模拟教师端扣课结果） ───
  console.log('\n[0] 造数：开关 OFF + 教师/课程/6 节 FINISHED 课 + 出勤(PRESENT×2) + 薪资档案');
  await configRepo.save(configRepo.create({ id: 1, enabled: false, createdBy: 1 }));
  const teacher = await userRepo.save(userRepo.create({
    username: `chain_teacher_${SID}`, mobile: `13${String(SID).padStart(9, '0')}`,
    password: 'x', name: '链测老师', role: 'Teacher', status: UserStatus.ACTIVE,
    teacherLevel: '初级', campusId: 0,
  }));
  const teacherId = Number(teacher.id);
  await courseRepo.save(courseRepo.create({
    courseCode: `CHAIN${SID}`, name: '链测课程', subject: Subject.MATH, type: CourseType.GROUP,
    totalHours: 40, totalLessons: 20, defaultDuration: 45, status: CourseStatus.DRAFT, createdBy: 1,
  }));

  // 6 节教师端扣课课（真实输入是 SCHEDULED，POST /lessons 自动转 FINISHED）+ 每节 2 名 PRESENT 学生（DEDUCTIBLE）
  const classCode = `CLSCHAIN${SID}`;
  const lessonIds: number[] = [];
  for (let i = 0; i < 6; i++) {
    const day = String(4 + i).padStart(2, '0');
    const lesson = await lessonRepo.save(lessonRepo.create({
      classCode, courseCode: `CHAIN${SID}`, lessonNumber: i + 1, status: LessonStatus.SCHEDULED,
      source: 'ADMIN_MANUAL' as never, scheduledDate: `2026-08-${day}`,
      startTime: '09:00', endTime: '10:30', teacherId, createdBy: 1,
    }));
    lessonIds.push(Number(lesson.id));
    for (const sc of [`S${SID}A`, `S${SID}B`]) {
      await attRepo.save(attRepo.create({
        lessonId: Number(lesson.id), studentCode: sc, classCode, teacherId,
        workflowState: AttendanceWorkflowState.CHECKED_IN, status: 'PRESENT' as never,
        source: AttendanceSource.API, operator: teacherId, createdBy: teacherId,
      }));
    }
  }

  // ─── 断点验证：教师端扣课原始状态 SCHEDULED 不进入工资结算 ───
  console.log('\n[0b] 断点：扣课课时原始为 SCHEDULED，settle 应跳过（修复后 POST /lessons 自动转 FINISHED）');
  const settleGap = await settleSvc.settle(MONTH, teacherId, 1);
  check('修复前断点：SCHEDULED 课时 settle lessons=0 created=0', settleGap.lessons === 0 && settleGap.created === 0, settleGap);
  // 修复：POST /lessons 扣课提交后 lesson.service.updateStatus(lesson.id, FINISHED)
  await lessonRepo.update({ id: In(lessonIds) }, { status: LessonStatus.FINISHED });
  ok('修复生效：扣课课时已转 FINISHED，进入工资结算链路');
  await profileRepo.save(profileRepo.create({
    teacherId, employmentType: TeacherEmploymentType.FULL_TIME, ruleType: SalaryRuleType.PER_LESSON,
    salaryConfig: { lessonPrice: 200, baseSalary: 8000, minLessonForBase: 5 },
    allowances: [{ type: 'COMMUTING', name: '交通补贴', amount: 300 }],
    deductions: [{ type: 'LEAVE', name: '请假扣款', amount: 200 }],
    city: '宁波', socialBase: 5000,
    socialRatios: { pension: 0.08, medical: 0.005, unemployment: 0.002, housingFund: 0.05 },
    effectiveFrom: '2026-01-01', isActive: true, createdBy: 1,
  }));
  await taxRepo.save(taxRepo.create({
    name: '2026 个税', effectiveFrom: '2026-08-01',
    brackets: [
      { min: 0, max: 3000, rate: 0.03, quickDeduction: 0 },
      { min: 3000, max: 12000, rate: 0.1, quickDeduction: 210 },
    ], createdBy: 1,
  }));
  await insRepo.save(insRepo.create({
    city: '宁波', name: '宁波 2026', effectiveFrom: '2026-08-01',
    ratios: { pension: 0.08, medical: 0.005, unemployment: 0.002, housingFund: 0.05 },
    createdBy: 1,
  }));

  // ─── 1. 月度结算：扣课(FINISHED+出勤) → 工资记录 ───
  console.log('\n[1] POST /salary/settle（月度结算生成工资记录）');
  const settleRes = await settleSvc.settle(MONTH, teacherId, 1);
  check('settle created=9（6×课时费 + 底薪 + 津贴 + 扣款）', settleRes.created === 9, settleRes);
  check('settle lessons=6', settleRes.lessons === 6, settleRes);

  const records = await recordRepo.find({ where: { teacherId, month: MONTH } });
  const bySource = new Map<string, SalaryRecordEntity[]>();
  for (const r of records) {
    const arr = bySource.get(r.source as string) ?? [];
    arr.push(r);
    bySource.set(r.source as string, arr);
  }
  const lessonFee = bySource.get('LESSON_FEE') ?? [];
  const base = bySource.get('BASE') ?? [];
  const allowance = bySource.get('ALLOWANCE') ?? [];
  const deduction = bySource.get('DEDUCTION') ?? [];
  check('课时费 6 条 × ¥200 = 1200', lessonFee.length === 6 && lessonFee.reduce((s, r) => s + Number(r.amount), 0) === 1200, lessonFee.map((r) => ({ amt: r.amount, stu: r.studentCount, dur: r.duration })));
  check('课时费带出勤人数 studentCount=2', lessonFee.every((r) => r.studentCount === 2));
  check('课时费带课时长 duration=90', lessonFee.every((r) => r.duration === 90));
  check('底薪 1 条 ¥8000（≥minLessonForBase）', base.length === 1 && Number(base[0].amount) === 8000, base.map((r) => r.amount));
  check('津贴 1 条 ¥300', allowance.length === 1 && Number(allowance[0].amount) === 300, allowance.map((r) => ({ amt: r.amount, detail: r.detail })));
  check('扣款 1 条 -¥200（负数）', deduction.length === 1 && Number(deduction[0].amount) === -200, deduction.map((r) => r.amount));
  const alDetail = allowance[0]?.detail as { items?: { name?: string; amount?: number }[] };
  const deDetail = deduction[0]?.detail as { items?: { name?: string; amount?: number }[] };
  console.log('  DEBUG alDetail.items =', JSON.stringify(alDetail?.items));
  console.log('  DEBUG deDetail.items =', JSON.stringify(deDetail?.items));
  check('津贴子项落库 [交通补贴300]', alDetail?.items?.length === 1 && alDetail.items[0].name === '交通补贴' && alDetail.items[0].amount === 300 && alDetail.items[0].type === 'COMMUTING');
  check('扣款子项落库 [请假扣款200]', deDetail?.items?.length === 1 && deDetail.items[0].name === '请假扣款' && deDetail.items[0].amount === 200 && deDetail.items[0].type === 'LEAVE');
  check('全部 PENDING', records.every((r) => r.status === SalaryRecordStatus.PENDING));
  check('幂等：重复 settle 不重复建', (await settleSvc.settle(MONTH, teacherId, 1)).created === 0);

  // ─── 2. 工资条试算 + 生成（开关 OFF → 实发=应发） ───
  console.log('\n[2] POST /salary/slips/preview + generate（开关 OFF）');
  const prevOff = await slipSvc.preview(MONTH, teacherId);
  const off = prevOff.slips[0];
  check('应发 gross=9300（8000+1200+300-200）', off.grossAmount === 9300, off.grossAmount);
  check('开关 OFF 不扣社保/个税 social=0 tax=0', off.socialAmount === 0 && off.taxAmount === 0, off);
  check('实发 net=9300（=应发）', off.netAmount === 9300, off.netAmount);
  const offDetail = off.detail as { breakdown?: { source: string; amount: number; items: { name: string; amount: number }[] }[] };
  const bdBase = offDetail.breakdown?.find((b) => b.source === 'BASE');
  const bdAllow = offDetail.breakdown?.find((b) => b.source === 'ALLOWANCE');
  const bdDeduct = offDetail.breakdown?.find((b) => b.source === 'DEDUCTION');
  check('构成·底薪 8000', bdBase?.amount === 8000);
  check('构成·津贴 300 且带子项[交通补贴300]', bdAllow?.amount === 300 && JSON.stringify(bdAllow?.items) === JSON.stringify([{ name: '交通补贴', amount: 300 }]));
  console.log('  DEBUG breakdown DEDUCTION items =', JSON.stringify(bdDeduct?.items), 'row amount =', bdDeduct?.amount);
  check('构成·扣款 -200 且带子项[请假扣款200]（子项保留正号，前端按扣款行加负号）', bdDeduct?.amount === -200 && JSON.stringify(bdDeduct?.items) === JSON.stringify([{ name: '请假扣款', amount: 200 }]));
  check('detail.deductEnabled=false', (off.detail as { deductEnabled: boolean }).deductEnabled === false);

  const genOff = await slipSvc.generateSlips(MONTH, teacherId, 1);
  check('生成 1 张工资条（幂等）', genOff.generated === 1, genOff);
  let slip = await slipRepo.findOne({ where: { teacherId, month: MONTH } });
  check('slip 落库 gross=9300 net=9300', Number(slip!.grossAmount) === 9300 && Number(slip!.netAmount) === 9300, slip?.grossAmount);
  check('slip 初始 PENDING', slip!.status === SalaryRecordStatus.PENDING);

  // ─── 3. 开关打开 → 重算未发放工资条 ───
  console.log('\n[3] PUT /salary/config enabled=true → recomputeByConfig');
  await configSvc.update(true, 1);
  const recompute = await slipSvc.recomputeByConfig(1);
  check('recompute 重算 1 张、跳过 PAID 0', recompute.recomputed === 1 && recompute.skippedPaid === 0, recompute);
  slip = await slipRepo.findOne({ where: { teacherId, month: MONTH } });
  check('重算后保留原 id 与 PENDING 状态', slip!.status === SalaryRecordStatus.PENDING);
  check('社保=685（5000×13.7%）', Number(slip!.socialAmount) === 685, slip!.socialAmount);
  check('个税=151.5（3615×10%-210）', Number(slip!.taxAmount) === 151.5, slip!.taxAmount);
  check('实发=8463.5', Number(slip!.netAmount) === 8463.5, slip!.netAmount);
  const onDetail = slip!.detail as { deductEnabled: boolean; social: { amount: number } | null; tax: { taxable: number } | null };
  check('detail.deductEnabled=true', onDetail.deductEnabled === true);
  check('detail.social.amount=685', onDetail.social?.amount === 685);
  check('detail.tax.taxable=3615', onDetail.tax?.taxable === 3615);

  // ─── 4. 管理端工资结算：发放批次 → 状态流转 → 发放联动 ───
  console.log('\n[4] 发放批次（管理端结算）');
  const payroll = await payrollSvc.create({ month: MONTH } as never, 1);
  check('批次创建 DRAFT total=8463.5', payroll.status === PayrollStatus.DRAFT && Number(payroll.totalAmount) === 8463.5, payroll);
  await payrollSvc.updateStatus(Number(payroll.id), PayrollStatus.CONFIRMED, 1);
  await payrollSvc.updateStatus(Number(payroll.id), PayrollStatus.PAID, 1);
  await payrollSvc.updateStatus(Number(payroll.id), PayrollStatus.CLOSED, 1);
  const payrollEnd = await payrollRepo.findOne({ where: { id: payroll.id } });
  check('批次 DRAFT→CONFIRMED→PAID→CLOSED', payrollEnd!.status === PayrollStatus.CLOSED, payrollEnd?.status);

  // 发放联动：slip PAID → 当月该教师 salary_record 全 PAID
  await slipSvc.updateSlipStatus(Number(slip!.id), SalaryRecordStatus.APPROVED, undefined, 1);
  await slipSvc.updateSlipStatus(Number(slip!.id), SalaryRecordStatus.PAID, undefined, 1);
  const slipEnd = await slipRepo.findOne({ where: { id: slip!.id } });
  check('slip 置 PAID', slipEnd!.status === SalaryRecordStatus.PAID, slipEnd?.status);
  const paidRecords = await recordRepo.find({ where: { teacherId, month: MONTH, status: SalaryRecordStatus.PAID } });
  check('发放联动：当月 9 条工资记录全 PAID', paidRecords.length === 9, paidRecords.length);

  // PAID 锁定：重算跳过，金额不变
  const recompute2 = await slipSvc.recomputeByConfig(1);
  check('PAID 锁定：recompute skippedPaid=1 recomputed=0', recompute2.skippedPaid === 1 && recompute2.recomputed === 0, recompute2);
  slip = await slipRepo.findOne({ where: { id: slip!.id } });
  check('PAID slip 金额不变（8463.5 锁定）', Number(slip!.netAmount) === 8463.5, slip?.netAmount);

  // ─── 5. 发放批次导出（管理端 Excel） ───
  console.log('\n[5] 发放批次导出');
  const excel = await payrollSvc.exportExcel(Number(payroll.id));
  check('批次 Excel 生成非空', excel.length > 1000, excel.length);

  await app.close();
  await db(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);

  console.log(`\n══════════ 全链路集成测试：${passCount} 通过 / ${failCount} 失败 ══════════`);
  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error('CHAIN FAIL:', e);
  db(`DROP DATABASE IF EXISTS \`${DB_NAME}\``).catch(() => undefined);
  process.exit(1);
});
