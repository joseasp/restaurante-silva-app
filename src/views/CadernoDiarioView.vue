<template>
  <q-page class="caderno-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h4 class="page-title">
          <q-icon name="book" class="q-mr-md" />
          {{ formatSelectedDate }}
        </h4>
        
        <div class="header-actions">
          <q-input
            v-model="selectedDate"
            type="date"
            outlined
            dense
            class="date-input"
          />
          
          <q-btn
            @click="printDailyReport"
            color="primary"
            icon="print"
            label="Imprimir Dia"
            outline
            dense
            class="print-btn"
          />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <q-splitter
        v-model="splitterModel"
        :limits="[25, 75]"
        class="full-height"
      >
        <!-- Left Panel - New Order Form -->
        <template v-slot:before>
          <div class="left-panel">
            <NewOrderForm
              v-model="currentOrder"
              :is-editing="isEditing"
              :submission-status="submissionStatus"
              :is-submitting="isSubmitting"
              @submit="handleOrderSubmit"
              @cancel-edit="cancelEdit"
            />
          </div>
        </template>

        <!-- Right Panel - Orders List -->
        <template v-slot:after>
          <div class="right-panel">
            <OrdersList
              :orders="ordersOfDay"
              :loading="ordersLoading"
              @edit-order="handleEditOrder"
              @cancel-order="handleCancelOrder"
              @toggle-payment="handleTogglePayment"
              @toggle-status="handleToggleStatus"
              @change-payment-form="handleChangePaymentForm"
              @print-order="handlePrintOrder"
            />
          </div>
        </template>
      </q-splitter>
    </div>

    <!-- PIN Modal for Protected Actions -->
    <PinModal
      :visible="showPinModal"
      @close="showPinModal = false"
      @success="executePendingAction"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDataStore } from '@/stores/dataStore.js'
import { useRealtimeTransactions } from '@/composables/useRealtimeTransactions.js'
import { db } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js'
import { DADOS_RESTAURANTE } from '@/config.js'

import NewOrderForm from '@/components/caderno/NewOrderForm.vue'
import OrdersList from '@/components/caderno/OrdersList.vue'
import PinModal from '@/components/PinModal.vue'

const $q = useQuasar()
const dataStore = useDataStore()

// Reactive state
const splitterModel = ref(35)
const isEditing = ref(false)
const isSubmitting = ref(false)
const submissionStatus = ref('') // 'sending', 'success', 'error'
const showPinModal = ref(false)
const pendingAction = ref(null)

// Date handling
const today = new Date()
today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
const selectedDate = ref(today.toISOString().slice(0, 10))

// Orders data
const { transactions: ordersOfDay, loading: ordersLoading } = useRealtimeTransactions(selectedDate)

// Order form data
const getInitialOrder = () => ({
  cliente: null,
  itens: [],
  metodo_pagamento: 'Não Pago',
  forma_pagamento: '',
  observacoes: '',
  nome_funcionario: ''
})

const currentOrder = ref(getInitialOrder())

// Computed
const formatSelectedDate = computed(() => {
  if (!selectedDate.value) return ''
  const [year, month, day] = selectedDate.value.split('-')
  return `${day}/${month}/${year}`
})

// Methods
const handleOrderSubmit = async (orderData) => {
  if (isSubmitting.value) return
  
  if (!orderData.cliente || orderData.itens.length === 0) {
    $q.notify({
      type: 'negative',
      message: 'Selecione um cliente e adicione itens ao pedido'
    })
    return
  }

  try {
    submissionStatus.value = 'sending'
    isSubmitting.value = true

    // Prevent rapid submissions
    const now = Date.now()
    if (now - lastSubmissionTime < 500) {
      $q.notify({
        type: 'warning',
        message: 'Aguarde um momento...'
      })
      return
    }
    lastSubmissionTime = now

    // Prepare transaction data
    const transactionData = {
      cliente_id: orderData.cliente.id,
      valor: orderData.itens.reduce((sum, item) => 
        sum + (item.preco_unitario_congelado * item.quantidade), 0
      ),
      data_transacao: selectedDate.value,
      tipo_transacao: 'VENDA',
      metodo_pagamento: orderData.metodo_pagamento,
      forma_pagamento: orderData.forma_pagamento || '',
      status_preparo: 'PENDENTE',
      observacoes: orderData.observacoes || '',
      nome_funcionario_empresa: orderData.nome_funcionario || '',
      created_at: new Date(),
    }

    // Save employee if needed
    if (orderData.cliente.tipo === 'EMPRESA' && 
        orderData.nome_funcionario && 
        !await employeeExists(orderData.cliente.id, orderData.nome_funcionario)) {
      await saveEmployee(orderData.cliente.id, orderData.nome_funcionario)
    }

    // Submit order
    await dataStore.lancarPedido(transactionData, orderData.itens)

    // Reset form
    currentOrder.value = getInitialOrder()
    isEditing.value = false
    submissionStatus.value = 'success'
    
    setTimeout(() => {
      submissionStatus.value = ''
    }, 2000)

  } catch (error) {
    console.error('Erro ao lançar pedido:', error)
    submissionStatus.value = 'error'
    setTimeout(() => {
      submissionStatus.value = ''
    }, 3000)
  } finally {
    setTimeout(() => {
      isSubmitting.value = false
    }, 400)
  }
}

const handleEditOrder = async (order) => {
  // Mark original order as cancelled (estornado)
  pendingAction.value = async () => {
    try {
      await updateTransaction(order.id, { estornado: true })
      
      // Load order data into form
      const client = dataStore.todosOsClientes.find(c => c.id === order.cliente_id)
      currentOrder.value = {
        cliente: client,
        itens: [...order.itens],
        metodo_pagamento: order.metodo_pagamento,
        forma_pagamento: order.forma_pagamento || '',
        observacoes: order.observacoes || '',
        nome_funcionario: order.nome_funcionario_empresa || ''
      }
      
      isEditing.value = true
      
      $q.notify({
        type: 'info',
        message: 'Pedido carregado para edição'
      })
    } catch (error) {
      console.error('Erro ao carregar pedido para edição:', error)
      $q.notify({
        type: 'negative',
        message: 'Erro ao carregar pedido'
      })
    }
  }
  
  showPinModal.value = true
}

const handleCancelOrder = (order) => {
  pendingAction.value = async () => {
    try {
      await updateTransaction(order.id, { estornado: true })
      $q.notify({
        type: 'positive',
        message: 'Pedido estornado com sucesso'
      })
    } catch (error) {
      console.error('Erro ao estornar pedido:', error)
      $q.notify({
        type: 'negative',
        message: 'Erro ao estornar pedido'
      })
    }
  }
  
  showPinModal.value = true
}

const handleTogglePayment = async (order) => {
  if (order.cliente_nome === 'Cliente Avulso') {
    $q.notify({
      type: 'warning',
      message: 'Não é possível alterar status de pagamento para venda avulsa'
    })
    return
  }

  try {
    const newStatus = order.metodo_pagamento === 'Não Pago' ? 'Pago' : 'Não Pago'
    await updateTransaction(order.id, { 
      metodo_pagamento: newStatus,
      forma_pagamento: newStatus === 'Não Pago' ? '' : order.forma_pagamento
    })
  } catch (error) {
    console.error('Erro ao alterar status de pagamento:', error)
    $q.notify({
      type: 'negative',
      message: 'Erro ao alterar status de pagamento'
    })
  }
}

const handleToggleStatus = async (order) => {
  try {
    const newStatus = order.status_preparo === 'PENDENTE' ? 'PRONTO' : 'PENDENTE'
    await updateTransaction(order.id, { status_preparo: newStatus })
  } catch (error) {
    console.error('Erro ao alterar status de preparo:', error)
    $q.notify({
      type: 'negative',
      message: 'Erro ao alterar status de preparo'
    })
  }
}

const handleChangePaymentForm = async (order, newForm) => {
  try {
    await updateTransaction(order.id, { forma_pagamento: newForm || '' })
  } catch (error) {
    console.error('Erro ao alterar forma de pagamento:', error)
    $q.notify({
      type: 'negative',
      message: 'Erro ao alterar forma de pagamento'
    })
  }
}

const handlePrintOrder = (order) => {
  printOrderReceipt(order)
}

const cancelEdit = () => {
  currentOrder.value = getInitialOrder()
  isEditing.value = false
  submissionStatus.value = ''
}

const executePendingAction = () => {
  if (pendingAction.value) {
    pendingAction.value()
    pendingAction.value = null
  }
  showPinModal.value = false
}

// Helper functions
let lastSubmissionTime = 0

const updateTransaction = async (id, updates) => {
  const { error } = await supabase
    .from('transacoes')
    .update(updates)
    .eq('id', id)
  
  if (error) throw error
  
  await db.transacoes.update(id, updates)
}

const employeeExists = async (clienteId, employeeName) => {
  const existing = await db.funcionarios
    .where('cliente_id').equals(clienteId)
    .and(emp => emp.nome.toLowerCase() === employeeName.toLowerCase())
    .first()
  return !!existing
}

const saveEmployee = async (clienteId, employeeName) => {
  try {
    await db.funcionarios.add({
      nome: employeeName,
      cliente_id: clienteId,
      created_at: new Date(),
    })
  } catch (error) {
    console.error('Erro ao salvar funcionário:', error)
  }
}

const printDailyReport = () => {
  // Implementation for daily report printing
  const validOrders = ordersOfDay.value.filter(order => !order.estornado)
  
  if (validOrders.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Nenhum pedido encontrado para imprimir'
    })
    return
  }

  // Create print content
  const printContent = generateDailyReportHTML(validOrders)
  
  // Open print window
  const printWindow = window.open('', '_blank')
  printWindow.document.write(printContent)
  printWindow.document.close()
  
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

const printOrderReceipt = (order) => {
  const receiptHTML = generateOrderReceiptHTML(order)
  
  const printWindow = window.open('', '_blank')
  printWindow.document.write(receiptHTML)
  printWindow.document.close()
  
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

const generateDailyReportHTML = (orders) => {
  const totalValue = orders.reduce((sum, order) => sum + order.valor, 0)
  const date = formatSelectedDate.value

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Relatório Diário - ${date}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; color: #db9000; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #db9000; color: white; }
        .total { font-weight: bold; background-color: #f9f9f9; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${DADOS_RESTAURANTE.nome_fantasia}</h1>
        <p>Relatório Diário - ${date}</p>
        <p>${DADOS_RESTAURANTE.endereco} - ${DADOS_RESTAURANTE.telefone}</p>
      </div>
      
      <div class="summary">
        <h3>Resumo do Dia</h3>
        <p><strong>Total de Pedidos:</strong> ${orders.length}</p>
        <p><strong>Faturamento Total:</strong> R$ ${totalValue.toFixed(2)}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Itens</th>
            <th>Valor</th>
            <th>Pagamento</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td>${order.cliente_nome}</td>
              <td>${order.itens.map(item => `${item.quantidade}x ${item.nome}`).join(', ')}</td>
              <td>R$ ${order.valor.toFixed(2)}</td>
              <td>${order.metodo_pagamento}</td>
              <td>${order.status_preparo}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total">
            <td colspan="2"><strong>TOTAL</strong></td>
            <td><strong>R$ ${totalValue.toFixed(2)}</strong></td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
      
      <div class="footer">
        <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    </body>
    </html>
  `
}

const generateOrderReceiptHTML = (order) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pedido - ${order.cliente_nome}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; max-width: 300px; }
        h1 { text-align: center; color: #db9000; font-size: 18px; }
        .header { text-align: center; margin-bottom: 20px; }
        .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .total { border-top: 1px solid #000; padding-top: 10px; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${DADOS_RESTAURANTE.nome_fantasia}</h1>
        <p>${DADOS_RESTAURANTE.endereco}</p>
        <p>${DADOS_RESTAURANTE.telefone}</p>
        <hr>
      </div>
      
      <p><strong>Cliente:</strong> ${order.cliente_nome}</p>
      ${order.nome_funcionario_empresa ? `<p><strong>Funcionário:</strong> ${order.nome_funcionario_empresa}</p>` : ''}
      <p><strong>Data:</strong> ${new Date(order.created_at).toLocaleString('pt-BR')}</p>
      <hr>
      
      ${order.itens.map(item => `
        <div class="item">
          <span>${item.quantidade}x ${item.nome}</span>
          <span>R$ ${(item.preco_unitario_congelado * item.quantidade).toFixed(2)}</span>
        </div>
      `).join('')}
      
      <div class="total">
        <div class="item">
          <span>TOTAL</span>
          <span>R$ ${order.valor.toFixed(2)}</span>
        </div>
      </div>
      
      ${order.observacoes ? `<p><strong>Obs:</strong> ${order.observacoes}</p>` : ''}
      
      <div class="footer">
        <p>${DADOS_RESTAURANTE.cnpj}</p>
        <p>*** NÃO É DOCUMENTO FISCAL ***</p>
      </div>
    </body>
    </html>
  `
}

// Lifecycle
onMounted(async () => {
  await dataStore.fetchClientes()
  await dataStore.fetchProdutos()
})
</script>

<style scoped>
.caderno-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-header {
  background: linear-gradient(135deg, var(--q-primary) 0%, #ffcc33 100%);
  color: white;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  margin: 0;
  display: flex;
  align-items: center;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.date-input {
  background: white;
  border-radius: 4px;
  min-width: 150px;
}

.print-btn {
  background: rgba(255, 255, 255, 0.1);
  border-color: white;
  color: white;
}

.print-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.main-content {
  flex: 1;
  min-height: 0;
}

.left-panel,
.right-panel {
  height: 100%;
  padding: 1rem;
}

.left-panel {
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
}

.right-panel {
  background: white;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: space-between;
  }
  
  .page-title {
    text-align: center;
    font-size: 1.2rem;
  }
  
  .left-panel,
  .right-panel {
    padding: 0.5rem;
  }
}
</style>