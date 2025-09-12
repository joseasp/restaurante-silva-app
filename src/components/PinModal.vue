<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card style="min-width: 320px">
      <q-card-section class="text-h6">{{ title }}</q-card-section>
      <q-card-section class="q-pt-none">
        <div class="text-body2">{{ message }}</div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat color="primary" label="Cancelar" @click="emit('close')" />
        <q-btn color="primary" label="OK" @click="emit('success')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Confirmação' },
  message: { type: String, default: 'Confirme a ação protegida por PIN.' }
})

const emit = defineEmits(['close', 'success'])

const isOpen = computed({
  get: () => props.visible,
  set: (v) => { if (!v) emit('close') }
})
</script>

<style scoped>
/* estilos mínimos opcionais */
</style>
