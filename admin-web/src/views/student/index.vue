<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchStudents,
  createStudent,
  updateStudent,
  updateStudentStatus,
  type Student,
  type Gender,
  type StudentStatus,
} from '@/api/student'
import { formatDate } from '@/utils/format'

const router = useRouter()

const loading = ref(false)
const list = ref<Student[]>([])
const total = ref(0)

const query = reactive({ keyword: '', status: undefined as StudentStatus | undefined, gender: undefined as Gender | undefined, page: 1, pageSize: 10 })

const statusLabel: Record<StudentStatus, string> = { ACTIVE: '在读', PAUSED: '停课', GRADUATED: '毕业', INACTIVE: '停用' }
const statusColor: Record<StudentStatus, string> = { ACTIVE: 'green', PAUSED: 'orange', GRADUATED: 'blue', INACTIVE: 'default' }
const genderLabel: Record<Gender, string> = { MALE: '男', FEMALE: '女' }

const columns = [
  { title: '学号', dataIndex: 'studentCode', key: 'studentCode', width: 130 },
  { title: '姓名', dataIndex: 'name', key: 'name', width: 120 },
  { title: '性别', dataIndex: 'gender', key: 'gender', width: 70 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '年级', dataIndex: 'grade', key: 'grade', width: 90 },
  { title: '学校', dataIndex: 'school', key: 'school', ellipsis: true },
  { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
  { title: '报名时间', dataIndex: 'createTime', key: 'createTime', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '操作', dataIndex: 'action', key: 'action', width: 150, fixed: 'right' },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchStudents({ keyword: query.keyword || undefined, status: query.status, gender: query.gender, page: query.page, pageSize: query.pageSize })
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
  query.gender = undefined
  query.page = 1
  load()
}

// ─── 新建 / 编辑 ───
const modalOpen = ref(false)
const modalLoading = ref(false)
const editing = ref<Student | null>(null)
const form = reactive({
  name: '',
  gender: 'MALE' as Gender,
  birthDate: '',
  phone: '',
  email: '',
  school: '',
  grade: '',
  tags: [] as string[],
  note: '',
})

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', gender: 'MALE' as Gender, birthDate: '', phone: '', email: '', school: '', grade: '', tags: [], note: '' })
  modalOpen.value = true
}

function openEdit(row: Student) {
  editing.value = row
  Object.assign(form, {
    name: row.name,
    gender: row.gender,
    birthDate: row.birthDate ? row.birthDate.slice(0, 10) : '',
    phone: row.phone || '',
    email: row.email || '',
    school: row.school || '',
    grade: row.grade || '',
    tags: row.tags || [],
    note: row.note || '',
  })
  modalOpen.value = true
}

async function onSubmit() {
  if (!form.name.trim()) {
    message.warning('请输入学生姓名')
    return
  }
  if (!form.birthDate) {
    message.warning('请选择出生日期')
    return
  }
  modalLoading.value = true
  try {
    if (editing.value) {
      await updateStudent(editing.value.id, {
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
        phone: form.phone || undefined,
        email: form.email || undefined,
        school: form.school || undefined,
        grade: form.grade || undefined,
        tags: form.tags.length ? form.tags : undefined,
        note: form.note || undefined,
      })
      message.success('学生信息已更新')
    } else {
      await createStudent({
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
        phone: form.phone || undefined,
        email: form.email || undefined,
        school: form.school || undefined,
        grade: form.grade || undefined,
        tags: form.tags.length ? form.tags : undefined,
        note: form.note || undefined,
      })
      message.success('学生创建成功')
    }
    modalOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    modalLoading.value = false
  }
}

// ─── 状态切换 ───
function onToggleStatus(row: Student) {
  const target = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  const text = target === 'INACTIVE' ? '停用' : '启用'
  Modal.confirm({
    title: `确认${text}该学生？`,
    content: `「${row.name}」将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateStudentStatus(row.id, target)
        message.success(`已${text}`)
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function goDetail(row: Student) {
  router.push(`/students/${row.id}`)
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false">
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-input v-model:value="query.keyword" placeholder="姓名 / 学号 / 手机号" allow-clear style="width: 200px" @press-enter="onSearch" />
      </a-form-item>
      <a-form-item>
        <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 120px" @change="onSearch">
          <a-select-option v-for="(label, key) in statusLabel" :key="key" :value="key">{{ label }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-select v-model:value="query.gender" placeholder="性别" allow-clear style="width: 100px" @change="onSearch">
          <a-select-option value="MALE">男</a-select-option>
          <a-select-option value="FEMALE">女</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
          <a-button :icon="h(ReloadOutlined)" @click="onReset">重置</a-button>
        </a-space>
      </a-form-item>
      <a-form-item class="search-actions">
        <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openCreate">新建学生</a-button>
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
        <template v-if="column.key === 'name'">
          <a @click="goDetail(record)">{{ record.name }}</a>
        </template>
        <template v-else-if="column.key === 'gender'">
          {{ genderLabel[record.gender as Gender] || '-' }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status as StudentStatus]">{{ statusLabel[record.status as StudentStatus] || record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a @click="goDetail(record)">详情</a>
            <a @click="openEdit(record)">编辑</a>
            <a :style="{ color: record.status === 'ACTIVE' ? '#ff4d4f' : undefined }" @click="onToggleStatus(record)">
              {{ record.status === 'ACTIVE' ? '停用' : '启用' }}
            </a>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalOpen" :title="editing ? '编辑学生' : '新建学生'" :confirm-loading="modalLoading" ok-text="保存" cancel-text="取消" width="600px" @ok="onSubmit">
      <a-form layout="vertical" :model="form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="姓名" required>
              <a-input v-model:value="form.name" placeholder="学生姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="性别" required>
              <a-radio-group v-model:value="form.gender">
                <a-radio value="MALE">男</a-radio>
                <a-radio value="FEMALE">女</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="出生日期" required>
          <a-date-picker v-model:value="form.birthDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="联系电话">
              <a-input v-model:value="form.phone" placeholder="家长联系电话" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="邮箱">
              <a-input v-model:value="form.email" placeholder="邮箱" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="学校">
              <a-input v-model:value="form.school" placeholder="就读学校" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="年级">
              <a-input v-model:value="form.grade" placeholder="年级" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="标签">
          <a-select v-model:value="form.tags" mode="tags" placeholder="输入后回车添加标签" style="width: 100%" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.note" :rows="3" placeholder="备注" />
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
