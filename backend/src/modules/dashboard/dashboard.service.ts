// ---------------------------------------------------------------------------
// DashboardService
// Phase 2 — Backend capability implementation
// Aggregates business data from existing modules only.
// No new business truth, no intermediate statistics tables.
// ---------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
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
  DashboardCardsDto,
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
        scheduledDate: Between(
          this.toDateStr(today),
          this.toDateStr(tomorrow),
        ),
      },
    });

    const completedLessons = await this.lessonRepo.count({
      where: {
        scheduledDate: Between(
          this.toDateStr(today),
          this.toDateStr(tomorrow),
        ),
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
        scheduledDate: Between(
          this.toDateStr(today),
          this.toDateStr(tomorrow),
        ),
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
  // 首页 12 数据卡：全部由服务器聚合，前端禁止计算业务。
  // 口径见 DTO 注释。
  // ------------------------------------------------------------------

  async getCards(): Promise<DashboardCardsDto> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [todayIncome, monthIncome, todayLessons, todayAttendance, todayLeave, todayEnrollments, monthExpense, teacherCount, studentCount, pendingApprovals, stockAlerts] =
      await Promise.all([
        // 今日收入 = 今日新签合同 totalAmount 合计
        this.sumContractAmount(todayStart, tomorrow),
        // 本月收入 = 本月新签合同 totalAmount 合计
        this.sumContractAmount(monthStart, nextMonth),
        // 今日课时 = 今日排课数
        this.lessonRepo.count({
          where: { scheduledDate: Between(this.toDateStr(todayStart), this.toDateStr(tomorrow)) },
        }),
        // 今日签到 = 今日实际出勤消耗数
        this.attendanceRepo.count({
          where: {
            status: In(Array.from(DEDUCTIBLE_STATUSES)),
            checkInTime: Between(todayStart, tomorrow),
          },
        }),
        // 今日请假 = 今日请假单数（按请假日期，含任意状态）
        this.leaveRequestRepo.count({
          where: { leaveDate: Between(this.toDateStr(todayStart), this.toDateStr(tomorrow)) },
        }),
        // 今日报名 = 今日报名记录数
        this.enrollmentRepo.count({
          where: { enrolledAt: Between(todayStart, tomorrow) },
        }),
        // 本月支出 = 本月工资记录合计
        this.salaryRepo
          .createQueryBuilder('salary')
          .select('COALESCE(SUM(salary.amount), 0)', 'sum')
          .where('salary.createTime >= :from AND salary.createTime < :to', {
            from: monthStart,
            to: nextMonth,
          })
          .getRawOne<{ sum: string }>()
          .then((r) => Number(r?.sum || 0)),
        // 老师人数
        this.userRepo.count({
          where: { role: 'Teacher', deleted: false },
        }),
        // 学生人数
        this.studentRepo.count({
          where: { deleted: false },
        }),
        // 待审批 = 待审批请假单数
        this.leaveRequestRepo.count({
          where: { status: LeaveRequestStatus.PENDING },
        }),
        // 库存提醒 = 积分商城低库存上架商品数
        this.pointsMallService.getLowStockCount(),
      ]);

    const profit = Math.round((monthIncome - monthExpense) * 100) / 100;

    return {
      todayIncome,
      todayLessons,
      todayAttendance,
      todayLeave,
      todayEnrollments,
      monthIncome,
      monthExpense,
      profit,
      teacherCount,
      studentCount,
      pendingApprovals,
      stockAlerts,
    };
  }

  /** 聚合 [from, to) 区间内新签合同 totalAmount 合计（decimal → number）。 */
  private async sumContractAmount(from: Date, to: Date): Promise<number> {
    const row = await this.contractRepo
      .createQueryBuilder('contract')
      .select('COALESCE(SUM(contract.totalAmount), 0)', 'sum')
      .where('contract.createdAt >= :from AND contract.createdAt < :to', { from, to })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum || 0);
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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
