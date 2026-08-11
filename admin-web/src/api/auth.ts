import { http } from '@/utils/request'
import type { LoginResult, UserInfo } from '@/types/api'

export interface LoginPayload {
  username: string
  password: string
  device?: string
}

/** 账号密码登录 */
export function login(payload: LoginPayload): Promise<LoginResult> {
  return http.post<LoginResult>('/auth/login', payload)
}

/** 当前登录用户信息 */
export function getMe(): Promise<UserInfo> {
  return http.get<UserInfo>('/auth/me')
}

/** 退出登录 */
export function logout(): Promise<null> {
  return http.post<null>('/auth/logout')
}

/** 修改本人密码（成功后会话被清空，需重新登录） */
export function changePassword(oldPassword: string, newPassword: string): Promise<null> {
  return http.post<null>('/auth/change-password', { oldPassword, newPassword })
}
