import { defineStore } from 'pinia'
import { login as apiLogin, logout as apiLogout, getMe as apiGetMe } from '@/api/auth'
import { clearAuth, getToken, getUser, setTokens, setUser as cacheUser } from '@/utils/auth'
import type { UserInfo } from '@/types/api'

interface AuthState {
  token: string | null
  user: UserInfo | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: getToken(),
    user: getUser(),
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    displayName: (state) => state.user?.name || state.user?.username || '未登录',
  },
  actions: {
    async login(username: string, password: string) {
      const result = await apiLogin({ username, password })
      this.token = result.accessToken
      setTokens(result.accessToken, result.refreshToken)
      this.user = result.user
      cacheUser(result.user)
      return result
    },
    async fetchMe() {
      const user = await apiGetMe()
      this.user = user
      cacheUser(user)
      return user
    },
    async logout() {
      try {
        await apiLogout()
      } catch {
        // 即使后端登出失败也完成本地登出
      }
      this.token = null
      this.user = null
      clearAuth()
    },
  },
})
