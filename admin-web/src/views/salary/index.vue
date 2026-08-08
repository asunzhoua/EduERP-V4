<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchSalaryRecords,
  fetchSalaryStatistics,
  updateSalaryRecordStatus,
  type SalaryRecord,
  type SalaryRecordStatus,
  type SalaryStatistics,
} from '@/api/salary'
import { formatDate, formatDateTime, formatMoney } from '@/utils/format'

const loading = ref(false)
const list = ref<SalaryRecord[]>([])
const total = ref(0)

const statistics = ref<SalaryStatistics>({ totalAmount: 0, paidAmount: 0, pendingAmount: 0, recordCount: 0, teacherCount: 0 })

const query = reactive({
  status: undefined as SalaryRecordStatus | undefined,
  teacherId: '',
  startDate: '',
  endDate: '',
  page: 1,
  pageSize: 10,
})

const statusLabel: Record<SalaryRecordStatus, string> = { PENDING: '待确认', CONFIRMED: '已确认', PAID: '已发放' }
const statusColor: Record<SalaryRecordStatus, string> = { PENDING: 'orange', CONFIRMED: 'blue', PAID: 'green' }

const columns = [
  { title: '记录ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '教师ID', dataIndex: 'teacherId', key: 'teacherId', width: 90 },
  { title: '课时日期', dataIndex: 'lessonDate', key: 'lessonDate', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '时长', dataIndex: 'duration', key: 'duration', width: 90, customRender: ({ text }: { text: number }) => `${text} 分钟` },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 120, customRender: ({ text }: { text: number }) => formatMoney(text) },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 150, customRender: ({ text }: { text: string }) => formatDateTime(text) },
  { title: '操作', dataIndex: 'action', key: 'action', width: 120, fixed: 'right' },
]

async function load() {
  loading.value = true
  try {
    const [res, stats] = await Promise.all([
      fetchSalaryRecords({
        status: query.status,
        teacherId: query.teacherId || undefined,
        startDate: query.startDate || undefined,
        endDate: query.endDate || undefined,
        page: query.page,
        pageSize: query.pageSize,
      }),
      fetchSalaryStatistics(),
    ])
    list.value = res.items
    total.value = res.total
    statistics.value = stats
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.page = 1
  load()
}

function onReset() {
  query.status = undefined
  query.teacherId = ''
  query.startDate = ''
  query.endDate = ''
  query.page = 1
  load()
}

function onUpdateStatus(row: SalaryRecord, target: SalaryRecordStatus) {
  const text = target === 'CONFIRMED' ? '确认' : '发放'
  Modal.confirm({
    title: `确认${text}该工资记录？`,
    content: `教师 ${row.teacherId} 的课时工资 ${formatMoney(row.amount)} 将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateSalaryRecordStatus(row.id, target)
        message.success(`已${text}`)
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false">
    <a-row :gutter="[16, 16]" class="stat-row">
      <a-col :span="4">
        <a-card :bordered="false">
          <a-statistic title="应发总额" :value="formatMoney(statistics.totalAmount)" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card :bordered="false">
          <a-statistic title="已发放" :value="formatMoney(statistics.paidAmount)" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card :bordered="false">
          <a-statistic title="待确认" :value="formatMoney(statistics.pendingAmount)" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card :bordered="false">
          <a-statistic title="记录数" :value="statistics.recordCount" />
        </a-card>
      </a-col>
      <a-col :span="4">
        <a-card :bordered="false">
          <a-statistic title="老师数" :value="statistics.teacherCount" />
        </a-card>
      </a-col>
    </a-row>

    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 120px" @change="onSearch">
          <a-select-option v-for="(label, key) in statusLabel" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-input v-model:value="query.teacherId" placeholder="教师ID" allow-clear style="width: 120px" @press-enter="onSearch" />
      </a-form-item>
      <a-form-item>
        <a-date-picker v-model:value="query.startDate" value-format="YYYY-MM-DD" placeholder="开始日期" style="width: 140px" />
      </a-form-item>
      <a-form-item>
        <a-date-picker v-model:value="query.endDate" value-format="YYYY-MM-DD" placeholder="结束日期" style="width: 140px" />
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
          <a-button :icon="h(ReloadOutlined)" @click="onReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>

    <a-table
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :pagination="{ current: query.page, pageSize: query.pageSize, total, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
      row-key="id"
      @change="(p: any) => { query.page = p.current; query.pageSize = p.pageSize; load() }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status as SalaryRecordStatus]">{{ statusLabel[record.status as SalaryRecordStatus] || record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <template v-if="record.status === 'PENDING'">
              <a @click="onUpdateStatus(record, 'CONFIRMED')">确认</a>
            </template>
            <template v-else-if="record.status === 'CONFIRMED'">
              <a @click="onUpdateStatus(record, 'PAID')">发放</a>
            </template>
            <span v-else>-</span>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.search-bar {
  margin-bottom: 16px;
}
</style>
