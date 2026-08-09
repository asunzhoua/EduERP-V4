import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { SalaryRecordEntity } from '../entities/salary-record.entity';
import { SalaryRuleEntity } from '../entities/salary-rule.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonStatus } from '@modules/teaching/lesson/enums/lesson-status.enum';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import {
  AttendanceStatus,
  DEDUCTIBLE_STATUSES,
} from '@modules/teaching/lesson-attendance/enums/attendance-status.enum';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { User } from '@modules/identity/entities/user.entity';
import {
  SalaryRecordStatus,
  SalaryRecordSource,
  SalaryRuleType,
} from '../enums/salary.enums';
import { computeLessonFee, scoreRule } from './salary-calculator.service';

export interface SettleResult {
  month: string;
  teacherId?: number;
  teachers: number;
  lessons: number;
  created: number;
  skipped: number;
  summary: { source: string; count: number; amount: number }[];
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function monthRange(month: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new BadRequestException('month 必须为 YYYY-MM 格式');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new BadRequestException('month 月份非法');
  const lastDay = new Date(y, mo, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

@Injectable()
export class SalarySettlementService {
  private readonly logger = new Logger(SalarySettlementService.name);

  constructor(
    @InjectRepository(SalaryRecordEntity)
    private readonly recordRepo: Repository<SalaryRecordEntity>,
    @InjectRepository(SalaryRuleEntity)
    private readonly ruleRepo: Repository<SalaryRuleEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(LessonAttendanceEntity)
    private readonly attendanceRepo: Repository<LessonAttendanceEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async settle(month: string, teacherId?: number, operatedBy = 0): Promise<SettleResult> {
    const { start, end } = monthRange(month);

    const lessonWhere: Record<string, any> = {
      status: LessonStatus.FINISHED,
      scheduledDate: Between(start, end),
    };
    if (teacherId) lessonWhere.teacherId = teacherId;

    const lessons = await this.lessonRepo.find({ where: lessonWhere });
    if (lessons.length === 0) {
      return { month, teacherId, teachers: 0, lessons: 0, created: 0, skipped: 0, summary: [] };
    }

    const lessonIds = lessons.map((l) => l.id);
    const courseCodes = [...new Set(lessons.map((l) => l.courseCode))];

    const [attendances, courses, rules] = await Promise.all([
      this.attendanceRepo.find({ where: { lessonId: In(lessonIds) } }),
      this.courseRepo.find({ where: { courseCode: In(courseCodes) } }),
      this.ruleRepo.find({ where: { isActive: true } }),
    ]);

    const courseTypeByCode = new Map(courses.map((c) => [c.courseCode, c.type]));
    const activeRules = rules;

    // 按教师分组
    const teacherIds = [...new Set(lessons.map((l) => l.teacherId))];

    // 教师等级（salary_rule.teacherLevel 精确匹配依据）
    const teacherLevelByUser = new Map<number, string | null>();
    if (teacherIds.length > 0) {
      const users = await this.userRepo.find({ where: { id: In(teacherIds) } });
      for (const u of users) teacherLevelByUser.set(Number(u.id), u.teacherLevel ?? null);
    }

    const existingRecords = teacherId
      ? await this.recordRepo.find({ where: { month, teacherId } })
      : await this.recordRepo.find({ where: { month } });

    const existingKeys = new Set(
      existingRecords.map((r) => this.recordKey(r.teacherId, r.source, r.lessonId, r.lessonDate)),
    );

    const toCreate: Partial<SalaryRecordEntity>[] = [];

    for (const tid of teacherIds) {
      const teacherLessons = lessons.filter((l) => l.teacherId === tid);
      const teacherAttendances = attendances.filter((a) => a.teacherId === tid);
      const attendanceByLesson = new Map<number, LessonAttendanceEntity[]>();
      for (const a of teacherAttendances) {
        const arr = attendanceByLesson.get(a.lessonId) ?? [];
        arr.push(a);
        attendanceByLesson.set(a.lessonId, arr);
      }

      // 为每节课挑选规则（同一规则按 type + courseType/teacherLevel 匹配）
      interface MatchedLesson {
        lesson: LessonEntity;
        rule: SalaryRuleEntity | null;
        headcount: number;
      }
      const matched: MatchedLesson[] = [];
      for (const lesson of teacherLessons) {
        const courseType = courseTypeByCode.get(lesson.courseCode) ?? null;
        const teacherLevel = teacherLevelByUser.get(lesson.teacherId) ?? null;
        let best: SalaryRuleEntity | null = null;
        let bestScore = 0;
        for (const rule of activeRules) {
          if (!this.ruleInEffect(rule, month)) continue;
          const s = scoreRule(rule, courseType, teacherLevel);
          if (s > bestScore) {
            bestScore = s;
            best = rule;
          }
        }
        const list = attendanceByLesson.get(lesson.id) ?? [];
        const headcount = list.filter((a) => DEDUCTIBLE_STATUSES.has(a.status as AttendanceStatus)).length;
        matched.push({ lesson, rule: bestScore > 0 ? best : null, headcount });
      }

      // 各规则当月课时数（TIER 累计档位依据）
      const lessonCountByRule = new Map<number, number>();
      for (const m of matched) {
        if (m.rule) {
          lessonCountByRule.set(m.rule.id, (lessonCountByRule.get(m.rule.id) ?? 0) + 1);
        }
      }

      // 已累计计数（TIER：按 lesson 日期升序累加）
      const tierCountByRule = new Map<number, number>();
      const ordered = [...matched].sort((a, b) => a.lesson.scheduledDate.localeCompare(b.lesson.scheduledDate));

      for (const m of ordered) {
        if (!m.rule) {
          // 无适用规则 → needsReview 兜底
          const key = this.recordKey(tid, SalaryRecordSource.LESSON_FEE, m.lesson.id, m.lesson.scheduledDate);
          if (!existingKeys.has(key)) {
            toCreate.push({
              teacherId: tid,
              lessonId: m.lesson.id,
              salaryRuleId: 0,
              source: SalaryRecordSource.LESSON_FEE,
              month,
              lessonDate: m.lesson.scheduledDate,
              duration: durationMinutes(m.lesson.startTime, m.lesson.endTime),
              studentCount: m.headcount,
              amount: 0,
              ruleVersion: '',
              status: SalaryRecordStatus.PENDING,
              needsReview: true,
              notes: '无适用工资规则',
              detail: { reason: '无适用工资规则', courseCode: m.lesson.courseCode, headcount: m.headcount },
              createdBy: operatedBy,
            });
            existingKeys.add(key);
          }
          continue;
        }

        const rule = m.rule;
        const config = rule.config ?? null;

        // G1: PER_DAY/MONTHLY 按天/按月聚合计薪（DAY/BASE 记录承载），无单课明细语义，
        // 跳过 0 元 LESSON_FEE 记录，避免污染按课明细与统计
        if (
          rule.type === SalaryRuleType.PER_DAY ||
          rule.type === SalaryRuleType.MONTHLY
        ) {
          continue;
        }

        const count = tierCountByRule.get(rule.id) ?? 0;
        const fee = computeLessonFee(rule.type as SalaryRuleType, config, rule, m.headcount, count + 1);
        tierCountByRule.set(rule.id, count + 1);

        const key = this.recordKey(tid, SalaryRecordSource.LESSON_FEE, m.lesson.id, m.lesson.scheduledDate);
        if (!existingKeys.has(key)) {
          toCreate.push({
            teacherId: tid,
            lessonId: m.lesson.id,
            salaryRuleId: rule.id,
            source: SalaryRecordSource.LESSON_FEE,
            month,
            lessonDate: m.lesson.scheduledDate,
            duration: durationMinutes(m.lesson.startTime, m.lesson.endTime),
            studentCount: m.headcount,
            amount: fee.amount,
            ruleVersion: this.ruleVersion(rule),
            status: SalaryRecordStatus.PENDING,
            needsReview: false,
            detail: {
              ruleId: rule.id,
              ruleSnapshot: this.ruleSnapshot(rule),
              headcount: m.headcount,
              feeMode: rule.type,
              tierLevel: fee.tierLevel,
              amount: fee.amount,
              calcFormula: fee.calcFormula,
            },
            createdBy: operatedBy,
          });
          existingKeys.add(key);
        }
      }

      const matchedRules = new Map<number, SalaryRuleEntity>();
      for (const m of matched) if (m.rule) matchedRules.set(m.rule.id, m.rule);

      // BASE / DAY / BONUS（按教师月聚合）
      for (const rule of matchedRules.values()) {
        const config = rule.config ?? null;
        const count = lessonCountByRule.get(rule.id) ?? 0;

        // BASE 底薪
        if (config?.baseSalary !== undefined) {
          const minForBase = config.minLessonForBase ?? 0;
          if (count >= minForBase) {
            const key = this.recordKey(tid, SalaryRecordSource.BASE, null, null);
            if (!existingKeys.has(key)) {
              toCreate.push({
                teacherId: tid,
                lessonId: null,
                salaryRuleId: rule.id,
                source: SalaryRecordSource.BASE,
                month,
                lessonDate: end,
                studentCount: null,
                amount: config.baseSalary,
                ruleVersion: this.ruleVersion(rule),
                status: SalaryRecordStatus.PENDING,
                needsReview: false,
                detail: {
                  ruleId: rule.id,
                  ruleSnapshot: this.ruleSnapshot(rule),
                  monthLessonCount: count,
                  baseSalary: config.baseSalary,
                  calcFormula: 'baseSalary',
                },
                createdBy: operatedBy,
              });
              existingKeys.add(key);
            }
          }
        }

        // DAY 按天
        if (rule.type === SalaryRuleType.PER_DAY && config?.lessonPrice !== undefined) {
          const dates = [...new Set(teacherLessons.map((l) => l.scheduledDate))].sort();
          for (const d of dates) {
            const dayLessons = teacherLessons.filter((l) => l.scheduledDate === d).length;
            const key = this.recordKey(tid, SalaryRecordSource.DAY, null, d);
            if (!existingKeys.has(key)) {
              toCreate.push({
                teacherId: tid,
                lessonId: null,
                salaryRuleId: rule.id,
                source: SalaryRecordSource.DAY,
                month,
                lessonDate: d,
                studentCount: null,
                amount: config.lessonPrice,
                ruleVersion: this.ruleVersion(rule),
                status: SalaryRecordStatus.PENDING,
                needsReview: false,
                detail: {
                  ruleId: rule.id,
                  ruleSnapshot: this.ruleSnapshot(rule),
                  dayLessonCount: dayLessons,
                  pricePerDay: config.lessonPrice,
                  calcFormula: 'perDay',
                },
                createdBy: operatedBy,
              });
              existingKeys.add(key);
            }
          }
        }

        // BONUS 绩效
        const bonus = config?.bonus as Record<string, any> | undefined;
        if (bonus) {
          let bonusAmount = 0;
          const formula: string[] = [];
          const fullAttendanceBonus = bonus.fullAttendance;
          if (fullAttendanceBonus) {
            const isFull = this.isFullAttendance(teacherAttendances);
            if (isFull) {
              bonusAmount += fullAttendanceBonus;
              formula.push(`fullAttendance(${fullAttendanceBonus})`);
            }
          }
          const target = bonus.lessonTarget as { threshold?: number; amount?: number } | undefined;
          if (target?.threshold && target.amount) {
            if (count >= target.threshold) {
              bonusAmount += target.amount;
              formula.push(`lessonTarget(${target.amount})`);
            }
          }
          if (bonusAmount > 0) {
            const key = this.recordKey(tid, SalaryRecordSource.BONUS, null, null);
            if (!existingKeys.has(key)) {
              toCreate.push({
                teacherId: tid,
                lessonId: null,
                salaryRuleId: rule.id,
                source: SalaryRecordSource.BONUS,
                month,
                lessonDate: end,
                studentCount: null,
                amount: bonusAmount,
                ruleVersion: this.ruleVersion(rule),
                status: SalaryRecordStatus.PENDING,
                needsReview: false,
                detail: {
                  ruleId: rule.id,
                  ruleSnapshot: this.ruleSnapshot(rule),
                  monthLessonCount: count,
                  calcFormula: formula.join('+') || 'none',
                },
                createdBy: operatedBy,
              });
              existingKeys.add(key);
            }
          }
        }
      }
    }

    // 单事务写入
    const created = await this.recordRepo.manager.transaction(async (em) => {
      const saved = await em.save(SalaryRecordEntity, toCreate as SalaryRecordEntity[]);
      return saved.length;
    });

    const summary = this.buildSummary(toCreate);

    this.logger.log(
      `Settlement ${month} teacher=${teacherId ?? 'all'}: lessons=${lessons.length}, created=${created}, skipped=${existingRecords.length}`,
    );

    return {
      month,
      teacherId,
      teachers: teacherIds.length,
      lessons: lessons.length,
      created,
      skipped: existingRecords.length,
      summary,
    };
  }

  private recordKey(
    teacherId: number,
    source: SalaryRecordSource,
    lessonId: number | null,
    lessonDate: string | null,
  ): string {
    if (source === SalaryRecordSource.LESSON_FEE) return `${teacherId}:${source}:${lessonId}`;
    if (source === SalaryRecordSource.DAY) return `${teacherId}:${source}:${lessonDate}`;
    return `${teacherId}:${source}`;
  }

  private ruleVersion(rule: SalaryRuleEntity): string {
    const d = rule.updateTime ?? rule.createTime;
    if (!d) return '';
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }

  private ruleSnapshot(rule: SalaryRuleEntity): Record<string, any> {
    return {
      id: rule.id,
      name: rule.name,
      type: rule.type,
      baseAmount: Number(rule.baseAmount),
      multiplier: Number(rule.multiplier),
      courseType: rule.courseType,
      teacherLevel: rule.teacherLevel,
      config: rule.config,
    };
  }

  private ruleInEffect(rule: SalaryRuleEntity, month: string): boolean {
    const config = rule.config ?? null;
    if (!config) return true;
    const from = config.effectiveFrom as string | undefined;
    const to = config.effectiveTo as string | undefined;
    const monthStart = `${month}-01`;
    if (from && monthStart < from) return false;
    if (to && monthStart > to) return false;
    return true;
  }

  private isFullAttendance(attendances: LessonAttendanceEntity[]): boolean {
    if (attendances.length === 0) return false;
    return attendances.every((a) => a.status && DEDUCTIBLE_STATUSES.has(a.status));
  }

  private buildSummary(records: Partial<SalaryRecordEntity>[]): { source: string; count: number; amount: number }[] {
    const map = new Map<string, { count: number; amount: number }>();
    for (const r of records) {
      const key = r.source as string;
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(r.amount) || 0;
      map.set(key, cur);
    }
    return [...map.entries()].map(([source, v]) => ({ source, count: v.count, amount: Math.round(v.amount * 100) / 100 }));
  }
}
