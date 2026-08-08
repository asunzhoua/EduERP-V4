import { http } from '@/utils/request'

/** 首页 12 数据卡 */
export interface DashboardCards {
  todayIncome: number
  todayLessons: number
  todayAttendance: number
  todayLeave: number
  todayEnrollments: number
  monthIncome: number
  monthExpense: number
  profit: number
  teacherCount: number
  studentCount: number
  pendingApprovals: number
  stockAlerts: number
}

export function fetchDashboardCards(): Promise<DashboardCards> {
  return http.get<DashboardCards>('/dashboard/cards')
}
