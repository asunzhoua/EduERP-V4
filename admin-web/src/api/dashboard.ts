import { http } from '@/utils/request'

/** 工作台时间维度；非法/缺失由后端回退 month */
export type WorkbenchTimeType = 'day' | 'week' | 'month' | 'year' | 'all'

export const WORKBENCH_TIME_LABELS: Record<WorkbenchTimeType, string> = {
  day: '今日',
  week: '本周',
  month: '本月',
  year: '本年',
  all: '全部',
}

/** 统计卡指标（服务器聚合，前端禁止计算业务） */
export interface WorkbenchMetric {
  key: string
  label: string
  value: number
  money?: boolean
  unit?: string
  link?: string
}

export interface WorkbenchGroup {
  key: 'teaching' | 'recruitment' | 'finance' | 'consumption'
  title: string
  metrics: WorkbenchMetric[]
}

export interface WorkbenchTrendPoint {
  date: string
  value: number
}

export interface WorkbenchTrend {
  name: 'consumption' | 'attendance' | 'finance'
  title: string
  data: WorkbenchTrendPoint[]
}

export interface WorkbenchTodo {
  key: string
  label: string
  count: number
  link: string
}

/** 工作台响应（GET /dashboard/cards?timeType=...） */
export interface DashboardWorkbench {
  timeType: WorkbenchTimeType
  groups: WorkbenchGroup[]
  trends: WorkbenchTrend[]
  todos: WorkbenchTodo[]
}

export function fetchDashboardCards(
  timeType?: WorkbenchTimeType,
): Promise<DashboardWorkbench> {
  return http.get<DashboardWorkbench>('/dashboard/cards', {
    params: timeType ? { timeType } : {},
  })
}
