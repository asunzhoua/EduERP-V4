import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

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
