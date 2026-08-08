import { describe, it, expect, beforeEach } from 'vitest'
import { menuItems } from '@/config/menu'
import router from '@/router'

describe('路由注册完整性（12 菜单全链路可达）', () => {
  let registered: string[]
  beforeEach(() => {
    registered = router.getRoutes().map((r) => r.path)
  })

  it('每个菜单路径都有对应路由', () => {
    for (const item of menuItems) {
      expect(registered, `缺少路由: ${item.path}`).toContain(item.path)
    }
  })

  it('路由懒加载组件均存在（路径可解析）', async () => {
    for (const item of menuItems) {
      const route = router.resolve(item.path)
      expect(route.matched.length, `无法解析: ${item.path}`).toBeGreaterThan(0)
    }
  })

  it('学生详情路由已注册', () => {
    expect(registered).toContain('/students/:id')
  })

  it('登录与 404 兜底存在', () => {
    expect(router.resolve('/login').matched.length).toBeGreaterThan(0)
    expect(router.resolve('/definitely-not-a-page').matched.length).toBeGreaterThan(0)
  })
})
