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

// ─── 教师分配 / 学员 / 一键排课（P3 排班排课） ───

export type TeacherRole = 'PRIMARY' | 'ASSISTANT'

export interface TeacherAssignment {
  id: number | string
  classCode: string
  teacherId: number | string
  role: TeacherRole
  effectiveFrom: string
  effectiveTo: string | null
  reason: string | null
  /** 前端按 teacherId 从教师列表回填的姓名 */
  teacherName?: string
}

export interface ClassStudent {
  enrollmentId: number | string
  studentCode: string
  name: string | null
  gender: string | null
  phone: string | null
  school: string | null
  grade: string | null
  status: string
  enrolledAt: string
}

export interface BatchGeneratePayload {
  startDate: string
  count?: number
  checkConflict?: boolean
  teacherId?: number
}

export interface BatchGenerateResult {
  classCode: string
  requested: number
  generated: number
  skipped: number
  conflicts: { date: string; startTime: string; endTime: string; reason: string }[]
  firstLessonNumber: number | null
  message: string
}

export function fetchClassTeachers(code: string): Promise<TeacherAssignment[]> {
  return http.get<TeacherAssignment[]>(`/classes/${code}/teachers`)
}

export function assignClassTeacher(
  code: string,
  teacherId: number,
  role: TeacherRole,
  reason?: string,
): Promise<TeacherAssignment> {
  return http.post<TeacherAssignment>(`/classes/${code}/teachers`, { teacherId, role, reason })
}

export function removeClassTeacher(code: string, assignmentId: number | string): Promise<void> {
  return http.delete<void>(`/classes/${code}/teachers/${assignmentId}`)
}

export function fetchClassStudents(code: string): Promise<ClassStudent[]> {
  return http.get<ClassStudent[]>(`/classes/${code}/students`)
}

export function generateClassLessons(
  code: string,
  payload: BatchGeneratePayload,
): Promise<BatchGenerateResult> {
  return http.post<BatchGenerateResult>(`/classes/${code}/lessons/batch`, payload)
}
