import { describe, it, expect } from 'vitest'
import { resolveRouteRedirect } from './permission'

function ctx(over: { token?: string | null; role?: string } = {}) {
  return {
    token: over.token === undefined ? 'token-1' : over.token,
    role: over.role,
  }
}

describe('resolveRouteRedirect 路由守卫纯函数', () => {
  it('未登录访问非登录页 → 重定向 /login', () => {
    expect(resolveRouteRedirect({ path: '/dashboard', meta: {} }, ctx({ token: null }))).toBe('/login')
  })

  it('未登录访问登录页 → 放行', () => {
    expect(resolveRouteRedirect({ path: '/login', meta: {} }, ctx({ token: null }))).toBeNull()
  })

  it('已登录访问登录页 → 回首页', () => {
    expect(resolveRouteRedirect({ path: '/login', meta: {} }, ctx())).toBe('/')
  })

  it('已登录、路由无 roles 限制 → 放行', () => {
    expect(resolveRouteRedirect({ path: '/dashboard', meta: {} }, ctx())).toBeNull()
  })

  it('已登录、角色在允许列表 → 放行', () => {
    const to = { path: '/x', meta: { roles: ['Admin', 'SuperAdmin'] } }
    expect(resolveRouteRedirect(to, ctx({ role: 'SuperAdmin' }))).toBeNull()
  })

  it('已登录、角色不在允许列表 → 重定向 /403', () => {
    const to = { path: '/x', meta: { roles: ['Admin'] } }
    expect(resolveRouteRedirect(to, ctx({ role: 'Teacher' }))).toBe('/403')
  })

  it('已登录、有 roles 但无角色信息 → 重定向 /403', () => {
    const to = { path: '/x', meta: { roles: ['Admin'] } }
    expect(resolveRouteRedirect(to, ctx({ role: undefined }))).toBe('/403')
  })
})
