<template>
  <q-chip
    clickable
    :disable="disabled"
    outline
    :color="chipColor"
    :text-color="chipColor"
    class="payment-chip"
    @click="$emit('toggle')"
  >
    <q-icon :name="iconName" :color="chipColor" size="16px" class="q-mr-xs" />
    <span class="text-weight-medium">{{ label }}</span>
    <span
      v-if="formaPagamento && value === 'Pago'"
      class="text-caption q-ml-xs opacity-80"
    >
      ({{ formaPagamento }})
    </span>
  </q-chip>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: String, required: true }, // 'Pago' | 'Não Pago'
  formaPagamento: { type: String, default: null },
  disabled: { type: Boolean, default: false },
})

const chipColor = computed(() => (props.value === 'Pago' ? 'positive' : 'negative'))
const iconName = computed(() => (props.value === 'Pago' ? 'check' : 'close'))
const label = computed(() => (props.value === 'Pago' ? 'Pago' : 'Não Pago'))
</script>

<style scoped>
.payment-chip {
  border-radius: 999px;
  min-height: 28px;
  padding: 0 10px;
  transition: background-color 0.15s ease;
}
.payment-chip:hover {
  background-color: rgba(0,0,0,0.02);
}
</style>
