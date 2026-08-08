import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

export interface Teacher {
  id: number | string
  username: string
  name: string
  mobile: string
  role: string
  status: number
  avatar: string | null
  teacherLevel: string | null
  teachingCount: number
  monthSalary: number
  createTime: string
}

export interface TeacherQuery {
  keyword?: string
  status?: number | string
  page?: number
  pageSize?: number
}

export interface CreateTeacherPayload {
  username: string
  name: string
  mobile: string
  password: string
  teacherLevel?: string | null
}

export interface UpdateTeacherPayload {
  name?: string
  mobile?: string
  password?: string
  teacherLevel?: string | null
}

export function fetchTeachers(query: TeacherQuery = {}): Promise<Paginated<Teacher>> {
  return http.get<Paginated<Teacher>>('/admin/teachers', { params: query })
}

export function fetchTeacher(id: number | string): Promise<Teacher> {
  return http.get<Teacher>(`/admin/teachers/${id}`)
}

export function createTeacher(payload: CreateTeacherPayload): Promise<Teacher> {
  return http.post<Teacher>('/admin/teachers', payload)
}

export function updateTeacher(id: number | string, payload: UpdateTeacherPayload): Promise<Teacher> {
  return http.put<Teacher>(`/admin/teachers/${id}`, payload)
}

export function updateTeacherStatus(id: number | string, status: number): Promise<Teacher> {
  return http.patch<Teacher>(`/admin/teachers/${id}/status`, { status })
}
