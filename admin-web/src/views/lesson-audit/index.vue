<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  fetchLessonAudits,
  type LessonAudit,
  type LessonAdjustmentAction,
  type LessonAdjustmentSource,
} from '@/api/enrollment'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const list = ref<LessonAudit[]>([])
const total = ref(0)

const query = reactive({
  action: undefined as LessonAdjustmentAction | undefined,
  source: undefined as LessonAdjustmentSource | undefined,
  range: undefined as [string, string] | undefined,
  page: 1,
  pageSize: 20,
})

const actionLabel: Record<LessonAdjustmentAction, string> = { ADD: '增加', DELETE: '减少', SET: '调整' }
const actionColor: Record<LessonAdjustmentAction, string> = { ADD: 'green', DELETE: 'red', SET: 'blue' }
const sourceLabel: Record<LessonAdjustmentSource, string> = {
  ADMIN_MANUAL: '手动调整',
  IMPORT: '批量导入',
  PROMO: '优惠活动',
  CONTRACT_CREATE: '新建合同',
}

const columns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, customRender: ({ text }: { text: string }) => formatDateTime(text) },
  { title: '学员', dataIndex: 'studentCode', key: 'studentCode', width: 110 },
  { title: '合同号', dataIndex: 'contractCode', key: 'contractCode', width: 150 },
  { title: '动作', dataIndex: 'action', key: 'action', width: 80 },
  { title: '变更', dataIndex: 'delta', key: 'delta', width: 80 },
  { title: '总课时', key: 'total', width: 110 },
  { title: '剩余课时', key: 'remaining', width: 110 },
  { title: '来源', dataIndex: 'source', key: 'source', width: 110 },
  { title: '操作者', dataIndex: 'operatorName', key: 'operatorName', width: 110 },
  { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchLessonAudits({
      action: query.action,
      source: query.source,
      startDate: query.range?.[0],
      endDate: query.range?.[1],
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
  query.action = undefined
  query.source = undefined
  query.range = undefined
  query.page = 1
  load()
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false">
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-select v-model:value="query.action" placeholder="动作" allow-clear style="width: 120px" @change="onSearch">
          <a-select-option v-for="(label, key) in actionLabel" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-select v-model:value="query.source" placeholder="来源" allow-clear style="width: 140px" @change="onSearch">
          <a-select-option v-for="(label, key) in sourceLabel" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-range-picker v-model:value="query.range" value-format="YYYY-MM-DD" />
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
        <template v-if="column.key === 'action'">
          <a-tag :color="actionColor[record.action as LessonAdjustmentAction]">{{ actionLabel[record.action as LessonAdjustmentAction] }}</a-tag>
        </template>
        <template v-else-if="column.key === 'delta'">
          <span :style="{ color: record.delta > 0 ? '#52c41a' : record.delta < 0 ? '#ff4d4f' : undefined }">
            {{ record.delta > 0 ? `+${record.delta}` : record.delta }}
          </span>
        </template>
        <template v-else-if="column.key === 'total'">
          {{ record.beforeTotal }} → {{ record.afterTotal }}
        </template>
        <template v-else-if="column.key === 'remaining'">
          {{ record.beforeRemaining }} → {{ record.afterRemaining }}
        </template>
        <template v-else-if="column.key === 'source'">
          {{ sourceLabel[record.source as LessonAdjustmentSource] || record.source }}
        </template>
        <template v-else-if="column.key === 'reason'">
          {{ record.reason || '-' }}
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped>
.search-bar {
  margin-bottom: 16px;
}
</style>
