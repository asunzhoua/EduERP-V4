/** 后端统一响应格式（ApiResponse） */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T | null
}

/** 用户角色 */
export type UserRole =
  | 'SuperAdmin'
  | 'Admin'
  | 'Teacher'
  | 'Parent'
  | 'Student'

/** 登录用户信息 */
export interface UserInfo {
  /** 后端返回 id 为字符串（bigint 序列化） */
  id: number | string
  username: string
  name?: string
  phone?: string
  role: UserRole
  [key: string]: unknown
}

/** 登录响应 */
export interface LoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: UserInfo
}

/** 分页响应 */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** 导入单行结果 */
export interface ImportRowResult {
  /** Excel 行号（表头为第 1 行，数据从第 2 行起） */
  row: number
  success: boolean
  errors: string[]
  /** 规范化后的该行数据（键为小写列名） */
  data: Record<string, string>
}

/** 导入报告：后端 ImportService.validateRows 返回 */
export interface ImportReport {
  total: number
  success: number
  failure: number
  details: ImportRowResult[]
  fileName: string
}
