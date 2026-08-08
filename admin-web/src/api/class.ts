import { http } from '@/utils/request'

export type ClassStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface ClassItem {
  id: number | string
  classCode: string
  courseCode: string
  name: string
  status: ClassStatus
  startDate: string
  totalLessons: number
  defaultDuration: number
  dayOfWeek: number[]
  startTime: string
  endTime: string
  maxStudents: number
  room: string | null
  note: string | null
  courseName: string
  teacherName: string
  currentStudents: number
  completedLessons: number
  schedule: string
  endDate: string
}

export interface ClassQuery {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface CreateClassPayload {
  courseCode: string
  name: string
  startDate: string
  totalLessons: number
  defaultDuration: number
  dayOfWeek: number[]
  startTime: string
  endTime: string
  maxStudents?: number
  room?: string
  note?: string
}

export interface UpdateClassPayload {
  name?: string
  startDate?: string
  totalLessons?: number
  defaultDuration?: number
  dayOfWeek?: number[]
  startTime?: string
  endTime?: string
  maxStudents?: number
  room?: string
  note?: string
}

export interface ClassListResult {
  items: ClassItem[]
  total: number
}

export function fetchClasses(query: ClassQuery = {}): Promise<ClassListResult> {
  return http.get<ClassListResult>('/classes', { params: query })
}

export function fetchClass(code: string): Promise<ClassItem> {
  return http.get<ClassItem>(`/classes/${code}`)
}

export function createClass(payload: CreateClassPayload): Promise<ClassItem> {
  return http.post<ClassItem>('/classes', payload)
}

export function updateClass(code: string, payload: UpdateClassPayload): Promise<ClassItem> {
  return http.put<ClassItem>(`/classes/${code}`, payload)
}

export function updateClassStatus(code: string, status: ClassStatus, cancelledReason?: string): Promise<ClassItem> {
  return http.patch<ClassItem>(`/classes/${code}/status`, { status, cancelledReason })
}
