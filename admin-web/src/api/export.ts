import { http } from '@/utils/request'

export interface ExportFilter {
  startDate?: string
  endDate?: string
  status?: string
  format?: 'csv' | 'excel'
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** 导出学生数据，触发浏览器下载 */
export async function exportStudents(filters: ExportFilter = {}): Promise<void> {
  const fmt = filters.format || 'excel'
  const blob = await http.postBlob<Blob>('/export/students', { ...filters, format: fmt })
  triggerDownload(blob, `学生数据_${Date.now()}.${fmt === 'excel' ? 'xlsx' : fmt}`)
}

/** 导出课时记录 */
export async function exportLessons(filters: ExportFilter = {}): Promise<void> {
  const fmt = filters.format || 'excel'
  const blob = await http.postBlob<Blob>('/export/lessons', { ...filters, format: fmt })
  triggerDownload(blob, `课时记录_${Date.now()}.${fmt === 'excel' ? 'xlsx' : fmt}`)
}

/** 导出课时消耗 */
export async function exportConsumption(filters: ExportFilter = {}): Promise<void> {
  const fmt = filters.format || 'excel'
  const blob = await http.postBlob<Blob>('/export/consumption', { ...filters, format: fmt })
  triggerDownload(blob, `课时消耗_${Date.now()}.${fmt === 'excel' ? 'xlsx' : fmt}`)
}

/** 导出工资记录 */
export async function exportSalary(filters: ExportFilter = {}): Promise<void> {
  const fmt = filters.format || 'excel'
  const blob = await http.postBlob<Blob>('/export/salary', { ...filters, format: fmt })
  triggerDownload(blob, `工资数据_${Date.now()}.${fmt === 'excel' ? 'xlsx' : fmt}`)
}

/** 导出财务记录 */
export async function exportFinance(filters: ExportFilter = {}): Promise<void> {
  const fmt = filters.format || 'excel'
  const blob = await http.postBlob<Blob>('/export/finance', { ...filters, format: fmt })
  triggerDownload(blob, `财务数据_${Date.now()}.${fmt === 'excel' ? 'xlsx' : fmt}`)
}

/** 导出工资条（按月份/状态等筛选） */
export async function exportSalarySlips(filters: {
  month?: string
  teacherId?: number
  status?: string
} = {}): Promise<void> {
  const blob = await http.postBlob<Blob>('/salary/slips/export', filters)
  triggerDownload(blob, `工资条_${Date.now()}.xlsx`)
}

/** 导出发放批次（含教师名明细） */
export async function exportSalaryPayroll(id: number | string): Promise<void> {
  const blob = await http.postBlob<Blob>(`/salary/payroll/${id}/export`)
  triggerDownload(blob, `发放批次_${Date.now()}.xlsx`)
}
