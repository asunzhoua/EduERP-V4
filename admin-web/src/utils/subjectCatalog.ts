import { reactive } from 'vue'
import { fetchSubjects } from '@/api/subjects'
import { subjectLabel } from '@/utils/format'

const CATEGORY_LABELS: Record<string, string> = {
  ACADEMIC: '学科培优',
  ART: '艺术类',
  SPORT: '体育类',
  STEM: '益智/科技类',
  LANG: '语言表达类',
  OTHER: '其他',
}

export interface SubjectOption {
  code: string
  name: string
}

export interface SubjectOptionGroup {
  category: string
  label: string
  items: SubjectOption[]
}

// 模块级响应式目录：ensureSubjectsLoaded 填充后，模板中调用 subjectName / subjectGroupOptions 自动更新
const state = reactive({
  names: {} as Record<string, string>,
  groups: [] as SubjectOptionGroup[],
  loaded: false,
})

export function ensureSubjectsLoaded(): Promise<void> {
  if (state.loaded) return Promise.resolve()
  return fetchSubjects()
    .then((list) => {
      const byCat = new Map<string, SubjectOption[]>()
      list.forEach((s) => {
        state.names[s.code] = s.name
        const cat = s.category || 'OTHER'
        if (!byCat.has(cat)) byCat.set(cat, [])
        byCat.get(cat)!.push({ code: s.code, name: s.name })
      })
      state.groups = Array.from(byCat.entries()).map(([category, items]) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        items,
      }))
      state.loaded = true
    })
    .catch(() => {
      // 拉取失败也标记已加载，避免反复请求；展示层回退静态 subjectLabel
      state.loaded = true
    })
}

/** 学科 code → 中文名；目录未覆盖时回退静态映射 */
export function subjectName(code: string): string {
  return state.names[code] || subjectLabel(code)
}

/** 分组选项（a-select-optgroup 用） */
export function subjectGroupOptions(): SubjectOptionGroup[] {
  return state.groups
}
