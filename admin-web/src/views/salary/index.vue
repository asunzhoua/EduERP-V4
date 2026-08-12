<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
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
  fetchSalaryTeachers,
  fetchTeacherSalaryProfile,
  upsertTeacherSalaryProfile,
  fetchOutingRecords,
  createOutingRecord,
  updateOutingRecord,
  updateOutingRecordStatus,
  deleteOutingRecord,
  fetchTaxPolicies,
  createTaxPolicy,
  updateTaxPolicy,
  deleteTaxPolicy,
  fetchInsurancePolicies,
  createInsurancePolicy,
  updateInsurancePolicy,
  deleteInsurancePolicy,
  importInsurancePolicy,
  fetchInsuranceCities,
  fetchSalarySlips,
  fetchSalarySlip,
  generateSalarySlips,
  previewSalarySlips,
  updateSlipStatus,
  getSalaryConfig,
  updateSalaryConfig,
  fetchPayrolls,
  createPayroll,
  updatePayrollStatus,
  type SalaryRecord,
  type SalaryRecordStatus,
  type SalaryRecordSource,
  type SalaryStatistics,
  type SalaryRule,
  type SettleResult,
  type CreateSalaryRuleDto,
  type TierConfig,
  type SalaryTeacher,
  type OutingRecord,
  type AllowanceItem,
  type DeductionItem,
  type UpsertTeacherSalaryProfileDto,
  type TaxPolicy,
  type TaxBracket,
  type InsurancePolicy,
  type SalarySlip,
  type SlipStatus,
  type SlipPreviewResult,
  type SalaryPayroll,
  type PayrollStatus,
} from '@/api/salary'
import { exportSalarySlips, exportSalaryPayroll } from '@/api/export'
import { formatDate, formatDateTime, formatMoney } from '@/utils/format'

const activeTab = ref('records')

// ─────────────────────────── 共用工具 ───────────────────────────

/** 比例转百分比显示（0.08 → '8%'），用于社保比例输入框 */
function fmtPct(v: string | number): string {
  if (v === '' || v === undefined || v === null) return ''
  const n = Number(v)
  if (isNaN(n)) return ''
  return `${Math.round(n * 1000) / 10}%`
}
/** 百分比文本解析为小数比例（'8%' → 0.08），用于社保比例输入框 */
function parsePct(s: string): string | number {
  const n = parseFloat(String(s ?? '').replace(/[^\d.-]/g, ''))
  if (isNaN(n)) return ''
  return Math.round(n * 1000) / 100000
}
/** 确保薪资配置中存在 bonus 绩效对象，避免模板 v-model 越界 */
function ensureProfileBonus() {
  const c = profileForm.salaryConfig
  if (!c.bonus || typeof c.bonus !== 'object') {
    c.bonus = {}
  }
  if (!c.bonus.lessonTarget || typeof c.bonus.lessonTarget !== 'object') {
    c.bonus.lessonTarget = {}
  }
}
/** 清理社保比例对象：剔除空值并转数字，返回 undefined 表示无有效比例 */
function cleanRatios(r: Record<string, unknown>): Record<string, number> | undefined {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(r)) {
    if (v === undefined || v === null || v === '') continue
    const n = Number(v)
    if (isNaN(n)) continue
    out[k] = n
  }
  return Object.keys(out).length ? out : undefined
}

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
  ALLOWANCE: '津贴',
  DEDUCTION: '扣款',
  OUTING: '外派',
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
    const statsQuery: { year?: number; month?: number } = {}
    if (query.month) {
      const [y, m] = query.month.split('-').map(Number)
      statsQuery.year = y
      statsQuery.month = m
    }
    const [res, stats] = await Promise.all([
      fetchSalaryRecords({
        status: query.status,
        source: query.source,
        teacherId: query.teacherId || undefined,
        month: query.month || undefined,
        page: query.page,
        pageSize: query.pageSize,
      }),
      fetchSalaryStatistics(statsQuery),
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
  config: { allowances: [], deductions: [] },
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
    config: { lessonPrice: undefined, allowances: [], deductions: [] },
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
  if (!Array.isArray(c.allowances)) c.allowances = []
  if (!Array.isArray(c.deductions)) c.deductions = []
  if (!c.bonus || typeof c.bonus !== 'object') c.bonus = {}
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

function addRuleAllowance() {
  const c = ruleForm.config as Record<string, any>
  if (!Array.isArray(c.allowances)) c.allowances = []
  c.allowances.push({ type: 'OTHER', name: '', amount: 0 })
}
function removeRuleAllowance(index: number) {
  const c = ruleForm.config as Record<string, any>
  if (Array.isArray(c.allowances)) c.allowances.splice(index, 1)
}
function addRuleDeduction() {
  const c = ruleForm.config as Record<string, any>
  if (!Array.isArray(c.deductions)) c.deductions = []
  c.deductions.push({ type: 'OTHER', name: '', amount: 0 })
}
function removeRuleDeduction(index: number) {
  const c = ruleForm.config as Record<string, any>
  if (Array.isArray(c.deductions)) c.deductions.splice(index, 1)
}

function onTypeChange() {
  // 切换类型时重建 config 默认结构（保留绩效/津贴/扣款项）
  const prev = ruleForm.config as Record<string, any>
  const keepBonus = prev.bonus && typeof prev.bonus === 'object' ? prev.bonus : {}
  const keepAllowances = Array.isArray(prev.allowances) ? prev.allowances : []
  const keepDeductions = Array.isArray(prev.deductions) ? prev.deductions : []
  const c: Record<string, any> = { bonus: keepBonus, allowances: keepAllowances, deductions: keepDeductions }
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
      if (k === 'allowances' || k === 'deductions') {
        clean[k] = v.map((i) => ({ type: i.type, name: i.name, amount: Number(i.amount) }))
        continue
      }
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

// ─────────────────────────── 教师薪资档案 Tab ───────────────────────────

const teachersLoading = ref(false)
const teachers = ref<SalaryTeacher[]>([])
const teacherKeyword = ref('')
const profileTab = ref('')
const profileLoading = ref(false)
const profileSaved = ref(false)

const employmentTypeLabel: Record<string, string> = {
  FULL_TIME: '全职',
  PART_TIME: '兼职',
  OUTER: '外聘',
}

const allowanceTypeLabel: Record<string, string> = {
  COMMUTING: '通勤补贴',
  HOUSING: '住房补贴',
  HIGH_TEMP: '高温补贴',
  OTHER: '其他津贴',
}

const deductionTypeLabel: Record<string, string> = {
  LEAVE: '请假扣款',
  OTHER: '其他扣款',
}

const profileForm = reactive<{
  employmentType: string
  ruleType: string
  salaryConfig: Record<string, any>
  allowances: AllowanceItem[]
  deductions: DeductionItem[]
  city?: string
  socialBase?: number
  socialRatios: Record<string, number>
  taxSpecialDeductions: { type?: string; amount?: number }[]
  effectiveFrom?: string
  effectiveTo?: string
  isActive: boolean
  note?: string
}>({
  employmentType: 'FULL_TIME',
  ruleType: 'PER_LESSON',
  salaryConfig: {
    lessonPrice: undefined,
    bonus: { fullAttendance: undefined, lessonTarget: { threshold: undefined, amount: undefined } },
  },
  allowances: [],
  deductions: [],
  socialRatios: {},
  taxSpecialDeductions: [],
  isActive: true,
})

async function searchTeachers(keyword?: string) {
  teachersLoading.value = true
  try {
    const res = await fetchSalaryTeachers({
      keyword: keyword || teacherKeyword.value || undefined,
      page: 1,
      pageSize: 50,
    })
    teachers.value = res.items
  } catch (e) {
    message.error((e as Error).message || '加载教师失败')
  } finally {
    teachersLoading.value = false
  }
}

function onSelectTeacher(teacherId: number | string) {
  loadProfile(Number(teacherId))
}

function resetProfileForm() {
  Object.assign(profileForm, {
    employmentType: 'FULL_TIME',
    ruleType: 'PER_LESSON',
    salaryConfig: {
      lessonPrice: undefined,
      bonus: { fullAttendance: undefined, lessonTarget: { threshold: undefined, amount: undefined } },
    },
    allowances: [],
    deductions: [],
    city: undefined,
    socialBase: undefined,
    socialRatios: {},
    taxSpecialDeductions: [],
    effectiveFrom: undefined,
    effectiveTo: undefined,
    isActive: true,
    note: undefined,
  })
}

async function loadProfile(teacherId: number | string) {
  profileLoading.value = true
  profileSaved.value = false
  try {
    const p = await fetchTeacherSalaryProfile(teacherId)
    if (p) {
      Object.assign(profileForm, {
        employmentType: p.employmentType,
        ruleType: p.ruleType,
        salaryConfig: p.salaryConfig ? JSON.parse(JSON.stringify(p.salaryConfig)) : {},
        allowances: p.allowances ? JSON.parse(JSON.stringify(p.allowances)) : [],
        deductions: p.deductions ? JSON.parse(JSON.stringify(p.deductions)) : [],
        city: p.city || undefined,
        socialBase: p.socialBase ?? undefined,
        socialRatios: p.socialRatios ? JSON.parse(JSON.stringify(p.socialRatios)) : {},
        taxSpecialDeductions: p.taxSpecialDeductions
          ? JSON.parse(JSON.stringify(p.taxSpecialDeductions))
          : [],
        effectiveFrom: p.effectiveFrom || undefined,
        effectiveTo: p.effectiveTo || undefined,
        isActive: p.isActive,
        note: p.note || undefined,
      })
      ensureProfileConfigShape()
    } else {
      resetProfileForm()
    }
  } catch (e) {
    message.error((e as Error).message || '加载档案失败')
    resetProfileForm()
  } finally {
    profileLoading.value = false
  }
}

function ensureProfileConfigShape() {
  const c = profileForm.salaryConfig
  if (profileForm.ruleType === 'TIER' && !Array.isArray(c.lessonTiers)) {
    c.lessonTiers = [defaultTier()]
  }
  if (profileForm.ruleType === 'PER_HEAD' && !Array.isArray(c.headcountTiers)) {
    c.headcountTiers = [defaultTier()]
  }
  ensureProfileBonus()
}

function onProfileTypeChange() {
  const c: Record<string, any> = {}
  if (['PER_LESSON', 'PART_TIME', 'OUTING', 'PER_DAY'].includes(profileForm.ruleType)) {
    c.lessonPrice = undefined
  } else if (profileForm.ruleType === 'PER_HEAD') {
    c.pricePerHead = undefined
    c.headcountTiers = [defaultTier()]
  } else if (profileForm.ruleType === 'TIER') {
    c.lessonTiers = [defaultTier()]
  } else if (profileForm.ruleType === 'MONTHLY') {
    c.baseSalary = undefined
  }
  c.bonus = { fullAttendance: undefined, lessonTarget: { threshold: undefined, amount: undefined } }
  profileForm.salaryConfig = c
}

function addProfileTier(field: 'lessonTiers' | 'headcountTiers') {
  const c = profileForm.salaryConfig
  if (!Array.isArray(c[field])) c[field] = []
  const last = c[field][c[field].length - 1]
  const nextMin = last && typeof last.max === 'number' ? last.max + 1 : c[field].length + 1
  c[field].push({ min: nextMin, max: null, pricePerLesson: undefined, pricePerHead: undefined })
}

function removeProfileTier(field: 'lessonTiers' | 'headcountTiers', index: number) {
  const c = profileForm.salaryConfig
  if (Array.isArray(c[field])) c[field].splice(index, 1)
}

function addProfileAllowance() {
  profileForm.allowances.push({ type: 'OTHER', name: '', amount: 0 })
}
function removeProfileAllowance(index: number) {
  profileForm.allowances.splice(index, 1)
}
function addProfileDeduction() {
  profileForm.deductions.push({ type: 'OTHER', name: '', amount: 0 })
}
function removeProfileDeduction(index: number) {
  profileForm.deductions.splice(index, 1)
}
function addProfileSpecialDeduction() {
  profileForm.taxSpecialDeductions.push({ type: '', amount: undefined })
}
function removeProfileSpecialDeduction(index: number) {
  profileForm.taxSpecialDeductions.splice(index, 1)
}

function buildProfileConfig(): Record<string, any> {
  const c = profileForm.salaryConfig
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
  const numKeys = ['lessonPrice', 'pricePerHead', 'baseSalary', 'minLessonForBase']
  for (const k of numKeys) {
    if (clean[k] !== undefined) clean[k] = Number(clean[k])
  }
  return clean
}

async function onSaveProfile() {
  if (!profileTab.value) {
    message.warning('请先选择教师')
    return
  }
  for (const a of profileForm.allowances) {
    if (!a.name) {
      message.warning('津贴项请填写名称')
      return
    }
  }
  for (const d of profileForm.deductions) {
    if (!d.name) {
      message.warning('扣款项请填写名称')
      return
    }
  }
  profileLoading.value = true
  try {
    const config = buildProfileConfig()
    const dto: UpsertTeacherSalaryProfileDto = {
      employmentType: profileForm.employmentType,
      ruleType: profileForm.ruleType,
      salaryConfig: Object.keys(config).length ? config : undefined,
      allowances: profileForm.allowances.length
        ? profileForm.allowances.map((i) => ({ ...i, amount: Number(i.amount) }))
        : undefined,
      deductions: profileForm.deductions.length
        ? profileForm.deductions.map((i) => ({ ...i, amount: Number(i.amount) }))
        : undefined,
      city: profileForm.city || undefined,
      socialBase:
        profileForm.socialBase !== undefined && profileForm.socialBase !== null
          ? Number(profileForm.socialBase)
          : undefined,
      socialRatios: cleanRatios(profileForm.socialRatios),
      taxSpecialDeductions: profileForm.taxSpecialDeductions.length
        ? profileForm.taxSpecialDeductions.map((d) => ({
            type: d.type,
            amount: Number(d.amount),
          }))
        : undefined,
      effectiveFrom: profileForm.effectiveFrom || undefined,
      effectiveTo: profileForm.effectiveTo || undefined,
      isActive: profileForm.isActive,
      note: profileForm.note || undefined,
    }
    await upsertTeacherSalaryProfile(profileTab.value, dto)
    message.success('档案已保存')
    profileSaved.value = true
    loadProfile(profileTab.value)
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    profileLoading.value = false
  }
}

// ─────────────────────────── 外派课时 Tab ───────────────────────────

const outingLoading = ref(false)
const outings = ref<OutingRecord[]>([])
const outingTotal = ref(0)
const outingQuery = reactive({
  teacherId: '',
  month: undefined as string | undefined,
  status: undefined as string | undefined,
  page: 1,
  pageSize: 10,
})
const outingModalVisible = ref(false)
const outingModalMode = ref<'create' | 'edit'>('create')
const editingOutingId = ref<number | string | null>(null)
const outingForm = reactive({
  teacherId: '' as number | string,
  outingDate: '',
  location: '',
  lessonCount: 1,
  note: '',
})

const outingStatusLabel: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
}
const outingStatusColor: Record<string, string> = {
  PENDING: 'orange',
  CONFIRMED: 'green',
}

const outingColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '教师ID', dataIndex: 'teacherId', key: 'teacherId', width: 90 },
  { title: '外派日期', dataIndex: 'outingDate', key: 'outingDate', width: 110 },
  { title: '地点', dataIndex: 'location', key: 'location' },
  { title: '课时数', dataIndex: 'lessonCount', key: 'lessonCount', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '备注', dataIndex: 'note', key: 'note' },
  { title: '操作', dataIndex: 'action', key: 'action', width: 180, fixed: 'right' as const },
]

async function loadOutings() {
  outingLoading.value = true
  try {
    const res = await fetchOutingRecords({
      teacherId: outingQuery.teacherId || undefined,
      month: outingQuery.month || undefined,
      status: outingQuery.status || undefined,
      page: outingQuery.page,
      pageSize: outingQuery.pageSize,
    })
    outings.value = res.records
    outingTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载外派失败')
  } finally {
    outingLoading.value = false
  }
}

function onOutingSearch() {
  outingQuery.page = 1
  loadOutings()
}

function onOutingReset() {
  outingQuery.teacherId = ''
  outingQuery.month = undefined
  outingQuery.status = undefined
  outingQuery.page = 1
  loadOutings()
}

function openCreateOuting() {
  outingModalMode.value = 'create'
  editingOutingId.value = null
  Object.assign(outingForm, {
    teacherId: '',
    outingDate: '',
    location: '',
    lessonCount: 1,
    note: '',
  })
  outingModalVisible.value = true
}

function openEditOuting(row: OutingRecord) {
  outingModalMode.value = 'edit'
  editingOutingId.value = row.id
  Object.assign(outingForm, {
    teacherId: row.teacherId,
    outingDate: row.outingDate,
    location: row.location || '',
    lessonCount: row.lessonCount,
    note: row.note || '',
  })
  outingModalVisible.value = true
}

async function onSubmitOuting() {
  if (!outingForm.teacherId) {
    message.warning('请选择教师')
    return
  }
  if (!outingForm.outingDate) {
    message.warning('请选择外派日期')
    return
  }
  try {
    const payload = {
      teacherId: Number(outingForm.teacherId),
      outingDate: outingForm.outingDate,
      location: outingForm.location || undefined,
      lessonCount: Number(outingForm.lessonCount) || 1,
      note: outingForm.note || undefined,
    }
    if (outingModalMode.value === 'create') {
      await createOutingRecord(payload)
      message.success('外派记录已创建')
    } else if (editingOutingId.value !== null) {
      await updateOutingRecord(editingOutingId.value, payload)
      message.success('外派记录已更新')
    }
    outingModalVisible.value = false
    loadOutings()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  }
}

function onConfirmOuting(row: OutingRecord) {
  Modal.confirm({
    title: '确认外派记录',
    content: `确认教师 ${row.teacherId} 于 ${row.outingDate} 的 ${row.lessonCount} 节外派课时？确认后将计入当月结算。`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateOutingRecordStatus(row.id, 'CONFIRMED')
        message.success('已确认')
        loadOutings()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onDeleteOuting(row: OutingRecord) {
  Modal.confirm({
    title: '删除外派记录',
    content: `确认删除 ${row.outingDate} 的外派记录？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteOutingRecord(row.id)
        message.success('已删除')
        loadOutings()
      } catch (e) {
        message.error((e as Error).message || '删除失败')
      }
    },
  })
}

// ─────────────────────────── 个税政策 Tab ───────────────────────────

const taxLoading = ref(false)
const taxPolicies = ref<TaxPolicy[]>([])
const taxTotal = ref(0)
const taxPage = ref(1)
const taxPageSize = ref(10)
const taxActiveOnly = ref(false)
const taxModalVisible = ref(false)
const taxModalMode = ref<'create' | 'edit'>('create')
const editingTaxId = ref<number | string | null>(null)
const taxForm = reactive<{
  name: string
  effectiveFrom?: string
  effectiveTo?: string
  taxThreshold?: number
  note?: string
  brackets: TaxBracket[]
}>({
  name: '',
  brackets: [],
})

const taxColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
  {
    title: '起征点',
    dataIndex: 'taxThreshold',
    key: 'taxThreshold',
    width: 100,
    customRender: ({ text }: { text: number }) => formatMoney(text),
  },
  {
    title: '档位数',
    key: 'bracketCount',
    width: 90,
    customRender: ({ record }: { record: TaxPolicy }) => record.brackets?.length ?? 0,
  },
  {
    title: '生效区间',
    key: 'effect',
    width: 200,
    customRender: ({ record }: { record: TaxPolicy }) => taxEffect(record),
  },
  { title: '操作', dataIndex: 'action', key: 'action', width: 120 },
]

function taxEffect(p: TaxPolicy): string {
  const from = p.effectiveFrom ? `从 ${p.effectiveFrom}` : ''
  const to = p.effectiveTo ? `至 ${p.effectiveTo}` : ''
  return [from, to].filter(Boolean).join(' ') || '长期'
}

async function loadTaxPolicies() {
  taxLoading.value = true
  try {
    const res = await fetchTaxPolicies({
      activeOnly: taxActiveOnly.value || undefined,
      page: taxPage.value,
      pageSize: taxPageSize.value,
    })
    taxPolicies.value = res.items
    taxTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载个税政策失败')
  } finally {
    taxLoading.value = false
  }
}

function defaultTaxBracket(): TaxBracket {
  return { min: 0, max: null, rate: 0.03, quickDeduction: 0 }
}

function openCreateTax() {
  taxModalMode.value = 'create'
  editingTaxId.value = null
  Object.assign(taxForm, {
    name: '',
    effectiveFrom: undefined,
    effectiveTo: undefined,
    taxThreshold: 5000,
    note: undefined,
    brackets: [defaultTaxBracket()],
  })
  taxModalVisible.value = true
}

function openEditTax(row: TaxPolicy) {
  taxModalMode.value = 'edit'
  editingTaxId.value = row.id
  Object.assign(taxForm, {
    name: row.name,
    effectiveFrom: row.effectiveFrom || undefined,
    effectiveTo: row.effectiveTo || undefined,
    taxThreshold: row.taxThreshold,
    note: row.note || undefined,
    brackets: row.brackets ? JSON.parse(JSON.stringify(row.brackets)) : [],
  })
  taxModalVisible.value = true
}

function addTaxBracket() {
  taxForm.brackets.push(defaultTaxBracket())
}
function removeTaxBracket(idx: number) {
  taxForm.brackets.splice(idx, 1)
}

async function onSubmitTax() {
  if (!taxForm.name || !taxForm.effectiveFrom) {
    message.warning('请填写名称与生效起始日')
    return
  }
  try {
    const payload = {
      name: taxForm.name,
      effectiveFrom: taxForm.effectiveFrom,
      effectiveTo: taxForm.effectiveTo || undefined,
      taxThreshold: Number(taxForm.taxThreshold) || 5000,
      brackets: taxForm.brackets
        .filter((b) => b.rate !== undefined && b.rate !== null)
        .map((b) => ({
          min: Number(b.min) || 0,
          max:
            b.max === undefined || b.max === null
              ? null
              : Number(b.max),
          rate: Number(b.rate) || 0,
          quickDeduction: Number(b.quickDeduction) || 0,
        })),
      note: taxForm.note || undefined,
    }
    if (taxModalMode.value === 'create') {
      await createTaxPolicy(payload)
      message.success('个税政策已创建')
    } else if (editingTaxId.value !== null) {
      await updateTaxPolicy(editingTaxId.value, payload)
      message.success('个税政策已更新')
    }
    taxModalVisible.value = false
    loadTaxPolicies()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  }
}

function onDeleteTax(row: TaxPolicy) {
  Modal.confirm({
    title: '删除个税政策',
    content: `确认删除「${row.name}」？历史工资条快照不受影响。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteTaxPolicy(row.id)
        message.success('已删除')
        loadTaxPolicies()
      } catch (e) {
        message.error((e as Error).message || '删除失败')
      }
    },
  })
}

// ─────────────────────────── 五险一金政策 Tab ───────────────────────────

const insLoading = ref(false)
const insPolicies = ref<InsurancePolicy[]>([])
const insTotal = ref(0)
const insPage = ref(1)
const insPageSize = ref(10)
const insCityFilter = ref('')
const insModalVisible = ref(false)
const insModalMode = ref<'create' | 'edit'>('create')
const editingInsId = ref<number | string | null>(null)
const insCities = ref<string[]>([])
const insImportVisible = ref(false)
const insImportCity = ref('')
const insImportEffectiveFrom = ref('')
const insImportLoading = ref(false)
const insForm = reactive<{
  city: string
  name: string
  effectiveFrom?: string
  effectiveTo?: string
  socialBaseMin?: number
  socialBaseMax?: number
  socialBase?: number
  ratios: Record<string, number>
  note?: string
}>({
  city: '',
  name: '',
  ratios: {},
})

const insColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '城市', dataIndex: 'city', key: 'city', width: 90 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 180 },
  {
    title: '基数下限',
    dataIndex: 'socialBaseMin',
    key: 'socialBaseMin',
    width: 100,
    customRender: ({ text }: { text: number | null }) => text ?? '-',
  },
  {
    title: '基数上限',
    dataIndex: 'socialBaseMax',
    key: 'socialBaseMax',
    width: 100,
    customRender: ({ text }: { text: number | null }) => text ?? '-',
  },
  {
    title: '默认基数',
    dataIndex: 'socialBase',
    key: 'socialBase',
    width: 100,
    customRender: ({ text }: { text: number | null }) => text ?? '-',
  },
  {
    title: '个人比例',
    key: 'ratiosSummary',
    width: 190,
    customRender: ({ record }: { record: InsurancePolicy }) => insRatiosSummary(record),
  },
  {
    title: '生效区间',
    key: 'effect',
    width: 200,
    customRender: ({ record }: { record: InsurancePolicy }) => insEffect(record),
  },
  { title: '操作', dataIndex: 'action', key: 'action', width: 150 },
]

function insRatiosSummary(p: InsurancePolicy): string {
  const r = p.ratios || {}
  if (!Object.keys(r).length) return '-'
  const pct = (v?: number) =>
    v === undefined || v === null ? '-' : `${Math.round(v * 1000) / 10}%`
  return `养${pct(r.pension)} 医${pct(r.medical)} 失${pct(r.unemployment)} 公${pct(r.housingFund)}`
}

function insEffect(p: InsurancePolicy): string {
  const from = p.effectiveFrom ? `从 ${p.effectiveFrom}` : ''
  const to = p.effectiveTo ? `至 ${p.effectiveTo}` : ''
  return [from, to].filter(Boolean).join(' ') || '长期'
}

async function loadInsurancePolicies() {
  insLoading.value = true
  try {
    const res = await fetchInsurancePolicies({
      city: insCityFilter.value || undefined,
      page: insPage.value,
      pageSize: insPageSize.value,
    })
    insPolicies.value = res.items
    insTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载五险一金政策失败')
  } finally {
    insLoading.value = false
  }
}

async function loadInsuranceCities() {
  try {
    insCities.value = await fetchInsuranceCities()
  } catch (e) {
    message.error((e as Error).message || '加载城市列表失败')
  }
}

function resetInsForm() {
  Object.assign(insForm, {
    city: '',
    name: '',
    effectiveFrom: undefined,
    effectiveTo: undefined,
    socialBaseMin: undefined,
    socialBaseMax: undefined,
    socialBase: undefined,
    ratios: {},
    note: undefined,
  })
}

function openCreateIns() {
  insModalMode.value = 'create'
  editingInsId.value = null
  resetInsForm()
  insModalVisible.value = true
}

function openEditIns(row: InsurancePolicy) {
  insModalMode.value = 'edit'
  editingInsId.value = row.id
  Object.assign(insForm, {
    city: row.city,
    name: row.name,
    effectiveFrom: row.effectiveFrom || undefined,
    effectiveTo: row.effectiveTo || undefined,
    socialBaseMin: row.socialBaseMin ?? undefined,
    socialBaseMax: row.socialBaseMax ?? undefined,
    socialBase: row.socialBase ?? undefined,
    ratios: row.ratios ? JSON.parse(JSON.stringify(row.ratios)) : {},
    note: row.note || undefined,
  })
  insModalVisible.value = true
}

async function onSubmitIns() {
  if (!insForm.city || !insForm.name || !insForm.effectiveFrom) {
    message.warning('请填写城市、名称与生效起始日')
    return
  }
  try {
    const payload = {
      city: insForm.city,
      name: insForm.name,
      effectiveFrom: insForm.effectiveFrom,
      effectiveTo: insForm.effectiveTo || undefined,
      socialBaseMin:
        insForm.socialBaseMin !== undefined ? Number(insForm.socialBaseMin) : undefined,
      socialBaseMax:
        insForm.socialBaseMax !== undefined ? Number(insForm.socialBaseMax) : undefined,
      socialBase:
        insForm.socialBase !== undefined ? Number(insForm.socialBase) : undefined,
      ratios: cleanRatios(insForm.ratios),
      note: insForm.note || undefined,
    }
    if (insModalMode.value === 'create') {
      await createInsurancePolicy(payload)
      message.success('五险一金政策已创建')
    } else if (editingInsId.value !== null) {
      await updateInsurancePolicy(editingInsId.value, payload)
      message.success('五险一金政策已更新')
    }
    insModalVisible.value = false
    loadInsurancePolicies()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  }
}

function onDeleteIns(row: InsurancePolicy) {
  Modal.confirm({
    title: '删除五险一金政策',
    content: `确认删除「${row.city} · ${row.name}」？历史工资条快照不受影响。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteInsurancePolicy(row.id)
        message.success('已删除')
        loadInsurancePolicies()
      } catch (e) {
        message.error((e as Error).message || '删除失败')
      }
    },
  })
}

function openImportIns() {
  insImportCity.value = ''
  insImportEffectiveFrom.value = ''
  insImportVisible.value = true
}

async function onSubmitImportIns() {
  if (!insImportCity.value) {
    message.warning('请选择城市')
    return
  }
  insImportLoading.value = true
  try {
    await importInsurancePolicy({
      city: insImportCity.value,
      effectiveFrom: insImportEffectiveFrom.value || undefined,
    })
    message.success('已生成新版本（历史版本保留）')
    insImportVisible.value = false
    loadInsurancePolicies()
  } catch (e) {
    message.error((e as Error).message || '导入失败')
  } finally {
    insImportLoading.value = false
  }
}

// ─────────────────────────── 工资条 Tab ───────────────────────────

const slipLoading = ref(false)
const slips = ref<SalarySlip[]>([])
const slipTotal = ref(0)
const slipQuery = reactive<{
  month?: string
  teacherId?: string
  status?: SlipStatus
  page: number
  pageSize: number
}>({ page: 1, pageSize: 10 })
const slipGenMonth = ref('')
const slipGenTeacherId = ref('')
const slipGenLoading = ref(false)
const slipPreviewResult = ref<SlipPreviewResult | null>(null)
const slipDetailVisible = ref(false)
const slipDetail = ref<SalarySlip | null>(null)
const slipDetailLoading = ref(false)

const slipStatusLabel: Record<SlipStatus, string> = {
  PENDING: '待确认',
  APPROVED: '已确认',
  PAID: '已发放',
}
const slipStatusColor: Record<SlipStatus, string> = {
  PENDING: 'orange',
  APPROVED: 'blue',
  PAID: 'green',
}

const slipColumns = computed(() => {
  const all = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '教师', dataIndex: 'teacherName', key: 'teacherName', width: 120 },
    { title: '月份', dataIndex: 'month', key: 'month', width: 90 },
    {
      title: '应发',
      dataIndex: 'grossAmount',
      key: 'grossAmount',
      width: 100,
      customRender: ({ text }: { text: number }) => formatMoney(text),
    },
    {
      title: '五险一金',
      dataIndex: 'socialAmount',
      key: 'socialAmount',
      width: 100,
      customRender: ({ text }: { text: number }) => formatMoney(text),
    },
    {
      title: '个税',
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      width: 90,
      customRender: ({ text }: { text: number }) => formatMoney(text),
    },
    {
      title: '实发',
      dataIndex: 'netAmount',
      key: 'netAmount',
      width: 100,
      customRender: ({ text }: { text: number }) => formatMoney(text),
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
    {
      title: '需复核',
      dataIndex: 'needsReview',
      key: 'needsReview',
      width: 80,
      customRender: ({ text }: { text: boolean }) =>
        text ? h('a-tag', { color: 'red' }, '是') : '-',
    },
    { title: '操作', dataIndex: 'action', key: 'action', width: 150, fixed: 'right' as const },
  ]
  return deductEnabled.value
    ? all
    : all.filter((c) => c.key !== 'socialAmount' && c.key !== 'taxAmount')
})

async function loadSlips() {
  slipLoading.value = true
  try {
    const res = await fetchSalarySlips({
      month: slipQuery.month || undefined,
      teacherId: slipQuery.teacherId ? Number(slipQuery.teacherId) : undefined,
      status: slipQuery.status || undefined,
      page: slipQuery.page,
      pageSize: slipQuery.pageSize,
    })
    slips.value = res.slips
    slipTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载工资条失败')
  } finally {
    slipLoading.value = false
  }
}

function onSlipSearch() {
  slipQuery.page = 1
  loadSlips()
}

function onSlipReset() {
  slipQuery.month = undefined
  slipQuery.teacherId = ''
  slipQuery.status = undefined
  slipQuery.page = 1
  loadSlips()
}

async function onExportSlips() {
  try {
    await exportSalarySlips({
      month: slipQuery.month || undefined,
      teacherId: slipQuery.teacherId ? Number(slipQuery.teacherId) : undefined,
      status: slipQuery.status || undefined,
    })
    message.success('导出成功')
  } catch (e) {
    message.error((e as Error).message || '导出失败')
  }
}

async function onGenerateSlips() {
  if (!slipGenMonth.value) {
    message.warning('请选择生成月份')
    return
  }
  slipGenLoading.value = true
  slipPreviewResult.value = null
  try {
    const res = await generateSalarySlips({
      month: slipGenMonth.value,
      teacherId: slipGenTeacherId.value ? Number(slipGenTeacherId.value) : undefined,
    })
    slipPreviewResult.value = {
      month: res.month,
      teachers: res.teachers,
      slips: res.slips,
    }
    message.success(`生成完成：新增 ${res.generated}，跳过 ${res.skipped}`)
    loadSlips()
  } catch (e) {
    message.error((e as Error).message || '生成失败')
  } finally {
    slipGenLoading.value = false
  }
}

async function onPreviewSlips() {
  if (!slipGenMonth.value) {
    message.warning('请选择试算月份')
    return
  }
  slipGenLoading.value = true
  slipPreviewResult.value = null
  try {
    slipPreviewResult.value = await previewSalarySlips({
      month: slipGenMonth.value,
      teacherId: slipGenTeacherId.value ? Number(slipGenTeacherId.value) : undefined,
    })
  } catch (e) {
    message.error((e as Error).message || '试算失败')
  } finally {
    slipGenLoading.value = false
  }
}

function onSlipStatus(row: SalarySlip, target: SlipStatus) {
  const textMap: Record<SlipStatus, string> = {
    PENDING: '重算',
    APPROVED: '确认',
    PAID: '发放',
  }
  const text = textMap[target]
  Modal.confirm({
    title: `确认${text}该工资条？`,
    content:
      target === 'PAID'
        ? '发放后当月该教师的所有工资记录将同步置为已发放。'
        : `教师 ${row.teacherName || row.teacherId} 的工资条将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateSlipStatus(row.id, target)
        message.success(`已${text}`)
        loadSlips()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

async function showSlipDetail(row: SalarySlip) {
  slipDetailVisible.value = true
  slipDetail.value = null
  slipDetailLoading.value = true
  try {
    slipDetail.value = await fetchSalarySlip(row.id)
  } catch (e) {
    message.error((e as Error).message || '加载详情失败')
    slipDetailVisible.value = false
  } finally {
    slipDetailLoading.value = false
  }
}

// ─────────────────────────── 社保/个税总开关 ───────────────────────────

const deductEnabled = ref(false)
const deductConfirmVisible = ref(false)
const deductSaving = ref(false)

async function loadSalaryConfig() {
  try {
    const res = await getSalaryConfig()
    deductEnabled.value = res.enabled
  } catch (e) {
    message.error((e as Error).message || '加载社保/个税配置失败')
  }
}

function onToggleDeduct() {
  deductConfirmVisible.value = true
}

async function onConfirmToggleDeduct() {
  deductSaving.value = true
  const next = !deductEnabled.value
  try {
    await updateSalaryConfig({ enabled: next })
    deductEnabled.value = next
    deductConfirmVisible.value = false
    message.success(next ? '已开启社保和个税' : '已关闭社保和个税')
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    deductSaving.value = false
  }
}

// ─────────────────────────── 发放批次 Tab ───────────────────────────

const payrollLoading = ref(false)
const payrolls = ref<SalaryPayroll[]>([])
const payrollTotal = ref(0)
const payrollQuery = reactive<{
  month?: string
  status?: PayrollStatus
  page: number
  pageSize: number
}>({ page: 1, pageSize: 10 })
const payrollModalVisible = ref(false)
const payrollMonth = ref('')
const payrollNote = ref('')
const payrollCreateLoading = ref(false)
const payrollExportingId = ref<number | string | null>(null)

const payrollStatusLabel: Record<PayrollStatus, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  PAID: '已发放',
  CLOSED: '已关闭',
}
const payrollStatusColor: Record<PayrollStatus, string> = {
  DRAFT: 'default',
  CONFIRMED: 'blue',
  PAID: 'green',
  CLOSED: 'gray',
}

const payrollColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 160 },
  { title: '月份', dataIndex: 'month', key: 'month', width: 90 },
  {
    title: '总额',
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    width: 120,
    customRender: ({ text }: { text: number }) => formatMoney(text),
  },
  {
    title: '工资条数',
    key: 'slipCount',
    width: 90,
    customRender: ({ record }: { record: SalaryPayroll }) => record.detail?.slipCount ?? 0,
  },
  {
    title: '教师数',
    key: 'teacherCount',
    width: 90,
    customRender: ({ record }: { record: SalaryPayroll }) => record.detail?.teacherCount ?? 0,
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 200, fixed: 'right' as const },
]

async function loadPayrolls() {
  payrollLoading.value = true
  try {
    const res = await fetchPayrolls({
      month: payrollQuery.month || undefined,
      status: payrollQuery.status || undefined,
      page: payrollQuery.page,
      pageSize: payrollQuery.pageSize,
    })
    payrolls.value = res.items
    payrollTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载发放批次失败')
  } finally {
    payrollLoading.value = false
  }
}

function onPayrollSearch() {
  payrollQuery.page = 1
  loadPayrolls()
}

function openCreatePayroll() {
  payrollMonth.value = ''
  payrollNote.value = ''
  payrollModalVisible.value = true
}

async function onSubmitCreatePayroll() {
  if (!payrollMonth.value) {
    message.warning('请选择发放月份')
    return
  }
  payrollCreateLoading.value = true
  try {
    await createPayroll({
      month: payrollMonth.value,
      note: payrollNote.value || undefined,
    })
    message.success('发放批次已创建（自动纳入该月待发放工资条）')
    payrollModalVisible.value = false
    loadPayrolls()
  } catch (e) {
    message.error((e as Error).message || '创建失败')
  } finally {
    payrollCreateLoading.value = false
  }
}

function onPayrollStatus(row: SalaryPayroll, target: PayrollStatus) {
  const textMap: Record<PayrollStatus, string> = {
    DRAFT: '设为草稿',
    CONFIRMED: '确认',
    PAID: '发放',
    CLOSED: '关闭',
  }
  const text = textMap[target]
  Modal.confirm({
    title: `确认${text}该批次？`,
    content: `批次 ${row.batchNo} 将被${text}。`,
    okText: `确认${text}`,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updatePayrollStatus(row.id, target)
        message.success(`已${text}`)
        loadPayrolls()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

async function onExportPayroll(row: SalaryPayroll) {
  payrollExportingId.value = row.id
  try {
    await exportSalaryPayroll(row.id)
    message.success('导出成功')
  } catch (e) {
    message.error((e as Error).message || '导出失败')
  } finally {
    payrollExportingId.value = null
  }
}

// ─────────────────────────── 初始化 ───────────────────────────

function onTabChange(key: string) {
  if (key === 'outing') loadOutings()
  else if (key === 'tax-policy') loadTaxPolicies()
  else if (key === 'insurance-policy') {
    loadInsurancePolicies()
    loadInsuranceCities()
  } else if (key === 'slips') loadSlips()
  else if (key === 'payroll') loadPayrolls()
  else if (key === 'profile') loadInsuranceCities()
  else if (key === 'soc-tax') loadSalaryConfig()
}

onMounted(() => {
  loadRecords()
  loadRules()
  loadInsuranceCities()
  loadSalaryConfig()
})
</script>

<template>
  <a-card :bordered="false">
    <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
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

      <!-- ── 教师薪资档案 ── -->
      <a-tab-pane key="profile" tab="教师薪资档案">
        <a-form layout="inline" class="search-bar">
          <a-form-item label="选择教师">
            <a-select
              v-model:value="profileTab"
              show-search
              :filter-option="false"
              :loading="teachersLoading"
              placeholder="按姓名/手机号搜索"
              style="width: 280px"
              :not-found-content="null"
              @search="(kw: string) => searchTeachers(kw)"
              @change="(v: number | string) => onSelectTeacher(v)"
              @dropdown-visible-change="(open: boolean) => open && searchTeachers()"
            >
              <a-select-option v-for="t in teachers" :key="t.id" :value="t.id">
                {{ t.name }}（{{ t.mobile || '无手机号' }}{{ t.teacherLevel ? ' · ' + t.teacherLevel : '' }}）
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-form>

        <a-spin :spinning="profileLoading">
          <a-form :model="profileForm" layout="vertical" class="profile-form">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="聘用形式">
                  <a-select v-model:value="profileForm.employmentType">
                    <a-select-option v-for="(label, key) in employmentTypeLabel" :key="key" :value="key">{{ label }}</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="计费类型">
                  <a-select v-model:value="profileForm.ruleType" @change="onProfileTypeChange">
                    <a-select-option v-for="(label, key) in typeLabel" :key="key" :value="key">{{ label }}</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="启用状态">
                  <a-switch v-model:checked="profileForm.isActive" checked-children="启用" un-checked-children="停用" />
                </a-form-item>
              </a-col>
            </a-row>

            <template v-if="['PER_LESSON', 'PART_TIME', 'OUTING', 'PER_DAY'].includes(profileForm.ruleType)">
              <a-form-item label="课时单价">
                <a-input-number v-model:value="profileForm.salaryConfig.lessonPrice" :min="0" style="width: 200px" />
              </a-form-item>
            </template>

            <template v-if="profileForm.ruleType === 'PER_HEAD'">
              <a-form-item label="每人单价(无阶梯)">
                <a-input-number v-model:value="profileForm.salaryConfig.pricePerHead" :min="0" style="width: 200px" />
              </a-form-item>
              <a-form-item label="人数阶梯">
                <div v-for="(tier, idx) in profileForm.salaryConfig.headcountTiers || []" :key="idx" class="tier-row">
                  <a-input-number v-model:value="tier.min" :min="1" placeholder="人数起" style="width: 90px" />
                  <span class="tier-sep">~</span>
                  <a-input-number v-model:value="tier.max" placeholder="人数止(留空不限)" style="width: 120px" />
                  <span class="tier-sep">每人</span>
                  <a-input-number v-model:value="tier.pricePerHead" :min="0" placeholder="价格" style="width: 100px" />
                  <a-button size="small" danger @click="removeProfileTier('headcountTiers', idx as number)">删</a-button>
                </div>
                <a-button size="small" type="dashed" @click="addProfileTier('headcountTiers')">+ 添加档位</a-button>
              </a-form-item>
            </template>

            <template v-if="profileForm.ruleType === 'TIER'">
              <a-form-item label="课时阶梯（按当月累计课时数）">
                <div v-for="(tier, idx) in profileForm.salaryConfig.lessonTiers || []" :key="idx" class="tier-row">
                  <a-input-number v-model:value="tier.min" :min="1" placeholder="课时起" style="width: 90px" />
                  <span class="tier-sep">~</span>
                  <a-input-number v-model:value="tier.max" placeholder="课时止(留空不限)" style="width: 120px" />
                  <span class="tier-sep">每节</span>
                  <a-input-number v-model:value="tier.pricePerLesson" :min="0" placeholder="价格" style="width: 100px" />
                  <a-button size="small" danger @click="removeProfileTier('lessonTiers', idx as number)">删</a-button>
                </div>
                <a-button size="small" type="dashed" @click="addProfileTier('lessonTiers')">+ 添加档位</a-button>
              </a-form-item>
            </template>

            <template v-if="profileForm.ruleType === 'MONTHLY'">
              <a-form-item label="底薪">
                <a-input-number v-model:value="profileForm.salaryConfig.baseSalary" :min="0" style="width: 200px" />
              </a-form-item>
            </template>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="底薪（可叠加）">
                  <a-input-number v-model:value="profileForm.salaryConfig.baseSalary" :min="0" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="底薪达标课时">
                  <a-input-number v-model:value="profileForm.salaryConfig.minLessonForBase" :min="0" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item label="个人津贴（结算生成 ALLOWANCE 记录）">
              <div v-for="(item, idx) in profileForm.allowances" :key="idx" class="item-row">
                <a-select v-model:value="item.type" style="width: 130px">
                  <a-select-option v-for="(label, key) in allowanceTypeLabel" :key="key" :value="key">{{ label }}</a-select-option>
                </a-select>
                <a-input v-model:value="item.name" placeholder="显示名称" style="width: 180px" />
                <a-input-number v-model:value="item.amount" :min="0" placeholder="金额" style="width: 110px" />
                <a-button size="small" danger @click="removeProfileAllowance(idx)">删</a-button>
              </div>
              <a-button size="small" type="dashed" @click="addProfileAllowance">+ 添加津贴</a-button>
            </a-form-item>

            <a-form-item label="个人扣款（结算生成 DEDUCTION 记录）">
              <div v-for="(item, idx) in profileForm.deductions" :key="idx" class="item-row">
                <a-select v-model:value="item.type" style="width: 130px">
                  <a-select-option v-for="(label, key) in deductionTypeLabel" :key="key" :value="key">{{ label }}</a-select-option>
                </a-select>
                <a-input v-model:value="item.name" placeholder="显示名称" style="width: 180px" />
                <a-input-number v-model:value="item.amount" :min="0" placeholder="金额" style="width: 110px" />
                <a-button size="small" danger @click="removeProfileDeduction(idx)">删</a-button>
              </div>
              <a-button size="small" type="dashed" @click="addProfileDeduction">+ 添加扣款</a-button>
            </a-form-item>

            <a-divider style="margin: 12px 0">绩效与社保</a-divider>

            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="满勤奖">
                  <a-input-number v-model:value="profileForm.salaryConfig.bonus.fullAttendance" :min="0" style="width: 100%" placeholder="0" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="课时目标(节)">
                  <a-input-number v-model:value="profileForm.salaryConfig.bonus.lessonTarget.threshold" :min="0" style="width: 100%" placeholder="当月课时数目标" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="达标奖励(元)">
                  <a-input-number v-model:value="profileForm.salaryConfig.bonus.lessonTarget.amount" :min="0" style="width: 100%" placeholder="达标奖励金额" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="社保城市">
                  <a-select v-model:value="profileForm.city" allow-clear placeholder="选择城市（用于五险一金比例）" style="width: 100%">
                    <a-select-option v-for="c in insCities" :key="c" :value="c">{{ c }}</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="社保基数（留空用政策默认）">
                  <a-input-number v-model:value="profileForm.socialBase" :min="0" style="width: 100%" placeholder="个人社保基数" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item label="社保个人比例（留空用政策默认，0 表示不缴）">
              <a-row :gutter="16">
                <a-col :span="6">
                  <a-input-number v-model:value="profileForm.socialRatios.pension" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="养老" style="width: 100%" />
                </a-col>
                <a-col :span="6">
                  <a-input-number v-model:value="profileForm.socialRatios.medical" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="医疗" style="width: 100%" />
                </a-col>
                <a-col :span="6">
                  <a-input-number v-model:value="profileForm.socialRatios.unemployment" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="失业" style="width: 100%" />
                </a-col>
                <a-col :span="6">
                  <a-input-number v-model:value="profileForm.socialRatios.housingFund" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="公积金" style="width: 100%" />
                </a-col>
              </a-row>
            </a-form-item>

            <a-form-item label="个税专项附加扣除（每月）">
              <div v-for="(d, idx) in profileForm.taxSpecialDeductions" :key="idx" class="item-row">
                <a-input v-model:value="d.type" placeholder="类型，如 子女教育/房贷利息" style="width: 240px" />
                <a-input-number v-model:value="d.amount" :min="0" placeholder="每月金额" style="width: 140px" />
                <a-button size="small" danger @click="removeProfileSpecialDeduction(idx)">删</a-button>
              </div>
              <a-button size="small" type="dashed" @click="addProfileSpecialDeduction">+ 添加专项附加</a-button>
            </a-form-item>

            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="生效起始日">
                  <a-date-picker v-model:value="profileForm.effectiveFrom" value-format="YYYY-MM-DD" style="width: 100%" placeholder="长期有效" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="生效结束日">
                  <a-date-picker v-model:value="profileForm.effectiveTo" value-format="YYYY-MM-DD" style="width: 100%" placeholder="长期有效" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="备注">
                  <a-input v-model:value="profileForm.note" placeholder="备注（可选）" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item>
              <a-button type="primary" :loading="profileLoading" :disabled="!profileTab" @click="onSaveProfile">
                保存档案
              </a-button>
              <a-alert v-if="profileSaved" type="success" show-icon class="save-tip" message="档案已保存，结算将按此档案优先计薪" />
            </a-form-item>
          </a-form>
        </a-spin>
      </a-tab-pane>

      <!-- ── 外派课时 ── -->
      <a-tab-pane key="outing" tab="外派课时">
        <div class="toolbar">
          <a-button type="primary" @click="openCreateOuting">新建外派记录</a-button>
        </div>
        <a-form layout="inline" class="search-bar" @submit.prevent="onOutingSearch">
          <a-form-item>
            <a-input v-model:value="outingQuery.teacherId" placeholder="教师ID" allow-clear style="width: 120px" @press-enter="onOutingSearch" />
          </a-form-item>
          <a-form-item>
            <a-date-picker v-model:value="outingQuery.month" picker="month" value-format="YYYY-MM" placeholder="月份" style="width: 130px" />
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="outingQuery.status" placeholder="状态" allow-clear style="width: 120px">
              <a-select-option v-for="(label, key) in outingStatusLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
              <a-button :icon="h(ReloadOutlined)" @click="onOutingReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>

        <a-table
          :columns="outingColumns"
          :data-source="outings"
          :loading="outingLoading"
          :pagination="{ current: outingQuery.page, pageSize: outingQuery.pageSize, total: outingTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { outingQuery.page = p.current; outingQuery.pageSize = p.pageSize; loadOutings() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'outingDate'">
              {{ formatDate(record.outingDate) }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="outingStatusColor[record.status as string]">
                {{ outingStatusLabel[record.status as string] || record.status }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <template v-if="record.status === 'PENDING'">
                  <a @click="onConfirmOuting(record as OutingRecord)">确认</a>
                </template>
                <a @click="openEditOuting(record as OutingRecord)">编辑</a>
                <a class="danger" @click="onDeleteOuting(record as OutingRecord)">删除</a>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- ── 个税政策 ── -->
      <a-tab-pane key="tax-policy" tab="个税政策">
        <div class="toolbar">
          <a-button type="primary" @click="openCreateTax">新建个税政策</a-button>
          <a-checkbox v-model:checked="taxActiveOnly" @change="loadTaxPolicies">仅显示启用中</a-checkbox>
        </div>
        <a-table
          :columns="taxColumns"
          :data-source="taxPolicies"
          :loading="taxLoading"
          :pagination="{ current: taxPage, pageSize: taxPageSize, total: taxTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { taxPage = p.current; taxPageSize = p.pageSize; loadTaxPolicies() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space>
                <a @click="openEditTax(record as TaxPolicy)">编辑</a>
                <a class="danger" @click="onDeleteTax(record as TaxPolicy)">删除</a>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- ── 五险一金政策 ── -->
      <a-tab-pane key="insurance-policy" tab="五险一金政策">
        <div class="toolbar">
          <a-button type="primary" @click="openCreateIns">新建政策</a-button>
          <a-button @click="openImportIns">一键导入新版本</a-button>
        </div>
        <a-form layout="inline" class="search-bar" @submit.prevent="loadInsurancePolicies">
          <a-form-item>
            <a-select v-model:value="insCityFilter" placeholder="城市" allow-clear style="width: 160px">
              <a-select-option v-for="c in insCities" :key="c" :value="c">{{ c }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" html-type="submit">查询</a-button>
              <a-button @click="() => { insCityFilter = ''; insPage = 1; loadInsurancePolicies() }">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>
        <a-table
          :columns="insColumns"
          :data-source="insPolicies"
          :loading="insLoading"
          :pagination="{ current: insPage, pageSize: insPageSize, total: insTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { insPage = p.current; insPageSize = p.pageSize; loadInsurancePolicies() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space>
                <a @click="openEditIns(record as InsurancePolicy)">编辑</a>
                <a class="danger" @click="onDeleteIns(record as InsurancePolicy)">删除</a>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- ── 社保/个税设置 ── -->
      <a-tab-pane key="soc-tax" tab="社保/个税设置">
        <a-form layout="vertical" style="max-width: 520px">
          <a-form-item label="社保 + 个税 总开关">
            <a-switch :checked="deductEnabled" :loading="deductSaving" @change="onToggleDeduct" />
            <div class="form-tip">
              关闭时工资条不显示社保和个税，实发=应发；比例在「五险一金政策 / 个税政策」Tab 维护。只影响之后新生成/重算的工资条，历史不动。
            </div>
          </a-form-item>
        </a-form>
      </a-tab-pane>

      <!-- ── 工资条 ── -->
      <a-tab-pane key="slips" tab="工资条">
        <div class="toolbar">
          <a-date-picker v-model:value="slipGenMonth" picker="month" value-format="YYYY-MM" placeholder="生成月份" style="width: 140px" />
          <a-input v-model:value="slipGenTeacherId" placeholder="教师ID(可选)" allow-clear style="width: 120px" />
          <a-button type="primary" :loading="slipGenLoading" @click="onGenerateSlips">生成工资条</a-button>
          <a-button :loading="slipGenLoading" @click="onPreviewSlips">试算(不落库)</a-button>
          <a-button @click="onExportSlips">导出 Excel</a-button>
        </div>
        <a-form layout="inline" class="search-bar" @submit.prevent="onSlipSearch">
          <a-form-item>
            <a-date-picker v-model:value="slipQuery.month" picker="month" value-format="YYYY-MM" placeholder="月份" style="width: 130px" />
          </a-form-item>
          <a-form-item>
            <a-input v-model:value="slipQuery.teacherId" placeholder="教师ID" allow-clear style="width: 120px" @press-enter="onSlipSearch" />
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="slipQuery.status" placeholder="状态" allow-clear style="width: 120px">
              <a-select-option v-for="(label, key) in slipStatusLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" html-type="submit">查询</a-button>
              <a-button @click="onSlipReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>
        <a-table
          :columns="slipColumns"
          :data-source="slips"
          :loading="slipLoading"
          :pagination="{ current: slipQuery.page, pageSize: slipQuery.pageSize, total: slipTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { slipQuery.page = p.current; slipQuery.pageSize = p.pageSize; loadSlips() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="slipStatusColor[record.status as SlipStatus]">{{ slipStatusLabel[record.status as SlipStatus] }}</a-tag>
            </template>
            <template v-else-if="column.key === 'needsReview'">
              <a-tag v-if="record.needsReview" color="red">是</a-tag>
              <span v-else>-</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a @click="showSlipDetail(record as SalarySlip)">详情</a>
                <template v-if="record.status === 'PENDING'">
                  <a @click="onSlipStatus(record as SalarySlip, 'APPROVED')">确认</a>
                </template>
                <template v-else-if="record.status === 'APPROVED'">
                  <a @click="onSlipStatus(record as SalarySlip, 'PAID')">发放</a>
                </template>
                <template v-if="record.status !== 'PAID'">
                  <a @click="onSlipStatus(record as SalarySlip, 'PENDING')">重算</a>
                </template>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-alert
          v-if="slipPreviewResult"
          type="info"
          show-icon
          class="save-tip"
          :message="`${slipPreviewResult.month} 试算：${slipPreviewResult.teachers} 位教师，${slipPreviewResult.slips.length} 张工资条（生成后详情可查看五险一金/个税明细）`"
        />
      </a-tab-pane>

      <!-- ── 发放批次 ── -->
      <a-tab-pane key="payroll" tab="发放批次">
        <div class="toolbar">
          <a-button type="primary" @click="openCreatePayroll">创建发放批次</a-button>
        </div>
        <a-form layout="inline" class="search-bar" @submit.prevent="onPayrollSearch">
          <a-form-item>
            <a-date-picker v-model:value="payrollQuery.month" picker="month" value-format="YYYY-MM" placeholder="月份" style="width: 130px" />
          </a-form-item>
          <a-form-item>
            <a-select v-model:value="payrollQuery.status" placeholder="状态" allow-clear style="width: 130px">
              <a-select-option v-for="(label, key) in payrollStatusLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" html-type="submit">查询</a-button>
            </a-space>
          </a-form-item>
        </a-form>
        <a-table
          :columns="payrollColumns"
          :data-source="payrolls"
          :loading="payrollLoading"
          :pagination="{ current: payrollQuery.page, pageSize: payrollQuery.pageSize, total: payrollTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { payrollQuery.page = p.current; payrollQuery.pageSize = p.pageSize; loadPayrolls() }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="payrollStatusColor[record.status as PayrollStatus]">{{ payrollStatusLabel[record.status as PayrollStatus] }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <template v-if="record.status === 'DRAFT'">
                  <a @click="onPayrollStatus(record as SalaryPayroll, 'CONFIRMED')">确认</a>
                </template>
                <template v-else-if="record.status === 'CONFIRMED'">
                  <a @click="onPayrollStatus(record as SalaryPayroll, 'PAID')">发放</a>
                </template>
                <template v-if="record.status === 'DRAFT' || record.status === 'CONFIRMED'">
                  <a @click="onPayrollStatus(record as SalaryPayroll, 'CLOSED')">关闭</a>
                </template>
                <a :loading="payrollExportingId === record.id" @click="onExportPayroll(record as SalaryPayroll)">导出</a>
              </a-space>
            </template>
          </template>
        </a-table>
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

        <a-form-item label="津贴项（结算生成 ALLOWANCE 记录）">
          <div v-for="(item, idx) in ((ruleForm.config as any).allowances as any[]) || []" :key="idx" class="item-row">
            <a-select v-model:value="item.type" style="width: 130px">
              <a-select-option v-for="(label, key) in allowanceTypeLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
            <a-input v-model:value="item.name" placeholder="显示名称，如：通勤补贴" style="width: 180px" />
            <a-input-number v-model:value="item.amount" :min="0" placeholder="金额" style="width: 110px" />
            <a-button size="small" danger @click="removeRuleAllowance(idx)">删</a-button>
          </div>
          <a-button size="small" type="dashed" @click="addRuleAllowance">+ 添加津贴</a-button>
        </a-form-item>

        <a-form-item label="扣款项（结算生成 DEDUCTION 记录）">
          <div v-for="(item, idx) in ((ruleForm.config as any).deductions as any[]) || []" :key="idx" class="item-row">
            <a-select v-model:value="item.type" style="width: 130px">
              <a-select-option v-for="(label, key) in deductionTypeLabel" :key="key" :value="key">{{ label }}</a-select-option>
            </a-select>
            <a-input v-model:value="item.name" placeholder="显示名称，如：请假扣款" style="width: 180px" />
            <a-input-number v-model:value="item.amount" :min="0" placeholder="金额" style="width: 110px" />
            <a-button size="small" danger @click="removeRuleDeduction(idx)">删</a-button>
          </div>
          <a-button size="small" type="dashed" @click="addRuleDeduction">+ 添加扣款</a-button>
        </a-form-item>
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

    <!-- 外派记录弹窗 -->
    <a-modal
      v-model:open="outingModalVisible"
      :title="outingModalMode === 'create' ? '新建外派记录' : '编辑外派记录'"
      :width="520"
      @ok="onSubmitOuting"
    >
      <a-form :model="outingForm" layout="vertical">
        <a-form-item label="教师" required>
          <a-select
            v-model:value="outingForm.teacherId"
            show-search
            :filter-option="false"
            :loading="teachersLoading"
            placeholder="按姓名/手机号搜索"
            style="width: 100%"
            :not-found-content="null"
            @search="(kw: string) => searchTeachers(kw)"
            @dropdown-visible-change="(open: boolean) => open && searchTeachers()"
          >
            <a-select-option v-for="t in teachers" :key="t.id" :value="t.id">
              {{ t.name }}（{{ t.mobile || '无手机号' }}）
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="外派日期" required>
          <a-date-picker v-model:value="outingForm.outingDate" value-format="YYYY-MM-DD" style="width: 100%" placeholder="选择日期" />
        </a-form-item>
        <a-form-item label="外派地点">
          <a-input v-model:value="outingForm.location" placeholder="地点（可选）" />
        </a-form-item>
        <a-form-item label="外派课时数">
          <a-input-number v-model:value="outingForm.lessonCount" :min="1" style="width: 160px" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="outingForm.note" placeholder="备注（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 个税政策弹窗 -->
    <a-modal
      v-model:open="taxModalVisible"
      :title="taxModalMode === 'create' ? '新建个税政策' : '编辑个税政策'"
      :width="760"
      @ok="onSubmitTax"
    >
      <a-form :model="taxForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="政策名称" required>
              <a-input v-model:value="taxForm.name" placeholder="如：2026 年度综合所得月度税率表" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="起征点(元/月)">
              <a-input-number v-model:value="taxForm.taxThreshold" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="生效起始日" required>
              <a-date-picker v-model:value="taxForm.effectiveFrom" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="生效结束日（留空长期有效）">
              <a-date-picker v-model:value="taxForm.effectiveTo" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="月度税率表（按应税额区间，速算扣除数）">
          <div v-for="(b, idx) in taxForm.brackets" :key="idx" class="tier-row">
            <a-input-number v-model:value="b.min" :min="0" placeholder="应税额起" style="width: 100px" />
            <span class="tier-sep">~</span>
            <a-input-number v-model:value="b.max" placeholder="应税额止(留空不限)" style="width: 130px" />
            <span class="tier-sep">税率</span>
            <a-input-number v-model:value="b.rate" :min="0" :max="1" :step="0.01" :formatter="fmtPct" :parser="parsePct" style="width: 90px" />
            <span class="tier-sep">速算</span>
            <a-input-number v-model:value="b.quickDeduction" :min="0" style="width: 100px" />
            <a-button size="small" danger @click="removeTaxBracket(idx)">删</a-button>
          </div>
          <a-button size="small" type="dashed" @click="addTaxBracket">+ 添加档位</a-button>
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="taxForm.note" placeholder="备注（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 五险一金政策弹窗 -->
    <a-modal
      v-model:open="insModalVisible"
      :title="insModalMode === 'create' ? '新建五险一金政策' : '编辑五险一金政策'"
      :width="720"
      @ok="onSubmitIns"
    >
      <a-form :model="insForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="城市" required>
              <a-input v-model:value="insForm.city" placeholder="如：宁波" />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="政策名称" required>
              <a-input v-model:value="insForm.name" placeholder="如：宁波 2026 年度社保公积金默认" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="生效起始日" required>
              <a-date-picker v-model:value="insForm.effectiveFrom" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="生效结束日（留空长期有效）">
              <a-date-picker v-model:value="insForm.effectiveTo" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="默认基数">
              <a-input-number v-model:value="insForm.socialBase" :min="0" style="width: 100%" placeholder="估算基数" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="基数下限">
              <a-input-number v-model:value="insForm.socialBaseMin" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="基数上限">
              <a-input-number v-model:value="insForm.socialBaseMax" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="个人比例">
          <a-row :gutter="16">
            <a-col :span="6">
              <a-input-number v-model:value="insForm.ratios.pension" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="养老" style="width: 100%" />
            </a-col>
            <a-col :span="6">
              <a-input-number v-model:value="insForm.ratios.medical" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="医疗" style="width: 100%" />
            </a-col>
            <a-col :span="6">
              <a-input-number v-model:value="insForm.ratios.unemployment" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="失业" style="width: 100%" />
            </a-col>
            <a-col :span="6">
              <a-input-number v-model:value="insForm.ratios.housingFund" :min="0" :max="1" :step="0.005" :formatter="fmtPct" :parser="parsePct" placeholder="公积金" style="width: 100%" />
            </a-col>
          </a-row>
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="insForm.note" placeholder="备注（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 一键导入新版本弹窗 -->
    <a-modal
      v-model:open="insImportVisible"
      title="一键导入新版本"
      :width="460"
      :confirm-loading="insImportLoading"
      @ok="onSubmitImportIns"
    >
      <a-form layout="vertical">
        <a-form-item label="城市" required>
          <a-select v-model:value="insImportCity" placeholder="选择城市" style="width: 100%">
            <a-select-option v-for="c in insCities" :key="c" :value="c">{{ c }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="生效起始日（留空 = 次月 1 日）">
          <a-date-picker v-model:value="insImportEffectiveFrom" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-alert type="info" show-icon message="从内置种子库生成新版本，历史版本保留不覆盖。上线前请按当地人社局/公积金中心最新标准核校比例与基数。" />
      </a-form>
    </a-modal>

    <!-- 创建发放批次弹窗 -->
    <a-modal
      v-model:open="payrollModalVisible"
      title="创建发放批次"
      :width="460"
      :confirm-loading="payrollCreateLoading"
      @ok="onSubmitCreatePayroll"
    >
      <a-form layout="vertical">
        <a-form-item label="发放月份" required>
          <a-date-picker v-model:value="payrollMonth" picker="month" value-format="YYYY-MM" style="width: 100%" placeholder="选择月份" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="payrollNote" placeholder="备注（可选）" />
        </a-form-item>
        <a-alert type="info" show-icon message="创建后自动纳入该月全部已确认的待发放工资条。" />
      </a-form>
    </a-modal>

    <!-- 社保/个税总开关确认弹窗 -->
    <a-modal
      v-model:open="deductConfirmVisible"
      title="社保/个税总开关"
      :confirm-loading="deductSaving"
      @ok="onConfirmToggleDeduct"
    >
      <p>确认{{ deductEnabled ? '关闭' : '开启' }}社保和个税？</p>
      <p class="form-tip">{{ deductEnabled ? '关闭后工资条不再显示社保和个税，实发=应发。' : '开启后新生成/重算的工资条将展示社保和个税。' }}</p>
    </a-modal>

    <!-- 工资条详情抽屉 -->
    <a-drawer
      v-model:open="slipDetailVisible"
      title="工资条详情"
      :width="560"
    >
      <a-spin :spinning="slipDetailLoading">
        <template v-if="slipDetail">
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="教师">{{ slipDetail.teacherName || slipDetail.teacherId }}</a-descriptions-item>
            <a-descriptions-item label="月份">{{ slipDetail.month }}</a-descriptions-item>
            <a-descriptions-item label="应发">{{ formatMoney(slipDetail.grossAmount) }}</a-descriptions-item>
            <a-descriptions-item v-if="deductEnabled" label="五险一金">{{ formatMoney(slipDetail.socialAmount) }}</a-descriptions-item>
            <a-descriptions-item v-if="deductEnabled" label="个税">{{ formatMoney(slipDetail.taxAmount) }}</a-descriptions-item>
            <a-descriptions-item label="实发">{{ formatMoney(slipDetail.netAmount) }}</a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-tag :color="slipStatusColor[slipDetail.status as SlipStatus]">{{ slipStatusLabel[slipDetail.status as SlipStatus] }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="需复核">{{ slipDetail.needsReview ? '是' : '否' }}</a-descriptions-item>
            <a-descriptions-item label="备注">{{ slipDetail.notes || '-' }}</a-descriptions-item>
          </a-descriptions>
          <a-divider style="margin: 16px 0">计算明细（政策快照）</a-divider>
          <pre class="detail-pre">{{ JSON.stringify(slipDetail.detail, null, 2) }}</pre>
        </template>
      </a-spin>
    </a-drawer>
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
.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.profile-form {
  margin-top: 8px;
  max-width: 760px;
}
.save-tip {
  margin-top: 8px;
}
.form-tip {
  margin-top: 4px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.6;
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
.detail-pre {
  max-height: 360px;
  overflow: auto;
  background: #f6f8fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
}
</style>
