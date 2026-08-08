import { describe, it, expect } from 'vitest'
import { formatMoney, formatNumber, formatDate, formatDateTime, subjectLabel } from './format'

describe('format utils', () => {
  it('formatMoney 千分位 + 两位小数', () => {
    expect(formatMoney(12345.6)).toBe('¥12,345.60')
    expect(formatMoney(0)).toBe('¥0.00')
    expect(formatMoney(null)).toBe('¥0.00')
    expect(formatMoney('800')).toBe('¥800.00')
  })

  it('formatNumber 千分位', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber(null)).toBe('0')
  })

  it('formatDate 输出 YYYY-MM-DD', () => {
    expect(formatDate('2026-08-07T10:00:00')).toBe('2026-08-07')
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(formatDate(null)).toBe('-')
    expect(formatDate('invalid')).toBe('-')
  })

  it('formatDateTime 输出 YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime('2026-08-07T09:05:00')).toBe('2026-08-07 09:05')
    expect(formatDateTime(null)).toBe('-')
  })

  it('subjectLabel 映射中文', () => {
    expect(subjectLabel('MATH')).toBe('数学')
    expect(subjectLabel('CODING')).toBe('编程')
    expect(subjectLabel('UNKNOWN')).toBe('UNKNOWN')
  })
})
