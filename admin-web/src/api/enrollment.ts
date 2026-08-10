import { http } from '@/utils/request'
import type { Paginated, ImportReport } from '@/types/api'

export type Subject = 'MATH' | 'ENGLISH' | 'CHINESE' | 'PHYSICS' | 'CHEMISTRY' | 'ART' | 'MUSIC' | 'DANCE' | 'SPORTS' | 'CODING' | 'OTHER'
export type ContractStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'REFUNDED' | 'FROZEN'

export interface Contract {
  id: number | string
  contractCode: string
  studentCode: string
  subject: Subject
  totalLessons: number
  remainingLessons: number
  status: ContractStatus
  validFrom: string
  validTo: string | null
  unitPrice: number | null
  totalAmount: number | null
  note: string | null
  createdAt: string
}

export interface Enrollment {
  id: number | string
  classCode: string
  studentCode: string
  contractCode: string
  status: string
  enrolledAt: string
}

export interface CreateContractPayload {
  studentCode: string
  subject: Subject
  totalLessons: number
  validFrom: string
  validTo?: string | null
  unitPrice?: number | null
  totalAmount?: number | null
  note?: string | null
}

export interface CreateEnrollmentPayload {
  classCode: string
  studentCode: string
  contractCode: string
}

export function fetchContracts(query: { studentCode?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Contract>> {
  return http.get<Paginated<Contract>>('/contracts', { params: query })
}

export function fetchStudentContracts(studentCode: string): Promise<Contract[]> {
  return http.get<Contract[]>(`/contracts/students/${studentCode}/contracts`)
}

export function createContract(payload: CreateContractPayload): Promise<Contract> {
  return http.post<Contract>('/contracts', payload)
}

export function freezeContract(code: string): Promise<Contract> {
  return http.patch<Contract>(`/contracts/${code}/freeze`)
}

export function unfreezeContract(code: string): Promise<Contract> {
  return http.patch<Contract>(`/contracts/${code}/unfreeze`)
}

export interface AdjustContractLessonsPayload {
  totalLessons?: number
  remainingLessons?: number
  reason?: string
}

export function adjustContractLessons(code: string, payload: AdjustContractLessonsPayload): Promise<Contract> {
  return http.patch<Contract>(`/contracts/${code}/lessons`, payload)
}

export function fetchEnrollments(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<Enrollment>> {
  return http.get<Paginated<Enrollment>>('/enrollments', { params: query })
}

export function createEnrollment(payload: CreateEnrollmentPayload): Promise<Enrollment> {
  return http.post<Enrollment>('/enrollments', payload)
}

export function withdrawEnrollment(id: number | string, reason: string): Promise<Enrollment> {
  return http.post<Enrollment>(`/enrollments/${id}/withdraw`, { reason })
}

// ─── 课时变更审计（管理端提醒 / 台账） ───

export type LessonAdjustmentAction = 'ADD' | 'DELETE' | 'SET'
export type LessonAdjustmentSource = 'ADMIN_MANUAL' | 'IMPORT' | 'PROMO' | 'CONTRACT_CREATE'

export interface LessonAudit {
  id: number | string
  contractId: number | string
  contractCode: string
  studentCode: string
  action: LessonAdjustmentAction
  beforeTotal: number
  afterTotal: number
  beforeRemaining: number
  afterRemaining: number
  /** 剩余课时变更量（正=增加，负=减少） */
  delta: number
  reason: string | null
  source: LessonAdjustmentSource
  operatorId: number | string
  operatorName: string | null
  createdAt: string
}

export interface LessonAuditQuery {
  action?: LessonAdjustmentAction
  source?: LessonAdjustmentSource
  operatorId?: number
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export function fetchLessonAudits(query: LessonAuditQuery = {}): Promise<Paginated<LessonAudit>> {
  return http.get<Paginated<LessonAudit>>('/admin/lesson-audits', { params: query })
}

/** 课时批量分配导入（累加语义，Excel 列：学员编码/科目/课时数） */
export function importLessons(file: File): Promise<ImportReport> {
  const form = new FormData()
  form.append('file', file)
  return http.post<ImportReport>('/contracts/import-lessons', form)
}
