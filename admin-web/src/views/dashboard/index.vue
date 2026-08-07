<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <a-card>
    <h2 style="margin-top: 0">欢迎，{{ auth.displayName }}</h2>
    <p>
      EduERP 管理后台脚手架已就绪。首页 12 张数据卡与学生管理将在 M1 里程碑开放。
    </p>
  </a-card>
</template>
