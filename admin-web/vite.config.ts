import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // ant-design-vue v4 为 CSS-in-JS（组件自带 useStyle），无需 style side-effect
    Components({
      resolvers: [AntDesignVueResolver({ importStyle: false })],
      // antd 自带 typings/global.d.ts 声明 GlobalComponents，无需再生成 d.ts
      dts: false,
    }),
    AutoImport({
      imports: ['vue', 'vue-router'],
      resolvers: [AntDesignVueResolver({ importStyle: false })],
      dts: 'src/types/auto-imports.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 开发环境代理到本地 NestJS（后端全局前缀 /api/v1）
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
