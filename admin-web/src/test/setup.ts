import { vi } from 'vitest'

// jsdom 缺少 matchMedia，AntD 的 responsiveObserve 依赖它
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

// AntD 的 getComputedStyle 断言需要
if (!window.getComputedStyle) {
  ;(window as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
    getPropertyValue: () => '',
  })
}
