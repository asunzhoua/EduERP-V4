import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

export interface Parent {
  id: number | string
  username: string
  name: string
  mobile: string
  role: string
  status: number
  createTime: string
}

export interface ParentQuery {
  keyword?: string
  status?: number | string
  page?: number
  pageSize?: number
}

export interface CreateParentPayload {
  username: string
  password: string
  name: string
  mobile: string
  studentId?: number | null
}

export interface ParentStudent {
  id: number | string
  studentId: number | string
  parentId: number | string
  relation?: string | null
  isPrimary?: boolean
  student: {
    id: number | string
    studentCode: string
    name: string
    school?: string | null
    grade?: string | null
  }
}

export function fetchParents(query: ParentQuery = {}): Promise<Paginated<Parent>> {
  return http.get<Paginated<Parent>>('/auth/admin/parents', { params: query })
}

export function createParent(payload: CreateParentPayload): Promise<Parent> {
  return http.post<Parent>('/auth/admin/parents', payload)
}

export function updateParentStatus(id: number | string, status: number): Promise<Parent> {
  return http.patch<Parent>(`/auth/admin/parents/${id}/status`, { status: String(status) })
}

export function fetchParentStudents(parentId: number | string): Promise<ParentStudent[]> {
  return http.get<ParentStudent[]>(`/students/parents/${parentId}/students`)
}

export function linkStudentToParent(
  studentId: number | string,
  parentId: number | string,
  relation?: string,
  isPrimary?: boolean,
): Promise<unknown> {
  return http.post(`/students/${studentId}/parents`, { parentId, relation, isPrimary })
}

export function unlinkStudentFromParent(
  studentId: number | string,
  parentId: number | string,
): Promise<unknown> {
  return http.delete(`/students/${studentId}/parents/${parentId}`)
}

export function resetParentPassword(
  id: number | string,
  payload: { operatorPassword: string; newPassword: string; reason?: string },
): Promise<unknown> {
  return http.post(`/auth/admin/users/${id}/reset-password`, payload)
}
