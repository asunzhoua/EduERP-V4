import { http } from '@/utils/request'

// ─── 类型 ───

export type SalaryRecordStatus = 'PENDING' | 'APPROVED' | 'PAID'
export type SalaryRecordSource =
  | 'LESSON_FEE'
  | 'BASE'
  | 'DAY'
  | 'BONUS'
  | 'DEDUCTION'

export interface SalaryRecord {
  id: number | string
  teacherId: number | string
  lessonId: number | string | null
  attendanceId: number | string | null
  salaryRuleId: number | string
  source: SalaryRecordSource
  month: string
  ruleVersion: string
  amount: number
  lessonDate: string | null
  duration: number | null
  studentCount: number | null
  needsReview: boolean
  status: SalaryRecordStatus
  notes: string | null
  createdBy: number | string
  createTime: string
}

export interface SalaryStatistics {
  year: number
  month: string
  monthNum: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  totalRecords: number
  recordCount: number
  teacherCount: number
  totalMinutes: number
}

export interface SalaryRecordQuery {
  teacherId?: number | string
  month?: string
  startDate?: string
  endDate?: string
  status?: SalaryRecordStatus
  source?: SalaryRecordSource
  page?: number
  pageSize?: number
}

export interface PaginatedRecords {
  records: SalaryRecord[]
  total: number
  page: number
  pageSize: number
}

export interface TierConfig {
  min: number
  max: number | null
  pricePerLesson?: number
  pricePerHead?: number
}

export interface BonusConfig {
  fullAttendance?: number
  lessonTarget?: { threshold?: number; amount?: number }
}

export interface DeductionConfig {
  latePerOccurrence?: number
  absentPerOccurrence?: number
}

export interface SalaryRuleConfig {
  lessonPrice?: number
  pricePerHead?: number
  headcountTiers?: TierConfig[]
  lessonTiers?: TierConfig[]
  baseSalary?: number
  minLessonForBase?: number
  bonus?: BonusConfig
  deductions?: DeductionConfig
  effectiveFrom?: string
  effectiveTo?: string
}

export interface SalaryRule {
  id: number | string
  name: string
  type: string
  baseAmount: number
  multiplier: number
  courseType: string | null
  teacherLevel: string | null
  isActive: boolean
  config: SalaryRuleConfig | null
  note: string | null
  createdBy: number | string
  createTime: string
  updateTime: string
}

export interface CreateSalaryRuleDto {
  name: string
  type: string
  baseAmount: number
  multiplier?: number
  courseType?: string
  teacherLevel?: string
  isActive?: boolean
  config?: SalaryRuleConfig
  note?: string
}

export interface SettleResult {
  month: string
  teacherId?: number
  teachers: number
  lessons: number
  created: number
  skipped: number
  summary: { source: string; count: number; amount: number }[]
}

// ─── 接口 ───

export function fetchSalaryRecords(query: SalaryRecordQuery = {}): Promise<PaginatedRecords> {
  return http.get<PaginatedRecords>('/salary/records', { params: query })
}

export function updateSalaryRecordStatus(
  id: number | string,
  status: SalaryRecordStatus,
  notes?: string,
): Promise<SalaryRecord> {
  return http.put<SalaryRecord>(`/salary/records/${id}/status`, { status, notes })
}

export function fetchSalaryStatistics(query: { year?: number; month?: number } = {}): Promise<SalaryStatistics> {
  return http.get<SalaryStatistics>('/salary/statistics', { params: query })
}

export function settleSalary(month: string, teacherId?: number | string): Promise<SettleResult> {
  return http.post<SettleResult>('/salary/settle', { month, teacherId })
}

export function fetchSalaryRules(activeOnly = true): Promise<SalaryRule[]> {
  return http.get<SalaryRule[]>('/salary/rules', { params: { activeOnly } })
}

export function fetchSalaryRule(id: number | string): Promise<SalaryRule> {
  return http.get<SalaryRule>(`/salary/rules/${id}`)
}

export function createSalaryRule(dto: CreateSalaryRuleDto): Promise<SalaryRule> {
  return http.post<SalaryRule>('/salary/rules', dto)
}

export function updateSalaryRule(id: number | string, dto: Partial<CreateSalaryRuleDto>): Promise<SalaryRule> {
  return http.put<SalaryRule>(`/salary/rules/${id}`, dto)
}

export function deleteSalaryRule(id: number | string): Promise<void> {
  return http.delete<void>(`/salary/rules/${id}`)
}
