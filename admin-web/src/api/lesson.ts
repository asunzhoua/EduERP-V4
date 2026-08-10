import { http } from '@/utils/request'

export type LessonStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'TEACHING'
  | 'FINISHED'
  | 'ARCHIVED'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'RESCHEDULED'
  | 'MAKEUP_PENDING'
  | 'MAKEUP_COMPLETED'

export type LessonSource = 'ADMIN_BATCH' | 'ADMIN_MANUAL' | 'TEACHER_MANUAL'

export interface Lesson {
  id: number | string
  classCode: string
  courseCode: string
  lessonNumber: number
  status: LessonStatus
  scheduledDate: string
  startTime: string
  endTime: string
  teacherId: number | string
  topic: string | null
  source: LessonSource | null
  isMakeup: boolean
  note: string | null
  cancelledReason: string | null
  createdAt: string
}

export function fetchClassLessons(
  classCode: string,
  query: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Lesson[]> {
  return http.get<Lesson[]>(`/classes/${classCode}/lessons`, { params: query })
}

export function startLesson(classCode: string, lessonNumber: number): Promise<Lesson> {
  return http.patch<Lesson>(`/classes/${classCode}/lessons/${lessonNumber}/start`)
}

export function completeLesson(classCode: string, lessonNumber: number): Promise<Lesson> {
  return http.patch<Lesson>(`/classes/${classCode}/lessons/${lessonNumber}/complete`)
}

export function confirmLesson(classCode: string, lessonNumber: number): Promise<Lesson> {
  return http.patch<Lesson>(`/classes/${classCode}/lessons/${lessonNumber}/confirm`)
}

/** 确认课时考勤（CHECKED_IN → CONFIRMED），供管理员审核闭环 */
export function confirmLessonAttendance(
  lessonId: number | string,
): Promise<Array<{ id: number | string; workflowState: string }>> {
  return http.post(`/lessons/${lessonId}/attendance/confirm`)
}

export function cancelLesson(classCode: string, lessonNumber: number, reason: string): Promise<Lesson> {
  return http.patch<Lesson>(`/classes/${classCode}/lessons/${lessonNumber}/cancel`, { reason })
}

export interface CreateLessonPayload {
  classCode: string
  lessonDate: string
  startTime: string
  endTime: string
  topic?: string
}

/** 手动创建课时（自动续 lessonNumber，主教师从班级自动推断） */
export function createLesson(payload: CreateLessonPayload): Promise<Lesson> {
  return http.post<Lesson>('/lessons', { ...payload, attendanceRecords: [] })
}
