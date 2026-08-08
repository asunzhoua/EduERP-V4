<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchSalaryRecords,
  fetchSalaryStatistics,
  updateSalaryRecordStatus,
  settleSalary,
  fetchSalaryRules,
  createSalaryRule,
  updateSalaryRule,
  deleteSalaryRule,
  type SalaryRecord,
  type SalaryRecordStatus,
  type SalaryRecordSource,
  type SalaryStatistics,
  type SalaryRule,
  type SettleResult,
  type CreateSalaryRuleDto,
  type TierConfig,
} from '@/api/salary'
import { formatDate, formatDateTime, formatMoney } from '@/utils/format'

const activeTab = ref('records')

// ─────────────────────────── 记录 Tab ───────────────────────────

const loading = ref(false)
const list = ref<SalaryRecord[]>([])
const total = ref(0)

const statistics = ref<SalaryStatistics>({
  totalRecords: 0,
  totalAmount: 0,
  paidAmount: 0,
  pendingAmount: 0,
  recordCount: 0,
  teacherCount: 0,
  totalMinutes: 0,
  year: new Date().getFullYear(),
  month: '',
  monthNum: new Date().getMonth() + 1,
})

const statusLabel: Record<SalaryRecordStatus, string> = {
  PENDING: '待确认',
  APPROVED: '已确认',
  PAID: '已发放',
}
const statusColor: Record<SalaryRecordStatus, string> = {
  PENDING: 'orange',
  APPROVED: 'blue',
  PAID: 'green',
}

const sourceLabel: Record<SalaryRecordSource, string> = {
  LESSON_FEE: '课时费',
  BASE: '底薪',
  DAY: '按天',
  BONUS: '绩效',
  DEDUCTION: '扣款',
}

const query = reactive({
  status: undefined as SalaryRecordStatus | undefined,
  source: undefined as SalaryRecordSource | undefined,
  teacherId: '',
  month: undefined as string | undefined,
  page: 1,
  pageSize: 10,
})

const columns = [
  { title: '记录ID', dataIndex: 'id', key: 'id', width: 90 },
  { title: '教师ID', dataIndex: 'teacherId', key: 'teacherId', width: 90 },
  { title: '来源', dataIndex: 'source', key: 'source', width: 90 },
  {
    title: '课时日期',
    dataIndex: 'lessonDate',
    key: 'lessonDate',
    width: 110,
    customRender: ({ text }: { text: string | null }) => formatDate(text),
  },
  {
    title: '时长',
    dataIndex: 'duration',
    key: 'duration',
    width: 80,
    customRender: ({ text }: { text: number | null }) => (text ? `${text} 分` : '-'),
  },
  {
    title: '人数',
    dataIndex: 'studentCount',
    key: 'studentCount',
    width: 70,
    customRender: ({ text }: { text: number | null }) => text ?? '-',
  },
  {
    title: '金额',
    dataIndex: 'amount',
    key: 'amount',
    width: 110,
    customRender: ({ text }: { text: number }) => formatMoney(text),
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  {
    title: '需复核',
    dataIndex: 'needsReview',
    key: 'needsReview',
    width: 80,
    customRender: ({ text }: { text: boolean }) =>
      text ? h('a-tag', { color: 'red' }, '是') : h('a-tag', { color: 'default' }, '否'),
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    key: 'createTime',
    width: 150,
    customRender: ({ text }: { text: string }) => formatDateTime(text),
  },
  { title: '操作', dataIndex: 'action', key: 'action', width: 150, fixed: 'right' as const },
]

async function loadRecords() {
  loading.value = true
  try {
    const [res, stats] = await Promise.all([
      fetchSalaryRecords({
        status: query.status,
        source: query.source,
        teacherId: query.teacherId || undefined,
        month: query.month || undefined,
        page: query.page,
        pageSize: query.pageSize,
      }),
      fetchSalaryStatistics(),
    ])
    list.value = res.records
    total.value = res.total
    statistics.value = stats
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.page = 1
  loadRecords()
}

function onReset() {
  query.status = undefined
  query.source = undefined
  query.teacherId = ''
  query.month = undefined
  query.page = 1
  loadRecords()
}

function onUpdateStatus(row: SalaryRecord, target: SalaryRecordStatus) {
  const textMap: Record<SalaryRecordStatus, string> = {
    PENDING: '重算',
    APPROVED: '确认',
    PAID: '发放',
  }
  const text = textMap[target]
  Modal.confirm({
    title: `确认${text}该工资记录？`,
    content: `教师 ${row.teacherId} 的 ${sourceLabel[row.source] || row.source} ${formatMoney(row.amount)} 将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateSalaryRecordStatus(row.id, target)
        message.success(`已${text}`)
        loadRecords()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─────────────────────────── 规则 Tab ───────────────────────────

const rulesLoading = ref(false)
const rules = ref<SalaryRule[]>([])
const ruleModalVisible = ref(false)
const ruleModalMode = ref<'create' | 'edit'>('create')
const editingRuleId = ref<number | string | null>(null)

const typeLabel: Record<string, string> = {
  PER_LESSON: '固定课时费',
  PER_DAY: '按天计费',
  PER_HEAD: '按上课人数',
  TIER: '阶梯式课时费',
  PART_TIME: '兼职教师',
  OUTING: '外出上课',
  MONTHLY: '月薪制',
  HOURLY: '按小时(旧)',
}

const ruleColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 130,
    customRender: ({ text }: { text: string }) => typeLabel[text] || text,
  },
  {
    title: '单价',
    dataIndex: 'baseAmount',
    key: 'baseAmount',
    width: 100,
    customRender: ({ text }: { text: number }) => formatMoney(text),
  },
  {
    title: '配置摘要',
    key: 'configSummary',
    width: 200,
    customRender: ({ record }: { record: SalaryRule }) => configSummary(record),
  },
  {
    title: '生效范围',
    key: 'effect',
    width: 160,
    customRender: ({ record }: { record: SalaryRule }) => effectSummary(record),
  },
  {
    title: '状态',
    dataIndex: 'isActive',
    key: 'isActive',
    width: 80,
    customRender: ({ text }: { text: boolean }) =>
      text ? h('a-tag', { color: 'green' }, '启用') : h('a-tag', { color: 'red' }, '停用'),
  },
  { title: '操作', dataIndex: 'action', key: 'action', width: 140 },
]

function configSummary(rule: SalaryRule): string {
  const c = rule.config || {}
  if (rule.type === 'TIER' && c.lessonTiers?.length) {
    return `阶梯 ${c.lessonTiers.length} 档`
  }
  if (rule.type === 'PER_HEAD') {
    return c.headcountTiers?.length ? `人数阶梯 ${c.headcountTiers.length} 档` : `每人 ${c.pricePerHead ?? '-'}`
  }
  if (c.lessonPrice !== undefined) return `课时 ${c.lessonPrice}`
  if (c.baseSalary !== undefined) return `底薪 ${c.baseSalary}`
  return '-'
}

function effectSummary(rule: SalaryRule): string {
  const c = rule.config || {}
  const from = c.effectiveFrom ? `从 ${c.effectiveFrom}` : ''
  const to = c.effectiveTo ? `至 ${c.effectiveTo}` : ''
  return [from, to].filter(Boolean).join(' ') || '长期'
}

async function loadRules() {
  rulesLoading.value = true
  try {
    rules.value = await fetchSalaryRules(true)
  } catch (e) {
    message.error((e as Error).message || '加载规则失败')
  } finally {
    rulesLoading.value = false
  }
}

// 规则表单（动态 config）
const ruleForm = reactive<CreateSalaryRuleDto>({
  name: '',
  type: 'PER_LESSON',
  baseAmount: 0,
  multiplier: 1,
  courseType: '',
  teacherLevel: '',
  isActive: true,
  config: {},
})

function defaultTier(): TierConfig {
  return { min: 1, max: null, pricePerLesson: undefined, pricePerHead: undefined }
}

function openCreateRule() {
  ruleModalMode.value = 'create'
  editingRuleId.value = null
  Object.assign(ruleForm, {
    name: '',
    type: 'PER_LESSON',
    baseAmount: 0,
    multiplier: 1,
    courseType: '',
    teacherLevel: '',
    isActive: true,
    config: { lessonPrice: undefined },
  })
  ruleModalVisible.value = true
}

function openEditRule(rule: SalaryRule) {
  ruleModalMode.value = 'edit'
  editingRuleId.value = rule.id
  Object.assign(ruleForm, {
    name: rule.name,
    type: rule.type,
    baseAmount: rule.baseAmount,
    multiplier: rule.multiplier,
    courseType: rule.courseType || '',
    teacherLevel: rule.teacherLevel || '',
    isActive: rule.isActive,
    config: rule.config ? JSON.parse(JSON.stringify(rule.config)) : {},
  })
  ensureConfigShape()
  ruleModalVisible.value = true
}

function ensureConfigShape() {
  const c = ruleForm.config as Record<string, any>
  if (ruleForm.type === 'TIER' && !Array.isArray(c.lessonTiers)) {
    c.lessonTiers = [defaultTier(), { min: 2, max: null, pricePerLesson: undefined }]
  }
  if (ruleForm.type === 'PER_HEAD' && !Array.isArray(c.headcountTiers)) {
    c.headcountTiers = [defaultTier()]
  }
}

function addTier(field: 'lessonTiers' | 'headcountTiers') {
  const c = ruleForm.config as Record<string, any>
  if (!Array.isArray(c[field])) c[field] = []
  const last = c[field][c[field].length - 1]
  const nextMin = last && typeof last.max === 'number' ? last.max + 1 : c[field].length + 1
  c[field].push({ min: nextMin, max: null, pricePerLesson: undefined, pricePerHead: undefined })
}

function removeTier(field: 'lessonTiers' | 'headcountTiers', index: number) {
  const c = ruleForm.config as Record<string, any>
  if (Array.isArray(c[field])) c[field].splice(index, 1)
}

function onTypeChange() {
  // 切换类型时重建 config 默认结构
  const c: Record<string, any> = {}
  if (['PER_LESSON', 'PART_TIME', 'OUTING', 'PER_DAY'].includes(ruleForm.type)) {
    c.lessonPrice = undefined
  } else if (ruleForm.type === 'PER_HEAD') {
    c.pricePerHead = undefined
    c.headcountTiers = [defaultTier()]
  } else if (ruleForm.type === 'TIER') {
    c.lessonTiers = [defaultTier()]
  } else if (ruleForm.type === 'MONTHLY') {
    c.baseSalary = undefined
  }
  ruleForm.config = c
}

function buildPayload(): CreateSalaryRuleDto {
  const c = ruleForm.config as Record<string, any>
  // 清理 undefined，避免发给后端
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(c)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) {
      if (v.length === 0) continue
      clean[k] = v.map((t) => {
        const o: Record<string, any> = { min: t.min, max: t.max ?? null }
        if (t.pricePerLesson !== undefined && t.pricePerLesson !== '') o.pricePerLesson = Number(t.pricePerLesson)
        if (t.pricePerHead !== undefined && t.pricePerHead !== '') o.pricePerHead = Number(t.pricePerHead)
        return o
      })
      continue
    }
    clean[k] = v
  }
  // 需要数值的字段转数字
  const numKeys = ['lessonPrice', 'pricePerHead', 'baseSalary', 'minLessonForBase']
  for (const k of numKeys) {
    if (clean[k] !== undefined) clean[k] = Number(clean[k])
  }
  return {
    name: ruleForm.name,
    type: ruleForm.type,
    baseAmount: Number(ruleForm.baseAmount) || 0,
    multiplier: Number(ruleForm.multiplier) || 1,
    courseType: ruleForm.courseType || undefined,
    teacherLevel: ruleForm.teacherLevel || undefined,
    isActive: ruleForm.isActive,
    config: Object.keys(clean).length ? clean : undefined,
  }
}

async function onSubmitRule() {
  if (!ruleForm.name) {
    message.warning('请填写规则名称')
    return
  }
  try {
    const payload = buildPayload()
    if (ruleModalMode.value === 'create') {
      await createSalaryRule(payload)
      message.success('规则创建成功')
    } else if (editingRuleId.value !== null) {
      await updateSalaryRule(editingRuleId.value, payload)
      message.success('规则更新成功')
    }
    ruleModalVisible.value = false
    loadRules()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  }
}

function onDeleteRule(rule: SalaryRule) {
  Modal.confirm({
    title: '删除规则',
    content: `确认停用规则「${rule.name}」？该操作不会影响已生成的工资记录。`,
    okText: '确认停用',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteSalaryRule(rule.id)
        message.success('规则已停用')
        loadRules()
      } catch (e) {
        message.error((e as Error).message || '删除失败')
      }
    },
  })
}

// ─────────────────────────── 结算 Tab ───────────────────────────

const settleLoading = ref(false)
const settleMonth = ref<string>(
  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
)
const settleTeacherId = ref('')
const settleResult = ref<SettleResult | null>(null)

async function onSettle() {
  if (!settleMonth.value) {
    message.warning('请选择结算月份')
    return
  }
  settleLoading.value = true
  settleResult.value = null
  try {
    settleResult.value = await settleSalary(settleMonth.value, settleTeacherId.value || undefined)
    message.success('结算完成')
    loadRecords()
    loadRules()
  } catch (e) {
    message.error((e as Error).message || '结算失败')
  } finally {
    settleLoading.value = false
  }
}

// ─────────────────────────── 初始化 ───────────────────────────

onMounted(() => {
  loadRecords()
  loadRules()
})
</script>

<template>
  <a-card :bordered="false">
    <a-tabs v-model:activeKey="activeTab">
      <!-- ── 记录 ── -->
      <a-tab-pane key="records" tab="工资记录">
        <a-row :gutter="[16, 16]" class="stat-row">
          <a-col :span="5">
            <a-card :bordered="false" size="small">
              <a-statistic title="应发总额" :value="formatMoney(statistics.totalAmount)" />
            </a-card>
          </a-col>
          <a-col :span="5">
            <a-card :bordered="false" size="small">
              <a-statistic title="已发放" :value="formatMoney(statistics.paidAmount)" />
            </a-card>
          </a-col>
          <a-col :span="5">
            <a-card :bordered="false" size="small">
              <a-statistic title="待发放" :value="formatMoney(statistics.pendingAmount)" />
            </a-card>
          </a-col>
          <a-col :span="4">
            <a-card :bordered="false" size="small">
              <a-statistic title="记录数" :value="statistics.recordCount" />
            </a-card>
          </a-col>
          <a-col :span="5">
            <a-card :bordered="false" size="small">
              <a-statistic title="老师数" :value="statistics.teacherCount" />
            </a-card>
          </a-col>
        </a-row>

        <a-form layout="inline" class="search-bar" @submit.prevent="onSearch">
          <a-form-item>
            <a-date-picker
              v-model:value="query.month"
              picker="month"
              value-format="YYYY-MM"
              placeholder="结算月份"
              style="width: 140px"
            />
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 120px" @change="onSearch">
              <a-select-option v-for="(label, key) in statusLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="query.source" placeholder="来源" allow-clear style="width: 130px" @change="onSearch">
              <a-select-option v-for="(label, key) in sourceLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-input v-model:value="query.teacherId" placeholder="教师ID" allow-clear style="width: 120px" @press-enter="onSearch" />
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
          @change="(p: any) => { query.page = p.current; query.pageSize = p.pageSize; loadRecords() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="statusColor[record.status as SalaryRecordStatus]">
                {{ statusLabel[record.status as SalaryRecordStatus] || record.status }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <template v-if="record.status === 'PENDING'">
                  <a @click="onUpdateStatus(record, 'APPROVED')">确认</a>
                </template>
                <template v-else-if="record.status === 'APPROVED'">
                  <a @click="onUpdateStatus(record, 'PAID')">发放</a>
                  <a @click="onUpdateStatus(record, 'PENDING')">重算</a>
                </template>
                <span v-else>-</span>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- ── 规则 ── -->
      <a-tab-pane key="rules" tab="工资规则">
        <div class="toolbar">
          <a-button type="primary" @click="openCreateRule">新建规则</a-button>
        </div>
        <a-table
          :columns="ruleColumns"
          :data-source="rules"
          :loading="rulesLoading"
          row-key="id"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space>
                <a @click="openEditRule(record as SalaryRule)">编辑</a>
                <a class="danger" @click="onDeleteRule(record as SalaryRule)">停用</a>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- ── 结算 ── -->
      <a-tab-pane key="settle" tab="月度结算">
        <a-form layout="inline" class="search-bar">
          <a-form-item label="结算月份">
            <a-date-picker
              v-model:value="settleMonth"
              picker="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              style="width: 160px"
            />
          </a-form-item>
          <a-form-item label="教师ID">
            <a-input v-model:value="settleTeacherId" placeholder="全部教师(留空)" style="width: 160px" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" :loading="settleLoading" @click="onSettle">开始结算</a-button>
          </a-form-item>
        </a-form>

        <a-alert
          type="info"
          show-icon
          class="settle-tip"
          message="结算说明"
          description="按当月已完成的课时（FINISHED）与出勤记录自动生成工资记录。重复结算幂等，不会生成重复记录；无适用规则的课时会标记为需复核。"
        />

        <a-card v-if="settleResult" :bordered="true" class="settle-result">
          <template #title>结算结果：{{ settleResult.month }}</template>
          <a-descriptions :column="4">
            <a-descriptions-item label="教师数">{{ settleResult.teachers }}</a-descriptions-item>
            <a-descriptions-item label="课时数">{{ settleResult.lessons }}</a-descriptions-item>
            <a-descriptions-item label="新建记录">{{ settleResult.created }}</a-descriptions-item>
            <a-descriptions-item label="跳过(幂等)">{{ settleResult.skipped }}</a-descriptions-item>
          </a-descriptions>
          <a-table
            v-if="settleResult.summary.length"
            :columns="[
              { title: '来源', dataIndex: 'source', key: 'source' },
              { title: '条数', dataIndex: 'count', key: 'count' },
              { title: '金额', dataIndex: 'amount', key: 'amount' },
            ]"
            :data-source="settleResult.summary"
            :pagination="false"
            row-key="source"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'source'">{{ sourceLabel[record.source as SalaryRecordSource] || record.source }}</template>
              <template v-else-if="column.key === 'amount'">{{ formatMoney(record.amount) }}</template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- 规则编辑弹窗 -->
    <a-modal
      v-model:open="ruleModalVisible"
      :title="ruleModalMode === 'create' ? '新建工资规则' : '编辑工资规则'"
      :width="640"
      @ok="onSubmitRule"
    >
      <a-form :model="ruleForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="规则名称" required>
              <a-input v-model:value="ruleForm.name" placeholder="如：1v1 固定课时费" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="规则类型" required>
              <a-select v-model:value="ruleForm.type" @change="onTypeChange">
                <a-select-option v-for="(label, key) in typeLabel" :key="key" :value="key">{{ label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="兜底单价(baseAmount)">
              <a-input-number v-model:value="ruleForm.baseAmount" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="倍率(multiplier)">
              <a-input-number v-model:value="ruleForm.multiplier" :min="0" :step="0.1" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="课程类型(courseType)">
              <a-input v-model:value="ruleForm.courseType" placeholder="如 1v1 / GROUP，留空不限" />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 按类型显示 config -->
        <template v-if="['PER_LESSON', 'PART_TIME', 'OUTING', 'PER_DAY'].includes(ruleForm.type)">
          <a-form-item label="课时单价">
            <a-input-number v-model:value="(ruleForm.config as any).lessonPrice" :min="0" style="width: 200px" />
          </a-form-item>
        </template>

        <template v-if="ruleForm.type === 'PER_HEAD'">
          <a-form-item label="每人单价(无阶梯)">
            <a-input-number v-model:value="(ruleForm.config as any).pricePerHead" :min="0" style="width: 200px" />
          </a-form-item>
          <a-form-item label="人数阶梯">
            <div v-for="(tier, idx) in ((ruleForm.config as any).headcountTiers as any[]) || []" :key="idx" class="tier-row">
              <a-input-number v-model:value="tier.min" :min="1" placeholder="人数起" style="width: 90px" />
              <span class="tier-sep">~</span>
              <a-input-number v-model:value="tier.max" placeholder="人数止(留空不限)" style="width: 120px" />
              <span class="tier-sep">每人</span>
              <a-input-number v-model:value="tier.pricePerHead" :min="0" placeholder="价格" style="width: 100px" />
              <a-button size="small" danger @click="removeTier('headcountTiers', idx)">删</a-button>
            </div>
            <a-button size="small" type="dashed" @click="addTier('headcountTiers')">+ 添加档位</a-button>
          </a-form-item>
        </template>

        <template v-if="ruleForm.type === 'TIER'">
          <a-form-item label="课时阶梯（按当月累计课时数）">
            <div v-for="(tier, idx) in ((ruleForm.config as any).lessonTiers as any[]) || []" :key="idx" class="tier-row">
              <a-input-number v-model:value="tier.min" :min="1" placeholder="课时起" style="width: 90px" />
              <span class="tier-sep">~</span>
              <a-input-number v-model:value="tier.max" placeholder="课时止(留空不限)" style="width: 120px" />
              <span class="tier-sep">每节</span>
              <a-input-number v-model:value="tier.pricePerLesson" :min="0" placeholder="价格" style="width: 100px" />
              <a-button size="small" danger @click="removeTier('lessonTiers', idx)">删</a-button>
            </div>
            <a-button size="small" type="dashed" @click="addTier('lessonTiers')">+ 添加档位</a-button>
          </a-form-item>
        </template>

        <template v-if="ruleForm.type === 'MONTHLY'">
          <a-form-item label="底薪">
            <a-input-number v-model:value="(ruleForm.config as any).baseSalary" :min="0" style="width: 200px" />
          </a-form-item>
        </template>

        <a-divider style="margin: 12px 0">绩效与扣款（可选）</a-divider>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="满勤奖">
              <a-input-number v-model:value="(ruleForm.config as any).bonus.fullAttendance" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="课时达标(节)">
              <a-input-number v-model:value="(ruleForm.config as any).bonus.lessonTarget.threshold" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="达标奖">
              <a-input-number v-model:value="(ruleForm.config as any).bonus.lessonTarget.amount" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="迟到扣款/次">
              <a-input-number v-model:value="(ruleForm.config as any).deductions.latePerOccurrence" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="缺勤扣款/次">
              <a-input-number v-model:value="(ruleForm.config as any).deductions.absentPerOccurrence" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="底薪达标课时">
              <a-input-number v-model:value="(ruleForm.config as any).minLessonForBase" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="生效时间(至)">
              <a-date-picker v-model:value="(ruleForm.config as any).effectiveTo" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </a-card>
</template>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.search-bar {
  margin-bottom: 16px;
}
.toolbar {
  margin-bottom: 16px;
}
.tier-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.tier-sep {
  color: #999;
}
.settle-tip {
  margin-bottom: 16px;
}
.settle-result {
  margin-top: 8px;
}
.danger {
  color: #ff4d4f;
}
</style>
