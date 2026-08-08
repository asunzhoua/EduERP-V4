import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

export type LeaveType = 'SICK' | 'PERSONAL'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LeaveRequest {
  id: number | string
  studentCode: string
  classCode: string
  studentName?: string
  leaveType: LeaveType
  leaveDate: string
  reason: string
  status: LeaveStatus
  reviewedBy: number | string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdBy: number | string
  createdAt: string
}

export interface LeaveQuery {
  status?: LeaveStatus
  studentCode?: string
  classCode?: string
  page?: number
  pageSize?: number
}

export function fetchLeaveRequests(query: LeaveQuery = {}): Promise<Paginated<LeaveRequest>> {
  return http.get<Paginated<LeaveRequest>>('/admin/leave-requests', { params: query })
}

export function approveLeaveRequest(id: number | string): Promise<LeaveRequest> {
  return http.post<LeaveRequest>(`/admin/leave-requests/${id}/approve`)
}

export function rejectLeaveRequest(id: number | string, reason: string): Promise<LeaveRequest> {
  return http.post<LeaveRequest>(`/admin/leave-requests/${id}/reject`, { rejectionReason: reason })
}
