<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchPointsProducts,
  createPointsProduct,
  updatePointsProduct,
  updatePointsProductStatus,
  fetchPointsExchanges,
  type PointsProduct,
  type PointsExchangeRecord,
  type PointsProductStatus,
  type PointsExchangeStatus,
} from '@/api/points'
import { formatDateTime } from '@/utils/format'

const activeKey = ref('products')

// ─── 商品管理 ───
const productLoading = ref(false)
const productList = ref<PointsProduct[]>([])
const productTotal = ref(0)
const productQuery = reactive({ keyword: '', status: undefined as PointsProductStatus | undefined, page: 1, pageSize: 10 })

const productStatusLabel: Record<PointsProductStatus, string> = { ON_SALE: '上架中', OFF_SALE: '已下架' }
const productStatusColor: Record<PointsProductStatus, string> = { ON_SALE: 'green', OFF_SALE: 'default' }

const productColumns = [
  { title: '商品名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '积分价格', dataIndex: 'pointsPrice', key: 'pointsPrice', width: 100 },
  { title: '库存', dataIndex: 'stock', key: 'stock', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 140 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, customRender: ({ text }: { text: string }) => formatDateTime(text) },
  { title: '操作', dataIndex: 'action', key: 'action', width: 130, fixed: 'right' },
]

async function loadProducts() {
  productLoading.value = true
  try {
    const res = await fetchPointsProducts({ keyword: productQuery.keyword || undefined, status: productQuery.status, page: productQuery.page, pageSize: productQuery.pageSize })
    productList.value = res.items
    productTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    productLoading.value = false
  }
}

function onProductSearch() {
  productQuery.page = 1
  loadProducts()
}

function onProductReset() {
  productQuery.keyword = ''
  productQuery.status = undefined
  productQuery.page = 1
  loadProducts()
}

// ─── 新建 / 编辑商品 ───
const productModalOpen = ref(false)
const productModalLoading = ref(false)
const editingProduct = ref<PointsProduct | null>(null)
const productForm = reactive({
  name: '',
  pointsPrice: 0,
  stock: 0,
  description: '',
  coverImage: '',
  status: 'ON_SALE' as PointsProductStatus,
})

function openCreateProduct() {
  editingProduct.value = null
  Object.assign(productForm, { name: '', pointsPrice: 0, stock: 0, description: '', coverImage: '', status: 'ON_SALE' as PointsProductStatus })
  productModalOpen.value = true
}

function openEditProduct(row: PointsProduct) {
  editingProduct.value = row
  Object.assign(productForm, {
    name: row.name,
    pointsPrice: row.pointsPrice,
    stock: row.stock,
    description: row.description || '',
    coverImage: row.coverImage || '',
  })
  productModalOpen.value = true
}

async function onSubmitProduct() {
  if (!productForm.name.trim()) {
    message.warning('请输入商品名称')
    return
  }
  if (productForm.pointsPrice == null || productForm.pointsPrice < 0) {
    message.warning('请输入积分价格')
    return
  }
  productModalLoading.value = true
  try {
    if (editingProduct.value) {
      await updatePointsProduct(editingProduct.value.id, {
        name: productForm.name.trim(),
        pointsPrice: productForm.pointsPrice,
        stock: productForm.stock == null ? undefined : productForm.stock,
        description: productForm.description.trim() ? productForm.description.trim() : undefined,
        coverImage: productForm.coverImage.trim() ? productForm.coverImage.trim() : undefined,
      })
      message.success('商品信息已更新')
    } else {
      await createPointsProduct({
        name: productForm.name.trim(),
        pointsPrice: productForm.pointsPrice,
        stock: productForm.stock == null ? undefined : productForm.stock,
        description: productForm.description.trim() ? productForm.description.trim() : undefined,
        coverImage: productForm.coverImage.trim() ? productForm.coverImage.trim() : undefined,
        status: productForm.status,
      })
      message.success('商品创建成功')
    }
    productModalOpen.value = false
    loadProducts()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    productModalLoading.value = false
  }
}

// ─── 商品上架 / 下架 ───
function onToggleProductStatus(row: PointsProduct) {
  const target: PointsProductStatus = row.status === 'ON_SALE' ? 'OFF_SALE' : 'ON_SALE'
  const text = target === 'OFF_SALE' ? '下架' : '上架'
  Modal.confirm({
    title: `确认${text}该商品？`,
    content: `「${row.name}」将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updatePointsProductStatus(row.id, target)
        message.success(`已${text}`)
        loadProducts()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─── 兑换记录 ───
const exchangeLoading = ref(false)
const exchangeList = ref<PointsExchangeRecord[]>([])
const exchangeTotal = ref(0)
const exchangeQuery = reactive({ keyword: '', status: undefined as PointsExchangeStatus | undefined, page: 1, pageSize: 10 })

const exchangeStatusLabel: Record<PointsExchangeStatus, string> = { PENDING: '待处理', COMPLETED: '已完成', CANCELLED: '已取消' }
const exchangeStatusColor: Record<PointsExchangeStatus, string> = { PENDING: 'orange', COMPLETED: 'green', CANCELLED: 'default' }

const exchangeColumns = [
  { title: '学生编号', dataIndex: 'studentCode', key: 'studentCode', width: 130 },
  { title: '学生姓名', dataIndex: 'studentName', key: 'studentName', width: 120 },
  { title: '商品名称', dataIndex: 'productName', key: 'productName', ellipsis: true },
  { title: '积分消耗', dataIndex: 'pointsCost', key: 'pointsCost', width: 100 },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '兑换时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, customRender: ({ text }: { text: string }) => formatDateTime(text) },
]

async function loadExchanges() {
  exchangeLoading.value = true
  try {
    const res = await fetchPointsExchanges({ keyword: exchangeQuery.keyword || undefined, status: exchangeQuery.status, page: exchangeQuery.page, pageSize: exchangeQuery.pageSize })
    exchangeList.value = res.items
    exchangeTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    exchangeLoading.value = false
  }
}

function onExchangeSearch() {
  exchangeQuery.page = 1
  loadExchanges()
}

function onExchangeReset() {
  exchangeQuery.keyword = ''
  exchangeQuery.status = undefined
  exchangeQuery.page = 1
  loadExchanges()
}

onMounted(() => {
  loadProducts()
  loadExchanges()
})
</script>

<template>
  <a-card :bordered="false">
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane key="products" tab="商品管理">
        <a-form layout="inline" class="search-bar" @submit.prevent="onProductSearch">
          <a-form-item>
            <a-input v-model:value="productQuery.keyword" placeholder="商品名称" allow-clear style="width: 200px" @press-enter="onProductSearch" />
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="productQuery.status" placeholder="状态" allow-clear style="width: 120px" @change="onProductSearch">
              <a-select-option v-for="(label, key) in productStatusLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
              <a-button :icon="h(ReloadOutlined)" @click="onProductReset">重置</a-button>
            </a-space>
          </a-form-item>
          <a-form-item class="search-actions">
            <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openCreateProduct">新增商品</a-button>
          </a-form-item>
        </a-form>

        <a-table
          :columns="productColumns"
          :data-source="productList"
          :loading="productLoading"
          :pagination="{ current: productQuery.page, pageSize: productQuery.pageSize, total: productTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { productQuery.page = p.current; productQuery.pageSize = p.pageSize; loadProducts() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a @click="openEditProduct(record)">{{ record.name }}</a>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-space>
                <a-tag :color="productStatusColor[record.status as PointsProductStatus]">{{ productStatusLabel[record.status as PointsProductStatus] || record.status }}</a-tag>
                <a-tag v-if="record.status === 'ON_SALE' && record.stock <= 5" color="red">低库存</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a @click="openEditProduct(record)">编辑</a>
                <a :style="{ color: record.status === 'ON_SALE' ? '#ff4d4f' : undefined }" @click="onToggleProductStatus(record)">
                  {{ record.status === 'ON_SALE' ? '下架' : '上架' }}
                </a>
              </a-space>
            </template>
          </template>
        </a-table>

        <a-modal v-model:open="productModalOpen" :title="editingProduct ? '编辑商品' : '新增商品'" :confirm-loading="productModalLoading" ok-text="保存" cancel-text="取消" width="600px" @ok="onSubmitProduct">
          <a-form layout="vertical" :model="productForm">
            <a-form-item label="商品名称" required>
              <a-input v-model:value="productForm.name" placeholder="商品名称" />
            </a-form-item>
            <a-form-item label="积分价格" required>
              <a-input-number v-model:value="productForm.pointsPrice" :min="0" style="width: 100%" />
            </a-form-item>
            <a-form-item label="库存">
              <a-input-number v-model:value="productForm.stock" :min="0" style="width: 100%" />
            </a-form-item>
            <a-form-item label="商品简介">
              <a-textarea v-model:value="productForm.description" :rows="3" placeholder="商品简介" />
            </a-form-item>
            <a-form-item label="封面图">
              <a-input v-model:value="productForm.coverImage" placeholder="图片 URL" />
            </a-form-item>
            <a-form-item v-if="!editingProduct" label="状态">
              <a-select v-model:value="productForm.status" style="width: 100%">
                <a-select-option v-for="(label, key) in productStatusLabel" :key="key" :value="key">{{ label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-form>
        </a-modal>
      </a-tab-pane>

      <a-tab-pane key="exchanges" tab="兑换记录">
        <a-form layout="inline" class="search-bar" @submit.prevent="onExchangeSearch">
          <a-form-item>
            <a-input v-model:value="exchangeQuery.keyword" placeholder="学生姓名" allow-clear style="width: 200px" @press-enter="onExchangeSearch" />
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="exchangeQuery.status" placeholder="状态" allow-clear style="width: 120px" @change="onExchangeSearch">
              <a-select-option v-for="(label, key) in exchangeStatusLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
              <a-button :icon="h(ReloadOutlined)" @click="onExchangeReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <a-table
          :columns="exchangeColumns"
          :data-source="exchangeList"
          :loading="exchangeLoading"
          :pagination="{ current: exchangeQuery.page, pageSize: exchangeQuery.pageSize, total: exchangeTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { exchangeQuery.page = p.current; exchangeQuery.pageSize = p.pageSize; loadExchanges() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="exchangeStatusColor[record.status as PointsExchangeStatus]">{{ exchangeStatusLabel[record.status as PointsExchangeStatus] || record.status }}</a-tag>
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped>
.search-bar {
  margin-bottom: 16px;
}
.search-actions {
  margin-left: auto;
}
</style>
