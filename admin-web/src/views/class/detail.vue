<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { ArrowLeftOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import {
  fetchClass,
  fetchClassTeachers,
  assignClassTeacher,
  removeClassTeacher,
  fetchClassStudents,
  generateClassLessons,
  type ClassItem,
  type TeacherAssignment,
  type ClassStudent,
  type TeacherRole,
  type BatchGenerateResult,
} from '@/api/class'
import { fetchTeachers, type Teacher } from '@/api/teacher'
import {
  fetchClassLessons,
  startLesson,
  completeLesson,
  confirmLesson,
  confirmLessonAttendance,
  cancelLesson,
  createLesson,
  type Lesson,
  type LessonStatus,
} from '@/api/lesson'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const cls = ref<ClassItem | null>(null)
const teachers = ref<TeacherAssignment[]>([])
const students = ref<ClassStudent[]>([])
const lessons = ref<Lesson[]>([])
const teacherOptions = ref<Teacher[]>([])

const classStatusLabel: Record<string, string> = { DRAFT: '草稿', ACTIVE: '进行中', COMPLETED: '已完成', CANCELLED: '已取消' }
const classStatusColor: Record<string, string> = { DRAFT: 'default', ACTIVE: 'green', COMPLETED: 'blue', CANCELLED: 'red' }

const lessonStatusLabel: Record<LessonStatus, string> = {
  DRAFT: '草稿',
  SCHEDULED: '待上课',
  TEACHING: '进行中',
  FINISHED: '已完成',
  ARCHIVED: '已归档',
  CANCELLED: '已取消',
  SUSPENDED: '已停课',
  RESCHEDULED: '已改期',
  MAKEUP_PENDING: '待补课',
  MAKEUP_COMPLETED: '补课完成',
}
const lessonStatusColor: Record<LessonStatus, string> = {
  DRAFT: 'default',
  SCHEDULED: 'blue',
  TEACHING: 'processing',
  FINISHED: 'green',
  ARCHIVED: 'cyan',
  CANCELLED: 'default',
  SUSPENDED: 'orange',
  RESCHEDULED: 'purple',
  MAKEUP_PENDING: 'gold',
  MAKEUP_COMPLETED: 'green',
}
const sourceLabel: Record<string, string> = {
  ADMIN_BATCH: '一键排课',
  ADMIN_MANUAL: '手动创建',
  TEACHER_MANUAL: '教师端',
}
const roleLabel: Record<TeacherRole, string> = { PRIMARY: '主教师', ASSISTANT: '助教' }

function dayOfWeekText(days: number[]): string {
  if (!days || !days.length) return '-'
  const map = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return days.map(d => map[d - 1] || '').filter(Boolean).join('、')
}

const nonCancelledLessons = () => lessons.value.filter(l => l.status !== 'CANCELLED').length

async function loadAll() {
  const code = route.params.code as string
  if (!code) return
  loading.value = true
  try {
    const [c, t, s, l] = await Promise.all([
      fetchClass(code),
      fetchClassTeachers(code),
      fetchClassStudents(code),
      fetchClassLessons(code),
    ])
    cls.value = c
    const nameMap = new Map(teacherOptions.value.map(x => [String(x.id), x.name]))
    teachers.value = t.map(ta => ({ ...ta, teacherName: nameMap.get(String(ta.teacherId)) || `#${ta.teacherId}` }))
    students.value = s
    lessons.value = l
  } catch (e) {
    message.error((e as Error).message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadTeacherOptions() {
  try {
    const res = await fetchTeachers({ pageSize: 100 })
    teacherOptions.value = res.items
  } catch (e) {
    message.error((e as Error).message || '教师列表加载失败')
  }
}

function goBack() {
  router.push('/classes')
}

// ─── 教师分配 ───

const assignOpen = ref(false)
const assignLoading = ref(false)
const assignForm = reactive({ teacherId: undefined as number | undefined, role: 'PRIMARY' as TeacherRole, reason: '' })

function openAssign() {
  assignForm.teacherId = undefined
  assignForm.role = 'PRIMARY'
  assignForm.reason = ''
  assignOpen.value = true
}

async function submitAssign() {
  if (!cls.value) return
  if (!assignForm.teacherId) {
    message.warning('请选择教师')
    return
  }
  assignLoading.value = true
  try {
    await assignClassTeacher(cls.value.classCode, assignForm.teacherId, assignForm.role, assignForm.reason || undefined)
    message.success('教师已分配')
    assignOpen.value = false
    loadAll()
  } catch (e) {
    message.error((e as Error).message || '分配失败')
  } finally {
    assignLoading.value = false
  }
}

function onRemoveTeacher(row: TeacherAssignment) {
  if (!cls.value) return
  Modal.confirm({
    title: '解除教师分配？',
    content: `确认解除 ${row.teacherName || '该教师'} 的分配？`,
    okText: '确认解除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await removeClassTeacher(cls.value!.classCode, row.id)
        message.success('已解除分配')
        loadAll()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

// ─── 一键排课 ───

const batchForm = reactive({ startDate: '', count: undefined as number | undefined, checkConflict: true })
const batchLoading = ref(false)
const batchResult = ref<BatchGenerateResult | null>(null)

async function submitBatch() {
  if (!cls.value) return
  if (!batchForm.startDate) {
    message.warning('请选择起始日期')
    return
  }
  batchLoading.value = true
  batchResult.value = null
  try {
    batchResult.value = await generateClassLessons(cls.value.classCode, {
      startDate: batchForm.startDate,
      count: batchForm.count || undefined,
      checkConflict: batchForm.checkConflict,
    })
    message.success('排课完成')
    loadAll()
  } catch (e) {
    message.error((e as Error).message || '排课失败')
  } finally {
    batchLoading.value = false
  }
}

// ─── 手动创建课时 ───

const createLoading = ref(false)
const createForm = reactive({ lessonDate: '', startTime: '', endTime: '', topic: '' })

async function submitCreate() {
  if (!cls.value) return
  if (!createForm.lessonDate) {
    message.warning('请选择上课日期')
    return
  }
  if (!createForm.startTime || !createForm.endTime) {
    message.warning('请选择上课时间')
    return
  }
  createLoading.value = true
  try {
    await createLesson({
      classCode: cls.value.classCode,
      lessonDate: createForm.lessonDate,
      startTime: createForm.startTime,
      endTime: createForm.endTime,
      topic: createForm.topic || undefined,
    })
    message.success('课时已创建')
    createForm.lessonDate = ''
    createForm.startTime = ''
    createForm.endTime = ''
    createForm.topic = ''
    loadAll()
  } catch (e) {
    message.error((e as Error).message || '创建失败')
  } finally {
    createLoading.value = false
  }
}

// ─── 课时操作 ───

function onStart(row: Lesson) {
  Modal.confirm({
    title: '确认开始上课？',
    content: `第 ${row.lessonNumber} 次课即将开始。`,
    okText: '确认开始',
    cancelText: '取消',
    onOk: async () => {
      try {
        await startLesson(row.classCode, row.lessonNumber)
        message.success('已开始上课')
        loadAll()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onComplete(row: Lesson) {
  Modal.confirm({
    title: '确认完成本次课？',
    content: `第 ${row.lessonNumber} 次课将标记为已完成。`,
    okText: '确认完成',
    cancelText: '取消',
    onOk: async () => {
      try {
        await completeLesson(row.classCode, row.lessonNumber)
        message.success('已完成本次课')
        loadAll()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onConfirm(row: Lesson) {
  Modal.confirm({
    title: '确认归档本次课？',
    content: `第 ${row.lessonNumber} 次课将归档确认（扣减课时）。`,
    okText: '确认归档',
    cancelText: '取消',
    onOk: async () => {
      try {
        await confirmLesson(row.classCode, row.lessonNumber)
        message.success('已归档确认')
        loadAll()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

function onConfirmAttendance(row: Lesson) {
  Modal.confirm({
    title: '确认本次课考勤？',
    content: `第 ${row.lessonNumber} 次课的考勤记录将确认（仅管理员可操作）。`,
    okText: '确认考勤',
    cancelText: '取消',
    onOk: async () => {
      try {
        const confirmed = await confirmLessonAttendance(row.id)
        message.success(`已确认 ${confirmed.length} 条考勤`)
        loadAll()
      } catch (e) {
        message.error((e as Error).message || '操作失败')
      }
    },
  })
}

const cancelOpen = ref(false)
const cancelLoading = ref(false)
const cancelTarget = ref<Lesson | null>(null)
const cancelReason = ref('')

function openCancel(row: Lesson) {
  cancelTarget.value = row
  cancelReason.value = ''
  cancelOpen.value = true
}

async function submitCancel() {
  if (!cancelReason.value.trim()) {
    message.warning('请输入取消原因')
    return
  }
  if (!cancelTarget.value) return
  cancelLoading.value = true
  try {
    await cancelLesson(cancelTarget.value.classCode, cancelTarget.value.lessonNumber, cancelReason.value)
    message.success('已取消本次课')
    cancelOpen.value = false
    loadAll()
  } catch (e) {
    message.error((e as Error).message || '操作失败')
  } finally {
    cancelLoading.value = false
  }
}

onMounted(async () => {
  await loadTeacherOptions()
  loadAll()
})
</script>

<template>
  <a-card :bordered="false" :loading="loading">
    <a-space class="detail-header">
      <a-button :icon="h(ArrowLeftOutlined)" @click="goBack">返回</a-button>
      <h2 style="margin: 0">{{ cls?.name || '班级详情' }}</h2>
      <a-tag v-if="cls" :color="classStatusColor[cls.status]">{{ classStatusLabel[cls.status] || cls.status }}</a-tag>
      <a-tag v-if="cls" color="geekblue">{{ cls.classCode }}</a-tag>
    </a-space>

    <a-tabs v-if="cls" style="margin-top: 8px">
      <a-tab-pane key="info" tab="基本信息">
        <a-descriptions bordered :column="3" size="small">
          <a-descriptions-item label="班级编号">{{ cls.classCode }}</a-descriptions-item>
          <a-descriptions-item label="课程">{{ cls.courseName || cls.courseCode }}</a-descriptions-item>
          <a-descriptions-item label="状态">{{ classStatusLabel[cls.status] || cls.status }}</a-descriptions-item>
          <a-descriptions-item label="开课日期">{{ formatDate(cls.startDate) }}</a-descriptions-item>
          <a-descriptions-item label="上课安排">{{ dayOfWeekText(cls.dayOfWeek) }} {{ cls.startTime }}-{{ cls.endTime }}</a-descriptions-item>
          <a-descriptions-item label="总课时">{{ cls.totalLessons }}</a-descriptions-item>
          <a-descriptions-item label="已排/已上">{{ nonCancelledLessons() }}/{{ cls.completedLessons || 0 }}</a-descriptions-item>
          <a-descriptions-item label="学员数">{{ cls.currentStudents }}/{{ cls.maxStudents || '-' }}</a-descriptions-item>
          <a-descriptions-item label="教室">{{ cls.room || '-' }}</a-descriptions-item>
          <a-descriptions-item label="备注" :span="3">{{ cls.note || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-tab-pane>

      <a-tab-pane key="teachers" tab="教师分配">
        <div class="tab-actions">
          <a-button type="primary" ghost :icon="h(PlusOutlined)" @click="openAssign">分配老师</a-button>
        </div>
        <a-table :data-source="teachers" :pagination="false" row-key="id" size="small">
          <a-table-column title="教师" data-index="teacherName" key="teacherName" width="140" />
          <a-table-column title="角色" data-index="role" key="role" width="100">
            <template #default="{ record }">
              <a-tag :color="record.role === 'PRIMARY' ? 'blue' : 'default'">{{ roleLabel[record.role as TeacherRole] || record.role }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="生效日期" data-index="effectiveFrom" key="effectiveFrom" width="120">
            <template #default="{ record }">{{ formatDate(record.effectiveFrom) }}</template>
          </a-table-column>
          <a-table-column title="分配原因" data-index="reason" key="reason" />
          <a-table-column title="操作" key="action" width="90">
            <template #default="{ record }">
              <a :style="{ color: '#ff4d4f' }" @click="onRemoveTeacher(record)">解除</a>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="lessons" tab="课时排课">
        <a-row :gutter="16" style="margin-bottom: 16px">
          <a-col :span="10">
            <a-card size="small" title="一键排课" :bordered="true">
              <a-form layout="vertical" style="margin-bottom: 0">
                <a-form-item label="起始日期" required>
                  <a-date-picker v-model:value="batchForm.startDate" value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="(d: any) => d && d.valueOf() < new Date(new Date().setHours(0,0,0,0)).valueOf() - 86400000" />
                </a-form-item>
                <a-form-item label="生成数量（留空=按剩余课时全量）">
                  <a-input-number v-model:value="batchForm.count" :min="1" style="width: 100%" />
                </a-form-item>
                <a-form-item>
                  <a-checkbox v-model:checked="batchForm.checkConflict">检测教师时间冲突</a-checkbox>
                </a-form-item>
                <a-form-item style="margin-bottom: 0">
                  <a-button type="primary" :icon="h(ThunderboltOutlined)" :loading="batchLoading" @click="submitBatch">开始排课</a-button>
                </a-form-item>
              </a-form>
              <a-alert
                v-if="batchResult"
                style="margin-top: 12px"
                :type="batchResult.generated > 0 ? 'success' : 'info'"
                show-icon
                :message="batchResult.message"
                :description="batchResult.conflicts.length ? '教师时间冲突：' + batchResult.conflicts.map(c => `${c.date} ${c.startTime}-${c.endTime}（${c.reason}）`).join('；') : ''"
              />
            </a-card>
          </a-col>
          <a-col :span="6">
            <a-card size="small" title="手动创建课时" :bordered="true">
              <a-space direction="vertical" style="width: 100%">
                <a-date-picker v-model:value="createForm.lessonDate" value-format="YYYY-MM-DD" placeholder="上课日期" style="width: 100%" />
                <a-space style="width: 100%">
                  <a-time-picker v-model:value="createForm.startTime" value-format="HH:mm" placeholder="开始" style="width: 100%" />
                  <a-time-picker v-model:value="createForm.endTime" value-format="HH:mm" placeholder="结束" style="width: 100%" />
                </a-space>
                <a-input v-model:value="createForm.topic" placeholder="主题（可选）" />
                <a-button type="primary" ghost :icon="h(PlusOutlined)" :loading="createLoading" @click="submitCreate">创建课时</a-button>
              </a-space>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card size="small" title="排课提示" :bordered="true">
              <ul style="padding-left: 16px; margin: 0; color: rgba(0,0,0,0.65)">
                <li>仅「进行中」班级可一键排课</li>
                <li>按班级上课星期（{{ dayOfWeekText(cls.dayOfWeek) }}）自动续号生成</li>
                <li>已排时段自动跳过，不重复生成</li>
                <li>课时严格由管理员/后台管理页面分配</li>
              </ul>
            </a-card>
          </a-col>
        </a-row>

        <a-table
          :data-source="lessons"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 节` }"
          row-key="id"
          size="small"
        >
          <a-table-column title="课次" data-index="lessonNumber" key="lessonNumber" width="70" />
          <a-table-column title="日期" data-index="scheduledDate" key="scheduledDate" width="110">
            <template #default="{ record }">{{ formatDate(record.scheduledDate) }}</template>
          </a-table-column>
          <a-table-column title="时间" key="time" width="130">
            <template #default="{ record }">{{ record.startTime }}-{{ record.endTime }}</template>
          </a-table-column>
          <a-table-column title="主题" data-index="topic" key="topic" ellipsis>
            <template #default="{ record }">{{ record.topic || '-' }}</template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" key="status" width="90">
            <template #default="{ record }">
              <a-tag :color="lessonStatusColor[record.status as LessonStatus]">{{ lessonStatusLabel[record.status as LessonStatus] || record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="来源" data-index="source" key="source" width="90">
            <template #default="{ record }">{{ sourceLabel[record.source] || record.source || '-' }}</template>
          </a-table-column>
          <a-table-column title="操作" key="action" width="270">
            <template #default="{ record }">
              <a-space>
                <a v-if="record.status === 'SCHEDULED'" @click="onStart(record)">开始</a>
                <a v-if="record.status === 'TEACHING'" @click="onComplete(record)">完成</a>
                <a v-if="['TEACHING', 'FINISHED'].includes(record.status)" @click="onConfirmAttendance(record)">确认考勤</a>
                <a v-if="record.status === 'FINISHED'" @click="onConfirm(record)">归档</a>
                <a
                  v-if="['SCHEDULED', 'TEACHING'].includes(record.status)"
                  :style="{ color: '#ff4d4f' }"
                  @click="openCancel(record)"
                >取消</a>
              </a-space>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

      <a-tab-pane key="students" tab="学员列表">
        <a-table :data-source="students" :pagination="false" row-key="enrollmentId" size="small">
          <a-table-column title="学号" data-index="studentCode" key="studentCode" width="140" />
          <a-table-column title="姓名" data-index="name" key="name" width="120" />
          <a-table-column title="性别" data-index="gender" key="gender" width="80">
            <template #default="{ record }">{{ record.gender === 'MALE' ? '男' : record.gender === 'FEMALE' ? '女' : '-' }}</template>
          </a-table-column>
          <a-table-column title="联系电话" data-index="phone" key="phone" width="130" />
          <a-table-column title="学校" data-index="school" key="school" />
          <a-table-column title="年级" data-index="grade" key="grade" width="100" />
          <a-table-column title="报名时间" data-index="enrolledAt" key="enrolledAt" width="120">
            <template #default="{ record }">{{ formatDate(record.enrolledAt) }}</template>
          </a-table-column>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <!-- 分配老师 -->
    <a-modal v-model:open="assignOpen" title="分配老师" :confirm-loading="assignLoading" ok-text="确认分配" cancel-text="取消" @ok="submitAssign">
      <a-form layout="vertical">
        <a-form-item label="教师" required>
          <a-select v-model:value="assignForm.teacherId" placeholder="请选择教师" style="width: 100%" show-search option-filter-prop="label">
            <a-select-option v-for="t in teacherOptions" :key="String(t.id)" :value="Number(t.id)" :label="`${t.name}（${t.username}）`">
              {{ t.name }}（{{ t.username }}）
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="角色" required>
          <a-radio-group v-model:value="assignForm.role">
            <a-radio value="PRIMARY">主教师</a-radio>
            <a-radio value="ASSISTANT">助教</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="分配原因">
          <a-textarea v-model:value="assignForm.reason" :rows="2" placeholder="分配原因（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 取消课时 -->
    <a-modal v-model:open="cancelOpen" title="取消课时" :confirm-loading="cancelLoading" ok-text="确认取消" cancel-text="关闭" @ok="submitCancel">
      <a-form layout="vertical">
        <a-form-item label="取消原因" required>
          <a-textarea v-model:value="cancelReason" :rows="3" placeholder="请输入取消原因" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<style scoped>
.detail-header {
  margin-bottom: 8px;
}
.tab-actions {
  margin-bottom: 12px;
}
</style>
