import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

export type LessonStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED' | 'SUSPENDED'

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
  createdAt: string
}

export function fetchClassLessons(
  classCode: string,
  query: { status?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<Lesson>> {
  return http.get<Paginated<Lesson>>(`/classes/${classCode}/lessons`, { params: query })
}

export function startLesson(classCode: string, lessonNumber: number): Promise<Lesson> {
  return http.patch<Lesson>(`/classes/${classCode}/lessons/${lessonNumber}/start`)
}

export function completeLesson(classCode: string, lessonNumber: number): Promise<Lesson> {
  return http.patch<Lesson>(`/classes/${classCode}/lessons/${lessonNumber}/complete`)
}

export function cancelLesson(classCode: string, lessonNumber: number, reason: string): Promise<Lesson> {
  return http.patch<Lesson>(`/classes/${classCode}/lessons/${lessonNumber}/cancel`, { reason })
}
