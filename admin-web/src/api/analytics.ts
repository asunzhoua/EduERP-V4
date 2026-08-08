import { http } from '@/utils/request'

export interface MetricItem {
  name: string
  value: number
  unit: string
}

export interface TrendData {
  date: string
  value: number
  label?: string
}

export interface MetricsResult {
  metrics: MetricItem[]
}

export interface AttendanceStatistics {
  totalRecords: number
  presentCount: number
  absentCount: number
  leaveCount: number
  lateCount: number
  attendanceRate: number
  byDate: Array<{ date: string; present: number; absent: number; leave: number; late: number; total: number }>
  byCourse: Array<{ courseCode: string; present: number; absent: number; leave: number; late: number; total: number }>
}

export interface ConsumptionStatistics {
  totalConsumed: number
  totalRemaining: number
  totalLessons: number
  completedLessons: number
  consumptionTrend: TrendData[]
  byStudent: Array<{ studentCode: string; consumed: number; remaining: number; total: number }>
  byCourse: Array<{ subject: string; consumed: number; remaining: number; total: number }>
}

export interface InstitutionTrend {
  lessonTrend: TrendData[]
  enrollmentTrend: TrendData[]
}

export interface TeacherTrend {
  lessonTrend: TrendData[]
  attendanceTrend: TrendData[]
}

export interface StudentTrend {
  learningTrend: TrendData[]
  attendanceTrend: TrendData[]
}

export function fetchInstitutionMetrics(): Promise<MetricsResult> {
  return http.get<MetricsResult>('/analytics/institution')
}

export function fetchInstitutionTrend(days = 30): Promise<InstitutionTrend> {
  return http.get<InstitutionTrend>('/analytics/institution/trend', { params: { days } })
}

export function fetchTeacherMetrics(teacherId: number | string): Promise<MetricsResult> {
  return http.get<MetricsResult>(`/analytics/teacher/${teacherId}`)
}

export function fetchTeacherTrend(teacherId: number | string, days = 30): Promise<TeacherTrend> {
  return http.get<TeacherTrend>(`/analytics/teacher/${teacherId}/trend`, { params: { days } })
}

export function fetchStudentMetrics(studentCode: string): Promise<MetricsResult> {
  return http.get<MetricsResult>(`/analytics/student/${studentCode}`)
}

export function fetchStudentTrend(studentCode: string, days = 30): Promise<StudentTrend> {
  return http.get<StudentTrend>(`/analytics/student/${studentCode}/trend`, { params: { days } })
}

export function fetchAttendanceStatistics(): Promise<AttendanceStatistics> {
  return http.get<AttendanceStatistics>('/analytics/attendance-statistics')
}

export function fetchConsumptionStatistics(days = 30): Promise<ConsumptionStatistics> {
  return http.get<ConsumptionStatistics>('/analytics/consumption-statistics', { params: { days } })
}
