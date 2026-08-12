<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  fetchInstitutionMetrics,
  fetchAttendanceStatistics,
  fetchConsumptionStatistics,
  type AttendanceStatistics,
  type ConsumptionStatistics,
  type MetricItem,
} from '@/api/analytics'
import { formatDate, formatNumber } from '@/utils/format'
import { ensureSubjectsLoaded, subjectName } from '@/utils/subjectCatalog'

const metricsLoading = ref(false)
const attendanceLoading = ref(false)
const consumptionLoading = ref(false)

const metrics = ref<MetricItem[]>([])
const attendance = ref<AttendanceStatistics>({
  totalRecords: 0,
  presentCount: 0,
  absentCount: 0,
  leaveCount: 0,
  lateCount: 0,
  attendanceRate: 0,
  byDate: [],
  byCourse: [],
})
const consumption = ref<ConsumptionStatistics>({
  totalConsumed: 0,
  totalRemaining: 0,
  totalLessons: 0,
  completedLessons: 0,
  consumptionTrend: [],
  byStudent: [],
  byCourse: [],
})

const days = ref(30)

function metricValue(name: string): number {
  const item = metrics.value.find((m) => m.name === name)
  return item ? item.value : 0
}

const trendMax = computed(() => Math.max(1, ...consumption.value.consumptionTrend.map((t) => t.value)))

const attendanceCourseColumns = [
  { title: '课程', dataIndex: 'courseCode', key: 'courseCode', width: 130 },
  { title: '出勤', dataIndex: 'present', key: 'present', width: 80 },
  { title: '缺勤', dataIndex: 'absent', key: 'absent', width: 80 },
  { title: '请假', dataIndex: 'leave', key: 'leave', width: 80 },
  { title: '迟到', dataIndex: 'late', key: 'late', width: 80 },
  { title: '总数', dataIndex: 'total', key: 'total', width: 80 },
  { title: '出勤率', dataIndex: 'rate', key: 'rate', width: 100 },
]

const studentColumns = [
  { title: '学生', dataIndex: 'studentCode', key: 'studentCode' },
  { title: '已消耗', dataIndex: 'consumed', key: 'consumed', width: 120 },
  { title: '剩余', dataIndex: 'remaining', key: 'remaining', width: 120 },
  { title: '总数', dataIndex: 'total', key: 'total', width: 120 },
]

const courseColumns = [
  { title: '学科', dataIndex: 'subject', key: 'subject' },
  { title: '已消耗', dataIndex: 'consumed', key: 'consumed', width: 120 },
  { title: '剩余', dataIndex: 'remaining', key: 'remaining', width: 120 },
  { title: '总数', dataIndex: 'total', key: 'total', width: 120 },
]

async function loadMetrics() {
  metricsLoading.value = true
  try {
    const res = await fetchInstitutionMetrics()
    metrics.value = res.metrics
  } catch (e) {
    message.error((e as Error).message || '加载机构数据失败')
  } finally {
    metricsLoading.value = false
  }
}

async function loadAttendance() {
  attendanceLoading.value = true
  try {
    attendance.value = await fetchAttendanceStatistics()
  } catch (e) {
    message.error((e as Error).message || '加载到课率数据失败')
  } finally {
    attendanceLoading.value = false
  }
}

async function loadConsumption() {
  consumptionLoading.value = true
  try {
    consumption.value = await fetchConsumptionStatistics(days.value)
  } catch (e) {
    message.error((e as Error).message || '加载课时消耗数据失败')
  } finally {
    consumptionLoading.value = false
  }
}

onMounted(() => {
  ensureSubjectsLoaded()
  loadMetrics()
  loadAttendance()
  loadConsumption()
})
</script>

<template>
  <div>
    <a-card :bordered="false" class="section-card" :loading="metricsLoading">
      <template #title>机构概览</template>
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="8" :md="6">
          <a-statistic title="学生总数" :value="metricValue('totalStudents')" />
        </a-col>
        <a-col :xs="12" :sm="8" :md="6">
          <a-statistic title="在读学生" :value="metricValue('activeStudents')" />
        </a-col>
        <a-col :xs="12" :sm="8" :md="6">
          <a-statistic title="课程数" :value="metricValue('totalCourses')" />
        </a-col>
        <a-col :xs="12" :sm="8" :md="6">
          <a-statistic title="班级数" :value="metricValue('totalClasses')" />
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false" class="section-card" :loading="attendanceLoading">
      <template #title>到课率统计</template>
      <a-row :gutter="[16, 16]" align="middle" class="attendance-top">
        <a-col :xs="24" :md="6">
          <a-progress type="circle" :percent="attendance.attendanceRate" :size="140" />
        </a-col>
        <a-col :xs="24" :md="18">
          <a-row :gutter="[16, 16]">
            <a-col :xs="12" :md="4"><a-statistic title="总记录" :value="attendance.totalRecords" /></a-col>
            <a-col :xs="12" :md="4"><a-statistic title="出勤" :value="attendance.presentCount" /></a-col>
            <a-col :xs="12" :md="4"><a-statistic title="缺勤" :value="attendance.absentCount" /></a-col>
            <a-col :xs="12" :md="4"><a-statistic title="请假" :value="attendance.leaveCount" /></a-col>
            <a-col :xs="12" :md="4"><a-statistic title="迟到" :value="attendance.lateCount" /></a-col>
          </a-row>
        </a-col>
      </a-row>
      <a-table
        :columns="attendanceCourseColumns"
        :data-source="attendance.byCourse"
        row-key="courseCode"
        size="small"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'rate'">
            {{ record.total ? `${Math.round((record.present / record.total) * 100)}%` : '-' }}
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card :bordered="false" :loading="consumptionLoading">
      <template #title>
        <div class="consume-title">
          <span>课时消耗</span>
          <a-select v-model:value="days" style="width: 120px" @change="loadConsumption">
            <a-select-option :value="7">近 7 天</a-select-option>
            <a-select-option :value="30">近 30 天</a-select-option>
            <a-select-option :value="90">近 90 天</a-select-option>
          </a-select>
        </div>
      </template>
      <a-row :gutter="[16, 16]" class="consume-cards">
        <a-col :xs="12" :md="6">
          <a-statistic title="总消耗" :value="formatNumber(consumption.totalConsumed)" />
        </a-col>
        <a-col :xs="12" :md="6">
          <a-statistic title="剩余课时" :value="formatNumber(consumption.totalRemaining)" />
        </a-col>
        <a-col :xs="12" :md="6">
          <a-statistic title="总课时" :value="formatNumber(consumption.totalLessons)" />
        </a-col>
        <a-col :xs="12" :md="6">
          <a-statistic title="已完成课时" :value="formatNumber(consumption.completedLessons)" />
        </a-col>
      </a-row>
      <h4>消耗趋势</h4>
      <div class="trend-list">
        <div v-for="item in consumption.consumptionTrend" :key="item.date" class="trend-row">
          <span class="trend-date">{{ formatDate(item.date) }}</span>
          <div class="trend-track">
            <div class="trend-bar" :style="{ width: `${Math.round((item.value / trendMax) * 100)}%` }"></div>
          </div>
          <span class="trend-value">{{ formatNumber(item.value) }}</span>
        </div>
        <a-empty v-if="!consumption.consumptionTrend.length" description="暂无趋势数据" />
      </div>
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :lg="12">
          <h4>学生课时消耗</h4>
          <a-table :columns="studentColumns" :data-source="consumption.byStudent" row-key="studentCode" size="small" :pagination="false" />
        </a-col>
        <a-col :xs="24" :lg="12">
          <h4>学科课时消耗</h4>
          <a-table :columns="courseColumns" :data-source="consumption.byCourse" row-key="subject" size="small" :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'subject'">
                {{ subjectName(record.subject) }}
              </template>
            </template>
          </a-table>
        </a-col>
      </a-row>
    </a-card>
  </div>
</template>

<style scoped>
.section-card {
  margin-bottom: 16px;
}
.attendance-top {
  margin-bottom: 16px;
}
.consume-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.consume-cards {
  margin-bottom: 8px;
}
.trend-list {
  margin-bottom: 16px;
}
.trend-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}
.trend-date {
  width: 90px;
  flex-shrink: 0;
  color: #666;
  font-size: 12px;
}
.trend-track {
  flex: 1;
  height: 16px;
  background: #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}
.trend-bar {
  height: 100%;
  background: #3b82f6;
  border-radius: 8px;
  transition: width 0.3s;
}
.trend-value {
  width: 60px;
  text-align: right;
  flex-shrink: 0;
  font-size: 12px;
}
</style>
