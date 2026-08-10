<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchParents,
  createParent,
  updateParentStatus,
  fetchParentStudents,
  linkStudentToParent,
  unlinkStudentFromParent,
  resetParentPassword,
  type Parent,
  type ParentStudent,
} from '@/api/parent'
import { fetchStudents, type Student } from '@/api/student'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const list = ref<Parent[]>([])
const total = ref(0)

const query = reactive({ keyword: '', status: undefined as number | undefined, page: 1, pageSize: 10 })

const statusLabel: Record<number, string> = { 1: '启用', 0: '停用' }
const statusColor: Record<number, string> = { 1: 'green', 0: 'default' }

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 140 },
  { title: '姓名', dataIndex: 'name', key: 'name', width: 110 },
  { title: '手机号', dataIndex: 'mobile', key: 'mobile', width: 140 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '操作', dataIndex: 'action', key: 'action', width: 200, fixed: 'right' },
]

async function load() {
  loading.value = true
  try {
    const res = await fetchParents({ keyword: query.keyword || undefined, status: query.status, page: query.page, pageSize: query.pageSize })
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

// ─── 新建 ───
const modalOpen = ref(false)
const modalLoading = ref(false)
const form = reactive({ username: '', name: '', mobile: '', password: '', studentId: undefined as number | undefined })
const createStudentOptions = ref<Student[]>([])

function openCreate() {
  Object.assign(form, { username: '', name: '', mobile: '', password: '', studentId: undefined })
  createStudentOptions.value = []
  modalOpen.value = true
}

async function onSearchCreateStudent(kw: string) {
  try {
    const res = await fetchStudents({ keyword: kw || undefined, page: 1, pageSize: 20 })
    createStudentOptions.value = res.items
  } catch {
    createStudentOptions.value = []
  }
}

async function onSubmit() {
  if (!form.username.trim()) {
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
  if (!form.password.trim()) {
    message.warning('请输入初始密码')
    return
  }
  modalLoading.value = true
  try {
    await createParent({
      username: form.username,
      name: form.name,
      mobile: form.mobile,
      password: form.password,
      studentId: form.studentId ?? null,
    })
    message.success('家长创建成功')
    modalOpen.value = false
    load()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    modalLoading.value = false
  }
}

// ─── 启用 / 停用 ───
function onToggleStatus(row: Parent) {
  const target = row.status === 1 ? 0 : 1
  const text = target === 0 ? '停用' : '启用'
  Modal.confirm({
    title: `确认${text}该家长？`,
    content: `「${row.name}」将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateParentStatus(row.id, target)
        message.success(`已${text}`)
        load()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─── 关联学生（抽屉）───
const drawerOpen = ref(false)
const drawerLoading = ref(false)
const currentParent = ref<Parent | null>(null)
const linkedStudents = ref<ParentStudent[]>([])
const bindStudentId = ref<number | undefined>(undefined)
const bindStudentOptions = ref<Student[]>([])
const binding = ref(false)

async function openDrawer(row: Parent) {
  currentParent.value = row
  bindStudentId.value = undefined
  bindStudentOptions.value = []
  drawerOpen.value = true
  drawerLoading.value = true
  try {
    linkedStudents.value = await fetchParentStudents(row.id)
  } catch (e) {
    message.error((e as Error).message || '加载关联学生失败')
    linkedStudents.value = []
  } finally {
    drawerLoading.value = false
  }
}

async function onSearchStudent(kw: string) {
  try {
    const res = await fetchStudents({ keyword: kw || undefined, page: 1, pageSize: 20 })
    bindStudentOptions.value = res.items
  } catch {
    bindStudentOptions.value = []
  }
}

async function onBind() {
  if (!currentParent.value || !bindStudentId.value) return
  binding.value = true
  try {
    await linkStudentToParent(bindStudentId.value, currentParent.value.id, 'father', false)
    message.success('关联成功')
    bindStudentId.value = undefined
    linkedStudents.value = await fetchParentStudents(currentParent.value.id)
  } catch (e) {
    message.error((e as Error).message || '关联失败')
  } finally {
    binding.value = false
  }
}

function onUnbind(student: ParentStudent) {
  if (!currentParent.value) return
  Modal.confirm({
    title: '确认解除关联？',
    content: `将解除「${student.student.name}」与「${currentParent.value.name}」的关联。`,
    okText: '解除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await unlinkStudentFromParent(student.studentId, currentParent.value!.id)
        message.success('已解除关联')
        linkedStudents.value = await fetchParentStudents(currentParent.value!.id)
      } catch (e) {
        message.error((e as Error).message || '解除失败')
      }
    },
  })
}

// ─── 重置密码 ───
const pwdOpen = ref(false)
const pwdLoading = ref(false)
const pwdTarget = ref<Parent | null>(null)
const pwdForm = reactive({ operatorPassword: '', newPassword: '', confirmPassword: '', reason: '' })

function openResetPwd(row: Parent) {
  pwdTarget.value = row
  Object.assign(pwdForm, { operatorPassword: '', newPassword: '', confirmPassword: '', reason: '' })
  pwdOpen.value = true
}

async function onSubmitPwd() {
  if (!pwdTarget.value) return
  if (!pwdForm.operatorPassword.trim()) {
    message.warning('请输入操作者密码')
    return
  }
  if (!pwdForm.newPassword.trim()) {
    message.warning('请输入新密码')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    message.warning('两次输入的新密码不一致')
    return
  }
  pwdLoading.value = true
  try {
    await resetParentPassword(pwdTarget.value.id, {
      operatorPassword: pwdForm.operatorPassword,
      newPassword: pwdForm.newPassword,
      reason: pwdForm.reason.trim() || undefined,
    })
    message.success('密码重置成功')
    pwdOpen.value = false
  } catch (e) {
    message.error((e as Error).message || '重置失败')
  } finally {
    pwdLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false">
    <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
      <a-form-item>
        <a-input v-model:value="query.keyword" placeholder="用户名 / 姓名 / 手机号" allow-clear style="width: 200px" @press-enter="onSearch" />
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
        <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openCreate">新建家长</a-button>
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
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a @click="openDrawer(record)">关联学生</a>
            <a @click="openResetPwd(record)">重置密码</a>
            <a :style="{ color: record.status === 1 ? '#ff4d4f' : undefined }" @click="onToggleStatus(record)">
              {{ record.status === 1 ? '停用' : '启用' }}
            </a>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="modalOpen" title="新建家长" :confirm-loading="modalLoading" ok-text="保存" cancel-text="取消" width="560px" @ok="onSubmit">
      <a-form layout="vertical" :model="form">
        <a-form-item label="用户名" required>
          <a-input v-model:value="form.username" placeholder="登录用户名" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="姓名" required>
              <a-input v-model:value="form.name" placeholder="家长姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号" required>
              <a-input v-model:value="form.mobile" placeholder="手机号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="初始密码" required>
          <a-input-password v-model:value="form.password" placeholder="至少 6 位，含大小写字母和数字" />
        </a-form-item>
        <a-form-item label="关联学生（可选）">
          <a-select
            v-model:value="form.studentId"
            show-search
            placeholder="搜索并选择学生"
            :filter-option="false"
            allow-clear
            @search="onSearchCreateStudent"
          >
            <a-select-option v-for="s in createStudentOptions" :key="s.id" :value="s.id">{{ s.name }}（{{ s.studentCode }}）</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-drawer
      v-model:open="drawerOpen"
      :title="currentParent ? `关联学生 - ${currentParent.name}` : '关联学生'"
      :width="460"
    >
      <div v-if="currentParent">
        <a-space class="bind-row">
          <a-select
            v-model:value="bindStudentId"
            show-search
            placeholder="搜索并选择要绑定的学生"
            :filter-option="false"
            style="width: 300px"
            @search="onSearchStudent"
          >
            <a-select-option v-for="s in bindStudentOptions" :key="s.id" :value="s.id">{{ s.name }}（{{ s.studentCode }}）</a-select-option>
          </a-select>
          <a-button type="primary" :disabled="!bindStudentId" :loading="binding" @click="onBind">绑定</a-button>
        </a-space>

        <a-divider style="margin: 16px 0" />

        <div class="drawer-list" v-if="!drawerLoading">
          <template v-if="linkedStudents.length">
            <div v-for="s in linkedStudents" :key="s.id" class="drawer-item">
              <div>
                <div class="drawer-name">{{ s.student.name }}（{{ s.student.studentCode }}）</div>
                <div class="drawer-sub">{{ s.student.school || '-' }} {{ s.student.grade || '' }}</div>
              </div>
              <a style="color: #ff4d4f" @click="onUnbind(s)">解绑</a>
            </div>
          </template>
          <a-empty v-else description="暂未关联学生" />
        </div>
        <div v-else class="drawer-loading">
          <a-spin />
        </div>
      </div>
    </a-drawer>

    <a-modal v-model:open="pwdOpen" :title="pwdTarget ? `重置密码 - ${pwdTarget.name}` : '重置密码'" :confirm-loading="pwdLoading" ok-text="确认重置" cancel-text="取消" width="520px" @ok="onSubmitPwd">
      <a-form layout="vertical" :model="pwdForm">
        <a-form-item label="操作者密码" required>
          <a-input-password v-model:value="pwdForm.operatorPassword" placeholder="当前登录账号的密码" />
        </a-form-item>
        <a-form-item label="新密码" required>
          <a-input-password v-model:value="pwdForm.newPassword" placeholder="至少 6 位，含大小写字母和数字" />
        </a-form-item>
        <a-form-item label="确认新密码" required>
          <a-input-password v-model:value="pwdForm.confirmPassword" placeholder="再次输入新密码" />
        </a-form-item>
        <a-form-item label="重置原因">
          <a-input v-model:value="pwdForm.reason" placeholder="选填" />
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
.bind-row {
  width: 100%;
}
.drawer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.drawer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}
.drawer-name {
  font-weight: 500;
}
.drawer-sub {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.drawer-loading {
  text-align: center;
  padding: 24px 0;
}
</style>
