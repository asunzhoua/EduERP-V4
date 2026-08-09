// ---------------------------------------------------------------------------
// DashboardService
// Phase 2 — Backend capability implementation
// Aggregates business data from existing modules only.
// No new business truth, no intermediate statistics tables.
// ---------------------------------------------------------------------------

import { Injectable, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';

// Entities
import { LessonEntity } from '@modules/teaching/lesson/lesson.entity';
import { LessonStatus } from '@modules/teaching/lesson/enums/lesson-status.enum';
import { Student } from '@modules/student/entities/student.entity';
import { StudentStatus } from '@modules/student/enums/student-status.enum';
import { ContractEntity } from '@modules/teaching/contract/contract.entity';
import { ContractStatus } from '@modules/teaching/contract/enums/contract-status.enum';
import { LessonExceptionEntity } from '@modules/teaching/lesson/lesson-exception/lesson-exception.entity';
import { SalaryRecordEntity } from '@modules/salary/entities/salary-record.entity';
import { User } from '@modules/identity/entities/user.entity';
import { UserStatus } from '@modules/identity/entities/user.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { LessonAttendanceEntity } from '@modules/teaching/lesson-attendance/lesson-attendance.entity';
import { EnrollmentEntity } from '@modules/teaching/enrollment/enrollment.entity';
import {
  LeaveRequestEntity,
  LeaveRequestStatus,
} from '@modules/teaching/leave-request/leave-request.entity';
import { PointsMallService } from '@modules/admin/points-mall.service';
import { DEDUCTIBLE_STATUSES } from '@modules/teaching/lesson-attendance/enums/attendance-status.enum';

// DTOs
import {
  DashboardOverviewDto,
  LessonStatsDto,
  StudentStatsDto,
  TeacherStatsDto,
  FinanceStatsDto,
  DashboardSummaryDto,
  DashboardWorkbenchDto,
  WorkbenchGroup,
  WorkbenchTrend,
  WorkbenchTrendPoint,
  WorkbenchTodo,
  WorkbenchTimeType,
  WORKBENCH_TIME_TYPES,
} from './dto/dashboard-response.dto';

// getRawOne 聚合结果：COALESCE 返回的列均为字符串
type ContractAgg = { total?: string; remaining?: string; consumed?: string };

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,

    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,

    @InjectRepository(ContractEntity)
    private readonly contractRepo: Repository<ContractEntity>,

    @InjectRepository(LessonExceptionEntity)
    private readonly exceptionRepo: Repository<LessonExceptionEntity>,

    @InjectRepository(SalaryRecordEntity)
    private readonly salaryRepo: Repository<SalaryRecordEntity>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,

    @InjectRepository(LessonAttendanceEntity)
    private readonly attendanceRepo: Repository<LessonAttendanceEntity>,

    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepo: Repository<EnrollmentEntity>,

    @InjectRepository(LeaveRequestEntity)
    private readonly leaveRequestRepo: Repository<LeaveRequestEntity>,

    private readonly pointsMallService: PointsMallService,

    // 可注入时钟：测试固定 now，生产默认 new Date()（module 提供 DASHBOARD_NOW）
    @Optional()
    @Inject('DASHBOARD_NOW')
    private readonly nowFn?: () => Date,
  ) {}

  // ------------------------------------------------------------------
  // 2.1 getOverview
  // ------------------------------------------------------------------

  async getOverview(): Promise<DashboardOverviewDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ── 今日运营 ──

    const todayLessons = await this.lessonRepo.count({
      where: {
        scheduledDate: Between(this.toDateStr(today), this.toDateStr(tomorrow)),
      },
    });

    const completedLessons = await this.lessonRepo.count({
      where: {
        scheduledDate: Between(this.toDateStr(today), this.toDateStr(tomorrow)),
        status: LessonStatus.FINISHED,
      },
    });

    const leaveCount = await this.exceptionRepo.count({
      where: {
        exceptionType: In(['LEAVE_SICK', 'LEAVE_PERSONAL']),
        startTime: Between(today, tomorrow),
      },
    });

    // ── 学员情况 ──

    const totalStudents = await this.studentRepo.count({
      where: { status: StudentStatus.ACTIVE },
    });

    const newStudents = await this.studentRepo.count({
      where: {
        status: StudentStatus.ACTIVE,
        createTime: Between(today, tomorrow),
      },
    });

    const activeContracts = await this.contractRepo.find({
      where: { status: ContractStatus.ACTIVE },
    });
    const remainingLessons = activeContracts.reduce(
      (sum, c) => sum + c.remainingLessons,
      0,
    );
    const consumedLessons = activeContracts.reduce(
      (sum, c) => sum + (c.totalLessons - c.remainingLessons),
      0,
    );

    // ── 教师情况 ──

    const teachingCount = await this.lessonRepo.count({
      where: {
        scheduledDate: Between(this.toDateStr(today), this.toDateStr(tomorrow)),
        status: LessonStatus.FINISHED,
      },
    });

    // ── 本月工资 ──

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const salaryRecords = await this.salaryRepo.find({
      where: {
        createTime: Between(currentMonth, nextMonth),
      },
    });
    const monthlySalary = salaryRecords.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    // ── 财务情况 ──
    // Payment / Ledger entities 尚未实现，todayIncome 保留为占位 0
    const todayIncome = 0;

    // 课时消耗价值
    const consumedValue = activeContracts.reduce((sum, c) => {
      const consumed = c.totalLessons - c.remainingLessons;
      return sum + consumed * Number(c.unitPrice || 0);
    }, 0);

    return {
      today: {
        totalLessons: todayLessons,
        completedLessons,
        leaveCount,
        consumedLessons,
      },
      students: {
        total: totalStudents,
        newToday: newStudents,
        remainingLessons,
      },
      teachers: {
        teachingCount,
        monthlySalary,
      },
      finance: {
        todayIncome,
        consumedValue,
      },
    };
  }

  // ------------------------------------------------------------------
  // 2.6 getSummary
  // 综合概览：总量 + 合同维度 + 实际出勤维度（口径分离，见方案 M4）
  // ------------------------------------------------------------------

  async getSummary(): Promise<DashboardSummaryDto> {
    const totalClasses = await this.classRepo.count({
      where: { deleted: false },
    });
    const totalStudents = await this.studentRepo.count({
      where: { deleted: false },
    });
    const totalTeachers = await this.userRepo.count({
      where: { role: 'Teacher' },
    });

    // 合同维度：全量合同（含非活动）
    const contractAgg = await this.contractRepo
      .createQueryBuilder('contract')
      .select('COALESCE(SUM(contract.totalLessons), 0)', 'total')
      .addSelect('COALESCE(SUM(contract.remainingLessons), 0)', 'remaining')
      .addSelect(
        'COALESCE(SUM(contract.totalLessons - contract.remainingLessons), 0)',
        'consumed',
      )
      .getRawOne<ContractAgg>();

    const totalContractHours = parseInt(contractAgg?.total || '0', 10);
    const remainingContractHours = parseInt(contractAgg?.remaining || '0', 10);
    const consumedContractHours = parseInt(contractAgg?.consumed || '0', 10);

    // 实际出勤维度：按 checkInTime 落在区间聚合
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7)); // 周一为一周起点

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYear = new Date(now.getFullYear() + 1, 0, 1);

    const deductibleStatuses = Array.from(DEDUCTIBLE_STATUSES);

    const [today, week, month, year] = await Promise.all([
      this.attendanceRepo.count({
        where: {
          status: In(deductibleStatuses),
          checkInTime: Between(todayStart, tomorrow),
        },
      }),
      this.attendanceRepo.count({
        where: {
          status: In(deductibleStatuses),
          checkInTime: Between(weekStart, tomorrow),
        },
      }),
      this.attendanceRepo.count({
        where: {
          status: In(deductibleStatuses),
          checkInTime: Between(monthStart, nextMonth),
        },
      }),
      this.attendanceRepo.count({
        where: {
          status: In(deductibleStatuses),
          checkInTime: Between(yearStart, nextYear),
        },
      }),
    ]);

    return {
      totalClasses,
      totalStudents,
      totalTeachers,
      totalContractHours,
      consumedContractHours,
      remainingContractHours,
      attendance: { today, week, month, year },
    };
  }

  // ------------------------------------------------------------------
  // 2.1b getCards
  // 工作台式首页统计（演进自 12 数据卡）：4 组统计卡 + 3 条近 30 日趋势 + 待办。
  // timeType=day|week|month|year|all，非法/缺失默认 month。口径见 DTO 注释与设计文档。
  // ------------------------------------------------------------------

  async getCards(timeType: string = 'month'): Promise<DashboardWorkbenchDto> {
    const tt = this.normalizeTimeType(timeType);
    const { from, to } = this.resolveWindow(tt);
    // from/to 同生同灭；windowed 非空即两者皆有，便于类型收窄
    const windowed = from !== null && to !== null ? { from, to } : null;

    // 窗口聚合与存量指标并行取数；Promise.all 数组顺序即 mockResolvedValueOnce 消费顺序。
    const [
      studentCount,
      classCount,
      teacherCount,
      remainingLessons,
      enrollmentCount,
      newStudentCount,
      contractAmount,
      expense,
      consumedLessons,
      scheduledLessons,
      leaveCount,
      pendingApprovals,
      stockAlerts,
    ] = await Promise.all([
      // 存量：不受 timeType 影响
      this.studentRepo.count({ where: { deleted: false } }),
      this.classRepo.count({ where: { deleted: false } }),
      this.userRepo.count({ where: { role: 'Teacher', deleted: false } }),
      this.sumRemainingLessons(),
      // 窗口聚合（all 不设时间过滤）
      this.enrollmentRepo.count(
        windowed
          ? { where: { enrolledAt: Between(windowed.from, windowed.to) } }
          : {},
      ),
      this.studentRepo.count(
        windowed
          ? {
              where: {
                deleted: false,
                createTime: Between(windowed.from, windowed.to),
              },
            }
          : { where: { deleted: false } },
      ),
      this.sumContractAmount(windowed?.from ?? null, windowed?.to ?? null),
      this.sumSalaryAmount(windowed?.from ?? null, windowed?.to ?? null),
      this.attendanceRepo.count(
        windowed
          ? {
              where: {
                status: In(Array.from(DEDUCTIBLE_STATUSES)),
                checkInTime: Between(windowed.from, windowed.to),
              },
            }
          : { where: { status: In(Array.from(DEDUCTIBLE_STATUSES)) } },
      ),
      this.lessonRepo.count(
        windowed
          ? {
              where: {
                scheduledDate: Between(
                  this.toDateStr(windowed.from),
                  this.toDateStr(windowed.to),
                ),
              },
            }
          : {},
      ),
      this.leaveRequestRepo.count(
        windowed
          ? {
              where: {
                leaveDate: Between(
                  this.toDateStr(windowed.from),
                  this.toDateStr(windowed.to),
                ),
              },
            }
          : {},
      ),
      // 待办存量
      this.leaveRequestRepo.count({
        where: { status: LeaveRequestStatus.PENDING },
      }),
      this.pointsMallService.getLowStockCount(),
    ]);

    const income = contractAmount;
    const profit = Math.round((income - expense) * 100) / 100;

    const [consumptionTrend, attendanceTrend, financeTrend] = await Promise.all(
      [
        this.consumptionDailyTrend(30),
        this.attendanceDailyTrend(30),
        this.contractDailyTrend(30),
      ],
    );

    const groups: WorkbenchGroup[] = [
      {
        key: 'teaching',
        title: '教务',
        metrics: [
          {
            key: 'studentCount',
            label: '学员总数',
            value: studentCount,
            link: '/students',
          },
          {
            key: 'classCount',
            label: '班级总数',
            value: classCount,
            link: '/classes',
          },
          {
            key: 'teacherCount',
            label: '教师总数',
            value: teacherCount,
            link: '/teachers',
          },
          {
            key: 'remainingLessons',
            label: '剩余课时',
            value: remainingLessons,
            link: '/students',
          },
        ],
      },
      {
        key: 'recruitment',
        title: '招生',
        metrics: [
          {
            key: 'enrollmentCount',
            label: '报名数',
            value: enrollmentCount,
            link: '/enrollments',
          },
          {
            key: 'newStudentCount',
            label: '新增学员',
            value: newStudentCount,
            link: '/students',
          },
          {
            key: 'contractAmount',
            label: '新签合同额',
            value: contractAmount,
            money: true,
            link: '/enrollments',
          },
        ],
      },
      {
        key: 'finance',
        title: '财务',
        metrics: [
          {
            key: 'income',
            label: '收入',
            value: income,
            money: true,
            link: '/salary',
          },
          {
            key: 'expense',
            label: '支出',
            value: expense,
            money: true,
            link: '/salary',
          },
          {
            key: 'profit',
            label: '利润',
            value: profit,
            money: true,
            link: '/salary',
          },
        ],
      },
      {
        key: 'consumption',
        title: '消课',
        metrics: [
          {
            key: 'consumedLessons',
            label: '消课课时',
            value: consumedLessons,
            link: '/lessons',
          },
          {
            key: 'scheduledLessons',
            label: '上课课时',
            value: scheduledLessons,
            link: '/lessons',
          },
          {
            key: 'leaveCount',
            label: '请假次数',
            value: leaveCount,
            link: '/leave-requests',
          },
        ],
      },
    ];

    const trends: WorkbenchTrend[] = [
      consumptionTrend,
      attendanceTrend,
      financeTrend,
    ];

    const todos: WorkbenchTodo[] = [
      {
        key: 'leave',
        label: '待审批请假',
        count: pendingApprovals,
        link: '/leave-requests',
      },
      {
        key: 'stock',
        label: '库存提醒',
        count: stockAlerts,
        link: '/points-mall',
      },
    ];

    return { timeType: tt, groups, trends, todos };
  }

  // ─── 工作台私有方法 ───────────────────────────────────────────────────

  private now(): Date {
    return this.nowFn ? this.nowFn() : new Date();
  }

  /** timeType 白名单校验；非法/缺失回退 month。 */
  private normalizeTimeType(timeType: string): WorkbenchTimeType {
    return (WORKBENCH_TIME_TYPES as readonly string[]).includes(timeType)
      ? (timeType as WorkbenchTimeType)
      : 'month';
  }

  /**
   * 解析 timeType 时间窗口 [from, to)。
   * day=今日 0 点起；week=本周一 0 点起；month=本月 1 号起；year=本年 1 月 1 日起；all=null（不设过滤）。
   */
  private resolveWindow(timeType: WorkbenchTimeType): {
    from: Date | null;
    to: Date | null;
  } {
    if (timeType === 'all') return { from: null, to: null };
    const now = this.now();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (timeType) {
      case 'day':
        return { from: todayStart, to: tomorrow };
      case 'week': {
        const weekStart = new Date(todayStart);
        weekStart.setDate(
          todayStart.getDate() - ((todayStart.getDay() + 6) % 7),
        ); // 周一为一周起点
        return { from: weekStart, to: tomorrow };
      }
      case 'month':
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        };
      case 'year':
        return {
          from: new Date(now.getFullYear(), 0, 1),
          to: new Date(now.getFullYear() + 1, 0, 1),
        };
      default:
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        };
    }
  }

  /** 活跃合同剩余课时求和（存量）。 */
  private async sumRemainingLessons(): Promise<number> {
    const activeContracts = await this.contractRepo.find({
      where: { status: ContractStatus.ACTIVE },
    });
    return activeContracts.reduce((sum, c) => sum + c.remainingLessons, 0);
  }

  /** 聚合 [from, to) 区间内新签合同 totalAmount 合计（decimal → number）；all 时全量。 */
  private async sumContractAmount(
    from: Date | null,
    to: Date | null,
  ): Promise<number> {
    const qb = this.contractRepo
      .createQueryBuilder('contract')
      .select('COALESCE(SUM(contract.totalAmount), 0)', 'sum');
    if (from) {
      qb.where('contract.createdAt >= :from AND contract.createdAt < :to', {
        from,
        to,
      });
    }
    const row = await qb.getRawOne<{ sum: string }>();
    return Number(row?.sum || 0);
  }

  /** 聚合 [from, to) 区间内工资记录 amount 合计；all 时全量。 */
  private async sumSalaryAmount(
    from: Date | null,
    to: Date | null,
  ): Promise<number> {
    const qb = this.salaryRepo
      .createQueryBuilder('salary')
      .select('COALESCE(SUM(salary.amount), 0)', 'sum');
    if (from) {
      qb.where('salary.createTime >= :from AND salary.createTime < :to', {
        from,
        to,
      });
    }
    const row = await qb.getRawOne<{ sum: string }>();
    return Number(row?.sum || 0);
  }

  /** 近 days 天每日序列（升序，含今日），date 为 YYYY-MM-DD。 */
  private lastNDays(days: number): Date[] {
    const now = this.now();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const result: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      result.push(d);
    }
    return result;
  }

  private addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  /** 将按日分组结果填进固定天数序列，缺失日补 0。 */
  private fillDailySeries(
    days: Date[],
    map: Map<string, number>,
  ): WorkbenchTrendPoint[] {
    return days.map((d) => ({
      date: this.toDateStr(d),
      value: map.get(this.toDateStr(d)) || 0,
    }));
  }

  private dailyKey(row: { date?: unknown }): string {
    const val = row.date;
    return typeof val === 'string'
      ? val.substring(0, 10)
      : this.toDateStr(val as Date);
  }

  /** 趋势·消课：近 30 日实际出勤消耗数（DEDUCTIBLE 考勤按日）。 */
  private async consumptionDailyTrend(days: number): Promise<WorkbenchTrend> {
    const range = this.lastNDays(days);
    const startDate = this.toDateStr(range[0]);
    const nextDay = this.toDateStr(this.addDays(range[range.length - 1], 1));
    const rows = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .select('DATE(attendance.checkInTime)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('attendance.checkInTime >= :startDate', { startDate })
      .andWhere('attendance.checkInTime < :nextDay', { nextDay })
      .andWhere('attendance.status IN (:...statuses)', {
        statuses: Array.from(DEDUCTIBLE_STATUSES),
      })
      .groupBy('date')
      .getRawMany<{ date?: unknown; count: string }>();
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(this.dailyKey(row), parseInt(row.count, 10));
    }
    return {
      name: 'consumption',
      title: '消课',
      data: this.fillDailySeries(range, map),
    };
  }

  /** 趋势·考勤：近 30 日考勤记录数（全状态按日，含未消课记录）。 */
  private async attendanceDailyTrend(days: number): Promise<WorkbenchTrend> {
    const range = this.lastNDays(days);
    const startDate = this.toDateStr(range[0]);
    const nextDay = this.toDateStr(this.addDays(range[range.length - 1], 1));
    const rows = await this.attendanceRepo
      .createQueryBuilder('attendance')
      .select('DATE(attendance.checkInTime)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('attendance.checkInTime >= :startDate', { startDate })
      .andWhere('attendance.checkInTime < :nextDay', { nextDay })
      .groupBy('date')
      .getRawMany<{ date?: unknown; count: string }>();
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(this.dailyKey(row), parseInt(row.count, 10));
    }
    return {
      name: 'attendance',
      title: '考勤',
      data: this.fillDailySeries(range, map),
    };
  }

  /** 趋势·财务：近 30 日每日新签合同额（createdAt 按日）。 */
  private async contractDailyTrend(days: number): Promise<WorkbenchTrend> {
    const range = this.lastNDays(days);
    const startDate = this.toDateStr(range[0]);
    const nextDay = this.toDateStr(this.addDays(range[range.length - 1], 1));
    const rows = await this.contractRepo
      .createQueryBuilder('contract')
      .select('DATE(contract.createdAt)', 'date')
      .addSelect('COALESCE(SUM(contract.totalAmount), 0)', 'amount')
      .where('contract.createdAt >= :startDate', { startDate })
      .andWhere('contract.createdAt < :nextDay', { nextDay })
      .groupBy('date')
      .getRawMany<{ date?: unknown; amount: string }>();
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(this.dailyKey(row), Number(row.amount || 0));
    }
    return {
      name: 'finance',
      title: '财务',
      data: this.fillDailySeries(range, map),
    };
  }

  // ------------------------------------------------------------------
  // 2.2 getLessons
  // ------------------------------------------------------------------

  async getLessons(): Promise<LessonStatsDto> {
    const totalLessons = await this.lessonRepo.count();

    const completedLessons = await this.lessonRepo.count({
      where: { status: LessonStatus.FINISHED },
    });

    const cancelledLessons = await this.lessonRepo.count({
      where: { status: LessonStatus.CANCELLED },
    });

    const suspendedLessons = await this.lessonRepo.count({
      where: { status: LessonStatus.SUSPENDED },
    });

    return {
      totalLessons,
      completedLessons,
      cancelledLessons,
      suspendedLessons,
    };
  }

  // ------------------------------------------------------------------
  // 2.3 getStudents
  // ------------------------------------------------------------------

  async getStudents(): Promise<StudentStatsDto> {
    const totalStudents = await this.studentRepo.count({
      where: { deleted: false },
    });

    const activeStudents = await this.studentRepo.count({
      where: { status: StudentStatus.ACTIVE, deleted: false },
    });

    // 本月新增学员
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    const newStudentsThisMonth = await this.studentRepo.count({
      where: {
        deleted: false,
        createTime: Between(monthStart, now),
      },
    });

    // 剩余课时（ACTIVE contracts）
    const activeContracts = await this.contractRepo.find({
      where: { status: ContractStatus.ACTIVE },
    });
    const totalRemainingLessons = activeContracts.reduce(
      (sum, c) => sum + c.remainingLessons,
      0,
    );

    return {
      totalStudents,
      activeStudents,
      newStudentsThisMonth,
      totalRemainingLessons,
    };
  }

  // ------------------------------------------------------------------
  // 2.4 getTeachers
  // ------------------------------------------------------------------

  async getTeachers(): Promise<TeacherStatsDto> {
    const totalTeachers = await this.userRepo.count({
      where: { role: 'Teacher' },
    });

    const activeTeachers = await this.userRepo.count({
      where: { role: 'Teacher', status: UserStatus.ACTIVE },
    });

    // 本月课时数
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const totalLessonsThisMonth = await this.lessonRepo.count({
      where: {
        scheduledDate: Between(
          this.toDateStr(monthStart),
          this.toDateStr(monthEnd),
        ),
      },
    });

    // 本月工资（SalaryRecord 按 createTime 聚合）
    const salaryRecords = await this.salaryRepo.find({
      where: {
        createTime: Between(monthStart, monthEnd),
      },
    });
    const totalSalaryThisMonth = salaryRecords.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    return {
      totalTeachers,
      activeTeachers,
      totalLessonsThisMonth,
      totalSalaryThisMonth,
    };
  }

  // ------------------------------------------------------------------
  // 2.5 getFinance
  // ------------------------------------------------------------------

  async getFinance(): Promise<FinanceStatsDto> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Payment / Ledger 尚未实现, income 字段保留为 0
    const totalIncome = 0;
    const todayIncome = 0;
    const monthIncome = 0;

    // 课时消耗价值
    const activeContracts = await this.contractRepo.find({
      where: { status: ContractStatus.ACTIVE },
    });
    const consumedValue = activeContracts.reduce((sum, c) => {
      const consumed = c.totalLessons - c.remainingLessons;
      return sum + consumed * Number(c.unitPrice || 0);
    }, 0);

    return {
      totalIncome,
      todayIncome,
      monthIncome,
      consumedValue,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /**
   * Format a Date to YYYY-MM-DD string (matching LessonEntity.scheduledDate type).
   */
  private toDateStr(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
