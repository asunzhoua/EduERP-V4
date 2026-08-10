import { http } from '@/utils/request'
import type { Paginated, ImportReport } from '@/types/api'

export type Gender = 'MALE' | 'FEMALE'
export type StudentStatus = 'ACTIVE' | 'PAUSED' | 'GRADUATED' | 'INACTIVE'

export interface Student {
  id: number | string
  studentCode: string
  name: string
  gender: Gender
  birthDate: string
  phone: string | null
  email: string | null
  school: string | null
  grade: string | null
  tags: string[] | null
  note: string | null
  status: StudentStatus
  createTime: string
  updateTime: string
}

export interface StudentQuery {
  name?: string
  studentCode?: string
  gender?: Gender
  status?: StudentStatus
  phone?: string
  school?: string
  grade?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface CreateStudentPayload {
  name: string
  gender: Gender
  birthDate: string
  phone?: string
  email?: string
  school?: string
  grade?: string
  tags?: string[]
  note?: string
  parentIds?: number[]
}

export interface UpdateStudentPayload {
  name?: string
  gender?: Gender
  birthDate?: string
  phone?: string
  email?: string
  school?: string
  grade?: string
  tags?: string[]
  note?: string
}

export function fetchStudents(query: StudentQuery = {}): Promise<Paginated<Student>> {
  return http.get<Paginated<Student>>('/students', { params: query })
}

export function fetchStudent(id: number | string): Promise<Student> {
  return http.get<Student>(`/students/${id}`)
}

export function createStudent(payload: CreateStudentPayload): Promise<Student> {
  return http.post<Student>('/students', payload)
}

export function updateStudent(id: number | string, payload: UpdateStudentPayload): Promise<Student> {
  return http.put<Student>(`/students/${id}`, payload)
}

export function updateStudentStatus(id: number | string, status: StudentStatus): Promise<Student> {
  return http.patch<Student>(`/students/${id}/status`, { status })
}

/** 学员名单批量导入（Excel/CSV，表头支持中文别名） */
export function importStudents(file: File): Promise<ImportReport> {
  const form = new FormData()
  form.append('file', file)
  return http.post<ImportReport>('/students/import', form)
}
