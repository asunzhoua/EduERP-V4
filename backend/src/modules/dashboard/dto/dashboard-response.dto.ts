// ---------------------------------------------------------------------------
// Dashboard Aggregation DTOs
// Phase 2 — Backend capability implementation
// Data sources: Lesson, Enrollment, Contract, LessonException, SalaryRecord, User
// ---------------------------------------------------------------------------

export class TodayOverview {
  totalLessons: number;
  completedLessons: number;
  leaveCount: number;
  consumedLessons: number;
}

export class StudentOverview {
  total: number;
  newToday: number;
  remainingLessons: number;
}

export class TeacherOverview {
  teachingCount: number;
  monthlySalary: number;
}

export class FinanceOverview {
  todayIncome: number;
  consumedValue: number;
}

export class DashboardOverviewDto {
  today: TodayOverview;
  students: StudentOverview;
  teachers: TeacherOverview;
  finance: FinanceOverview;
}

// ─── Stats DTOs ────────────────────────────────────────────────────────────

export class LessonStatsDto {
  totalLessons: number;
  completedLessons: number;
  cancelledLessons: number;
  suspendedLessons: number;
}

export class StudentStatsDto {
  totalStudents: number;
  activeStudents: number;
  newStudentsThisMonth: number;
  totalRemainingLessons: number;
}

export class TeacherStatsDto {
  totalTeachers: number;
  activeTeachers: number;
  totalLessonsThisMonth: number;
  totalSalaryThisMonth: number;
}

export class FinanceStatsDto {
  totalIncome: number;
  todayIncome: number;
  monthIncome: number;
  consumedValue: number;
}

// ─── Summary DTOs ───────────────────────────────────────────────────────────

export class AttendanceConsumptionDto {
  today: number;
  week: number;
  month: number;
  year: number;
}

export class DashboardSummaryDto {
  totalClasses: number;
  totalStudents: number;
  totalTeachers: number;
  totalContractHours: number;
  consumedContractHours: number;
  remainingContractHours: number;
  attendance: AttendanceConsumptionDto;
}

// ─── 首页 12 数据卡 DTO ───────────────────────────────────────────────────────

/**
 * 首页固定 12 张数据卡（WebDashboardDesign.md 三）。
 *
 * 数据口径（全部由服务器聚合，前端禁止计算业务）：
 * - todayIncome      今日收入 = 今日新签合同 totalAmount 合计（合同即报名收费）
 * - todayLessons     今日课时 = 今日排课课时数
 * - todayAttendance  今日签到 = 今日实际出勤消耗数（考勤扣课时口径）
 * - todayLeave       今日请假 = 今日请假单数（leave_request）
 * - todayEnrollments 今日报名 = 今日报名记录数（enrollment）
 * - monthIncome      本月收入 = 本月新签合同 totalAmount 合计
 * - monthExpense     本月支出 = 本月工资记录 amount 合计（SalaryRecord）
 * - profit           利润     = monthIncome - monthExpense
 * - teacherCount     老师人数 = role=Teacher 且未删除用户数
 * - studentCount     学生人数 = 未删除学生数
 * - pendingApprovals 待审批   = 待审批请假单数（leave_request PENDING）
 * - stockAlerts      库存提醒 = 积分商城低库存商品数（积分模块落地后接入，当前 0）
 */
export class DashboardCardsDto {
  todayIncome: number;
  todayLessons: number;
  todayAttendance: number;
  todayLeave: number;
  todayEnrollments: number;
  monthIncome: number;
  monthExpense: number;
  profit: number;
  teacherCount: number;
  studentCount: number;
  pendingApprovals: number;
  stockAlerts: number;
}
