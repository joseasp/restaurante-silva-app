<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <h3>PIN de Autorização</h3>
      <input
        ref="pinInput"
        type="password"
        v-model="pin"
        maxlength="4"
        @keyup.enter="handleConfirm"
      />
      <p class="error-message">{{ errorMessage }}</p>
      <div class="modal-actions">
        <button @click="$emit('close')">Cancelar</button>
        <button @click="handleConfirm">Confirmar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: Boolean,
})
const emit = defineEmits(['close', 'success'])

const pin = ref('')
const errorMessage = ref('')
const pinInput = ref(null)

const PIN_CORRETO = '1234' // Mantenha seu PIN aqui

watch(
  () => props.visible,
  (newValue) => {
    if (newValue) {
      pin.value = ''
      errorMessage.value = ''
      nextTick(() => {
        pinInput.value?.focus()
      })
    }
  },
)

const handleConfirm = () => {
  if (pin.value === PIN_CORRETO) {
    emit('success')
  } else {
    errorMessage.value = 'PIN incorreto.'
    pin.value = ''
    pinInput.value?.focus()
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  padding: 25px 30px;
  border-radius: 8px;
  width: 320px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  text-align: center;
}
.modal-content h3 {
  margin-top: 0;
  margin-bottom: 15px;
}
.modal-content input {
  width: 100%;
  padding: 10px;
  text-align: center;
  font-size: 1.5em;
  letter-spacing: 0.5em;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 10px;
  box-sizing: border-box;
}
.error-message {
  color: #dc3545;
  min-height: 20px;
}
.modal-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.modal-actions button {
  flex-grow: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.modal-actions button:first-of-type {
  /* Botão Cancelar */
  background-color: #6c757d;
  color: white;
}
.modal-actions button:last-of-type {
  /* Botão Confirmar */
  background-color: #198754;
  color: white;
}
</style>
