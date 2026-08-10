<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { fetchSettings, saveSettings, type SettingEntry, type SettingsGrouped } from '@/api/settings'
import { fetchOperationLogs, type OperationLog, type OperationLogQuery } from '@/api/operationLog'
import { exportConsumption, exportFinance, exportLessons, exportSalary, exportStudents } from '@/api/export'
import { formatDateTime } from '@/utils/format'

// ─── 系统设置 ───
const settingsLoading = ref(false)
const grouped = ref<SettingsGrouped>({})

const categoryLabel: Record<string, string> = {
  system: '系统',
  school: '机构',
  billing: '收费',
  notify: '通知',
  mall: '积分商城',
  leave: '请假',
}

// 设置 key → 中文标签；未知 key 回退原样
const keyLabel: Record<string, string> = {
  'campus.name': '校区名称',
  'school.name': '机构名称',
  'school.address': '机构地址',
  'school.phone': '联系电话',
  'billing.unitPrice': '默认课时单价',
  'notify.wechatEnabled': '微信通知开关',
  'mall.pointsRate': '积分兑换比例',
  'leave.autoApprove': '请假自动审批',
}
function displayLabel(key: string): string {
  return keyLabel[key] || key
}

const categories = computed(() =>
  Object.entries(grouped.value).map(([key, entries]) => ({ key, label: categoryLabel[key] || key, entries })),
)

async function loadSettings() {
  settingsLoading.value = true
  try {
    grouped.value = await fetchSettings()
  } catch (e) {
    message.error((e as Error).message || '加载设置失败')
  } finally {
    settingsLoading.value = false
  }
}

async function onSave() {
  const entries: SettingEntry[] = Object.values(grouped.value).flat()
  try {
    grouped.value = await saveSettings(entries)
    message.success('设置已保存')
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  }
}

// ─── 操作日志 ───
const logsLoading = ref(false)
const logList = ref<OperationLog[]>([])
const logTotal = ref(0)
const logQuery = reactive<OperationLogQuery>({ keyword: '', module: '', action: '', startDate: '', endDate: '', page: 1, pageSize: 10 })

const logColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 110 },
  { title: '模块', dataIndex: 'module', key: 'module', width: 100 },
  { title: '动作', dataIndex: 'action', key: 'action', width: 120 },
  { title: '方法', dataIndex: 'method', key: 'method', width: 80 },
  { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 120 },
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, customRender: ({ text }: { text: string }) => formatDateTime(text) },
]

async function loadLogs() {
  logsLoading.value = true
  try {
    const res = await fetchOperationLogs({
      keyword: logQuery.keyword || undefined,
      module: logQuery.module || undefined,
      action: logQuery.action || undefined,
      startDate: logQuery.startDate || undefined,
      endDate: logQuery.endDate || undefined,
      page: logQuery.page,
      pageSize: logQuery.pageSize,
    })
    logList.value = res.items
    logTotal.value = res.total
  } catch (e) {
    message.error((e as Error).message || '加载日志失败')
  } finally {
    logsLoading.value = false
  }
}

function onLogSearch() {
  logQuery.page = 1
  loadLogs()
}

function onLogReset() {
  logQuery.keyword = ''
  logQuery.module = ''
  logQuery.action = ''
  logQuery.startDate = ''
  logQuery.endDate = ''
  logQuery.page = 1
  loadLogs()
}

// ─── 数据导出 ───
async function onExport(fn: () => Promise<void>, label: string) {
  try {
    await fn()
    message.success('导出已开始')
  } catch (e) {
    message.error((e as Error).message || `${label}导出失败`)
  }
}

onMounted(() => {
  loadSettings()
  loadLogs()
})
</script>

<template>
  <a-card :bordered="false">
    <a-tabs>
      <a-tab-pane key="settings" tab="系统设置">
        <a-card :bordered="false" :loading="settingsLoading">
          <div class="toolbar">
            <a-button type="primary" @click="onSave">保存</a-button>
          </div>
          <a-empty v-if="!categories.length && !settingsLoading" description="暂无设置项" />
          <a-row v-else :gutter="[16, 16]">
            <a-col v-for="cat in categories" :key="cat.key" :xs="24" :md="12" :xl="8">
              <a-card size="small" :title="cat.label" :bordered="false">
                <a-form layout="vertical">
                  <a-form-item
                    v-for="entry in cat.entries"
                    :key="entry.key"
                    :label="displayLabel(entry.key)"
                    :extra="entry.description || undefined"
                  >
                    <a-input v-model:value="entry.value" :placeholder="entry.description || '请输入'" />
                  </a-form-item>
                </a-form>
              </a-card>
            </a-col>
          </a-row>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="logs" tab="操作日志">
        <a-form layout="inline" class="search-bar" @submit.prevent="onLogSearch">
          <a-form-item>
            <a-input v-model:value="logQuery.keyword" placeholder="用户名" allow-clear style="width: 160px" @press-enter="onLogSearch" />
          </a-form-item>
          <a-form-item>
            <a-input v-model:value="logQuery.module" placeholder="模块" allow-clear style="width: 140px" @press-enter="onLogSearch" />
          </a-form-item>
          <a-form-item>
            <a-input v-model:value="logQuery.action" placeholder="动作" allow-clear style="width: 140px" @press-enter="onLogSearch" />
          </a-form-item>
          <a-form-item>
            <a-date-picker v-model:value="logQuery.startDate" value-format="YYYY-MM-DD" placeholder="开始日期" style="width: 140px" />
          </a-form-item>
          <a-form-item>
            <a-date-picker v-model:value="logQuery.endDate" value-format="YYYY-MM-DD" placeholder="结束日期" style="width: 140px" />
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" html-type="submit" :icon="h(SearchOutlined)">查询</a-button>
              <a-button :icon="h(ReloadOutlined)" @click="onLogReset">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>
        <a-table
          :columns="logColumns"
          :data-source="logList"
          :loading="logsLoading"
          :pagination="{ current: logQuery.page, pageSize: logQuery.pageSize, total: logTotal, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
          row-key="id"
          @change="(p: any) => { logQuery.page = p.current; logQuery.pageSize = p.pageSize; loadLogs() }"
        />
      </a-tab-pane>

      <a-tab-pane key="export" tab="数据导出">
        <a-card :bordered="false">
          <p class="export-tip">选择数据范围导出，导出任务将自动触发浏览器下载。</p>
          <a-space wrap>
            <a-button @click="onExport(() => exportStudents({}), '学生')">导出学生</a-button>
            <a-button @click="onExport(() => exportLessons({}), '课时')">导出课时</a-button>
            <a-button @click="onExport(() => exportConsumption({}), '消耗')">导出消耗</a-button>
            <a-button @click="onExport(() => exportSalary({}), '工资')">导出工资</a-button>
            <a-button @click="onExport(() => exportFinance({}), '财务')">导出财务</a-button>
          </a-space>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}
.search-bar {
  margin-bottom: 16px;
}
.export-tip {
  color: #666;
}
</style>
