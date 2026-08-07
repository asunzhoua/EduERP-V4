import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Antd from 'ant-design-vue'
import Login from './Login.vue'

const { loginMock, pushMock, successMock, errorMock, warningMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  pushMock: vi.fn(),
  successMock: vi.fn(),
  errorMock: vi.fn(),
  warningMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ login: loginMock }),
}))

vi.mock('ant-design-vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('ant-design-vue')>()
  return {
    ...mod,
    message: { success: successMock, error: errorMock, warning: warningMock },
  }
})

describe('Login.vue 登录页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染标题与登录按钮', () => {
    const wrapper = mount(Login, { global: { plugins: [Antd] } })
    expect(wrapper.text()).toContain('EduERP 管理后台')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('提交表单 → 调用 store.login 并跳转首页', async () => {
    loginMock.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 7200, user: { id: 1, username: 'admin', role: 'SuperAdmin' } })
    const wrapper = mount(Login, { global: { plugins: [Antd] } })

    await wrapper.find('input[placeholder="账号"]').setValue('admin')
    await wrapper.find('input[placeholder="密码"]').setValue('secret')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(loginMock).toHaveBeenCalledWith('admin', 'secret')
    expect(pushMock).toHaveBeenCalledWith('/')
    expect(successMock).toHaveBeenCalled()
  })

  it('登录失败 → 提示错误且不跳转', async () => {
    loginMock.mockRejectedValue(new Error('用户名或密码错误'))
    const wrapper = mount(Login, { global: { plugins: [Antd] } })

    await wrapper.find('input[placeholder="账号"]').setValue('admin')
    await wrapper.find('input[placeholder="密码"]').setValue('bad')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(errorMock).toHaveBeenCalledWith('用户名或密码错误')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('空账号密码 → 不提交仅提示', async () => {
    const wrapper = mount(Login, { global: { plugins: [Antd] } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(warningMock).toHaveBeenCalled()
    expect(loginMock).not.toHaveBeenCalled()
  })
})
