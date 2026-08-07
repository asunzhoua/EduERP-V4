import type { NavigationGuard, RouteLocationNormalized } from 'vue-router'

export interface GuardContext {
  token: string | null
  role?: string
}

/**
 * 路由守卫纯函数：根据登录态与 meta.roles 决定是否重定向。
 * 返回 null 表示放行，返回字符串表示重定向路径。
 */
export function resolveRouteRedirect(
  to: Pick<RouteLocationNormalized, 'path' | 'meta'>,
  ctx: GuardContext,
): string | null {
  const isLoginPage = to.path === '/login'
  if (!ctx.token) {
    return isLoginPage ? null : '/login'
  }
  if (isLoginPage) {
    return '/'
  }
  const roles = to.meta?.roles as string[] | undefined
  if (Array.isArray(roles) && roles.length > 0) {
    if (!ctx.role || !roles.includes(ctx.role)) {
      return '/403'
    }
  }
  return null
}

/** 生成 Vue Router 导航守卫（从外部注入上下文，便于测试） */
export function createPermissionGuard(getContext: () => GuardContext): NavigationGuard {
  return (to) => {
    const redirect = resolveRouteRedirect(to, getContext())
    return redirect ?? true
  }
}
