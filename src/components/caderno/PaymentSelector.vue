<template>
  <div class="payment-selector">
    <!-- Status de Pagamento (Toggle) -->
    <div class="payment-status-toggle">
      <label class="toggle-label">Status do Pagamento:</label>
      <div class="toggle-container">
        <q-toggle
          v-model="isPaid"
          :label="isPaid ? 'Pago' : 'Não Pago'"
          :color="isPaid ? 'positive' : 'negative'"
          :icon="isPaid ? 'check_circle' : 'radio_button_unchecked'"
          size="lg"
          @update:model-value="handlePaymentStatusChange"
        />
      </div>
    </div>

    <!-- Forma de Pagamento (quando pago) -->
    <div v-if="isPaid" class="payment-method">
      <label class="form-label">Forma de Pagamento:</label>
      <q-select
        v-model="paymentForm"
        :options="paymentOptions"
        outlined
        dense
        emit-value
        map-options
        clearable
        @update:model-value="handlePaymentFormChange"
        placeholder="Selecione a forma de pagamento"
      >
        <template v-slot:prepend>
          <q-icon name="payment" />
        </template>
      </q-select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'Não Pago'
  },
  forma: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'update:forma'])

// Reactive data
const isPaid = ref(props.modelValue === 'Pago')
const paymentForm = ref(props.forma)

// Payment form options
const paymentOptions = [
  { label: 'Dinheiro', value: 'Dinheiro' },
  { label: 'PIX', value: 'PIX' },
  { label: 'Cartão de Débito', value: 'Cartão de Débito' },
  { label: 'Cartão de Crédito', value: 'Cartão de Crédito' },
  { label: 'Transferência', value: 'Transferência' }
]

// Watchers to sync with parent
watch(() => props.modelValue, (newValue) => {
  isPaid.value = newValue === 'Pago'
})

watch(() => props.forma, (newValue) => {
  paymentForm.value = newValue
})

// Methods
const handlePaymentStatusChange = (value) => {
  const newStatus = value ? 'Pago' : 'Não Pago'
  emit('update:modelValue', newStatus)
  
  // Clear payment form if changing to unpaid
  if (!value) {
    paymentForm.value = ''
    emit('update:forma', '')
  }
}

const handlePaymentFormChange = (value) => {
  emit('update:forma', value || '')
}
</script>

<style scoped>
.payment-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.payment-status-toggle {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toggle-label {
  font-weight: 500;
  color: var(--q-dark);
  margin-bottom: 0.25rem;
}

.toggle-container {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f9f9f9;
}

.payment-method {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 500;
  color: var(--q-dark);
}

/* Custom toggle styling */
:deep(.q-toggle) {
  font-size: 1rem;
  font-weight: 500;
}

:deep(.q-toggle__label) {
  margin-left: 0.5rem;
}

:deep(.q-toggle--negative .q-toggle__track) {
  background: rgba(193, 0, 21, 0.2);
}

:deep(.q-toggle--negative .q-toggle__thumb) {
  background: var(--q-negative);
}

:deep(.q-toggle--positive .q-toggle__track) {
  background: rgba(33, 186, 69, 0.2);
}

:deep(.q-toggle--positive .q-toggle__thumb) {
  background: var(--q-positive);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .payment-selector {
    gap: 0.75rem;
  }
  
  .toggle-container {
    padding: 0.75rem;
  }
}
</style>