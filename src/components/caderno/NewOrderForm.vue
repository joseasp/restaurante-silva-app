<template>
  <div class="new-order-form">
    <div class="form-header">
      <h5 class="q-ma-none">
        <q-icon name="add_circle" class="q-mr-sm" />
        {{ isEditing ? 'Editando Lançamento' : 'Novo Lançamento' }}
      </h5>
    </div>

    <!-- Status de Envio -->
    <q-banner
      v-if="submissionStatus"
      :class="{
        'bg-primary text-white': submissionStatus === 'sending',
        'bg-positive text-white': submissionStatus === 'success',
        'bg-negative text-white': submissionStatus === 'error'
      }"
      class="q-mb-md"
    >
      <template v-slot:avatar>
        <q-spinner v-if="submissionStatus === 'sending'" />
        <q-icon v-else-if="submissionStatus === 'success'" name="check_circle" />
        <q-icon v-else-if="submissionStatus === 'error'" name="error" />
      </template>
      <span v-if="submissionStatus === 'sending'">Enviando lançamento...</span>
      <span v-else-if="submissionStatus === 'success'">Lançamento enviado com sucesso!</span>
      <span v-else-if="submissionStatus === 'error'">Erro ao enviar. Tente novamente.</span>
    </q-banner>

    <q-form @submit.prevent="submitOrder" class="q-gutter-md">
      <!-- Seleção de Cliente -->
      <div class="form-section">
        <label class="form-label">Cliente:</label>
        <ClientSelector
          v-model="currentOrder.cliente"
          @update:modelValue="handleClientChange"
        />
      </div>

      <!-- Nome do Funcionário (apenas para empresas) -->
      <div v-if="currentOrder.cliente && currentOrder.cliente.tipo === 'EMPRESA'" class="form-section">
        <label class="form-label">Funcionário:</label>
        <EmployeeSelector
          v-model="currentOrder.nome_funcionario"
          :cliente-id="currentOrder.cliente.id"
        />
      </div>

      <!-- Seleção de Produtos -->
      <div class="form-section">
        <label class="form-label">Produtos:</label>
        <ProductSelector
          v-model="currentOrder.itens"
          @update:modelValue="handleItemsChange"
        />
      </div>

      <!-- Lista de Itens Selecionados -->
      <div v-if="currentOrder.itens.length > 0" class="items-list">
        <div class="items-header">
          <span class="text-subtitle2">Itens do Pedido</span>
          <span class="text-subtitle2 text-weight-bold">Total: R$ {{ totalOrder.toFixed(2) }}</span>
        </div>
        <q-list bordered separator>
          <q-item v-for="(item, index) in currentOrder.itens" :key="index" dense>
            <q-item-section>
              <div class="item-row">
                <span class="item-name">{{ item.nome }}</span>
                <div class="item-controls">
                  <q-btn
                    round
                    dense
                    size="sm"
                    icon="remove"
                    color="negative"
                    @click="decrementItem(index)"
                  />
                  <span class="item-quantity">{{ item.quantidade }}</span>
                  <q-btn
                    round
                    dense
                    size="sm"
                    icon="add"
                    color="positive"
                    @click="incrementItem(index)"
                  />
                  <span class="item-price">R$ {{ (item.preco_unitario_congelado * item.quantidade).toFixed(2) }}</span>
                </div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Método de Pagamento -->
      <div class="form-section">
        <label class="form-label">Pagamento:</label>
        <PaymentSelector
          v-model="currentOrder.metodo_pagamento"
          v-model:forma="currentOrder.forma_pagamento"
        />
      </div>

      <!-- Observações -->
      <div class="form-section">
        <q-input
          v-model="currentOrder.observacoes"
          type="textarea"
          outlined
          label="Observações (opcional)"
          rows="2"
          autogrow
        />
      </div>

      <!-- Botões de Ação -->
      <div class="form-actions">
        <q-btn
          v-if="isEditing"
          type="button"
          color="grey-7"
          outline
          label="Cancelar Edição"
          @click="cancelEdit"
          class="q-mr-sm"
        />
        <q-btn
          type="submit"
          color="primary"
          :loading="isSubmitting"
          :disable="!canSubmit"
          :label="isEditing ? 'Atualizar Lançamento' : 'Lançar Pedido'"
          icon="send"
          class="full-width"
        />
      </div>
    </q-form>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import ClientSelector from './ClientSelector.vue'
import EmployeeSelector from './EmployeeSelector.vue'
import ProductSelector from './ProductSelector.vue'
import PaymentSelector from './PaymentSelector.vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      cliente: null,
      itens: [],
      metodo_pagamento: 'Não Pago',
      forma_pagamento: '',
      observacoes: '',
      nome_funcionario: ''
    })
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  submissionStatus: {
    type: String,
    default: '' // 'sending', 'success', 'error'
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel-edit'])

const currentOrder = ref({ ...props.modelValue })

// Computed
const totalOrder = computed(() => {
  return currentOrder.value.itens.reduce((sum, item) => {
    return sum + (item.preco_unitario_congelado * item.quantidade)
  }, 0)
})

const canSubmit = computed(() => {
  return currentOrder.value.cliente && 
         currentOrder.value.itens.length > 0 &&
         !props.isSubmitting
})

// Watchers
watch(currentOrder, (newValue) => {
  emit('update:modelValue', { ...newValue })
}, { deep: true })

watch(() => props.modelValue, (newValue) => {
  currentOrder.value = { ...newValue }
}, { deep: true })

// Methods
const handleClientChange = (cliente) => {
  currentOrder.value.cliente = cliente
  if (cliente?.tipo !== 'EMPRESA') {
    currentOrder.value.nome_funcionario = ''
  }
}

const handleItemsChange = (itens) => {
  currentOrder.value.itens = itens
}

const incrementItem = (index) => {
  currentOrder.value.itens[index].quantidade++
}

const decrementItem = (index) => {
  if (currentOrder.value.itens[index].quantidade > 1) {
    currentOrder.value.itens[index].quantidade--
  } else {
    currentOrder.value.itens.splice(index, 1)
  }
}

const submitOrder = () => {
  if (canSubmit.value) {
    emit('submit', { ...currentOrder.value })
  }
}

const cancelEdit = () => {
  emit('cancel-edit')
}
</script>

<style scoped>
.new-order-form {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.form-header {
  padding: 1rem 0;
  border-bottom: 1px solid var(--q-primary);
  margin-bottom: 1rem;
}

.form-header h5 {
  color: var(--q-primary);
  display: flex;
  align-items: center;
}

.form-section {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--q-dark);
}

.items-list {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 0.5rem;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.item-name {
  flex: 1;
  font-weight: 500;
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item-quantity {
  min-width: 2rem;
  text-align: center;
  font-weight: bold;
}

.item-price {
  min-width: 5rem;
  text-align: right;
  font-weight: 500;
  color: var(--q-primary);
}

.form-actions {
  margin-top: auto;
  padding-top: 1rem;
}

@media (max-width: 768px) {
  .item-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .item-controls {
    justify-content: space-between;
    width: 100%;
  }
}
</style>