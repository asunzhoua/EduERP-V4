import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const loginMock = vi.fn()
const getMeMock = vi.fn()
const logoutMock = vi.fn()

vi.mock('@/api/auth', () => ({
  login: (...args: unknown[]) => loginMock(...args),
  getMe: (...args: unknown[]) => getMeMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
}))

import { useAuthStore } from './auth'
import { clearAuth } from '@/utils/auth'
import type { UserInfo } from '@/types/api'

const adminUser: UserInfo = {
  id: 1,
  username: 'admin',
  name: '管理员',
  role: 'SuperAdmin',
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clearAuth()
    vi.clearAllMocks()
  })

  it('login 成功后写入 token/user 并标记已登录', async () => {
    loginMock.mockResolvedValue({
      accessToken: 'a1',
      refreshToken: 'r1',
      expiresIn: 7200,
      user: adminUser,
    })
    const store = useAuthStore()
    const result = await store.login('admin', 'secret')
    expect(result.accessToken).toBe('a1')
    expect(store.token).toBe('a1')
    expect(store.user).toEqual(adminUser)
    expect(store.isAuthenticated).toBe(true)
    expect(loginMock).toHaveBeenCalledWith({ username: 'admin', password: 'secret' })
  })

  it('login 失败时抛出错误且不产生 token', async () => {
    loginMock.mockRejectedValue(new Error('用户名或密码错误'))
    const store = useAuthStore()
    await expect(store.login('admin', 'bad')).rejects.toThrow('用户名或密码错误')
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('fetchMe 拉取并缓存用户信息', async () => {
    getMeMock.mockResolvedValue(adminUser)
    const store = useAuthStore()
    const user = await store.fetchMe()
    expect(user).toEqual(adminUser)
    expect(store.user).toEqual(adminUser)
  })

  it('logout 清空 token 与用户', async () => {
    logoutMock.mockResolvedValue(null)
    const store = useAuthStore()
    store.token = 'a1'
    store.user = adminUser
    await store.logout()
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('logout 后端失败仍完成本地登出', async () => {
    logoutMock.mockRejectedValue(new Error('网络错误'))
    const store = useAuthStore()
    store.token = 'a1'
    await store.logout()
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})
