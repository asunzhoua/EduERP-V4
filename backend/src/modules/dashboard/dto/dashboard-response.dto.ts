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

// ─── 工作台 DTO（2026-08-09 演进 /dashboard/cards）────────────────────────

/** timeType 合法值；非法/缺失默认 month（契约，见 DTO 注释与 spec）。 */
export const WORKBENCH_TIME_TYPES = [
  'day',
  'week',
  'month',
  'year',
  'all',
] as const;
export type WorkbenchTimeType = (typeof WORKBENCH_TIME_TYPES)[number];

/**
 * 工作台统计卡指标。
 * 口径（全部由服务器聚合，前端禁止计算业务）：
 * - 窗口聚合：报名数/新增学员/新签合同额/收入/支出/消课/上课/请假（timeType 决定 [from,to)）
 * - 存量：学员/班级/教师总数、剩余课时（不受 timeType 影响）
 * - 收入 = 新签合同总额（占位口径：EduERP 无真实收支流水）
 */
export class WorkbenchMetric {
  key: string;
  label: string;
  value: number;
  money?: boolean;
  unit?: string;
  link?: string;
}

export class WorkbenchGroup {
  key: 'teaching' | 'recruitment' | 'finance' | 'consumption';
  title: string;
  metrics: WorkbenchMetric[];
}

export class WorkbenchTrendPoint {
  date: string;
  value: number;
}

export class WorkbenchTrend {
  name: 'consumption' | 'attendance' | 'finance';
  title: string;
  data: WorkbenchTrendPoint[];
}

export class WorkbenchTodo {
  key: string;
  label: string;
  count: number;
  link: string;
}

/**
 * 工作台响应（GET /dashboard/cards?timeType=day|week|month|year|all，默认 month）。
 * - timeType 语义：day=今日 0 点起；week=本周一 0 点起；month=本月 1 号起；year=本年 1 月 1 日起；all=不设时间过滤（全量聚合）。
 * - trends：三组折线统一为近 30 日每日序列（与时间维度解耦）；更长跨度走既有 analytics 趋势接口（trend?days=）。
 */
export class DashboardWorkbenchDto {
  timeType: WorkbenchTimeType;
  groups: WorkbenchGroup[];
  trends: WorkbenchTrend[];
  todos: WorkbenchTodo[];
}
