<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LockOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { menuItems } from '@/config/menu'
import { changePassword } from '@/api/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const collapsed = ref(false)

// 修改密码弹窗
const changePwdVisible = ref(false)
const changePwdLoading = ref(false)
const changePwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,64}$/

function openChangePwd() {
  changePwdForm.oldPassword = ''
  changePwdForm.newPassword = ''
  changePwdForm.confirmPassword = ''
  changePwdVisible.value = true
}

async function onSubmitChangePwd() {
  if (!changePwdForm.oldPassword || !changePwdForm.newPassword || !changePwdForm.confirmPassword) {
    message.warning('请填写完整')
    return
  }
  if (!PASSWORD_PATTERN.test(changePwdForm.newPassword)) {
    message.warning('新密码需包含大小写字母和数字，长度 6-64 位')
    return
  }
  if (changePwdForm.newPassword !== changePwdForm.confirmPassword) {
    message.warning('两次输入的新密码不一致')
    return
  }
  changePwdLoading.value = true
  try {
    await changePassword(changePwdForm.oldPassword, changePwdForm.newPassword)
    message.success('密码修改成功，请重新登录')
    changePwdVisible.value = false
    await auth.logout()
    router.push('/login')
  } catch (e) {
    message.error((e as Error).message || '修改失败')
  } finally {
    changePwdLoading.value = false
  }
}

// 仅展示已注册路由 + 当前角色可访问的菜单项（随里程碑增加路由自动变多）
const visibleMenus = computed(() => {
  const paths = new Set(router.getRoutes().map((r) => r.path))
  const userRole = auth.user?.role
  return menuItems.filter(
    (item) =>
      paths.has(item.path) && (!item.roles || (userRole && item.roles.includes(userRole))),
  )
})

const selectedKeys = computed(() => [route.path])

function onMenuClick({ key }: { key: string }) {
  router.push(key)
}

async function onUserMenuClick({ key }: { key: string }) {
  if (key === 'changePassword') {
    openChangePwd()
  } else if (key === 'logout') {
    await auth.logout()
    message.success('已退出登录')
    router.push('/login')
  }
}
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible>
      <div class="logo">
        <span v-if="!collapsed">EduERP</span>
        <span v-else>E</span>
      </div>
      <a-menu theme="dark" mode="inline" :selected-keys="selectedKeys" @click="onMenuClick">
        <a-menu-item v-for="item in visibleMenus" :key="item.path">
          <component :is="item.icon" />
          <span>{{ item.title }}</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="header">
        <div class="header-right">
          <a-dropdown>
            <span class="user-name">
              <UserOutlined />
              {{ auth.displayName }}
            </span>
            <template #overlay>
              <a-menu @click="onUserMenuClick">
                <a-menu-item key="changePassword">
                  <LockOutlined />
                  修改密码
                </a-menu-item>
                <a-menu-item key="logout">
                  <LogoutOutlined />
                  退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>

    <a-modal
      v-model:open="changePwdVisible"
      title="修改密码"
      :confirm-loading="changePwdLoading"
      :mask-closable="false"
      @ok="onSubmitChangePwd"
    >
      <a-form layout="vertical">
        <a-form-item label="原密码" required>
          <a-input-password
            v-model:value="changePwdForm.oldPassword"
            placeholder="请输入当前密码"
            autocomplete="current-password"
          />
        </a-form-item>
        <a-form-item label="新密码" required>
          <a-input-password
            v-model:value="changePwdForm.newPassword"
            placeholder="需包含大小写字母和数字，长度 6-64 位"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-form-item label="确认新密码" required>
          <a-input-password
            v-model:value="changePwdForm.confirmPassword"
            placeholder="再次输入新密码"
            autocomplete="new-password"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-layout>
</template>

<style scoped>
.logo {
  height: 48px;
  line-height: 48px;
  text-align: center;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 2px;
}
.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}
.user-name {
  cursor: pointer;
}
.content {
  margin: 24px;
}
</style>
