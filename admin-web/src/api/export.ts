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
  const blob = await http.postBlob<Blob>('/export/students', filters)
  triggerDownload(blob, `students_${Date.now()}.${filters.format || 'csv'}`)
}

/** 导出课时记录 */
export async function exportLessons(filters: ExportFilter = {}): Promise<void> {
  const blob = await http.postBlob<Blob>('/export/lessons', filters)
  triggerDownload(blob, `lessons_${Date.now()}.${filters.format || 'csv'}`)
}

/** 导出课时消耗 */
export async function exportConsumption(filters: ExportFilter = {}): Promise<void> {
  const blob = await http.postBlob<Blob>('/export/consumption', filters)
  triggerDownload(blob, `consumption_${Date.now()}.${filters.format || 'csv'}`)
}

/** 导出工资记录 */
export async function exportSalary(filters: ExportFilter = {}): Promise<void> {
  const blob = await http.postBlob<Blob>('/export/salary', filters)
  triggerDownload(blob, `salary_${Date.now()}.${filters.format || 'csv'}`)
}

/** 导出财务记录 */
export async function exportFinance(filters: ExportFilter = {}): Promise<void> {
  const blob = await http.postBlob<Blob>('/export/finance', filters)
  triggerDownload(blob, `finance_${Date.now()}.${filters.format || 'csv'}`)
}
