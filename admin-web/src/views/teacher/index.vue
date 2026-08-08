<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchTeachers,
  createTeacher,
  updateTeacher,
  updateTeacherStatus,
  type Teacher,
} from '@/api/teacher'
import { formatDate, formatMoney } from '@/utils/format'

const loading = ref(false)
const list = ref<Teacher[]>([])
const total = ref(0)

const query = reactive({ keyword: '', status: undefined as number | undefined, page: 1, pageSize: 10 })

const statusLabel: Record<number, string> = { 1: '启用', 0: '停用' }
const statusColor: Record<number, string> = { 1: 'green', 0: 'default' }

const teacherLevelOptions = [
  { value: '', label: '未设置' },
  { value: '初级', label: '初级' },
  { value: '中级', label: '中级' },
  { value: '高级', label: '高级' },
  { value: '特级', label: '特级' },
]

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
  { title: '等级', dataIndex: 'teacherLevel', key: 'teacherLevel', width: 90 },
  { title: '手机号', dataIndex: 'mobile', key: 'mobile', width: 130 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '授课数', dataIndex: 'teachingCount', key: 'teachingCount', width: 90 },
  { title: '本月工资', dataIndex: 'monthSalary', key: 'monthSalary', width: 140 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '操作', dataIndex: 'action', key: 'action', width: 140, fixed: 'right' },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchTeachers({ keyword: query.keyword || undefined, status: query.status, page: query.page, pageSize: query.pageSize })
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
  query.page = 1
  load()
}

// ─── 新建 / 编辑 ───
const modalOpen = ref(false)
const modalLoading = ref(false)
const editing = ref<Teacher | null>(null)
const form = reactive({
  username: '',
  name: '',
  mobile: '',
  password: '',
  teacherLevel: '',
})

function openCreate() {
  editing.value = null
  Object.assign(form, { username: '', name: '', mobile: '', password: '', teacherLevel: '' })
  modalOpen.value = true
}

function openEdit(row: Teacher) {
  editing.value = row
  Object.assign(form, { name: row.name, mobile: row.mobile || '', password: '', teacherLevel: row.teacherLevel || '' })
  modalOpen.value = true
}

async function onSubmit() {
  if (!editing.value && !form.username.trim()) {
    message.warning('请输入用户名')
    return
  }
  if (!form.name.trim()) {
    message.warning('请输入姓名')
    return
  }
  if (!form.mobile.trim()) {
    message.warning('请输入手机号')
    return
  }
  if (!editing.value && !form.password.trim()) {
    message.warning('请输入密码')
    return
  }
  modalLoading.value = true
  try {
    if (editing.value) {
      await updateTeacher(editing.value.id, {
        name: form.name,
        mobile: form.mobile,
        password: form.password || undefined,
        teacherLevel: form.teacherLevel,
      })
      message.success('教师信息已更新')
    } else {
      await createTeacher({
        username: form.username,
        name: form.name,
        mobile: form.mobile,
        password: form.password,
        teacherLevel: form.teacherLevel || null,
      })
      message.success('教师创建成功')
    }
    modalOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    modalLoading.value = false
  }
}

// ─── 启用 / 停用 ───
function onToggleStatus(row: Teacher) {
  const target = row.status === 1 ? 0 : 1
  const text = target === 0 ? '停用' : '启用'
  Modal.confirm({
    title: `确认${text}该教师？`,
    content: `「${row.name}」将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateTeacherStatus(row.id, target)
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
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-input v-model:value="query.keyword" placeholder="姓名 / 手机号" allow-clear style="width: 200px" @press-enter="onSearch" />
      </a-form-item>
      <a-form-item>
        <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 120px" @change="onSearch">
          <a-select-option :value="1">启用</a-select-option>
          <a-select-option :value="0">停用</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
          <a-button :icon="h(ReloadOutlined)" @click="onReset">重置</a-button>
        </a-space>
      </a-form-item>
      <a-form-item class="search-actions">
        <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openCreate">新建教师</a-button>
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
          <a-tag :color="statusColor[record.status as number] || 'default'">{{ statusLabel[record.status as number] || '未知' }}</a-tag>
        </template>
        <template v-else-if="column.key === 'teacherLevel'">
          {{ (record.teacherLevel as string) || '未设置' }}
        </template>
        <template v-else-if="column.key === 'monthSalary'">
          {{ formatMoney(record.monthSalary as number) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a @click="openEdit(record)">编辑</a>
            <a :style="{ color: record.status === 1 ? '#ff4d4f' : undefined }" @click="onToggleStatus(record)">
              {{ record.status === 1 ? '停用' : '启用' }}
            </a>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalOpen" :title="editing ? '编辑教师' : '新建教师'" :confirm-loading="modalLoading" ok-text="保存" cancel-text="取消" width="560px" @ok="onSubmit">
      <a-form layout="vertical" :model="form">
        <a-form-item v-if="!editing" label="用户名" required>
          <a-input v-model:value="form.username" placeholder="登录用户名" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="姓名" required>
              <a-input v-model:value="form.name" placeholder="教师姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号" required>
              <a-input v-model:value="form.mobile" placeholder="手机号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="教师等级">
          <a-select v-model:value="form.teacherLevel" placeholder="选择等级（用于工资规则匹配）">
            <a-select-option v-for="opt in teacherLevelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="密码" :required="!editing">
          <a-input-password v-model:value="form.password" :placeholder="editing ? '留空表示不修改' : '初始密码'" />
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
