import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SalarySettlementService } from './salary-settlement.service';
import { LessonStatus } from '@modules/teaching/lesson/enums/lesson-status.enum';
import { AttendanceStatus } from '@modules/teaching/lesson-attendance/enums/attendance-status.enum';
import {
  OutingRecordStatus,
  SalaryRecordSource,
  SalaryRuleType,
} from '../enums/salary.enums';
import { SalaryRecordEntity } from '../entities/salary-record.entity';
import { SalaryRuleEntity } from '../entities/salary-rule.entity';
import { TeacherSalaryProfileEntity } from '../entities/teacher-salary-profile.entity';
import { OutingRecordEntity } from '../entities/outing-record.entity';
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { User } from '@modules/identity/entities/user.entity';

type Row = Record<string, unknown>;

/** salary_record.detail 中本 spec 会断言的字段（类型安全，替代 as any） */
interface RecordDetail {
  ruleSnapshot?: { source?: string };
  outingId?: number;
  lessonCount?: number;
}

type Where = {
  status?: LessonStatus | OutingRecordStatus;
  teacherId?: number | { _value: unknown[] };
  month?: string;
  lessonId?: { _value: unknown[] };
  courseCode?: { _value: unknown[] };
  id?: { _value: unknown[] };
  outingDate?: { _value: [string, string] };
};

type LessonOverrides = {
  id?: number;
  teacherId?: number;
  courseCode?: string;
  status?: LessonStatus;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
};

type AttendanceOverrides = {
  id?: number;
  lessonId?: number;
  teacherId?: number;
  studentCode?: string;
  status?: AttendanceStatus;
};

type RuleOverrides = {
  id?: number;
  name?: string;
  type?: SalaryRuleType;
  baseAmount?: number;
  multiplier?: number;
  courseType?: string | null;
  teacherLevel?: string | null;
  isActive?: boolean;
  config?: Record<string, unknown>;
  createTime?: Date;
  updateTime?: Date;
};

type CourseOverrides = {
  courseCode?: string;
  type?: string;
};

type ProfileOverrides = {
  id?: number;
  teacherId?: number;
  employmentType?: string;
  ruleType?: SalaryRuleType;
  salaryConfig?: Record<string, unknown> | null;
  allowances?: Record<string, unknown>[] | null;
  deductions?: Record<string, unknown>[] | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive?: boolean;
  createTime?: Date;
  updateTime?: Date;
};

type OutingOverrides = {
  id?: number;
  teacherId?: number;
  outingDate?: string;
  location?: string | null;
  lessonCount?: number;
  note?: string | null;
  status?: OutingRecordStatus;
  createTime?: Date;
  updateTime?: Date;
};

// ─── Mock Factories ───

function createLesson(overrides: LessonOverrides = {}) {
  return {
    id: 1,
    teacherId: 5001,
    courseCode: 'MATH001',
    status: LessonStatus.FINISHED,
    scheduledDate: '2026-07-12',
    startTime: '09:00',
    endTime: '10:30',
    ...overrides,
  };
}

function createAttendance(overrides: AttendanceOverrides = {}) {
  return {
    id: 1,
    lessonId: 1,
    teacherId: 5001,
    studentCode: 'STU001',
    status: AttendanceStatus.PRESENT,
    ...overrides,
  };
}

function createRule(overrides: RuleOverrides = {}) {
  return {
    id: 1,
    name: '固定课时费',
    type: SalaryRuleType.PER_LESSON,
    baseAmount: 100,
    multiplier: 1,
    courseType: null,
    teacherLevel: null,
    isActive: true,
    config: { lessonPrice: 80 },
    createTime: new Date('2026-07-01'),
    updateTime: new Date('2026-07-01'),
    ...overrides,
  };
}

function createCourse(overrides: CourseOverrides = {}) {
  return { courseCode: 'MATH001', type: '1v1', ...overrides };
}

function createProfile(overrides: ProfileOverrides = {}) {
  return {
    id: 9001,
    teacherId: 5001,
    employmentType: 'FULL_TIME',
    ruleType: SalaryRuleType.PER_LESSON,
    salaryConfig: { lessonPrice: 95, baseSalary: 3000 },
    allowances: [{ type: 'COMMUTING', name: '通勤补贴', amount: 200 }],
    deductions: [{ type: 'LEAVE', name: '请假扣款', amount: 100 }],
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
    createTime: new Date('2026-07-01'),
    updateTime: new Date('2026-07-01'),
    ...overrides,
  };
}

function createOuting(overrides: OutingOverrides = {}) {
  return {
    id: 1,
    teacherId: 5001,
    outingDate: '2026-07-15',
    location: '合作校',
    lessonCount: 2,
    note: null,
    status: OutingRecordStatus.CONFIRMED,
    createTime: new Date('2026-07-01'),
    updateTime: new Date('2026-07-01'),
    ...overrides,
  };
}

function createMockLessonRepo(lessons: Row[]) {
  return {
    _lessons: lessons,
    find: jest.fn().mockImplementation(({ where }: { where?: Where }) => {
      let out = lessons;
      if (where?.status) out = out.filter((l) => l.status === where.status);
      if (where?.teacherId)
        out = out.filter(
          (l) => Number(l.teacherId) === Number(where.teacherId),
        );
      return Promise.resolve(out);
    }),
  };
}

function createMockAttendanceRepo(rows: Row[]) {
  return {
    _rows: rows,
    find: jest.fn().mockImplementation(({ where }: { where?: Where }) => {
      const ids = where?.lessonId?._value;
      if (Array.isArray(ids)) {
        return Promise.resolve(rows.filter((r) => ids.includes(r.lessonId)));
      }
      return Promise.resolve(rows);
    }),
  };
}

function createMockCourseRepo(rows: Row[]) {
  return {
    _rows: rows,
    find: jest.fn().mockImplementation(({ where }: { where?: Where }) => {
      const codes = where?.courseCode?._value;
      if (Array.isArray(codes)) {
        return Promise.resolve(
          rows.filter((r) => codes.includes(r.courseCode)),
        );
      }
      return Promise.resolve(rows);
    }),
  };
}

function createMockRuleRepo(rules: Row[]) {
  return { find: jest.fn().mockResolvedValue(rules) };
}

function createMockUserRepo(users: Row[]) {
  return {
    find: jest.fn().mockImplementation(({ where }: { where?: Where }) => {
      const ids = where?.id?._value;
      if (Array.isArray(ids)) {
        return Promise.resolve(
          users.filter((u) => ids.some((x) => Number(x) === Number(u.id))),
        );
      }
      return Promise.resolve(users);
    }),
  };
}

function createMockProfileRepo(profiles: Row[]) {
  return {
    _rows: profiles,
    find: jest.fn().mockImplementation(({ where }: { where?: Where }) => {
      const ids = (where?.teacherId as { _value?: unknown[] } | undefined)
        ?._value;
      if (Array.isArray(ids)) {
        return Promise.resolve(
          profiles.filter((p) =>
            ids.some((x) => Number(x) === Number(p.teacherId)),
          ),
        );
      }
      return Promise.resolve(profiles);
    }),
  };
}

function createMockOutingRepo(outings: Row[]) {
  return {
    _rows: outings,
    find: jest.fn().mockImplementation(({ where }: { where?: Where }) => {
      const ids = (where?.teacherId as { _value?: unknown[] } | undefined)
        ?._value;
      let out = outings;
      if (Array.isArray(ids)) {
        out = out.filter((o) =>
          ids.some((x) => Number(x) === Number(o.teacherId)),
        );
      }
      if (where?.status) {
        out = out.filter((o) => o.status === where.status);
      }
      if (where?.outingDate?._value) {
        const [s, e] = where.outingDate._value;
        out = out.filter(
          (o) => String(o.outingDate) >= s && String(o.outingDate) <= e,
        );
      }
      return Promise.resolve(out);
    }),
  };
}

function createMockRecordRepo(existing: Row[] = []) {
  const saved: Row[] = [];
  const manager = {
    transaction: jest
      .fn()
      .mockImplementation((cb: (em: unknown) => unknown) => {
        const em = {
          save: jest
            .fn()
            .mockImplementation((_cls: unknown, entities: Row[]) => {
              saved.push(...entities);
              return Promise.resolve(entities);
            }),
        };
        return cb(em);
      }),
  };
  return {
    _existing: existing,
    _saved: saved,
    manager,
    find: jest.fn().mockImplementation(({ where }: { where?: Where }) => {
      let out = existing;
      if (where?.month) out = out.filter((r) => r.month === where.month);
      if (where?.teacherId)
        out = out.filter((r) => r.teacherId === where.teacherId);
      return Promise.resolve(out);
    }),
  };
}

function buildService(
  opts: {
    lessons?: Row[];
    attendances?: Row[];
    courses?: Row[];
    rules?: Row[];
    existing?: Row[];
    users?: Row[];
    profiles?: Row[];
    outings?: Row[];
  } = {},
) {
  const lessonRepo = createMockLessonRepo(opts.lessons ?? []);
  const attendanceRepo = createMockAttendanceRepo(opts.attendances ?? []);
  const courseRepo = createMockCourseRepo(opts.courses ?? []);
  const ruleRepo = createMockRuleRepo(opts.rules ?? []);
  const recordRepo = createMockRecordRepo(opts.existing ?? []);
  const userRepo = createMockUserRepo(opts.users ?? []);
  const profileRepo = createMockProfileRepo(opts.profiles ?? []);
  const outingRepo = createMockOutingRepo(opts.outings ?? []);
  const service = new SalarySettlementService(
    recordRepo as unknown as Repository<SalaryRecordEntity>,
    ruleRepo as unknown as Repository<SalaryRuleEntity>,
    lessonRepo as unknown as Repository<LessonEntity>,
    attendanceRepo as unknown as Repository<LessonAttendanceEntity>,
    courseRepo as unknown as Repository<CourseEntity>,
    userRepo as unknown as Repository<User>,
    profileRepo as unknown as Repository<TeacherSalaryProfileEntity>,
    outingRepo as unknown as Repository<OutingRecordEntity>,
  );
  return {
    service,
    recordRepo,
    lessonRepo,
    attendanceRepo,
    courseRepo,
    ruleRepo,
    userRepo,
    profileRepo,
    outingRepo,
  };
}

// ─── Tests ───

describe('SalarySettlementService.settle', () => {
  it('无 FINISHED 课时返回空结果', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson({ status: LessonStatus.SCHEDULED })],
    });
    const res = await service.settle('2026-07');
    expect(res.teachers).toBe(0);
    expect(res.lessons).toBe(0);
    expect(res.created).toBe(0);
    expect(recordRepo.find).not.toHaveBeenCalled();
  });

  it('PER_LESSON 规则生成 LESSON_FEE 记录', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [createRule()],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    expect(res.lessons).toBe(1);
    expect(res.teachers).toBe(1);

    const rec = recordRepo._saved[0];
    expect(rec.source).toBe(SalaryRecordSource.LESSON_FEE);
    expect(rec.lessonId).toBe(1);
    expect(rec.teacherId).toBe(5001);
    expect(rec.month).toBe('2026-07');
    expect(rec.amount).toBe(80);
    expect(rec.studentCount).toBe(1);
    expect(rec.needsReview).toBe(false);
    expect(rec.status).toBe('PENDING');
  });

  it('无适用规则 → needsReview 兜底，amount=0', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [createRule({ courseType: 'GROUP' })], // 不匹配 1v1
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    const rec = recordRepo._saved[0];
    expect(rec.needsReview).toBe(true);
    expect(rec.amount).toBe(0);
    expect(rec.salaryRuleId).toBe(0);
    expect(rec.notes).toContain('无适用工资规则');
  });

  it('幂等：已有记录则跳过，created=0', async () => {
    const existing = [
      {
        teacherId: 5001,
        source: SalaryRecordSource.LESSON_FEE,
        lessonId: 1,
        lessonDate: '2026-07-12',
        month: '2026-07',
      },
    ];
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [createRule()],
      existing,
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
    expect(recordRepo._saved).toHaveLength(0);
  });

  it('TIER 按累计课时跨档计费', async () => {
    const { service, recordRepo } = buildService({
      lessons: [
        createLesson({ id: 1, scheduledDate: '2026-07-01' }),
        createLesson({ id: 2, scheduledDate: '2026-07-08' }),
        createLesson({ id: 3, scheduledDate: '2026-07-15' }),
      ],
      attendances: [
        createAttendance({ lessonId: 1 }),
        createAttendance({ lessonId: 2 }),
        createAttendance({ lessonId: 3 }),
      ],
      courses: [createCourse()],
      rules: [
        createRule({
          type: SalaryRuleType.TIER,
          config: {
            lessonTiers: [
              { min: 1, max: 2, pricePerLesson: 30 },
              { min: 3, max: null, pricePerLesson: 35 },
            ],
          },
        }),
      ],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(3);
    const amounts = recordRepo._saved.map((r) => r.amount);
    expect(amounts).toEqual([30, 30, 35]); // 按日期升序，第 3 节进入第二档
  });

  it('BASE 底薪：达标课时数生成 BASE 记录', async () => {
    const { service, recordRepo } = buildService({
      lessons: [
        createLesson({ id: 1, scheduledDate: '2026-07-01' }),
        createLesson({ id: 2, scheduledDate: '2026-07-08' }),
      ],
      attendances: [],
      courses: [createCourse()],
      rules: [
        createRule({
          config: { lessonPrice: 80, baseSalary: 2000, minLessonForBase: 2 },
        }),
      ],
    });
    const res = await service.settle('2026-07');
    const base = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.BASE,
    );
    expect(base).toBeDefined();
    expect(base!.amount).toBe(2000);
    expect(base!.lessonId).toBeNull();
    expect(res.created).toBe(3); // 2 LESSON_FEE + 1 BASE
  });

  it('G1 MONTHLY：只生成 1 条 BASE 记录，不生成 0 元 LESSON_FEE 明细', async () => {
    const { service, recordRepo } = buildService({
      lessons: [
        createLesson({ id: 1, scheduledDate: '2026-07-01' }),
        createLesson({ id: 2, scheduledDate: '2026-07-08' }),
      ],
      attendances: [],
      courses: [createCourse()],
      rules: [
        createRule({
          type: SalaryRuleType.MONTHLY,
          config: { baseSalary: 5000, minLessonForBase: 0 },
        }),
      ],
    });
    await service.settle('2026-07');
    const sources = recordRepo._saved.map((r) => r.source);
    expect(sources).not.toContain(SalaryRecordSource.LESSON_FEE);
    const base = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.BASE,
    );
    expect(base).toBeDefined();
    expect(base!.amount).toBe(5000);
    expect(recordRepo._saved).toHaveLength(1);
  });

  it('G1 PER_DAY：只生成按天 DAY 记录，不生成 0 元 LESSON_FEE 明细', async () => {
    const { service, recordRepo } = buildService({
      lessons: [
        createLesson({ id: 1, scheduledDate: '2026-07-01' }),
        createLesson({ id: 2, scheduledDate: '2026-07-01' }),
        createLesson({ id: 3, scheduledDate: '2026-07-02' }),
      ],
      attendances: [],
      courses: [createCourse()],
      rules: [
        createRule({
          type: SalaryRuleType.PER_DAY,
          config: { lessonPrice: 300 },
        }),
      ],
    });
    await service.settle('2026-07');
    const sources = recordRepo._saved.map((r) => r.source);
    expect(sources).not.toContain(SalaryRecordSource.LESSON_FEE);
    const dayRecords = recordRepo._saved.filter(
      (r) => r.source === SalaryRecordSource.DAY,
    );
    expect(dayRecords).toHaveLength(2); // 2 个不同日期
    expect(dayRecords.map((r) => r.amount)).toEqual([300, 300]);
  });

  it('G5 学生考勤迟到/缺勤不再生成教师 DEDUCTION 记录', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [
        createAttendance({ status: AttendanceStatus.LATE }),
        createAttendance({ status: AttendanceStatus.ABSENT }),
      ],
      courses: [createCourse()],
      rules: [
        createRule({
          config: {
            lessonPrice: 80,
            deductions: { latePerOccurrence: 10, absentPerOccurrence: 20 },
          },
        }),
      ],
    });
    await service.settle('2026-07');
    const ded = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.DEDUCTION,
    );
    expect(ded).toBeUndefined();
    expect(recordRepo._saved).toHaveLength(1); // 仅 LESSON_FEE
  });

  it('BONUS 绩效：满勤 + 课时达标', async () => {
    const { service, recordRepo } = buildService({
      lessons: [
        createLesson({ id: 1, scheduledDate: '2026-07-01' }),
        createLesson({ id: 2, scheduledDate: '2026-07-08' }),
      ],
      attendances: [
        createAttendance({ lessonId: 1 }),
        createAttendance({ lessonId: 2 }),
      ],
      courses: [createCourse()],
      rules: [
        createRule({
          config: {
            lessonPrice: 80,
            bonus: {
              fullAttendance: 100,
              lessonTarget: { threshold: 2, amount: 200 },
            },
          },
        }),
      ],
    });
    await service.settle('2026-07');
    const bonus = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.BONUS,
    );
    expect(bonus).toBeDefined();
    expect(bonus!.amount).toBe(300); // 100 + 200
    // 绩效构成子项：满勤奖 + 课时达标奖
    const bd = bonus!.detail as { items?: { name: string; amount: number }[] };
    expect(bd.items).toEqual([
      { name: '满勤奖', amount: 100 },
      { name: '课时达标奖', amount: 200 },
    ]);
  });

  it('指定教师结算只处理该教师课时', async () => {
    const { service, recordRepo } = buildService({
      lessons: [
        createLesson({ id: 1, teacherId: 5001 }),
        createLesson({ id: 2, teacherId: 5002 }),
      ],
      attendances: [],
      courses: [createCourse()],
      rules: [createRule()],
    });
    const res = await service.settle('2026-07', 5001);
    expect(res.lessons).toBe(1);
    expect(res.teachers).toBe(1);
    expect(recordRepo._saved[0].teacherId).toBe(5001);
  });

  it('month 非法格式抛出 BadRequestException', async () => {
    const { service } = buildService();
    await expect(service.settle('2026/07')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.settle('2026-13')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('ruleVersion 取规则 updateTime 的 YYYY-MM-DD', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [createRule({ updateTime: new Date('2026-07-05') })],
    });
    await service.settle('2026-07');
    expect(recordRepo._saved[0].ruleVersion).toBe('2026-07-05');
  });

  it('teacherLevel 精确匹配：教师等级命中等级规则（score 2）', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [
        createRule({ teacherLevel: '中级', config: { lessonPrice: 120 } }),
      ],
      users: [{ id: 5001, teacherLevel: '中级' }],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    const rec = recordRepo._saved[0];
    expect(rec.needsReview).toBe(false);
    expect(rec.amount).toBe(120);
  });

  it('teacherLevel 不匹配 → 规则不命中 → needsReview 兜底', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [
        createRule({ teacherLevel: '高级', config: { lessonPrice: 150 } }),
      ],
      users: [{ id: 5001, teacherLevel: '中级' }],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    const rec = recordRepo._saved[0];
    expect(rec.needsReview).toBe(true);
    expect(rec.amount).toBe(0);
  });

  it('courseType + teacherLevel 双匹配（score 4）优先于仅 courseType（score 3）', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [
        createRule({ id: 1, courseType: '1v1', config: { lessonPrice: 100 } }),
        createRule({
          id: 2,
          courseType: '1v1',
          teacherLevel: '中级',
          config: { lessonPrice: 130 },
        }),
      ],
      users: [{ id: 5001, teacherLevel: '中级' }],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    const rec = recordRepo._saved[0];
    expect(rec.salaryRuleId).toBe(2);
    expect(rec.amount).toBe(130);
  });

  it('教师等级未知时，等级规则不命中，通用规则兜底', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [
        createRule({
          id: 1,
          teacherLevel: '高级',
          config: { lessonPrice: 150 },
        }),
        createRule({ id: 2, config: { lessonPrice: 80 } }),
      ],
      users: [{ id: 5001, teacherLevel: null }],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    const rec = recordRepo._saved[0];
    expect(rec.salaryRuleId).toBe(2);
    expect(rec.amount).toBe(80);
  });

  // ─── P1: 教师薪资档案（档案优先） ───

  it('档案优先：有 active 档案 → 用档案课时费/底薪/津贴/扣款', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [createRule({ config: { lessonPrice: 80 } })], // 全局规则会被档案覆盖
      profiles: [createProfile()],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(4); // LESSON_FEE + BASE + ALLOWANCE + DEDUCTION

    const lesson = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.LESSON_FEE,
    );
    expect(lesson!.amount).toBe(95); // 档案 lessonPrice，非全局 80
    expect(lesson!.salaryRuleId).toBe(-9001); // 档案合成规则 id 为负数
    expect((lesson!.detail as RecordDetail).ruleSnapshot?.source).toBe(
      'profile',
    );

    const base = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.BASE,
    );
    expect(base!.amount).toBe(3000);

    const allowance = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.ALLOWANCE,
    );
    expect(allowance).toBeDefined();
    expect(allowance!.amount).toBe(200);
    expect(allowance!.lessonId).toBeNull();

    const deduction = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.DEDUCTION,
    );
    expect(deduction).toBeDefined();
    expect(deduction!.amount).toBe(-100); // 扣款记负数
  });

  it('生产 bigint：lesson.teacherId 为字符串时档案仍命中（Number 归一化回归）', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson({ teacherId: '5001' })], // MySQL bigint 返回字符串
      attendances: [createAttendance({ teacherId: '5001' })],
      courses: [createCourse()],
      rules: [createRule({ config: { lessonPrice: 80 } })], // 全局规则会被档案覆盖
      profiles: [createProfile()], // teacherId: 5001 number
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(4); // LESSON_FEE + BASE + ALLOWANCE + DEDUCTION
    const lesson = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.LESSON_FEE,
    );
    expect(lesson!.amount).toBe(95); // 档案 lessonPrice，非全局 80
    expect(lesson!.salaryRuleId).toBe(-9001);
  });

  it('生产 bigint：teacherId 字符串时 teacherLevel 等级规则仍命中', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson({ teacherId: '5001' })],
      attendances: [createAttendance({ teacherId: '5001' })],
      courses: [createCourse()],
      rules: [
        createRule({ teacherLevel: '中级', config: { lessonPrice: 120 } }),
      ],
      users: [{ id: 5001, teacherLevel: '中级' }],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    const rec = recordRepo._saved[0];
    expect(rec.needsReview).toBe(false);
    expect(rec.amount).toBe(120);
  });

  it('档案失效（isActive=false）→ 回落全局规则，不生成津贴/扣款', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [createRule({ config: { lessonPrice: 80 } })],
      profiles: [createProfile({ isActive: false })],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    const rec = recordRepo._saved[0];
    expect(rec.source).toBe(SalaryRecordSource.LESSON_FEE);
    expect(rec.amount).toBe(80);
    expect(rec.salaryRuleId).toBe(1); // 全局规则 id
  });

  it('档案生效区间：effectiveTo 早于结算月 → 档案不生效，回落全局', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [createRule({ config: { lessonPrice: 80 } })],
      profiles: [createProfile({ effectiveTo: '2026-06-30' })],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(1);
    expect(recordRepo._saved[0].amount).toBe(80);
  });

  // ─── P1: 外派课时 ───

  it('外派：档案有 lessonPrice → OUTING 记录 = price × lessonCount', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      profiles: [createProfile()],
      outings: [createOuting({ lessonCount: 2 })],
    });
    const res = await service.settle('2026-07');
    expect(res.created).toBe(5); // LESSON_FEE + BASE + ALLOWANCE + DEDUCTION + OUTING
    const outing = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.OUTING,
    );
    expect(outing).toBeDefined();
    expect(outing!.lessonId).toBe(1); // outing.id
    expect(outing!.amount).toBe(190); // 95 × 2
    expect(outing!.salaryRuleId).toBe(-9001);
    expect((outing!.detail as RecordDetail).outingId).toBe(1);
    expect((outing!.detail as RecordDetail).lessonCount).toBe(2);
    expect(outing!.needsReview).toBe(false);
  });

  it('外派：无档案 → 回落全局 OUTING 规则', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [
        createRule({
          id: 7,
          type: SalaryRuleType.OUTING,
          config: { lessonPrice: 150 },
        }),
      ],
      outings: [createOuting({ lessonCount: 1 })],
    });
    await service.settle('2026-07');
    const outing = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.OUTING,
    );
    expect(outing).toBeDefined();
    expect(outing!.amount).toBe(150);
    expect(outing!.salaryRuleId).toBe(7);
  });

  it('外派：无任何规则 → needsReview 兜底，amount=0', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      rules: [],
      outings: [createOuting()],
    });
    await service.settle('2026-07');
    const outing = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.OUTING,
    );
    expect(outing).toBeDefined();
    expect(outing!.amount).toBe(0);
    expect(outing!.needsReview).toBe(true);
  });

  it('外派：PENDING 状态不计入结算', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      profiles: [createProfile()],
      outings: [createOuting({ status: OutingRecordStatus.PENDING })],
    });
    await service.settle('2026-07');
    const outing = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.OUTING,
    );
    expect(outing).toBeUndefined();
  });

  it('外派：幂等，已有 OUTING 记录则跳过', async () => {
    const { service, recordRepo } = buildService({
      lessons: [createLesson()],
      attendances: [createAttendance()],
      courses: [createCourse()],
      profiles: [createProfile()],
      outings: [createOuting()],
      existing: [
        {
          teacherId: 5001,
          source: SalaryRecordSource.OUTING,
          lessonId: 1,
          lessonDate: '2026-07-15',
          month: '2026-07',
        },
      ],
    });
    const res = await service.settle('2026-07');
    const outing = recordRepo._saved.find(
      (r) => r.source === SalaryRecordSource.OUTING,
    );
    expect(outing).toBeUndefined();
    expect(res.created).toBe(4); // LESSON_FEE + BASE + ALLOWANCE + DEDUCTION
  });
});
