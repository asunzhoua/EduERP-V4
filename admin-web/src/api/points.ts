import { http } from '@/utils/request'
import type { Paginated } from '@/types/api'

export type PointsProductStatus = 'ON_SALE' | 'OFF_SALE'
export type PointsExchangeStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export interface PointsProduct {
  id: number | string
  name: string
  description: string | null
  coverImage: string | null
  pointsPrice: number
  stock: number
  status: PointsProductStatus
  createdBy: number | string | null
  createdAt: string
  deleted: boolean
}

export interface PointsExchangeRecord {
  id: number | string
  productId: number | string
  productName: string
  studentCode: string
  studentName: string
  pointsCost: number
  quantity: number
  status: PointsExchangeStatus
  createdAt: string
}

export interface CreatePointsProductPayload {
  name: string
  description?: string | null
  coverImage?: string | null
  pointsPrice: number
  stock?: number
  status?: PointsProductStatus
}

export interface UpdatePointsProductPayload {
  name?: string
  description?: string | null
  coverImage?: string | null
  pointsPrice?: number
  stock?: number
  status?: PointsProductStatus
}

export interface PointsQuery {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

export function fetchPointsProducts(query: PointsQuery = {}): Promise<Paginated<PointsProduct>> {
  return http.get<Paginated<PointsProduct>>('/admin/points/products', { params: query })
}

export function createPointsProduct(payload: CreatePointsProductPayload): Promise<PointsProduct> {
  return http.post<PointsProduct>('/admin/points/products', payload)
}

export function updatePointsProduct(id: number | string, payload: UpdatePointsProductPayload): Promise<PointsProduct> {
  return http.put<PointsProduct>(`/admin/points/products/${id}`, payload)
}

export function updatePointsProductStatus(id: number | string, status: PointsProductStatus): Promise<PointsProduct> {
  return http.patch<PointsProduct>(`/admin/points/products/${id}/status`, { status })
}

export function fetchPointsExchanges(query: PointsQuery = {}): Promise<Paginated<PointsExchangeRecord>> {
  return http.get<Paginated<PointsExchangeRecord>>('/admin/points/exchanges', { params: query })
}
