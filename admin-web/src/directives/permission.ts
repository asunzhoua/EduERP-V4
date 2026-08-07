import type { Directive, DirectiveBinding } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * 按钮级权限指令：v-permission="'Teacher'" 或 v-permission="['Admin','SuperAdmin']"
 * 无权限时移除该元素。
 */
export const permission: Directive<HTMLElement, string | string[]> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const roles = Array.isArray(binding.value) ? binding.value : [binding.value]
    const auth = useAuthStore()
    const userRole = auth.user?.role
    if (!userRole || !roles.includes(userRole)) {
      el.remove()
    }
  },
}
