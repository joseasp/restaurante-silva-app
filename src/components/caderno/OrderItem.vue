<template>
  <q-card 
    class="order-item"
    :class="{
      'order-pending': order.status_preparo === 'PENDENTE',
      'order-ready': order.status_preparo === 'PRONTO',
      'order-paid': order.metodo_pagamento === 'Pago',
      'order-unpaid': order.metodo_pagamento === 'Não Pago'
    }"
    @click="toggleExpanded"
  >
    <!-- Main Order Info -->
    <q-card-section class="order-main" :class="{ 'cursor-pointer': !expanded }">
      <div class="order-header">
        <div class="order-client">
          <q-icon 
            :name="order.cliente_nome === 'Cliente Avulso' ? 'shopping_cart' : 'person'" 
            class="q-mr-sm" 
          />
          <span class="client-name">{{ order.cliente_nome }}</span>
          <span v-if="order.nome_funcionario_empresa" class="employee-name">
            • {{ order.nome_funcionario_empresa }}
          </span>
        </div>
        
        <div class="order-actions">
          <q-btn
            flat
            dense
            round
            :icon="expanded ? 'expand_less' : 'expand_more'"
            color="grey-6"
            size="sm"
            @click.stop="toggleExpanded"
          >
            <q-tooltip>{{ expanded ? 'Ocultar' : 'Mostrar' }} detalhes</q-tooltip>
          </q-btn>
          
          <q-btn
            flat
            dense
            round
            icon="more_vert"
            color="grey-6"
            size="sm"
            @click.stop="showMenu = !showMenu"
          >
            <q-menu v-model="showMenu" auto-close>
              <q-list dense>
                <q-item clickable @click="$emit('edit', order)">
                  <q-item-section avatar>
                    <q-icon name="edit" color="primary" />
                  </q-item-section>
                  <q-item-section>Editar</q-item-section>
                </q-item>
                
                <q-item clickable @click="$emit('print', order)">
                  <q-item-section avatar>
                    <q-icon name="print" color="info" />
                  </q-item-section>
                  <q-item-section>Imprimir</q-item-section>
                </q-item>
                
                <q-separator />
                
                <q-item clickable @click="$emit('cancel', order)">
                  <q-item-section avatar>
                    <q-icon name="cancel" color="negative" />
                  </q-item-section>
                  <q-item-section>Estornar</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="order-summary">
        <div class="order-items">
          <span class="items-text">{{ itemsSummary }}</span>
        </div>
        <div class="order-total">
          <span class="total-value">R$ {{ order.valor.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Status Buttons Row -->
      <div class="status-row">
        <!-- Preparation Status -->
        <q-btn
          :color="order.status_preparo === 'PENDENTE' ? 'warning' : 'positive'"
          :outline="order.status_preparo === 'PRONTO'"
          :label="order.status_preparo === 'PENDENTE' ? 'Pendente' : 'Pronto'"
          :icon="order.status_preparo === 'PENDENTE' ? 'schedule' : 'check_circle'"
          size="sm"
          dense
          @click.stop="$emit('toggle-status', order)"
          class="status-btn"
        />

        <!-- Payment Status Toggle -->
        <q-toggle
          :model-value="order.metodo_pagamento === 'Pago'"
          :label="order.metodo_pagamento === 'Pago' ? 'Pago' : 'Não Pago'"
          :color="order.metodo_pagamento === 'Pago' ? 'positive' : 'negative'"
          size="sm"
          @update:model-value="$emit('toggle-payment', order)"
          @click.stop
          class="payment-toggle"
        />

        <!-- Payment Form (if paid) -->
        <q-select
          v-if="order.metodo_pagamento === 'Pago'"
          :model-value="order.forma_pagamento"
          :options="paymentFormOptions"
          dense
          outlined
          emit-value
          map-options
          placeholder="Forma"
          style="min-width: 100px; max-width: 120px"
          @update:model-value="$emit('change-payment-form', $event)"
          @click.stop
        />
      </div>
    </q-card-section>

    <!-- Expanded Details -->
    <q-slide-transition>
      <q-card-section v-show="expanded" class="order-details">
        <q-separator class="q-mb-md" />
        
        <!-- Detailed Items List -->
        <div class="details-section">
          <h6 class="details-title">
            <q-icon name="shopping_basket" class="q-mr-sm" />
            Itens do Pedido
          </h6>
          <q-list dense>
            <q-item v-for="(item, index) in order.itens" :key="index">
              <q-item-section>
                <q-item-label>
                  {{ item.quantidade }}x {{ item.nome }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label>
                  R$ {{ (item.preco_unitario_congelado * item.quantidade).toFixed(2) }}
                </q-item-label>
                <q-item-label caption>
                  R$ {{ item.preco_unitario_congelado.toFixed(2) }} cada
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- Order Info -->
        <div class="details-section">
          <h6 class="details-title">
            <q-icon name="info" class="q-mr-sm" />
            Informações do Pedido
          </h6>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Horário:</span>
              <span class="info-value">{{ formatTime(order.created_at) }}</span>
            </div>
            <div class="info-item" v-if="order.observacoes">
              <span class="info-label">Observações:</span>
              <span class="info-value">{{ order.observacoes }}</span>
            </div>
            <div class="info-item" v-if="order.forma_pagamento">
              <span class="info-label">Forma de Pagamento:</span>
              <span class="info-value">{{ order.forma_pagamento }}</span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-slide-transition>
  </q-card>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  order: {
    type: Object,
    required: true
  }
})

const emit = defineEmits([
  'edit', 
  'cancel', 
  'toggle-payment', 
  'toggle-status', 
  'change-payment-form', 
  'print'
])

const expanded = ref(false)
const showMenu = ref(false)

const paymentFormOptions = [
  { label: 'Dinheiro', value: 'Dinheiro' },
  { label: 'PIX', value: 'PIX' },
  { label: 'Cartão de Débito', value: 'Cartão de Débito' },
  { label: 'Cartão de Crédito', value: 'Cartão de Crédito' },
  { label: 'Transferência', value: 'Transferência' }
]

// Computed
const itemsSummary = computed(() => {
  if (!props.order.itens || props.order.itens.length === 0) {
    return 'Sem itens'
  }
  
  const totalItems = props.order.itens.reduce((sum, item) => sum + item.quantidade, 0)
  const firstItem = props.order.itens[0]
  
  if (props.order.itens.length === 1) {
    return `${firstItem.quantidade}x ${firstItem.nome}`
  } else {
    return `${totalItems} itens: ${firstItem.nome}${props.order.itens.length > 1 ? ` +${props.order.itens.length - 1}` : ''}`
  }
})

// Methods
const toggleExpanded = () => {
  expanded.value = !expanded.value
}

const formatTime = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}
</script>

<style scoped>
.order-item {
  border-left: 4px solid transparent;
  transition: all 0.3s ease;
}

.order-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.order-item.order-pending {
  border-left-color: #ff9800;
}

.order-item.order-ready {
  border-left-color: #4caf50;
}

.order-main {
  padding: 1rem;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.order-client {
  display: flex;
  align-items: center;
  flex: 1;
}

.client-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--q-dark);
}

.employee-name {
  color: var(--q-grey-7);
  font-size: 0.9rem;
  margin-left: 0.25rem;
}

.order-actions {
  display: flex;
  gap: 0.25rem;
}

.order-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.items-text {
  color: var(--q-grey-7);
  font-size: 0.9rem;
}

.total-value {
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--q-primary);
}

.status-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.status-btn {
  justify-self: start;
}

.payment-toggle {
  justify-self: center;
}

.order-details {
  background: #f8f9fa;
  padding: 1rem;
}

.details-section {
  margin-bottom: 1.5rem;
}

.details-section:last-child {
  margin-bottom: 0;
}

.details-title {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--q-primary);
  display: flex;
  align-items: center;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
}

.info-label {
  font-weight: 500;
  color: var(--q-dark);
}

.info-value {
  color: var(--q-grey-7);
  text-align: right;
  max-width: 60%;
  word-wrap: break-word;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .order-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .order-actions {
    align-self: flex-end;
  }
  
  .status-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .status-btn,
  .payment-toggle {
    justify-self: stretch;
  }
  
  .order-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .info-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .info-value {
    max-width: 100%;
    text-align: left;
  }
}
</style>