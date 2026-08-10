<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchClassLessons,
  startLesson,
  completeLesson,
  confirmLesson,
  confirmLessonAttendance,
  cancelLesson,
  type Lesson,
  type LessonStatus,
} from '@/api/lesson'
import { fetchClasses, type ClassItem } from '@/api/class'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const lessons = ref<Lesson[]>([])
const total = ref(0)
const classes = ref<ClassItem[]>([])
const selectedClass = ref('')
const query = reactive({ status: undefined as LessonStatus | undefined, page: 1, pageSize: 10 })

const statusLabel: Record<LessonStatus, string> = {
  DRAFT: '草稿',
  SCHEDULED: '待上课',
  TEACHING: '进行中',
  FINISHED: '已完成',
  ARCHIVED: '已归档',
  CANCELLED: '已取消',
  SUSPENDED: '已停课',
  RESCHEDULED: '已改期',
  MAKEUP_PENDING: '待补课',
  MAKEUP_COMPLETED: '补课完成',
}
const statusColor: Record<LessonStatus, string> = {
  DRAFT: 'default',
  SCHEDULED: 'blue',
  TEACHING: 'processing',
  FINISHED: 'green',
  ARCHIVED: 'cyan',
  CANCELLED: 'default',
  SUSPENDED: 'orange',
  RESCHEDULED: 'purple',
  MAKEUP_PENDING: 'gold',
  MAKEUP_COMPLETED: 'green',
}

const columns = [
  { title: '课次', dataIndex: 'lessonNumber', key: 'lessonNumber', width: 70 },
  { title: '上课日期', dataIndex: 'scheduledDate', key: 'scheduledDate', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '时间', key: 'time', width: 130 },
  { title: '主题', dataIndex: 'topic', key: 'topic', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 260, fixed: 'right' },
]

async function load() {
  if (!selectedClass.value) return
  loading.value = true
  try {
    const res = await fetchClassLessons(selectedClass.value, { status: query.status })
    lessons.value = res
    total.value = res.length
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadClasses() {
  try {
    const res = await fetchClasses({ pageSize: 100 })
    classes.value = res.items
    if (!selectedClass.value && res.items.length) {
      selectedClass.value = res.items[0].classCode
      load()
    }
  } catch (e) {
    message.error((e as Error).message || '班级加载失败')
  }
}

function onClassChange() {
  query.page = 1
  load()
}

function onSearch() {
  query.page = 1
  load()
}

// ─── 开始 / 完成 ───
function onStart(row: Lesson) {
  Modal.confirm({
    title: '确认开始上课？',
    content: `第 ${row.lessonNumber} 次课即将开始。`,
    okText: '确认开始',
    cancelText: '取消',
    onOk: async () => {
      try {
        await startLesson(row.classCode, row.lessonNumber)
        message.success('已开始上课')
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onComplete(row: Lesson) {
  Modal.confirm({
    title: '确认完成本次课？',
    content: `第 ${row.lessonNumber} 次课将标记为已完成。`,
    okText: '确认完成',
    cancelText: '取消',
    onOk: async () => {
      try {
        await completeLesson(row.classCode, row.lessonNumber)
        message.success('已完成本次课')
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─── 考勤确认 / 归档（管理员闭环） ───
function onConfirmAttendance(row: Lesson) {
  Modal.confirm({
    title: '确认本次课考勤？',
    content: `第 ${row.lessonNumber} 次课的考勤记录将确认。`,
    okText: '确认考勤',
    cancelText: '取消',
    onOk: async () => {
      try {
        const confirmed = await confirmLessonAttendance(row.id)
        message.success(`已确认 ${confirmed.length} 条考勤`)
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onConfirm(row: Lesson) {
  Modal.confirm({
    title: '确认归档本次课？',
    content: `第 ${row.lessonNumber} 次课将归档确认（扣减课时）。`,
    okText: '确认归档',
    cancelText: '取消',
    onOk: async () => {
      try {
        await confirmLesson(row.classCode, row.lessonNumber)
        message.success('已归档确认')
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─── 取消 ───
const cancelOpen = ref(false)
const cancelLoading = ref(false)
const cancelTarget = ref<Lesson | null>(null)
const cancelReason = ref('')

function openCancel(row: Lesson) {
  cancelTarget.value = row
  cancelReason.value = ''
  cancelOpen.value = true
}

async function onCancelSubmit() {
  if (!cancelReason.value.trim()) {
    message.warning('请输入取消原因')
    return
  }
  if (!cancelTarget.value) return
  cancelLoading.value = true
  try {
    await cancelLesson(cancelTarget.value.classCode, cancelTarget.value.lessonNumber, cancelReason.value)
    message.success('已取消本次课')
    cancelOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '操作失败')
  } finally {
    cancelLoading.value = false
  }
}

onMounted(loadClasses)
</script>

<template>
  <a-card :bordered="false">
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item label="班级">
        <a-select v-model:value="selectedClass" placeholder="请选择班级" style="width: 240px" @change="onClassChange">
          <a-select-option v-for="c in classes" :key="c.classCode" :value="c.classCode">{{ c.name }} ({{ c.classCode }})</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="状态">
        <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 120px" @change="onSearch">
          <a-select-option v-for="(label, key) in statusLabel" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
      </a-form-item>
    </a-form>

    <a-table
      :columns="columns"
      :data-source="lessons"
      :loading="loading"
      :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'time'">
          {{ record.startTime }} - {{ record.endTime }}
        </template>
        <template v-else-if="column.key === 'topic'">
          {{ record.topic || '-' }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status as LessonStatus]">{{ statusLabel[record.status as LessonStatus] || record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <template v-if="record.status === 'SCHEDULED' || record.status === 'DRAFT'">
              <a @click="onStart(record)">开始上课</a>
            </template>
            <template v-if="record.status === 'TEACHING'">
              <a @click="onComplete(record)">完成</a>
            </template>
            <template v-if="record.status === 'TEACHING' || record.status === 'FINISHED'">
              <a @click="onConfirmAttendance(record)">确认考勤</a>
            </template>
            <template v-if="record.status === 'FINISHED'">
              <a @click="onConfirm(record)">归档</a>
            </template>
            <template v-if="record.status === 'SCHEDULED' || record.status === 'DRAFT' || record.status === 'TEACHING'">
              <a :style="{ color: '#ff4d4f' }" @click="openCancel(record)">取消</a>
            </template>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="cancelOpen" title="取消课时" :confirm-loading="cancelLoading" ok-text="确认取消" cancel-text="取消" width="480px" @ok="onCancelSubmit">
      <a-form layout="vertical">
        <a-form-item label="取消原因" required>
          <a-textarea v-model:value="cancelReason" :rows="3" placeholder="请输入取消原因" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<style scoped>
.search-bar {
  margin-bottom: 16px;
}
</style>
