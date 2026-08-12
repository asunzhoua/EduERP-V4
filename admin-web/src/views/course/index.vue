<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchCourses,
  createCourse,
  updateCourse,
  updateCourseStatus,
  type CourseItem,
  type Subject,
  type CourseType,
  type CourseStatus,
} from '@/api/course'
import { ensureSubjectsLoaded, subjectGroupOptions, subjectName } from '@/utils/subjectCatalog'

const loading = ref(false)
const list = ref<CourseItem[]>([])
const total = ref(0)

const query = reactive({ keyword: '', status: undefined as CourseStatus | undefined, subject: undefined as string | undefined, page: 1, pageSize: 10 })

const statusLabel: Record<CourseStatus, string> = { DRAFT: '草稿', PUBLISHED: '已上架', ARCHIVED: '已归档' }
const statusColor: Record<CourseStatus, string> = { DRAFT: 'default', PUBLISHED: 'green', ARCHIVED: 'blue' }
const typeLabel: Record<CourseType, string> = { INDIVIDUAL: '一对一', GROUP: '小班', TRIAL: '体验', CAMP: '营地' }

const columns = [
  { title: '课程编号', dataIndex: 'courseCode', key: 'courseCode', width: 130 },
  { title: '课程名称', dataIndex: 'name', key: 'name', width: 150 },
  { title: '学科', dataIndex: 'subject', key: 'subject', width: 90 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 90 },
  { title: '总课时', dataIndex: 'totalLessons', key: 'totalLessons', width: 90 },
  { title: '时长', dataIndex: 'defaultDuration', key: 'defaultDuration', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 180, fixed: 'right' },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchCourses({ keyword: query.keyword || undefined, status: query.status, subject: query.subject, page: query.page, pageSize: query.pageSize })
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
  query.keyword = ''
  query.status = undefined
  query.subject = undefined
  query.page = 1
  load()
}

// ─── 新建 / 编辑 ───
const modalOpen = ref(false)
const modalLoading = ref(false)
const editing = ref<CourseItem | null>(null)
const form = reactive({
  name: '',
  subject: 'MATH',
  type: 'INDIVIDUAL' as CourseType,
  totalHours: 1,
  totalLessons: 1,
  defaultDuration: 60,
  description: '',
  tags: [] as string[],
  note: '',
})

function openCreate() {
  editing.value = null
  Object.assign(form, {
    name: '',
    subject: 'MATH',
    type: 'INDIVIDUAL' as CourseType,
    totalHours: 1,
    totalLessons: 1,
    defaultDuration: 60,
    description: '',
    tags: [],
    note: '',
  })
  modalOpen.value = true
}

function openEdit(row: CourseItem) {
  editing.value = row
  Object.assign(form, {
    name: row.name,
    subject: row.subject,
    type: row.type,
    totalHours: row.totalHours,
    totalLessons: row.totalLessons,
    defaultDuration: row.defaultDuration,
    description: row.description || '',
    tags: row.tags || [],
    note: row.note || '',
  })
  modalOpen.value = true
}

async function onSubmit() {
  if (!form.name.trim()) {
    message.warning('请输入课程名称')
    return
  }
  if (!form.subject) {
    message.warning('请选择学科')
    return
  }
  if (!form.type) {
    message.warning('请选择课程类型')
    return
  }
  modalLoading.value = true
  try {
    if (editing.value) {
      await updateCourse(editing.value.courseCode, {
        name: form.name,
        subject: form.subject as Subject,
        type: form.type,
        totalHours: form.totalHours,
        totalLessons: form.totalLessons,
        defaultDuration: form.defaultDuration,
        description: form.description || undefined,
        tags: form.tags.length ? form.tags : undefined,
        note: form.note || undefined,
      })
      message.success('课程信息已更新')
    } else {
      await createCourse({
        name: form.name,
        subject: form.subject as Subject,
        type: form.type,
        totalHours: form.totalHours,
        totalLessons: form.totalLessons,
        defaultDuration: form.defaultDuration,
        description: form.description || undefined,
        tags: form.tags.length ? form.tags : undefined,
        note: form.note || undefined,
      })
      message.success('课程创建成功')
    }
    modalOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    modalLoading.value = false
  }
}

// ─── 上架 / 下架 / 归档 ───
function onTogglePublish(row: CourseItem) {
  const target: CourseStatus = row.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
  const text = target === 'PUBLISHED' ? '上架' : '下架'
  Modal.confirm({
    title: `确认${text}该课程？`,
    content: `「${row.name}」将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateCourseStatus(row.courseCode, target)
        message.success(`已${text}`)
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onArchive(row: CourseItem) {
  Modal.confirm({
    title: '确认归档该课程？',
    content: `「${row.name}」将被归档。`,
    okText: '确认归档',
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateCourseStatus(row.courseCode, 'ARCHIVED')
        message.success('已归档')
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

onMounted(() => {
  ensureSubjectsLoaded()
  load()
})
</script>

<template>
  <a-card :bordered="false">
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-input v-model:value="query.keyword" placeholder="课程名称 / 编号" allow-clear style="width: 200px" @press-enter="onSearch" />
      </a-form-item>
      <a-form-item>
        <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 120px" @change="onSearch">
          <a-select-option v-for="(label, key) in statusLabel" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-select v-model:value="query.subject" placeholder="学科" allow-clear style="width: 140px" @change="onSearch">
          <a-select-opt-group v-for="g in subjectGroupOptions()" :key="g.category" :label="g.label">
            <a-select-option v-for="s in g.items" :key="s.code" :value="s.code">{{ s.name }}</a-select-option>
          </a-select-opt-group>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
          <a-button :icon="h(ReloadOutlined)" @click="onReset">重置</a-button>
        </a-space>
      </a-form-item>
      <a-form-item class="search-actions">
        <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openCreate">新建课程</a-button>
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
        <template v-if="column.key === 'subject'">
          {{ subjectName(record.subject as string) }}
        </template>
        <template v-else-if="column.key === 'type'">
          {{ typeLabel[record.type as CourseType] || record.type }}
        </template>
        <template v-else-if="column.key === 'defaultDuration'">
          {{ record.defaultDuration }} 分钟
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status as CourseStatus]">{{ statusLabel[record.status as CourseStatus] || record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a @click="openEdit(record)">编辑</a>
            <template v-if="record.status !== 'ARCHIVED'">
              <a v-if="record.status === 'DRAFT'" @click="onTogglePublish(record)">上架</a>
              <a v-else-if="record.status === 'PUBLISHED'" :style="{ color: '#ff4d4f' }" @click="onTogglePublish(record)">下架</a>
              <a @click="onArchive(record)">归档</a>
            </template>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalOpen" :title="editing ? '编辑课程' : '新建课程'" :confirm-loading="modalLoading" ok-text="保存" cancel-text="取消" width="640px" @ok="onSubmit">
      <a-form layout="vertical" :model="form">
        <a-form-item label="课程名称" required>
          <a-input v-model:value="form.name" placeholder="课程名称" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="学科" required>
              <a-select v-model:value="form.subject" placeholder="请选择学科" style="width: 100%">
                <a-select-opt-group v-for="g in subjectGroupOptions()" :key="g.category" :label="g.label">
                  <a-select-option v-for="s in g.items" :key="s.code" :value="s.code">{{ s.name }}</a-select-option>
                </a-select-opt-group>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="类型" required>
              <a-select v-model:value="form.type" placeholder="请选择类型" style="width: 100%">
                <a-select-option v-for="(label, key) in typeLabel" :key="key" :value="key">{{ label }}</a-select-option>
              </a-select>
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
            <a-form-item label="每节时长（分钟）" required>
              <a-input-number v-model:value="form.defaultDuration" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="总学时" required>
          <a-input-number v-model:value="form.totalHours" :min="1" style="width: 100%" />
        </a-form-item>
        <a-form-item label="简介">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="课程简介" />
        </a-form-item>
        <a-form-item label="标签">
          <a-select v-model:value="form.tags" mode="tags" placeholder="输入后回车添加标签" style="width: 100%" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.note" :rows="2" placeholder="备注" />
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
