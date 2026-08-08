import { http } from '@/utils/request'

export interface SettingEntry {
  key: string
  value: string
  category: string
  description?: string | null
}

/** 系统设置：按分类分组返回，前端按分类渲染表单 */
export type SettingsGrouped = Record<string, SettingEntry[]>

export function fetchSettings(): Promise<SettingsGrouped> {
  return http.get<SettingsGrouped>('/admin/settings')
}

export function saveSettings(entries: SettingEntry[]): Promise<SettingsGrouped> {
  return http.post<SettingsGrouped>('/admin/settings/save', { entries })
}
