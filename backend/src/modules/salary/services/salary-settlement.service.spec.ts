import { BadRequestException } from '@nestjs/common';
import { SalarySettlementService } from './salary-settlement.service';
import { LessonStatus } from '@modules/teaching/lesson/enums/lesson-status.enum';
import { AttendanceStatus } from '@modules/teaching/lesson-attendance/enums/attendance-status.enum';
import { SalaryRecordSource, SalaryRuleType } from '../enums/salary.enums';

// ─── Mock Factories ───

function createLesson(overrides: any = {}) {
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

function createAttendance(overrides: any = {}) {
  return {
    id: 1,
    lessonId: 1,
    teacherId: 5001,
    studentCode: 'STU001',
    status: AttendanceStatus.PRESENT,
    ...overrides,
  };
}

function createRule(overrides: any = {}) {
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

function createCourse(overrides: any = {}) {
  return { courseCode: 'MATH001', type: '1v1', ...overrides };
}

function createMockLessonRepo(lessons: any[]) {
  return {
    _lessons: lessons,
    find: jest.fn().mockImplementation(({ where }: any) => {
      let out = lessons;
      if (where?.status) out = out.filter((l) => l.status === where.status);
      if (where?.teacherId)
        out = out.filter((l) => l.teacherId === where.teacherId);
      return Promise.resolve(out);
    }),
  };
}

function createMockAttendanceRepo(rows: any[]) {
  return {
    _rows: rows,
    find: jest.fn().mockImplementation(({ where }: any) => {
      const ids = where?.lessonId?._value;
      if (Array.isArray(ids)) {
        return Promise.resolve(rows.filter((r) => ids.includes(r.lessonId)));
      }
      return Promise.resolve(rows);
    }),
  };
}

function createMockCourseRepo(rows: any[]) {
  return {
    _rows: rows,
    find: jest.fn().mockImplementation(({ where }: any) => {
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

function createMockRuleRepo(rules: any[]) {
  return { find: jest.fn().mockResolvedValue(rules) };
}

function createMockUserRepo(users: any[]) {
  return {
    find: jest.fn().mockImplementation(({ where }: any) => {
      const ids = where?.id?._value;
      if (Array.isArray(ids)) {
        return Promise.resolve(users.filter((u) => ids.includes(Number(u.id))));
      }
      return Promise.resolve(users);
    }),
  };
}

function createMockRecordRepo(existing: any[] = []) {
  const saved: any[] = [];
  const manager = {
    transaction: jest.fn().mockImplementation(async (cb: any) => {
      const em = {
        save: jest.fn().mockImplementation((_cls: any, entities: any[]) => {
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
    find: jest.fn().mockImplementation(({ where }: any) => {
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
    lessons?: any[];
    attendances?: any[];
    courses?: any[];
    rules?: any[];
    existing?: any[];
    users?: any[];
  } = {},
) {
  const lessonRepo = createMockLessonRepo(opts.lessons ?? []);
  const attendanceRepo = createMockAttendanceRepo(opts.attendances ?? []);
  const courseRepo = createMockCourseRepo(opts.courses ?? []);
  const ruleRepo = createMockRuleRepo(opts.rules ?? []);
  const recordRepo = createMockRecordRepo(opts.existing ?? []);
  const userRepo = createMockUserRepo(opts.users ?? []);
  const service = new SalarySettlementService(
    recordRepo as any,
    ruleRepo as any,
    lessonRepo as any,
    attendanceRepo as any,
    courseRepo as any,
    userRepo as any,
  );
  return {
    service,
    recordRepo,
    lessonRepo,
    attendanceRepo,
    courseRepo,
    ruleRepo,
    userRepo,
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
    const amounts = recordRepo._saved.map((r: any) => r.amount);
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
      (r: any) => r.source === SalaryRecordSource.BASE,
    );
    expect(base).toBeDefined();
    expect(base.amount).toBe(2000);
    expect(base.lessonId).toBeNull();
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
    const res = await service.settle('2026-07');
    const sources = recordRepo._saved.map((r: any) => r.source);
    expect(sources).not.toContain(SalaryRecordSource.LESSON_FEE);
    const base = recordRepo._saved.find(
      (r: any) => r.source === SalaryRecordSource.BASE,
    );
    expect(base).toBeDefined();
    expect(base.amount).toBe(5000);
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
    const res = await service.settle('2026-07');
    const sources = recordRepo._saved.map((r: any) => r.source);
    expect(sources).not.toContain(SalaryRecordSource.LESSON_FEE);
    const dayRecords = recordRepo._saved.filter(
      (r: any) => r.source === SalaryRecordSource.DAY,
    );
    expect(dayRecords).toHaveLength(2); // 2 个不同日期
    expect(dayRecords.map((r: any) => r.amount)).toEqual([300, 300]);
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
    const res = await service.settle('2026-07');
    const ded = recordRepo._saved.find(
      (r: any) => r.source === SalaryRecordSource.DEDUCTION,
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
    const res = await service.settle('2026-07');
    const bonus = recordRepo._saved.find(
      (r: any) => r.source === SalaryRecordSource.BONUS,
    );
    expect(bonus).toBeDefined();
    expect(bonus.amount).toBe(300); // 100 + 200
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
});
