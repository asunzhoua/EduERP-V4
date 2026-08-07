<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const captchaEnabled = import.meta.env.VITE_CAPTCHA_ENABLED === 'true'

const form = reactive({
  username: '',
  password: '',
  captcha: '',
})

async function onSubmit() {
  if (!form.username.trim() || !form.password) {
    message.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.username.trim(), form.password)
    message.success('登录成功')
    router.push('/')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">EduERP 管理后台</h1>
      <p class="login-subtitle">教育机构一体化管理平台</p>
      <a-form layout="vertical" :model="form" @finish="onSubmit">
        <a-form-item>
          <a-input v-model:value="form.username" size="large" placeholder="账号">
            <template #prefix><UserOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item>
          <a-input-password v-model:value="form.password" size="large" placeholder="密码">
            <template #prefix><LockOutlined /></template>
          </a-input-password>
        </a-form-item>
        <a-form-item v-if="captchaEnabled">
          <a-input v-model:value="form.captcha" size="large" placeholder="验证码">
            <template #prefix><SafetyCertificateOutlined /></template>
          </a-input>
        </a-form-item>
        <a-button type="primary" html-type="submit" size="large" block :loading="loading">
          登录
        </a-button>
      </a-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
}
.login-card {
  width: 360px;
  padding: 40px 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.login-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
}
.login-subtitle {
  margin: 8px 0 24px;
  text-align: center;
  color: #999;
}
</style>
