<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { use, init } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { message } from 'ant-design-vue'
import {
  fetchDashboardCards,
  WORKBENCH_TIME_LABELS,
  type DashboardWorkbench,
  type WorkbenchMetric,
  type WorkbenchTimeType,
  type WorkbenchTodo,
} from '@/api/dashboard'
import { formatMoney } from '@/utils/format'

// ECharts 按需引入，避免全量 ~1MB 打包
use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const router = useRouter()

const loading = ref(false)
const timeType = ref<WorkbenchTimeType>('month')
const data = ref<DashboardWorkbench | null>(null)
const chartEl = ref<HTMLElement | null>(null)
let chart: ReturnType<typeof init> | null = null
let timer: ReturnType<typeof setInterval> | null = null

const timeTypes: WorkbenchTimeType[] = ['day', 'week', 'month', 'year', 'all']

function metricDisplay(metric: WorkbenchMetric): string {
  if (metric.money) return formatMoney(metric.value)
  if (metric.unit) return `${metric.value} ${metric.unit}`
  return String(metric.value)
}

function onMetricClick(metric: WorkbenchMetric) {
  if (metric.link) router.push(metric.link)
}

function onTodoClick(todo: WorkbenchTodo) {
  if (todo.link) router.push(todo.link)
}

function renderChart() {
  if (!chartEl.value) return
  const trends = data.value?.trends ?? []
  if (!chart) {
    chart = init(chartEl.value)
  }
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: trends.map((t) => t.title), top: 0 },
    grid: { left: 48, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trends[0]?.data.map((p) => p.date) ?? [],
    },
    yAxis: { type: 'value' },
    series: trends.map((t) => ({
      name: t.title,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: t.data.map((p) => p.value),
    })),
  })
}

function onResize() {
  chart?.resize()
}

async function load() {
  loading.value = true
  try {
    data.value = await fetchDashboardCards(timeType.value)
  } catch (e) {
    message.error((e as Error).message || '加载数据失败')
  } finally {
    loading.value = false
  }
  // 等 loading 关闭、卡内 DOM（含图表容器）渲染后再绘制
  await nextTick()
  renderChart()
}

function onTimeTypeChange() {
  void load()
}

onMounted(() => {
  void load()
  timer = setInterval(load, 60_000)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="workbench">
    <a-card :loading="loading" :bordered="false">
      <div class="wb-header">
        <div>
          <h2 style="margin: 0">工作台</h2>
          <span class="wb-sub">每 60 秒自动刷新</span>
        </div>
        <a-radio-group v-model:value="timeType" button-style="solid" @change="onTimeTypeChange">
          <a-radio-button v-for="tt in timeTypes" :key="tt" :value="tt">
            {{ WORKBENCH_TIME_LABELS[tt] }}
          </a-radio-button>
        </a-radio-group>
      </div>

      <a-row :gutter="[16, 16]">
        <a-col v-for="group in data?.groups ?? []" :key="group.key" :xs="24" :sm="12" :lg="6">
          <a-card class="wb-group" :bordered="false">
            <div class="wb-group-title">{{ group.title }}</div>
            <a-row :gutter="[8, 12]">
              <a-col
                v-for="metric in group.metrics"
                :key="metric.key"
                :span="12"
                class="wb-metric"
                :class="{ clickable: metric.link }"
                @click="onMetricClick(metric)"
              >
                <div class="wb-metric-label">{{ metric.label }}</div>
                <div class="wb-metric-value">{{ metricDisplay(metric) }}</div>
              </a-col>
            </a-row>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="[16, 16]" class="wb-bottom">
        <a-col :xs="24" :lg="16">
          <a-card :bordered="false">
            <div ref="chartEl" class="wb-chart" data-testid="wb-chart" />
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="8">
          <a-card :bordered="false" class="wb-todo-card">
            <div class="wb-group-title">待办</div>
            <div v-if="(data?.todos ?? []).length === 0" class="wb-todo-empty">暂无待办</div>
            <div
              v-for="todo in data?.todos ?? []"
              :key="todo.key"
              class="wb-todo"
              @click="onTodoClick(todo)"
            >
              <span class="wb-todo-label">{{ todo.label }}</span>
              <a-badge :count="todo.count" :overflow-count="99" />
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-card>
  </div>
</template>

<style scoped>
.wb-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.wb-sub {
  color: #999;
  font-size: 12px;
}
.wb-group {
  border-radius: 8px;
}
.wb-group-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}
.wb-metric {
  cursor: default;
}
.wb-metric.clickable {
  cursor: pointer;
}
.wb-metric-label {
  color: #666;
  font-size: 12px;
  margin-bottom: 4px;
}
.wb-metric-value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.wb-bottom {
  margin-top: 16px;
}
.wb-chart {
  height: 320px;
}
.wb-todo-card {
  height: 100%;
}
.wb-todo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  background: #fafafa;
  margin-bottom: 8px;
}
.wb-todo:hover {
  background: #f0f0f0;
}
.wb-todo-empty {
  color: #999;
  padding: 8px 0;
}
</style>
