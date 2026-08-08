<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { adjustContractLessons, type Contract } from '@/api/enrollment'

const props = defineProps<{
  open: boolean
  contract: Contract | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'success'): void
}>()

const submitting = ref(false)
const form = reactive({
  totalLessons: undefined as number | undefined,
  remainingLessons: undefined as number | undefined,
  reason: '',
})

watch(
  () => props.open,
  (open) => {
    if (open && props.contract) {
      form.totalLessons = props.contract.totalLessons
      form.remainingLessons = props.contract.remainingLessons
      form.reason = ''
    }
  },
)

function close() {
  emit('update:open', false)
}

async function onSubmit() {
  const c = props.contract
  if (!c) return

  // 清空视为保持现值（a-input-number 清空可能为 null）
  const total = form.totalLessons ?? c.totalLessons
  const remaining = form.remainingLessons ?? c.remainingLessons

  if (total < 0 || remaining < 0) {
    message.warning('课时不能为负数')
    return
  }
  if (remaining > total) {
    message.warning('剩余课时不能大于总课时')
    return
  }
  if (total === c.totalLessons && remaining === c.remainingLessons) {
    message.warning('没有课时变化')
    return
  }
  if (remaining < c.remainingLessons && !form.reason.trim()) {
    message.warning('减少课时必须填写原因')
    return
  }

  submitting.value = true
  try {
    await adjustContractLessons(c.contractCode, {
      totalLessons: form.totalLessons ?? undefined,
      remainingLessons: form.remainingLessons ?? undefined,
      reason: form.reason.trim() || undefined,
    })
    message.success('课时已更新')
    close()
    emit('success')
  } catch (e) {
    message.error((e as Error).message || '操作失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    title="调整课时"
    :confirm-loading="submitting"
    ok-text="保存"
    cancel-text="取消"
    width="520px"
    @ok="onSubmit"
    @cancel="close"
  >
    <p v-if="contract" style="margin-bottom: 12px; color: #6F675D">
      合同 {{ contract.contractCode }} · 当前 总 {{ contract.totalLessons }} / 剩余 {{ contract.remainingLessons }}
    </p>
    <a-form layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="总课时">
            <a-input-number v-model:value="form.totalLessons" :min="0" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="剩余课时">
            <a-input-number v-model:value="form.remainingLessons" :min="0" style="width: 100%" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item label="原因（减少剩余课时时必填）">
        <a-textarea v-model:value="form.reason" :rows="3" placeholder="如：家长续费赠送 / 退款 5 节" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
