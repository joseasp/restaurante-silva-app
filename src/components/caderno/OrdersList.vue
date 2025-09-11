<template>
  <div class="orders-list">
    <!-- Header with Summary -->
    <div class="orders-header">
      <div class="header-title">
        <h5 class="q-ma-none">
          <q-icon name="receipt_long" class="q-mr-sm" />
          Pedidos do Dia
        </h5>
        <q-btn
          flat
          dense
          round
          icon="visibility"
          color="primary"
          @click="toggleSummary"
          class="q-ml-sm"
        >
          <q-tooltip>{{ showSummary ? 'Ocultar' : 'Mostrar' }} Resumo</q-tooltip>
        </q-btn>
      </div>
      
      <!-- Daily Summary -->
      <q-expansion-item
        v-model="showSummary"
        dense
        class="summary-expansion"
      >
        <template v-slot:header>
          <div class="summary-header">
            <span class="text-subtitle2">Resumo do Dia</span>
            <div class="summary-stats">
              <q-chip color="primary" text-color="white" size="sm">
                {{ summary.totalOrders }} pedidos
              </q-chip>
              <q-chip color="positive" text-color="white" size="sm">
                R$ {{ summary.totalRevenue.toFixed(2) }}
              </q-chip>
            </div>
          </div>
        </template>
        
        <q-card flat class="summary-details">
          <q-card-section class="q-pt-none">
            <div class="summary-grid">
              <div class="summary-item">
                <span class="label">Pendentes:</span>
                <span class="value pending">{{ summary.pendingOrders }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Prontos:</span>
                <span class="value ready">{{ summary.readyOrders }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Pagos:</span>
                <span class="value paid">{{ summary.paidOrders }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Não Pagos:</span>
                <span class="value unpaid">{{ summary.unpaidOrders }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </div>

    <!-- Orders List -->
    <div class="orders-container">
      <q-scroll-area class="full-height">
        <div v-if="groupedOrders.length === 0" class="no-orders">
          <q-icon name="receipt" size="4rem" color="grey-5" />
          <p class="text-grey-6 q-mt-md">Nenhum pedido encontrado para esta data</p>
        </div>
        
        <div v-else class="orders-grid">
          <OrderItem
            v-for="order in groupedOrders"
            :key="order.id"
            :order="order"
            @edit="$emit('edit-order', order)"
            @cancel="$emit('cancel-order', order)"
            @toggle-payment="$emit('toggle-payment', order)"
            @toggle-status="$emit('toggle-status', order)"
            @change-payment-form="$emit('change-payment-form', order, $event)"
            @print="$emit('print-order', order)"
          />
        </div>
      </q-scroll-area>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import OrderItem from './OrderItem.vue'

const props = defineProps({
  orders: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'edit-order',
  'cancel-order', 
  'toggle-payment',
  'toggle-status',
  'change-payment-form',
  'print-order'
])

const showSummary = ref(false)

// Computed
const groupedOrders = computed(() => {
  // Filter out cancelled orders and sort by priority
  const validOrders = props.orders.filter(order => !order.estornado)
  
  // Sort by: 1) Status (PENDENTE first), 2) Created date (oldest first)
  return validOrders.sort((a, b) => {
    // Priority 1: Status (PENDENTE > PRONTO)
    if (a.status_preparo === 'PENDENTE' && b.status_preparo !== 'PENDENTE') return -1
    if (a.status_preparo !== 'PENDENTE' && b.status_preparo === 'PENDENTE') return 1
    
    // Priority 2: Creation time (oldest first)
    const dateA = new Date(a.created_at)
    const dateB = new Date(b.created_at)
    return dateA - dateB
  })
})

const summary = computed(() => {
  const validOrders = props.orders.filter(order => !order.estornado)
  
  return {
    totalOrders: validOrders.length,
    totalRevenue: validOrders.reduce((sum, order) => sum + order.valor, 0),
    pendingOrders: validOrders.filter(order => order.status_preparo === 'PENDENTE').length,
    readyOrders: validOrders.filter(order => order.status_preparo === 'PRONTO').length,
    paidOrders: validOrders.filter(order => order.metodo_pagamento === 'Pago').length,
    unpaidOrders: validOrders.filter(order => order.metodo_pagamento === 'Não Pago').length
  }
})

// Methods
const toggleSummary = () => {
  showSummary.value = !showSummary.value
}
</script>

<style scoped>
.orders-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.orders-header {
  border-bottom: 1px solid var(--q-primary);
  margin-bottom: 1rem;
}

.header-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
}

.header-title h5 {
  color: var(--q-primary);
  display: flex;
  align-items: center;
}

.summary-expansion {
  margin-bottom: 1rem;
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.summary-stats {
  display: flex;
  gap: 0.5rem;
}

.summary-details {
  background: #f8f9fa;
  border-radius: 8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border-left: 3px solid var(--q-primary);
}

.summary-item .label {
  font-weight: 500;
  color: var(--q-dark);
}

.summary-item .value {
  font-weight: bold;
  font-size: 1.1rem;
}

.value.pending { color: #ff9800; }
.value.ready { color: #4caf50; }
.value.paid { color: #2196f3; }
.value.unpaid { color: #f44336; }

.orders-container {
  flex: 1;
  min-height: 0;
}

.orders-grid {
  display: grid;
  gap: 1rem;
  padding: 0.5rem 0;
}

.no-orders {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .header-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .summary-stats {
    align-self: flex-end;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .orders-grid {
    gap: 0.5rem;
  }
}
</style>