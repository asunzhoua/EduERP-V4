import { http } from '@/utils/request'

// ─── 类型 ───

export type SalaryRecordStatus = 'PENDING' | 'APPROVED' | 'PAID'
export type SalaryRecordSource =
  | 'LESSON_FEE'
  | 'BASE'
  | 'DAY'
  | 'BONUS'
  | 'ALLOWANCE'
  | 'DEDUCTION'
  | 'OUTING'

export interface SalaryRecord {
  id: number | string
  teacherId: number | string
  lessonId: number | string | null
  attendanceId: number | string | null
  salaryRuleId: number | string
  source: SalaryRecordSource
  month: string
  ruleVersion: string
  amount: number
  lessonDate: string | null
  duration: number | null
  studentCount: number | null
  needsReview: boolean
  status: SalaryRecordStatus
  notes: string | null
  createdBy: number | string
  createTime: string
}

export interface SalaryStatistics {
  year: number
  month: string
  monthNum: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  totalRecords: number
  recordCount: number
  teacherCount: number
  totalMinutes: number
}

export interface SalaryRecordQuery {
  teacherId?: number | string
  month?: string
  startDate?: string
  endDate?: string
  status?: SalaryRecordStatus
  source?: SalaryRecordSource
  page?: number
  pageSize?: number
}

export interface PaginatedRecords {
  records: SalaryRecord[]
  total: number
  page: number
  pageSize: number
}

export interface TierConfig {
  min: number
  max: number | null
  pricePerLesson?: number
  pricePerHead?: number
}

export interface BonusConfig {
  fullAttendance?: number
  lessonTarget?: { threshold?: number; amount?: number }
}

/** 津贴项：{ type, name, amount }（COMMUTING/HOUSING/HIGH_TEMP/OTHER） */
export interface AllowanceItem {
  type: 'COMMUTING' | 'HOUSING' | 'HIGH_TEMP' | 'OTHER'
  name: string
  amount: number
}

/** 扣款项：{ type, name, amount }（LEAVE/OTHER） */
export interface DeductionItem {
  type: 'LEAVE' | 'OTHER'
  name: string
  amount: number
}

export interface SalaryRuleConfig {
  lessonPrice?: number
  pricePerHead?: number
  headcountTiers?: TierConfig[]
  lessonTiers?: TierConfig[]
  baseSalary?: number
  minLessonForBase?: number
  bonus?: BonusConfig
  allowances?: AllowanceItem[]
  deductions?: DeductionItem[]
  effectiveFrom?: string
  effectiveTo?: string
}

export interface SalaryRule {
  id: number | string
  name: string
  type: string
  baseAmount: number
  multiplier: number
  courseType: string | null
  teacherLevel: string | null
  isActive: boolean
  config: SalaryRuleConfig | null
  note: string | null
  createdBy: number | string
  createTime: string
  updateTime: string
}

export interface CreateSalaryRuleDto {
  name: string
  type: string
  baseAmount: number
  multiplier?: number
  courseType?: string
  teacherLevel?: string
  isActive?: boolean
  config?: SalaryRuleConfig
  note?: string
}

// ─── 教师薪资档案 ───

export type TeacherEmploymentType = 'FULL_TIME' | 'PART_TIME' | 'OUTER'

export interface TeacherSalaryProfile {
  id: number | string
  teacherId: number | string
  employmentType: TeacherEmploymentType
  ruleType: string
  salaryConfig: SalaryRuleConfig | null
  allowances: AllowanceItem[] | null
  deductions: DeductionItem[] | null
  city: string | null
  socialBase: number | null
  socialRatios: Record<string, number> | null
  taxSpecialDeductions: { type?: string; amount?: number }[] | null
  effectiveFrom: string | null
  effectiveTo: string | null
  isActive: boolean
  note: string | null
  createdBy: number | string
  createTime: string
  updatedBy: number | string | null
  updateTime: string
}

export interface UpsertTeacherSalaryProfileDto {
  employmentType: string
  ruleType: string
  salaryConfig?: SalaryRuleConfig
  allowances?: AllowanceItem[]
  deductions?: DeductionItem[]
  city?: string
  socialBase?: number
  socialRatios?: Record<string, number>
  taxSpecialDeductions?: { type?: string; amount?: number }[]
  effectiveFrom?: string
  effectiveTo?: string
  isActive?: boolean
  note?: string
}

export interface SalaryTeacher {
  id: number | string
  name: string
  mobile: string
  teacherLevel: string | null
  status: number
  createTime: string
}

export interface PaginatedTeachers {
  items: SalaryTeacher[]
  total: number
  page: number
  pageSize: number
}

// ─── 外派课时记录 ───

export type OutingRecordStatus = 'PENDING' | 'CONFIRMED'

export interface OutingRecord {
  id: number | string
  teacherId: number | string
  outingDate: string
  location: string | null
  lessonCount: number
  note: string | null
  status: OutingRecordStatus
  createdBy: number | string
  createTime: string
  updatedBy: number | string | null
  updateTime: string
}

export interface CreateOutingRecordDto {
  teacherId: number | string
  outingDate: string
  location?: string
  lessonCount?: number
  note?: string
}

export interface UpdateOutingRecordDto {
  teacherId?: number | string
  outingDate?: string
  location?: string
  lessonCount?: number
  note?: string
}

export interface PaginatedOutings {
  records: OutingRecord[]
  total: number
  page: number
  pageSize: number
}

export interface SettleResult {
  month: string
  teacherId?: number
  teachers: number
  lessons: number
  created: number
  skipped: number
  summary: { source: string; count: number; amount: number }[]
}

// ─── 接口 ───

export function fetchSalaryRecords(query: SalaryRecordQuery = {}): Promise<PaginatedRecords> {
  return http.get<PaginatedRecords>('/salary/records', { params: query })
}

export function updateSalaryRecordStatus(
  id: number | string,
  status: SalaryRecordStatus,
  notes?: string,
): Promise<SalaryRecord> {
  return http.put<SalaryRecord>(`/salary/records/${id}/status`, { status, notes })
}

export function fetchSalaryStatistics(query: { year?: number; month?: number } = {}): Promise<SalaryStatistics> {
  return http.get<SalaryStatistics>('/salary/statistics', { params: query })
}

export function settleSalary(month: string, teacherId?: number | string): Promise<SettleResult> {
  return http.post<SettleResult>('/salary/settle', { month, teacherId })
}

export function fetchSalaryRules(activeOnly = true): Promise<SalaryRule[]> {
  return http.get<SalaryRule[]>('/salary/rules', { params: { activeOnly } })
}

export function fetchSalaryRule(id: number | string): Promise<SalaryRule> {
  return http.get<SalaryRule>(`/salary/rules/${id}`)
}

export function createSalaryRule(dto: CreateSalaryRuleDto): Promise<SalaryRule> {
  return http.post<SalaryRule>('/salary/rules', dto)
}

export function updateSalaryRule(id: number | string, dto: Partial<CreateSalaryRuleDto>): Promise<SalaryRule> {
  return http.put<SalaryRule>(`/salary/rules/${id}`, dto)
}

export function deleteSalaryRule(id: number | string): Promise<void> {
  return http.delete<void>(`/salary/rules/${id}`)
}

// ─── 教师薪资档案 ───

export function fetchSalaryTeachers(
  query: { keyword?: string; page?: number; pageSize?: number } = {},
): Promise<PaginatedTeachers> {
  return http.get<PaginatedTeachers>('/salary/teachers', { params: query })
}

export function fetchTeacherSalaryProfile(
  teacherId: number | string,
): Promise<TeacherSalaryProfile | null> {
  return http.get<TeacherSalaryProfile | null>(`/salary/teachers/${teacherId}/profile`)
}

export function upsertTeacherSalaryProfile(
  teacherId: number | string,
  dto: UpsertTeacherSalaryProfileDto,
): Promise<TeacherSalaryProfile> {
  return http.put<TeacherSalaryProfile>(`/salary/teachers/${teacherId}/profile`, dto)
}

// ─── 外派课时记录 ───

export function fetchOutingRecords(
  query: {
    teacherId?: number | string
    month?: string
    status?: string
    page?: number
    pageSize?: number
  } = {},
): Promise<PaginatedOutings> {
  return http.get<PaginatedOutings>('/salary/outing', { params: query })
}

export function createOutingRecord(dto: CreateOutingRecordDto): Promise<OutingRecord> {
  return http.post<OutingRecord>('/salary/outing', dto)
}

export function updateOutingRecord(
  id: number | string,
  dto: UpdateOutingRecordDto,
): Promise<OutingRecord> {
  return http.put<OutingRecord>(`/salary/outing/${id}`, dto)
}

export function updateOutingRecordStatus(
  id: number | string,
  status: OutingRecordStatus,
): Promise<OutingRecord> {
  return http.put<OutingRecord>(`/salary/outing/${id}/status`, { status })
}

export function deleteOutingRecord(id: number | string): Promise<void> {
  return http.delete<void>(`/salary/outing/${id}`)
}

// ─── 个税政策（P2） ───

export interface TaxBracket {
  min: number
  max: number | null
  rate: number
  quickDeduction: number
}

export interface TaxPolicy {
  id: number | string
  name: string
  effectiveFrom: string
  effectiveTo: string | null
  taxThreshold: number
  brackets: TaxBracket[] | null
  note: string | null
  createdBy: number | string
  createTime: string
  updatedBy: number | string | null
  updateTime: string
}

export interface CreateTaxPolicyDto {
  name: string
  effectiveFrom: string
  effectiveTo?: string
  taxThreshold?: number
  brackets?: TaxBracket[]
  note?: string
}

export interface QueryTaxPolicyDto {
  activeOnly?: boolean
  page?: number
  pageSize?: number
}

export interface PaginatedTaxPolicies {
  items: TaxPolicy[]
  total: number
  page: number
  pageSize: number
}

export function fetchTaxPolicies(
  query: QueryTaxPolicyDto = {},
): Promise<PaginatedTaxPolicies> {
  return http.get<PaginatedTaxPolicies>('/salary/tax-policy', { params: query })
}

export function createTaxPolicy(dto: CreateTaxPolicyDto): Promise<TaxPolicy> {
  return http.post<TaxPolicy>('/salary/tax-policy', dto)
}

export function updateTaxPolicy(
  id: number | string,
  dto: Partial<CreateTaxPolicyDto>,
): Promise<TaxPolicy> {
  return http.put<TaxPolicy>(`/salary/tax-policy/${id}`, dto)
}

export function deleteTaxPolicy(id: number | string): Promise<void> {
  return http.delete<void>(`/salary/tax-policy/${id}`)
}

// ─── 五险一金政策（P3） ───

export interface InsurancePolicy {
  id: number | string
  city: string
  name: string
  effectiveFrom: string
  effectiveTo: string | null
  socialBaseMin: number | null
  socialBaseMax: number | null
  socialBase: number | null
  ratios: Record<string, number> | null
  employerRatios: Record<string, number> | null
  note: string | null
  createdBy: number | string
  createTime: string
  updatedBy: number | string | null
  updateTime: string
}

export interface CreateInsurancePolicyDto {
  city: string
  name: string
  effectiveFrom: string
  effectiveTo?: string
  socialBaseMin?: number
  socialBaseMax?: number
  socialBase?: number
  ratios?: Record<string, number>
  employerRatios?: Record<string, number>
  note?: string
}

export interface QueryInsurancePolicyDto {
  city?: string
  activeOnly?: boolean
  page?: number
  pageSize?: number
}

export interface PaginatedInsurancePolicies {
  items: InsurancePolicy[]
  total: number
  page: number
  pageSize: number
}

export function fetchInsurancePolicies(
  query: QueryInsurancePolicyDto = {},
): Promise<PaginatedInsurancePolicies> {
  return http.get<PaginatedInsurancePolicies>('/salary/insurance-policy', {
    params: query,
  })
}

export function createInsurancePolicy(
  dto: CreateInsurancePolicyDto,
): Promise<InsurancePolicy> {
  return http.post<InsurancePolicy>('/salary/insurance-policy', dto)
}

export function updateInsurancePolicy(
  id: number | string,
  dto: Partial<CreateInsurancePolicyDto>,
): Promise<InsurancePolicy> {
  return http.put<InsurancePolicy>(`/salary/insurance-policy/${id}`, dto)
}

export function deleteInsurancePolicy(id: number | string): Promise<void> {
  return http.delete<void>(`/salary/insurance-policy/${id}`)
}

export function importInsurancePolicy(dto: {
  city: string
  effectiveFrom?: string
}): Promise<InsurancePolicy> {
  return http.post<InsurancePolicy>('/salary/insurance-policy/import', dto)
}

export function fetchInsuranceCities(): Promise<string[]> {
  return http.get<string[]>('/salary/insurance-policy/cities')
}

// ─── 工资条（P2） ───

export type SlipStatus = 'PENDING' | 'APPROVED' | 'PAID'

export interface SalarySlip {
  id: number | string
  teacherId: number | string
  month: string
  grossAmount: number
  socialAmount: number
  taxAmount: number
  netAmount: number
  detail: Record<string, any> | null
  status: SlipStatus
  needsReview: boolean
  notes: string | null
  teacherName?: string | null
  createdBy: number | string
  createTime: string
}

export interface SlipPreviewItem {
  teacherId: number
  teacherName?: string
  grossAmount: number
  socialAmount: number
  taxAmount: number
  netAmount: number
  needsReview: boolean
  notes: string[]
  detail: Record<string, any>
}

export interface SlipGenerateResult {
  month: string
  teacherId?: number
  teachers: number
  generated: number
  skipped: number
  slips: SlipPreviewItem[]
}

export interface SlipPreviewResult {
  month: string
  teacherId?: number
  teachers: number
  slips: SlipPreviewItem[]
}

export interface QuerySlipsDto {
  month?: string
  teacherId?: number
  status?: SlipStatus
  page?: number
  pageSize?: number
}

export interface PaginatedSlips {
  slips: SalarySlip[]
  total: number
  page: number
  pageSize: number
}

export function fetchSalarySlips(query: QuerySlipsDto = {}): Promise<PaginatedSlips> {
  return http.get<PaginatedSlips>('/salary/slips', { params: query })
}

export function fetchSalarySlip(id: number | string): Promise<SalarySlip> {
  return http.get<SalarySlip>(`/salary/slips/${id}`)
}

export function generateSalarySlips(dto: {
  month: string
  teacherId?: number
}): Promise<SlipGenerateResult> {
  return http.post<SlipGenerateResult>('/salary/slips/generate', dto)
}

export function previewSalarySlips(dto: {
  month: string
  teacherId?: number
}): Promise<SlipPreviewResult> {
  return http.post<SlipPreviewResult>('/salary/slips/preview', dto)
}

export function updateSlipStatus(
  id: number | string,
  status: SlipStatus,
  notes?: string,
): Promise<SalarySlip> {
  return http.put<SalarySlip>(`/salary/slips/${id}/status`, { status, notes })
}

// ─── 发放批次（P3） ───

export type PayrollStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CLOSED'

export interface SalaryPayroll {
  id: number | string
  month: string
  batchNo: string
  totalAmount: number
  status: PayrollStatus
  detail: {
    slipIds: number[]
    slipCount: number
    teacherCount: number
  } | null
  note: string | null
  createdBy: number | string
  createTime: string
}

export interface CreatePayrollDto {
  month: string
  slipIds?: number[]
  note?: string
}

export interface QueryPayrollDto {
  month?: string
  status?: PayrollStatus
  page?: number
  pageSize?: number
}

export interface PaginatedPayrolls {
  items: SalaryPayroll[]
  total: number
  page: number
  pageSize: number
}

export function fetchPayrolls(query: QueryPayrollDto = {}): Promise<PaginatedPayrolls> {
  return http.get<PaginatedPayrolls>('/salary/payroll', { params: query })
}

export function fetchPayroll(id: number | string): Promise<SalaryPayroll> {
  return http.get<SalaryPayroll>(`/salary/payroll/${id}`)
}

export function createPayroll(dto: CreatePayrollDto): Promise<SalaryPayroll> {
  return http.post<SalaryPayroll>('/salary/payroll', dto)
}

export function updatePayrollStatus(
  id: number | string,
  status: PayrollStatus,
): Promise<SalaryPayroll> {
  return http.put<SalaryPayroll>(`/salary/payroll/${id}/status`, { status })
}
