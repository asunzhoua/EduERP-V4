<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { InboxOutlined } from '@ant-design/icons-vue'
import type { ImportReport } from '@/types/api'

const props = defineProps<{
  open: boolean
  title: string
  /** 导入执行函数：接收选择的文件，返回后端 ImportReport */
  importFn: (file: File) => Promise<ImportReport>
  /** 表头/格式提示文案（展示在上传区下方） */
  hint?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'success'): void
}>()

const importing = ref(false)
const report = ref<ImportReport | null>(null)
const selectedName = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) {
      report.value = null
      selectedName.value = ''
    }
  },
)

function close() {
  if (importing.value) return
  emit('update:open', false)
}

function onBeforeUpload(file: File) {
  selectedName.value = file.name
  importing.value = true
  props
    .importFn(file)
    .then((r) => {
      report.value = r
      emit('success')
    })
    .catch((e: Error) => {
      message.error(e.message || '导入失败')
    })
    .finally(() => {
      importing.value = false
    })
  return false
}

const failedRows = ref<ImportReport['details']>([])
watch(
  () => report.value,
  (r) => {
    failedRows.value = r ? r.details.filter((d) => !d.success) : []
  },
)
</script>

<template>
  <a-modal
    :open="open"
    :title="title"
    :footer="report ? undefined : null"
    :confirm-loading="importing"
    ok-text="完成"
    :cancel-button-props="report ? { style: 'display: none' } : undefined"
    width="720px"
    @ok="close"
    @cancel="close"
  >
    <!-- 上传阶段 -->
    <template v-if="!report">
      <a-upload-dragger
        :before-upload="onBeforeUpload"
        :show-upload-list="false"
        accept=".xlsx,.xls,.csv"
        :disabled="importing"
      >
        <p class="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p class="ant-upload-text">{{ importing ? '正在导入，请稍候…' : '点击或拖拽 Excel / CSV 文件到此处' }}</p>
        <p class="ant-upload-hint">支持 .xlsx / .xls / .csv，文件不超过 5MB</p>
      </a-upload-dragger>
      <p v-if="selectedName && !report" style="margin-top: 8px; color: #6F675D">已选择：{{ selectedName }}</p>
      <p v-if="hint" style="margin-top: 12px; margin-bottom: 0; color: #6F675D; white-space: pre-line">{{ hint }}</p>
    </template>

    <!-- 导入结果阶段 -->
    <template v-else>
      <a-space style="margin-bottom: 12px">
        <a-tag color="blue">共 {{ report.total }} 行</a-tag>
        <a-tag color="green">成功 {{ report.success }}</a-tag>
        <a-tag :color="report.failure > 0 ? 'red' : 'default'">失败 {{ report.failure }}</a-tag>
      </a-space>

      <a-alert
        v-if="report.failure === 0"
        type="success"
        show-icon
        message="导入完成"
        description="全部数据已成功导入。"
        style="margin-bottom: 12px"
      />

      <a-table
        v-else
        :columns="[
          { title: '行号', dataIndex: 'row', key: 'row', width: 90 },
          { title: '错误信息', dataIndex: 'errors', key: 'errors' },
        ]"
        :data-source="failedRows"
        :pagination="false"
        row-key="row"
        size="small"
        :scroll="{ y: 320 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'row'">第 {{ record.row }} 行</template>
          <template v-else-if="column.key === 'errors'">
            <div v-for="(err, i) in record.errors" :key="i" style="color: #ff4d4f">{{ err }}</div>
          </template>
        </template>
      </a-table>
    </template>
  </a-modal>
</template>
