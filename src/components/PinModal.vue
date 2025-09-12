<template>
  <q-dialog v-model="open" persistent @hide="emit('close')">
    <q-card style="min-width: 320px" class="pin-modal-card">
      <q-card-section class="text-h6">PIN de Autorização</q-card-section>
      <q-card-section>
        <q-input
          ref="pinInput"
            v-model="pin"
            type="password"
            label="Digite o PIN"
            dense
            autofocus
            maxlength="4"
            mask="####"
            inputmode="numeric"
            aria-label="Campo para digitar PIN de 4 dígitos"
            @keyup.enter="handleConfirm"
            :error="!!errorMessage"
            :error-message="errorMessage"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancelar" color="primary" @click="open = false" />
        <q-btn label="Confirmar" color="primary" @click="handleConfirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close', 'success'])

const auth = useAuthStore()
const open = ref(false)
const pin = ref('')
const errorMessage = ref('')
const pinInput = ref(null)

watch(
  () => props.visible,
  (v) => {
    open.value = v
    if (v) {
      pin.value = ''
      errorMessage.value = ''
      nextTick(() => pinInput.value?.focus())
    }
  },
  { immediate: true }
)

watch(open, (v) => { if (!v) emit('close') })

const handleConfirm = () => {
  const ok = typeof auth.checkPin === 'function' ? auth.checkPin(pin.value) : pin.value === '1234'
  if (ok) {
    emit('success')
    open.value = false
  } else {
    errorMessage.value = 'PIN incorreto.'
    pin.value = ''
    nextTick(() => pinInput.value?.focus())
  }
}
</script>

<style scoped>
.pin-modal-card { max-width: 360px; }
</style>
