<template>
  <q-chip
    clickable
    :disable="disabled"
    outline
    :color="chipColor"
    :text-color="chipColor"
    class="prep-chip"
    @click="$emit('toggle')"
  >
    <q-icon :name="iconName" :color="chipColor" size="16px" class="q-mr-xs" />
    <span class="text-weight-medium">{{ label }}</span>
  </q-chip>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: String, required: true }, // 'PENDENTE' | 'PRONTO'
  disabled: { type: Boolean, default: false },
})

const chipColor = computed(() => (props.value === 'PENDENTE' ? 'orange' : 'positive'))
const iconName = computed(() => (props.value === 'PENDENTE' ? 'hourglass_empty' : 'done'))
const label = computed(() => (props.value === 'PENDENTE' ? 'Pendente' : 'Pronto'))
</script>

<style scoped>
.prep-chip {
  border-radius: 999px;
  min-height: 28px;
  padding: 0 10px;
  transition: background-color 0.15s ease;
}
.prep-chip:hover {
  background-color: rgba(0, 0, 0, 0.02);
}
@media (min-width: 1024px) {
  .prep-chip {
    min-height: 30px;
    font-size: 0.95rem;
  }
}
</style>
