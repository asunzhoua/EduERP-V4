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
