<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchClasses,
  createClass,
  updateClass,
  updateClassStatus,
  type ClassItem,
  type ClassStatus,
  type ClassQuery,
} from '@/api/class'
import { fetchCourses } from '@/api/course'
import { formatDate } from '@/utils/format'

const router = useRouter()

const loading = ref(false)
const list = ref<ClassItem[]>([])
const total = ref(0)
const courseList = ref<{ courseCode: string; name: string }[]>([])

const query = reactive<ClassQuery>({ keyword: '', status: undefined, page: 1, pageSize: 10 })

const statusLabel: Record<ClassStatus, string> = { DRAFT: '草稿', ACTIVE: '进行中', COMPLETED: '已完成', CANCELLED: '已取消' }
const statusColor: Record<ClassStatus, string> = { DRAFT: 'default', ACTIVE: 'green', COMPLETED: 'blue', CANCELLED: 'red' }

const columns = [
  { title: '班级编号', dataIndex: 'classCode', key: 'classCode', width: 120 },
  { title: '班级名称', dataIndex: 'name', key: 'name', width: 140 },
  { title: '课程', dataIndex: 'courseName', key: 'courseName', width: 140 },
  { title: '老师', dataIndex: 'teacherName', key: 'teacherName', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '开课日期', dataIndex: 'startDate', key: 'startDate', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '周几', dataIndex: 'dayOfWeek', key: 'dayOfWeek', width: 140 },
  { title: '时间', dataIndex: 'startTime', key: 'time', width: 130 },
  { title: '进度', dataIndex: 'completedLessons', key: 'progress', width: 90 },
  { title: '人数', dataIndex: 'currentStudents', key: 'count', width: 110 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 220, fixed: 'right' },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchClasses({ keyword: query.keyword || undefined, status: query.status, page: query.page, pageSize: query.pageSize })
    list.value = res.items
    total.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadCourses() {
  try {
    const res = await fetchCourses({ pageSize: 100 })
    courseList.value = res.items
  } catch (e) {
    message.error((e as Error).message || '课程加载失败')
  }
}

function onSearch() {
  query.page = 1
  load()
}

function onReset() {
  query.keyword = ''
  query.status = undefined
  query.page = 1
  load()
}

function dayOfWeekText(days: number[]): string {
  if (!days || !days.length) return '-'
  const map = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return days.map(d => map[d - 1] || '').filter(Boolean).join('、')
}

// ─── 新建 / 编辑 ───
const modalOpen = ref(false)
const modalLoading = ref(false)
const editing = ref<ClassItem | null>(null)
const form = reactive({
  courseCode: '',
  name: '',
  startDate: '',
  totalLessons: 1,
  defaultDuration: 60,
  dayOfWeek: [] as number[],
  startTime: '',
  endTime: '',
  maxStudents: undefined as number | undefined,
  room: '',
  note: '',
})

function openCreate() {
  editing.value = null
  Object.assign(form, {
    courseCode: '',
    name: '',
    startDate: '',
    totalLessons: 1,
    defaultDuration: 60,
    dayOfWeek: [],
    startTime: '',
    endTime: '',
    maxStudents: undefined,
    room: '',
    note: '',
  })
  modalOpen.value = true
}

function openEdit(row: ClassItem) {
  editing.value = row
  Object.assign(form, {
    courseCode: row.courseCode,
    name: row.name,
    startDate: row.startDate ? row.startDate.slice(0, 10) : '',
    totalLessons: row.totalLessons,
    defaultDuration: row.defaultDuration,
    dayOfWeek: row.dayOfWeek || [],
    startTime: row.startTime || '',
    endTime: row.endTime || '',
    maxStudents: row.maxStudents,
    room: row.room || '',
    note: row.note || '',
  })
  modalOpen.value = true
}

async function onSubmit() {
  if (!editing.value && !form.courseCode) {
    message.warning('请选择课程')
    return
  }
  if (!form.name.trim()) {
    message.warning('请输入班级名称')
    return
  }
  if (!form.startDate) {
    message.warning('请选择开课日期')
    return
  }
  if (!form.dayOfWeek.length) {
    message.warning('请选择上课星期')
    return
  }
  if (!form.startTime || !form.endTime) {
    message.warning('请选择上课时间')
    return
  }
  modalLoading.value = true
  try {
    if (editing.value) {
      await updateClass(editing.value.classCode, {
        name: form.name,
        startDate: form.startDate,
        totalLessons: form.totalLessons,
        defaultDuration: form.defaultDuration,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        maxStudents: form.maxStudents || undefined,
        room: form.room || undefined,
        note: form.note || undefined,
      })
      message.success('班级信息已更新')
    } else {
      await createClass({
        courseCode: form.courseCode,
        name: form.name,
        startDate: form.startDate,
        totalLessons: form.totalLessons,
        defaultDuration: form.defaultDuration,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        maxStudents: form.maxStudents || undefined,
        room: form.room || undefined,
        note: form.note || undefined,
      })
      message.success('班级创建成功')
    }
    modalOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    modalLoading.value = false
  }
}

// ─── 状态操作 ───
function onActivate(row: ClassItem) {
  Modal.confirm({
    title: '确认开课？',
    content: `「${row.name}」将开始上课。`,
    okText: '确认开课',
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateClassStatus(row.classCode, 'ACTIVE')
        message.success('已开课')
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onComplete(row: ClassItem) {
  Modal.confirm({
    title: '确认完成该班级？',
    content: `「${row.name}」将被标记为已完成。`,
    okText: '确认完成',
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateClassStatus(row.classCode, 'COMPLETED')
        message.success('班级已完成')
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onCancel(row: ClassItem) {
  cancelRow.value = row
  cancelReason.value = ''
  cancelOpen.value = true
}

const cancelOpen = ref(false)
const cancelLoading = ref(false)
const cancelRow = ref<ClassItem | null>(null)
const cancelReason = ref('')

async function submitCancel() {
  if (!cancelRow.value) return
  cancelLoading.value = true
  try {
    await updateClassStatus(cancelRow.value.classCode, 'CANCELLED', cancelReason.value || undefined)
    message.success('班级已取消')
    cancelOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '操作失败')
  } finally {
    cancelLoading.value = false
  }
}

onMounted(() => {
  load()
  loadCourses()
})
</script>

<template>
  <a-card :bordered="false">
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-input v-model:value="query.keyword" placeholder="班名 / 班级编号 / 课程" allow-clear style="width: 220px" @press-enter="onSearch" />
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
      <a-form-item class="search-actions">
        <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openCreate">新建班级</a-button>
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
          <a-tag :color="statusColor[record.status as ClassStatus]">{{ statusLabel[record.status as ClassStatus] || record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'dayOfWeek'">
          {{ dayOfWeekText(record.dayOfWeek as number[]) }}
        </template>
        <template v-else-if="column.key === 'time'">
          {{ record.startTime }} - {{ record.endTime }}
        </template>
        <template v-else-if="column.key === 'progress'">
          {{ record.completedLessons }}/{{ record.totalLessons }}
        </template>
        <template v-else-if="column.key === 'count'">
          {{ record.currentStudents }}/{{ record.maxStudents }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a @click="router.push(`/classes/${record.classCode}`)">详情</a>
            <a @click="openEdit(record)">编辑</a>
            <template v-if="record.status === 'DRAFT'">
              <a @click="onActivate(record)">开课</a>
              <a :style="{ color: '#ff4d4f' }" @click="onCancel(record)">取消</a>
            </template>
            <template v-else-if="record.status === 'ACTIVE'">
              <a @click="onComplete(record)">完成</a>
              <a :style="{ color: '#ff4d4f' }" @click="onCancel(record)">取消</a>
            </template>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalOpen" :title="editing ? '编辑班级' : '新建班级'" :confirm-loading="modalLoading" ok-text="保存" cancel-text="取消" width="720px" @ok="onSubmit">
      <a-form layout="vertical" :model="form">
        <a-form-item v-if="!editing" label="课程" required>
          <a-select v-model:value="form.courseCode" placeholder="请选择课程" style="width: 100%">
            <a-select-option v-for="c in courseList" :key="c.courseCode" :value="c.courseCode">{{ c.courseCode }} · {{ c.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="班级名称" required>
              <a-input v-model:value="form.name" placeholder="班级名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="开课日期" required>
              <a-date-picker v-model:value="form.startDate" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="总课时" required>
              <a-input-number v-model:value="form.totalLessons" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="每节课时长（分钟）" required>
              <a-input-number v-model:value="form.defaultDuration" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="上课星期" required>
          <a-checkbox-group v-model:value="form.dayOfWeek">
            <a-checkbox v-for="d in 7" :key="d" :value="d">周{{ '一二三四五六日'[d - 1] }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item label="上课时间" required>
          <a-space>
            <a-time-picker v-model:value="form.startTime" value-format="HH:mm" placeholder="开始时间" style="width: 120px" />
            <span>-</span>
            <a-time-picker v-model:value="form.endTime" value-format="HH:mm" placeholder="结束时间" style="width: 120px" />
          </a-space>
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="最大人数">
              <a-input-number v-model:value="form.maxStudents" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="教室">
              <a-input v-model:value="form.room" placeholder="教室" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.note" :rows="3" placeholder="备注" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="cancelOpen" title="取消班级" :confirm-loading="cancelLoading" ok-text="确认取消" cancel-text="关闭" @ok="submitCancel">
      <a-form layout="vertical">
        <a-form-item label="取消原因">
          <a-textarea v-model:value="cancelReason" :rows="3" placeholder="请输入取消原因（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>
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
