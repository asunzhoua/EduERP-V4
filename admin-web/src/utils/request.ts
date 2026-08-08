import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import type { ApiResponse } from '@/types/api'
import { getToken, clearAuth } from '@/utils/auth'

const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  timeout: 15000,
})

// 请求拦截：注入 Bearer token
request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：业务码非 0 视为错误；401 清理会话并跳登录
request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const body = response.data
    if (body && typeof body.code === 'number' && body.code !== 0) {
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return response
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      clearAuth()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    const message = error.response?.data?.message || error.message || '网络错误'
    return Promise.reject(new Error(message))
  },
)

async function unwrap<T>(promise: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const response = await promise
  return response.data.data as T
}

/** 二进制下载（导出接口返回文件流，不走 ApiResponse 解包） */
async function download<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
  const response = await promise
  return response.data
}

/** 类型化的请求对象：调用方直接拿到解包后的 data（ApiResponse.data） */
export const http = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap<T>(request.get(url, config))
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return unwrap<T>(request.post(url, data, config))
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return unwrap<T>(request.put(url, data, config))
  },
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return unwrap<T>(request.patch(url, data, config))
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return unwrap<T>(request.delete(url, config))
  },
  /** 返回二进制内容（文件导出） */
  postBlob<T = Blob>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return download<T>(request.post(url, data, { ...config, responseType: 'blob' }))
  },
}
