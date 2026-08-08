import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

export interface OperationLog {
  id: number | string
  userId: number | string | null
  username: string | null
  role: string | null
  method: string
  path: string
  action: string
  module: string | null
  resourceId: string | null
  detail: string | null
  ip: string | null
  createdAt: string
}

export interface OperationLogQuery {
  keyword?: string
  module?: string
  action?: string
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
}

export function fetchOperationLogs(query: OperationLogQuery = {}): Promise<Paginated<OperationLog>> {
  return http.get<Paginated<OperationLog>>('/admin/operation-logs', { params: query })
}
