import { http } from '@/utils/request'

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type Subject = 'MATH' | 'ENGLISH' | 'CHINESE' | 'PHYSICS' | 'CHEMISTRY' | 'ART' | 'MUSIC' | 'DANCE' | 'SPORTS' | 'CODING' | 'OTHER'
export type CourseType = 'INDIVIDUAL' | 'GROUP' | 'TRIAL' | 'CAMP'

export interface CourseItem {
  id: number | string
  courseCode: string
  name: string
  subject: Subject
  type: CourseType
  description: string | null
  totalHours: number
  totalLessons: number
  defaultDuration: number
  status: CourseStatus
  tags: string[] | null
  coverImage: string | null
  note: string | null
}

export interface CourseQuery {
  keyword?: string
  status?: string
  subject?: string
  page?: number
  pageSize?: number
}

export interface CreateCoursePayload {
  name: string
  subject: Subject
  type: CourseType
  totalHours: number
  totalLessons: number
  defaultDuration: number
  description?: string
  tags?: string[]
  coverImage?: string
  note?: string
}

export interface UpdateCoursePayload {
  name?: string
  subject?: Subject
  type?: CourseType
  totalHours?: number
  totalLessons?: number
  defaultDuration?: number
  description?: string
  tags?: string[]
  coverImage?: string
  note?: string
}

export interface CourseListResult {
  items: CourseItem[]
  total: number
}

export function fetchCourses(query: CourseQuery = {}): Promise<CourseListResult> {
  return http.get<CourseListResult>('/courses', { params: query })
}

export function fetchCourse(code: string): Promise<CourseItem> {
  return http.get<CourseItem>(`/courses/${code}`)
}

export function createCourse(payload: CreateCoursePayload): Promise<CourseItem> {
  return http.post<CourseItem>('/courses', payload)
}

export function updateCourse(code: string, payload: UpdateCoursePayload): Promise<CourseItem> {
  return http.put<CourseItem>(`/courses/${code}`, payload)
}

export function updateCourseStatus(code: string, status: CourseStatus): Promise<CourseItem> {
  return http.patch<CourseItem>(`/courses/${code}/status`, { status })
}
