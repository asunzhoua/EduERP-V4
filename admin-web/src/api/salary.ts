import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

export type SalaryRecordStatus = 'PENDING' | 'CONFIRMED' | 'PAID'

export interface SalaryRecord {
  id: number | string
  teacherId: number | string
  lessonId: number | string
  attendanceId: number | string | null
  salaryRuleId: number | string
  ruleVersion: string
  amount: number
  lessonDate: string
  duration: number
  status: SalaryRecordStatus
  notes: string | null
  createTime: string
}

export interface SalaryRule {
  id: number | string
  name: string
  type: string
  baseAmount: number
  bonusPerStudent?: number | null
  status: string
}

export interface SalaryStatistics {
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  recordCount: number
  teacherCount: number
}

export interface SalaryRecordQuery {
  status?: SalaryRecordStatus
  teacherId?: number | string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export function fetchSalaryRecords(query: SalaryRecordQuery = {}): Promise<Paginated<SalaryRecord>> {
  return http.get<Paginated<SalaryRecord>>('/salary/records', { params: query })
}

export function updateSalaryRecordStatus(id: number | string, status: SalaryRecordStatus): Promise<SalaryRecord> {
  return http.put<SalaryRecord>(`/salary/records/${id}/status`, { status })
}

export function fetchSalaryStatistics(): Promise<SalaryStatistics> {
  return http.get<SalaryStatistics>('/salary/statistics')
}

export function fetchSalaryRules(): Promise<SalaryRule[]> {
  return http.get<SalaryRule[]>('/salary/rules')
}
