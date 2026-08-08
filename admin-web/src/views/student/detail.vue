<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import { fetchStudent, type Student, type Gender, type StudentStatus } from '@/api/student'
import { fetchStudentContracts, type Contract } from '@/api/enrollment'
import { formatDate, formatMoney, subjectLabel } from '@/utils/format'
import AdjustContractLessonsModal from '@/components/AdjustContractLessonsModal.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const student = ref<Student | null>(null)
const contracts = ref<Contract[]>([])

const genderLabel: Record<Gender, string> = { MALE: '男', FEMALE: '女' }
const statusLabel: Record<StudentStatus, string> = { ACTIVE: '在读', PAUSED: '停课', GRADUATED: '毕业', INACTIVE: '停用' }
const statusColor: Record<StudentStatus, string> = { ACTIVE: 'green', PAUSED: 'orange', GRADUATED: 'blue', INACTIVE: 'default' }
const contractStatusLabel: Record<string, string> = { ACTIVE: '生效中', EXHAUSTED: '已用完', EXPIRED: '已过期', REFUNDED: '已退款', FROZEN: '已冻结' }
const contractStatusColor: Record<string, string> = { ACTIVE: 'green', EXHAUSTED: 'orange', EXPIRED: 'default', REFUNDED: 'red', FROZEN: 'blue' }

const contractColumns = [
  { title: '合同号', dataIndex: 'contractCode', key: 'contractCode', width: 160 },
  { title: '学科', dataIndex: 'subject', key: 'subject', width: 90 },
  { title: '总课时', dataIndex: 'totalLessons', key: 'totalLessons', width: 80 },
  { title: '剩余课时', dataIndex: 'remainingLessons', key: 'remainingLessons', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '生效日期', dataIndex: 'validFrom', key: 'validFrom', width: 110 },
  { title: '到期日期', dataIndex: 'validTo', key: 'validTo', width: 110 },
  { title: '合同金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 110 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 110 },
]

// ─── 加课 / 调整课时 ───
const adjustOpen = ref(false)
const adjustTarget = ref<Contract | null>(null)

function openAdjust(row: Contract) {
  adjustTarget.value = row
  adjustOpen.value = true
}

async function load() {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  try {
    student.value = await fetchStudent(id)
    contracts.value = await fetchStudentContracts(student.value.studentCode)
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/students')
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false" :loading="loading">
    <a-space class="detail-header">
      <a-button :icon="h(ArrowLeftOutlined)" @click="goBack">返回</a-button>
      <h2 style="margin: 0">{{ student?.name }}</h2>
      <a-tag v-if="student" :color="statusColor[student.status as StudentStatus]">{{ statusLabel[student.status as StudentStatus] }}</a-tag>
    </a-space>

    <a-descriptions v-if="student" bordered :column="3" size="small" style="margin-top: 16px">
      <a-descriptions-item label="学号">{{ student.studentCode }}</a-descriptions-item>
      <a-descriptions-item label="姓名">{{ student.name }}</a-descriptions-item>
      <a-descriptions-item label="性别">{{ genderLabel[student.gender as Gender] || '-' }}</a-descriptions-item>
      <a-descriptions-item label="出生日期">{{ formatDate(student.birthDate) }}</a-descriptions-item>
      <a-descriptions-item label="联系电话">{{ student.phone || '-' }}</a-descriptions-item>
      <a-descriptions-item label="邮箱">{{ student.email || '-' }}</a-descriptions-item>
      <a-descriptions-item label="学校">{{ student.school || '-' }}</a-descriptions-item>
      <a-descriptions-item label="年级">{{ student.grade || '-' }}</a-descriptions-item>
      <a-descriptions-item label="报名时间">{{ formatDate(student.createTime) }}</a-descriptions-item>
      <a-descriptions-item label="标签" :span="2">
        <template v-if="student.tags && student.tags.length">
          <a-tag v-for="tag in student.tags" :key="tag" color="blue">{{ tag }}</a-tag>
        </template>
        <span v-else>-</span>
      </a-descriptions-item>
      <a-descriptions-item label="备注" :span="3">{{ student.note || '-' }}</a-descriptions-item>
    </a-descriptions>

    <a-divider />

    <h3>合同 / 课时</h3>
    <a-table
      :columns="contractColumns"
      :data-source="contracts"
      :pagination="false"
      row-key="id"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'subject'">
          {{ subjectLabel(record.subject) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="contractStatusColor[record.status] || 'default'">{{ contractStatusLabel[record.status] || record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'validFrom'">
          {{ formatDate(record.validFrom) }}
        </template>
        <template v-else-if="column.key === 'validTo'">
          {{ record.validTo ? formatDate(record.validTo) : '长期' }}
        </template>
        <template v-else-if="column.key === 'totalAmount'">
          {{ record.totalAmount != null ? formatMoney(record.totalAmount) : '-' }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a @click="openAdjust(record)">加课/调整</a>
        </template>
      </template>
    </a-table>

    <AdjustContractLessonsModal v-model:open="adjustOpen" :contract="adjustTarget" @success="load" />
  </a-card>
</template>

<style scoped>
.detail-header {
  margin-bottom: 8px;
}
</style>
