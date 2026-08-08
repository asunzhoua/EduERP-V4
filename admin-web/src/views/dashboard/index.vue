<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AccountBookOutlined,
  AlignLeftOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ExportOutlined,
  FileAddOutlined,
  RiseOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { fetchDashboardCards, type DashboardCards } from '@/api/dashboard'
import { formatMoney } from '@/utils/format'

const router = useRouter()

const loading = ref(false)
const cards = ref<DashboardCards>({
  todayIncome: 0,
  todayLessons: 0,
  todayAttendance: 0,
  todayLeave: 0,
  todayEnrollments: 0,
  monthIncome: 0,
  monthExpense: 0,
  profit: 0,
  teacherCount: 0,
  studentCount: 0,
  pendingApprovals: 0,
  stockAlerts: 0,
})

interface CardDef {
  key: keyof DashboardCards
  title: string
  icon: unknown
  color: string
  suffix?: string
  money?: boolean
  link?: string
}

const cardDefs: CardDef[] = [
  { key: 'todayIncome', title: '今日收入', icon: DollarOutlined, color: '#3b82f6', money: true, link: '/enrollments' },
  { key: 'todayLessons', title: '今日课时', icon: ClockCircleOutlined, color: '#10b981', link: '/lessons' },
  { key: 'todayAttendance', title: '今日签到', icon: CheckSquareOutlined, color: '#f59e0b', link: '/lessons' },
  { key: 'todayLeave', title: '今日请假', icon: FileAddOutlined, color: '#ef4444', link: '/leave-requests' },
  { key: 'todayEnrollments', title: '今日报名', icon: AlignLeftOutlined, color: '#8b5cf6', link: '/enrollments' },
  { key: 'monthIncome', title: '本月收入', icon: RiseOutlined, color: '#14b8a6', money: true, link: '/enrollments' },
  { key: 'monthExpense', title: '本月支出', icon: ExportOutlined, color: '#f97316', money: true, link: '/salary' },
  { key: 'profit', title: '利润', icon: AccountBookOutlined, color: '#06b6d4', money: true, link: '/analytics' },
  { key: 'teacherCount', title: '老师人数', icon: UserOutlined, color: '#6366f1', suffix: ' 人', link: '/teachers' },
  { key: 'studentCount', title: '学生人数', icon: TeamOutlined, color: '#84cc16', suffix: ' 人', link: '/students' },
  { key: 'pendingApprovals', title: '待审批', icon: FileAddOutlined, color: '#eab308', link: '/leave-requests' },
  { key: 'stockAlerts', title: '库存提醒', icon: WarningOutlined, color: '#ef4444', link: '/points-mall' },
]

const cardsList = computed(() =>
  cardDefs.map((def) => {
    const value = cards.value[def.key]
    return {
      ...def,
      value,
      display: def.money ? formatMoney(value) : `${value}${def.suffix || ''}`,
    }
  }),
)

let timer: ReturnType<typeof setInterval> | null = null

async function load() {
  loading.value = true
  try {
    cards.value = await fetchDashboardCards()
  } catch (e) {
    message.error((e as Error).message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

function onCardClick(def: CardDef) {
  if (def.link) router.push(def.link)
}

onMounted(() => {
  load()
  timer = setInterval(load, 60_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div>
    <a-card :loading="loading" :bordered="false">
      <div class="dash-header">
        <div>
          <h2 style="margin: 0">数据概览</h2>
          <span class="dash-sub">每 60 秒自动刷新</span>
        </div>
      </div>
      <a-row :gutter="[16, 16]">
        <a-col v-for="card in cardsList" :key="card.key" :xs="12" :sm="8" :md="6" :lg="4">
          <a-card class="dash-card" :bordered="false" hoverable @click="onCardClick(card)">
            <div class="card-inner">
              <div class="card-icon" :style="{ background: `${card.color}1a`, color: card.color }">
                <component :is="card.icon" />
              </div>
              <div class="card-body">
                <div class="card-title">{{ card.title }}</div>
                <div class="card-value" :style="{ color: card.color }">{{ card.display }}</div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-card>
  </div>
</template>

<style scoped>
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.dash-sub {
  color: #999;
  font-size: 12px;
}
.dash-card {
  cursor: pointer;
  border-radius: 8px;
}
.dash-card :deep(.ant-card-body) {
  padding: 16px;
}
.card-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.card-body {
  overflow: hidden;
}
.card-title {
  color: #666;
  font-size: 12px;
  white-space: nowrap;
}
.card-value {
  font-size: 18px;
  font-weight: 600;
  margin-top: 4px;
  white-space: nowrap;
}
</style>
