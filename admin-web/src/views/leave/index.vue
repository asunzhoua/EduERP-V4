<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  type LeaveRequest,
  type LeaveStatus,
} from '@/api/leave'
import { formatDate, formatDateTime } from '@/utils/format'

type LeaveType = LeaveRequest['leaveType']

const loading = ref(false)
const list = ref<LeaveRequest[]>([])
const total = ref(0)
const query = reactive({ status: undefined as LeaveStatus | undefined, studentCode: '', classCode: '', page: 1, pageSize: 10 })

const leaveTypeLabel: Record<LeaveType, string> = { SICK: '病假', PERSONAL: '事假' }
const statusLabel: Record<LeaveStatus, string> = { PENDING: '待审批', APPROVED: '已批准', REJECTED: '已驳回' }
const statusColor: Record<LeaveStatus, string> = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'default' }

const columns = [
  { title: '学生编号', dataIndex: 'studentCode', key: 'studentCode', width: 120 },
  { title: '班级', dataIndex: 'classCode', key: 'classCode', width: 130 },
  { title: '学生姓名', dataIndex: 'studentName', key: 'studentName', width: 110 },
  { title: '请假类型', dataIndex: 'leaveType', key: 'leaveType', width: 90 },
  { title: '请假日期', dataIndex: 'leaveDate', key: 'leaveDate', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '事由', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '申请时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, customRender: ({ text }: { text: string }) => formatDateTime(text) },
  { title: '操作', dataIndex: 'action', key: 'action', width: 160, fixed: 'right' },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchLeaveRequests({
      status: query.status,
      studentCode: query.studentCode || undefined,
      classCode: query.classCode || undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = res.items
    total.value = res.total
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
  query.studentCode = ''
  query.classCode = ''
  query.status = undefined
  query.page = 1
  load()
}

// ─── 批准 ───
function onApprove(row: LeaveRequest) {
  Modal.confirm({
    title: '确认批准该请假申请？',
    content: `「${row.studentName || row.studentCode}」的请假将被批准。`,
    okText: '确认批准',
    cancelText: '取消',
    onOk: async () => {
      try {
        await approveLeaveRequest(row.id)
        message.success('已批准')
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─── 驳回 ───
const rejectOpen = ref(false)
const rejectLoading = ref(false)
const rejectTarget = ref<LeaveRequest | null>(null)
const rejectReason = ref('')

function openReject(row: LeaveRequest) {
  rejectTarget.value = row
  rejectReason.value = ''
  rejectOpen.value = true
}

async function onRejectSubmit() {
  if (!rejectReason.value.trim()) {
    message.warning('请输入驳回原因')
    return
  }
  if (!rejectTarget.value) return
  rejectLoading.value = true
  try {
    await rejectLeaveRequest(rejectTarget.value.id, rejectReason.value)
    message.success('已驳回')
    rejectOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '操作失败')
  } finally {
    rejectLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false">
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-input v-model:value="query.studentCode" placeholder="学生编号" allow-clear style="width: 150px" @press-enter="onSearch" />
      </a-form-item>
      <a-form-item>
        <a-input v-model:value="query.classCode" placeholder="班级编号" allow-clear style="width: 150px" @press-enter="onSearch" />
      </a-form-item>
      <a-form-item>
        <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 120px" @change="onSearch">
          <a-select-option v-for="(label, key) in statusLabel" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
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
        <template v-if="column.key === 'studentName'">
          {{ record.studentName || '-' }}
        </template>
        <template v-else-if="column.key === 'leaveType'">
          {{ leaveTypeLabel[record.leaveType as LeaveType] || record.leaveType }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status as LeaveStatus]">{{ statusLabel[record.status as LeaveStatus] || record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <template v-if="record.status === 'PENDING'">
            <a-space>
              <a @click="onApprove(record)">批准</a>
              <a :style="{ color: '#ff4d4f' }" @click="openReject(record)">驳回</a>
            </a-space>
          </template>
          <template v-else-if="record.status === 'APPROVED'">
            <div class="cell-muted">审批人：{{ record.reviewedBy ?? '-' }}</div>
            <div class="cell-muted">审批时间：{{ formatDateTime(record.reviewedAt) }}</div>
          </template>
          <template v-else>
            <div class="cell-muted">驳回原因：{{ record.rejectionReason || '-' }}</div>
          </template>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="rejectOpen" title="驳回请假申请" :confirm-loading="rejectLoading" ok-text="确认驳回" cancel-text="取消" width="480px" @ok="onRejectSubmit">
      <a-form layout="vertical">
        <a-form-item label="驳回原因" required>
          <a-textarea v-model:value="rejectReason" :rows="3" placeholder="请输入驳回原因" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<style scoped>
.search-bar {
  margin-bottom: 16px;
}
.cell-muted {
  color: #999;
  line-height: 1.6;
}
</style>
