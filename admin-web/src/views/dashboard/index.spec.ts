import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import Antd from 'ant-design-vue'
import Dashboard from './index.vue'

const { fetchCardsMock, useMock, initMock, pushMock, errorMock } = vi.hoisted(() => ({
  fetchCardsMock: vi.fn(),
  useMock: vi.fn(),
  initMock: vi.fn(),
  pushMock: vi.fn(),
  errorMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/dashboard', () => ({
  fetchDashboardCards: fetchCardsMock,
  WORKBENCH_TIME_LABELS: { day: '今日', week: '本周', month: '本月', year: '本年', all: '全部' },
}))

vi.mock('echarts/core', () => ({
  use: useMock,
  init: initMock,
}))

vi.mock('echarts/charts', () => ({ LineChart: {} }))
vi.mock('echarts/components', () => ({
  GridComponent: {},
  TooltipComponent: {},
  LegendComponent: {},
}))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))

vi.mock('ant-design-vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('ant-design-vue')>()
  return { ...mod, message: { error: errorMock } }
})

const trend = (seed: number) =>
  Array.from({ length: 30 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, '0')}`, value: seed + i }))

const workbench = {
  timeType: 'month',
  groups: [
    {
      key: 'teaching',
      title: '教务',
      metrics: [
        { key: 'studentCount', label: '学员总数', value: 120, link: '/students' },
        { key: 'classCount', label: '班级总数', value: 9, link: '/classes' },
        { key: 'teacherCount', label: '教师总数', value: 14, link: '/teachers' },
        { key: 'remainingLessons', label: '剩余课时', value: 70, link: '/students' },
      ],
    },
    {
      key: 'recruitment',
      title: '招生',
      metrics: [
        { key: 'enrollmentCount', label: '报名数', value: 8, link: '/enrollments' },
        { key: 'newStudentCount', label: '新增学员', value: 5, link: '/students' },
        { key: 'contractAmount', label: '新签合同额', value: 36000, money: true, link: '/enrollments' },
      ],
    },
    {
      key: 'finance',
      title: '财务',
      metrics: [
        { key: 'income', label: '收入', value: 36000, money: true, link: '/salary' },
        { key: 'expense', label: '支出', value: 9000, money: true, link: '/salary' },
        { key: 'profit', label: '利润', value: 27000, money: true, link: '/salary' },
      ],
    },
    {
      key: 'consumption',
      title: '消课',
      metrics: [
        { key: 'consumedLessons', label: '消课课时', value: 210, link: '/lessons' },
        { key: 'scheduledLessons', label: '上课课时', value: 260, link: '/lessons' },
        { key: 'leaveCount', label: '请假次数', value: 6, link: '/leave-requests' },
      ],
    },
  ],
  trends: [
    { name: 'consumption', title: '消课', data: trend(1) },
    { name: 'attendance', title: '考勤', data: trend(10) },
    { name: 'finance', title: '财务', data: trend(100) },
  ],
  todos: [
    { key: 'leave', label: '待审批请假', count: 2, link: '/leave-requests' },
    { key: 'stock', label: '库存提醒', count: 1, link: '/points-mall' },
  ],
}

enableAutoUnmount(afterEach)

describe('Dashboard.vue 工作台', () => {
  let containers: unknown[]
  let instances: Array<{ setOption: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>

  beforeEach(() => {
    vi.clearAllMocks()
    containers = []
    instances = []
    initMock.mockImplementation((el: unknown) => {
      const instance = {
        setOption: vi.fn(),
        resize: vi.fn(),
        dispose: vi.fn(),
        getDom: () => el,
      }
      containers.push(el)
      instances.push(instance)
      return instance
    })
    fetchCardsMock.mockResolvedValue(workbench)
  })

  it('挂载默认按 month 拉取，渲染 4 组统计、趋势图容器与待办', async () => {
    const wrapper = mount(Dashboard, { global: { plugins: [Antd] } })
    await flushPromises()

    expect(fetchCardsMock).toHaveBeenCalledWith('month')
    expect(useMock).toHaveBeenCalled()
    expect(initMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('工作台')
    expect(wrapper.text()).toContain('教务')
    expect(wrapper.text()).toContain('招生')
    expect(wrapper.text()).toContain('财务')
    expect(wrapper.text()).toContain('消课')
    expect(wrapper.text()).toContain('学员总数')
    expect(wrapper.text()).toContain('待审批请假')
    expect(wrapper.find('[data-testid="wb-chart"]').exists()).toBe(true)
    expect(wrapper.findAll('.wb-metric').length).toBe(13)
  })

  it('切换时间维度触发按新 timeType 重载', async () => {
    const wrapper = mount(Dashboard, { global: { plugins: [Antd] } })
    await flushPromises()

    const radios = wrapper.findAll('input[type="radio"]')
    const weekInput = radios[1] // day/week/month/year/all → index 1 = 本周
    await weekInput.setValue(true)
    await flushPromises()

    expect(fetchCardsMock).toHaveBeenLastCalledWith('week')
  })

  it('骨架屏替换卡片内容后在新容器上重建图表实例（不把 setOption 打到已卸载 DOM）', async () => {
    const wrapper = mount(Dashboard, { global: { plugins: [Antd] } })
    await flushPromises()
    expect(initMock).toHaveBeenCalledTimes(1)
    const first = instances[0]

    // 切换时间维度 → load() 里 loading 置真 → a-card 骨架屏卸载再重建卡片内容（含图表容器）
    await wrapper.findAll('input[type="radio"]')[1].setValue(true)
    await flushPromises()

    // 容器被替换后应重建实例：init 第二次，旧实例先 dispose
    expect(initMock).toHaveBeenCalledTimes(2)
    expect(instances[1]).not.toBe(first)
    expect(containers[1]).not.toBe(containers[0])
    expect(first.dispose).toHaveBeenCalled()
  })

  it('点击带链接的统计卡跳转对应模块', async () => {
    const wrapper = mount(Dashboard, { global: { plugins: [Antd] } })
    await flushPromises()

    await wrapper.findAll('.wb-metric')[0].trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/students')
  })

  it('点击待办跳转对应模块', async () => {
    const wrapper = mount(Dashboard, { global: { plugins: [Antd] } })
    await flushPromises()

    const todo = wrapper.findAll('.wb-todo').find((t) => t.text().includes('待审批请假'))
    await todo!.trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/leave-requests')
  })

  it('拉取失败提示错误信息', async () => {
    fetchCardsMock.mockRejectedValue(new Error('服务不可用'))
    mount(Dashboard, { global: { plugins: [Antd] } })
    await flushPromises()

    expect(errorMock).toHaveBeenCalledWith('服务不可用')
  })
})
