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
