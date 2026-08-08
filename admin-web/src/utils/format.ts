/** 金额格式化：12345.6 → ¥12,345.60 */
export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value || 0)
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 数字千分位：12345 → 12,345 */
export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value || 0)
  return n.toLocaleString('zh-CN')
}

/** 日期：'2026-08-07T10:00:00' → '2026-08-07' */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 日期时间：'2026-08-07T10:00:00' → '2026-08-07 10:00' */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 学科 → 中文标签 */
export function subjectLabel(subject: string): string {
  const map: Record<string, string> = {
    MATH: '数学',
    ENGLISH: '英语',
    CHINESE: '语文',
    PHYSICS: '物理',
    CHEMISTRY: '化学',
    ART: '美术',
    MUSIC: '音乐',
    DANCE: '舞蹈',
    SPORTS: '体育',
    CODING: '编程',
    OTHER: '其他',
  }
  return map[subject] || subject
}

/** 下载并保存文件（通用） */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
