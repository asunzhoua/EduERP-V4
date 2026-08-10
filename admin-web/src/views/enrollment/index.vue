<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchContracts,
  createContract,
  freezeContract,
  unfreezeContract,
  fetchEnrollments,
  createEnrollment,
  withdrawEnrollment,
  importLessons,
  type Contract,
  type Enrollment,
  type Subject,
} from '@/api/enrollment'
import { formatDate, formatDateTime, formatMoney, subjectLabel } from '@/utils/format'
import AdjustContractLessonsModal from '@/components/AdjustContractLessonsModal.vue'
import ImportExcelModal from '@/components/ImportExcelModal.vue'

type ContractStatus = Contract['status']

const activeTab = ref('contracts')

// ─── 合同管理 ───
const contractLoading = ref(false)
const contracts = ref<Contract[]>([])
const contractTotal = ref(0)
const contractQuery = reactive({ studentCode: '', status: undefined as ContractStatus | undefined, page: 1, pageSize: 10 })

const statusLabel: Record<ContractStatus, string> = { ACTIVE: '生效中', EXHAUSTED: '已用完', EXPIRED: '已过期', REFUNDED: '已退款', FROZEN: '已冻结' }
const statusColor: Record<ContractStatus, string> = { ACTIVE: 'green', EXHAUSTED: 'default', EXPIRED: 'orange', REFUNDED: 'default', FROZEN: 'blue' }

const subjects: Subject[] = ['MATH', 'ENGLISH', 'CHINESE', 'PHYSICS', 'CHEMISTRY', 'ART', 'MUSIC', 'DANCE', 'SPORTS', 'CODING', 'OTHER']

const contractColumns = [
  { title: '合同号', dataIndex: 'contractCode', key: 'contractCode', width: 150 },
  { title: '学生编号', dataIndex: 'studentCode', key: 'studentCode', width: 110 },
  { title: '学科', dataIndex: 'subject', key: 'subject', width: 80 },
  { title: '总课时', dataIndex: 'totalLessons', key: 'totalLessons', width: 80 },
  { title: '剩余课时', dataIndex: 'remainingLessons', key: 'remainingLessons', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '生效日期', dataIndex: 'validFrom', key: 'validFrom', width: 110, customRender: ({ text }: { text: string }) => formatDate(text) },
  { title: '到期日期', dataIndex: 'validTo', key: 'validTo', width: 110 },
  { title: '合同金额', dataIndex: 'unitPrice', key: 'unitPrice', width: 110 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 140, fixed: 'right' },
]

async function loadContracts() {
  contractLoading.value = true
  try {
    const res = await fetchContracts({ studentCode: contractQuery.studentCode || undefined, status: contractQuery.status, page: contractQuery.page, pageSize: contractQuery.pageSize })
    contracts.value = res.items
    contractTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    contractLoading.value = false
  }
}

function onContractSearch() {
  contractQuery.page = 1
  loadContracts()
}

// ─── 新建合同 ───
const contractModalOpen = ref(false)
const contractModalLoading = ref(false)
const contractForm = reactive({
  studentCode: '',
  subject: 'MATH' as Subject,
  totalLessons: undefined as number | undefined,
  validFrom: '',
  validTo: undefined as string | undefined,
  unitPrice: undefined as number | undefined,
  totalAmount: undefined as number | undefined,
  note: '',
})

function openContractCreate() {
  Object.assign(contractForm, { studentCode: '', subject: 'MATH' as Subject, totalLessons: undefined, validFrom: '', validTo: undefined, unitPrice: undefined, totalAmount: undefined, note: '' })
  contractModalOpen.value = true
}

async function onContractSubmit() {
  if (!contractForm.studentCode.trim()) {
    message.warning('请输入学生编号')
    return
  }
  if (!contractForm.totalLessons) {
    message.warning('请输入总课时')
    return
  }
  if (!contractForm.validFrom) {
    message.warning('请选择生效日期')
    return
  }
  contractModalLoading.value = true
  try {
    await createContract({
      studentCode: contractForm.studentCode,
      subject: contractForm.subject,
      totalLessons: contractForm.totalLessons,
      validFrom: contractForm.validFrom,
      validTo: contractForm.validTo || undefined,
      unitPrice: contractForm.unitPrice ?? undefined,
      totalAmount: contractForm.totalAmount ?? undefined,
      note: contractForm.note || undefined,
    })
    message.success('合同创建成功')
    contractModalOpen.value = false
    loadContracts()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    contractModalLoading.value = false
  }
}

// ─── 加课 / 调整课时 ───
const adjustOpen = ref(false)
const adjustTarget = ref<Contract | null>(null)

function openAdjust(row: Contract) {
  adjustTarget.value = row
  adjustOpen.value = true
}

// ─── 冻结 / 解冻 ───
function onToggleFreeze(row: Contract) {
  const frozen = row.status === 'FROZEN'
  const text = frozen ? '解冻' : '冻结'
  Modal.confirm({
    title: `确认${text}合同？`,
    content: `合同「${row.contractCode}」将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        if (frozen) {
          await unfreezeContract(row.contractCode)
        } else {
          await freezeContract(row.contractCode)
        }
        message.success(`已${text}`)
        loadContracts()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─── 报名记录 ───
const enrollmentLoading = ref(false)
const enrollments = ref<Enrollment[]>([])
const enrollmentTotal = ref(0)
const enrollmentQuery = reactive({ page: 1, pageSize: 10 })

const enrollmentColumns = [
  { title: '报名编号', dataIndex: 'id', key: 'id', width: 100 },
  { title: '班级编号', dataIndex: 'classCode', key: 'classCode', width: 140 },
  { title: '学生编号', dataIndex: 'studentCode', key: 'studentCode', width: 120 },
  { title: '合同号', dataIndex: 'contractCode', key: 'contractCode', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '报名时间', dataIndex: 'enrolledAt', key: 'enrolledAt', width: 150, customRender: ({ text }: { text: string }) => formatDateTime(text) },
  { title: '操作', dataIndex: 'action', key: 'action', width: 80, fixed: 'right' },
]

async function loadEnrollments() {
  enrollmentLoading.value = true
  try {
    const res = await fetchEnrollments({ page: enrollmentQuery.page, pageSize: enrollmentQuery.pageSize })
    enrollments.value = res.items
    enrollmentTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    enrollmentLoading.value = false
  }
}

// ─── 新建报名 ───
const enrollmentModalOpen = ref(false)
const enrollmentModalLoading = ref(false)
const enrollmentForm = reactive({ classCode: '', studentCode: '', contractCode: '' })

function openEnrollmentCreate() {
  Object.assign(enrollmentForm, { classCode: '', studentCode: '', contractCode: '' })
  enrollmentModalOpen.value = true
}

async function onEnrollmentSubmit() {
  if (!enrollmentForm.classCode.trim()) {
    message.warning('请输入班级编号')
    return
  }
  if (!enrollmentForm.studentCode.trim()) {
    message.warning('请输入学生编号')
    return
  }
  if (!enrollmentForm.contractCode.trim()) {
    message.warning('请输入合同号')
    return
  }
  enrollmentModalLoading.value = true
  try {
    await createEnrollment({ classCode: enrollmentForm.classCode, studentCode: enrollmentForm.studentCode, contractCode: enrollmentForm.contractCode })
    message.success('报名创建成功')
    enrollmentModalOpen.value = false
    loadEnrollments()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    enrollmentModalLoading.value = false
  }
}

// ─── 退课 ───
const withdrawOpen = ref(false)
const withdrawLoading = ref(false)
const withdrawTarget = ref<Enrollment | null>(null)
const withdrawReason = ref('')

function openWithdraw(row: Enrollment) {
  withdrawTarget.value = row
  withdrawReason.value = ''
  withdrawOpen.value = true
}

async function onWithdrawSubmit() {
  if (!withdrawReason.value.trim()) {
    message.warning('请输入退课原因')
    return
  }
  if (!withdrawTarget.value) return
  withdrawLoading.value = true
  try {
    await withdrawEnrollment(withdrawTarget.value.id, withdrawReason.value)
    message.success('退课成功')
    withdrawOpen.value = false
    loadEnrollments()
  } catch (e) {
    message.error((e as Error).message || '操作失败')
  } finally {
    withdrawLoading.value = false
  }
}

function onTabChange(key: string) {
  if (key === 'contracts') {
    loadContracts()
  } else {
    loadEnrollments()
  }
}

// ─── 课时批量导入 ───
const lessonImportOpen = ref(false)
const lessonImportHint =
  '表头（支持中文）：学员编码 / 科目（数学/英语 或 MATH/ENGLISH）/ 课时数（正整数）/ 单价（可选）/ 到期日（可选，YYYY-MM-DD）。\n已有同科目有效合同时按累加方式增加课时；无有效合同则自动新建合同。'

onMounted(loadContracts)
</script>

<template>
  <a-card :bordered="false">
    <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
      <a-tab-pane key="contracts" tab="合同管理">
        <a-form layout="inline" class="search-bar" @submit.prevent="onContractSearch">
          <a-form-item>
            <a-input v-model:value="contractQuery.studentCode" placeholder="学生编号" allow-clear style="width: 200px" @press-enter="onContractSearch" />
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="contractQuery.status" placeholder="状态" allow-clear style="width: 120px" @change="onContractSearch">
              <a-select-option v-for="(label, key) in statusLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
          </a-form-item>
          <a-form-item class="search-actions">
            <a-space>
              <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openContractCreate">新建合同</a-button>
              <a-button @click="lessonImportOpen = true">导入课时</a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <a-table
          :columns="contractColumns"
          :data-source="contracts"
          :loading="contractLoading"
          :pagination="{ current: contractQuery.page, pageSize: contractQuery.pageSize, total: contractTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { contractQuery.page = p.current; contractQuery.pageSize = p.pageSize; loadContracts() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'subject'">
              {{ subjectLabel(record.subject) }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor[record.status as ContractStatus]">{{ statusLabel[record.status as ContractStatus] || record.status }}</a-tag>
            </template>
            <template v-else-if="column.key === 'validTo'">
              {{ record.validTo ? formatDate(record.validTo) : '长期' }}
            </template>
            <template v-else-if="column.key === 'unitPrice'">
              {{ record.unitPrice != null ? formatMoney(record.unitPrice) : '-' }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a @click="openAdjust(record)">加课/调整</a>
                <a @click="onToggleFreeze(record)">{{ record.status === 'FROZEN' ? '解冻' : '冻结' }}</a>
              </a-space>
            </template>
          </template>
        </a-table>

        <a-modal v-model:open="contractModalOpen" title="新建合同" :confirm-loading="contractModalLoading" ok-text="保存" cancel-text="取消" width="600px" @ok="onContractSubmit">
          <a-form layout="vertical" :model="contractForm">
            <a-form-item label="学生编号" required>
              <a-input v-model:value="contractForm.studentCode" placeholder="学生编号" />
            </a-form-item>
            <a-form-item label="学科" required>
              <a-select v-model:value="contractForm.subject" placeholder="请选择学科" style="width: 100%">
                <a-select-option v-for="s in subjects" :key="s" :value="s">{{ subjectLabel(s) }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="总课时" required>
              <a-input-number v-model:value="contractForm.totalLessons" :min="1" style="width: 100%" />
            </a-form-item>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="生效日期" required>
                  <a-date-picker v-model:value="contractForm.validFrom" value-format="YYYY-MM-DD" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="到期日期">
                  <a-date-picker v-model:value="contractForm.validTo" value-format="YYYY-MM-DD" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="单价">
                  <a-input-number v-model:value="contractForm.unitPrice" :min="0" :precision="2" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="合同金额">
                  <a-input-number v-model:value="contractForm.totalAmount" :min="0" :precision="2" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="备注">
              <a-textarea v-model:value="contractForm.note" :rows="3" placeholder="备注" />
            </a-form-item>
          </a-form>
        </a-modal>
      </a-tab-pane>

      <a-tab-pane key="enrollments" tab="报名记录">
        <a-form layout="inline" class="search-bar">
          <a-form-item class="search-actions">
            <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openEnrollmentCreate">新建报名</a-button>
          </a-form-item>
        </a-form>

        <a-table
          :columns="enrollmentColumns"
          :data-source="enrollments"
          :loading="enrollmentLoading"
          :pagination="{ current: enrollmentQuery.page, pageSize: enrollmentQuery.pageSize, total: enrollmentTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { enrollmentQuery.page = p.current; enrollmentQuery.pageSize = p.pageSize; loadEnrollments() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag>{{ record.status }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a :style="{ color: '#ff4d4f' }" @click="openWithdraw(record)">退课</a>
            </template>
          </template>
        </a-table>

        <a-modal v-model:open="enrollmentModalOpen" title="新建报名" :confirm-loading="enrollmentModalLoading" ok-text="保存" cancel-text="取消" width="480px" @ok="onEnrollmentSubmit">
          <a-form layout="vertical" :model="enrollmentForm">
            <a-form-item label="班级编号" required>
              <a-input v-model:value="enrollmentForm.classCode" placeholder="班级编号" />
            </a-form-item>
            <a-form-item label="学生编号" required>
              <a-input v-model:value="enrollmentForm.studentCode" placeholder="学生编号" />
            </a-form-item>
            <a-form-item label="合同号" required>
              <a-input v-model:value="enrollmentForm.contractCode" placeholder="合同号" />
            </a-form-item>
          </a-form>
        </a-modal>

        <a-modal v-model:open="withdrawOpen" title="退课" :confirm-loading="withdrawLoading" ok-text="确认退课" cancel-text="取消" width="480px" @ok="onWithdrawSubmit">
          <a-form layout="vertical">
            <a-form-item label="退课原因" required>
              <a-textarea v-model:value="withdrawReason" :rows="3" placeholder="请输入退课原因" />
            </a-form-item>
          </a-form>
        </a-modal>
      </a-tab-pane>
    </a-tabs>

    <AdjustContractLessonsModal v-model:open="adjustOpen" :contract="adjustTarget" @success="loadContracts" />
    <ImportExcelModal v-model:open="lessonImportOpen" title="导入课时" :import-fn="importLessons" :hint="lessonImportHint" @success="loadContracts" />
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
