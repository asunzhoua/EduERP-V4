import { http } from '@/utils/request'

export type SubjectCategory = 'ACADEMIC' | 'ART' | 'SPORT' | 'STEM' | 'LANG' | 'OTHER'

export interface SubjectItem {
  id: number
  code: string
  name: string
  category: SubjectCategory
  isDefault: boolean
}

export function fetchSubjects(): Promise<SubjectItem[]> {
  return http.get<SubjectItem[]>('/subjects')
}

export function createSubject(payload: {
  name: string
  category: SubjectCategory
}): Promise<SubjectItem> {
  return http.post<SubjectItem>('/subjects', payload)
}
