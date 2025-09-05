<template>
  <div class="contas-container">
    <div class="lista-clientes">
      <h2>Clientes com Histórico</h2>
      <ul>
        <li
          v-for="cliente in todosOsClientesComConta"
          :key="cliente.id"
          @click="selecionarCliente(cliente)"
          :class="{ active: clienteSelecionado && clienteSelecionado.id === cliente.id }"
        >
          <span>{{ cliente.nome }}</span>
          <span
            class="saldo"
            :class="{ devedor: cliente.saldo > 0.01, credor: cliente.saldo < -0.01 }"
          >
            R$ {{ cliente.saldo.toFixed(2) }}
          </span>
        </li>
      </ul>
    </div>

    <div class="extrato-cliente">
      <div v-if="!clienteSelecionado" class="placeholder-extrato">
        <h2>Selecione um cliente para ver o extrato</h2>
      </div>
      <div v-else>
        <h2>Extrato de: {{ clienteSelecionado.nome }}</h2>
        <div
          class="saldo-total"
          :class="{
            devedor: clienteSelecionado.saldo > 0.01,
            credor: clienteSelecionado.saldo < -0.01,
          }"
        >
          <span v-if="clienteSelecionado.saldo > 0.01"
            >Saldo Devedor: R$ {{ clienteSelecionado.saldo.toFixed(2) }}</span
          >
          <span v-else-if="clienteSelecionado.saldo < -0.01"
            >Crédito Disponível: R$ {{ Math.abs(clienteSelecionado.saldo).toFixed(2) }}</span
          >
          <span v-else>Saldo Zerado</span>
        </div>

        <form @submit.prevent="registrarPagamento" class="pagamento-form">
          <input
            type="number"
            step="0.01"
            placeholder="Valor do Pagamento"
            v-model="valorPagamento"
            required
          />
          <select v-model="formaPagamento">
            <option disabled value="">Selecione a forma (opcional)</option>
            <option>Dinheiro</option>
            <option>PIX</option>
            <option>Cartão</option>
          </select>
          <textarea
            v-model="observacoesPagamento"
            placeholder="Observações (opcional)"
            rows="2"
          ></textarea>
          <button type="submit">Registrar Pagamento</button>
        </form>

        <ul class="lista-transacoes">
          <li
            v-for="t in clienteSelecionado.transacoes"
            :key="t.id"
            class="transacao-item"
            :class="{
              estornado: t.estornado,
              'fundo-pagamento': t.tipo_transacao === 'PAGAMENTO' && !t.estornado,
            }"
          >
            <div class="transacao-info">
              <span class="data">{{
                new Date(t.created_at || t.data_transacao).toLocaleString('pt-BR')
              }}</span>
              <span class="tipo-transacao">
                {{ t.tipo_transacao }}
                <em
                  v-if="
                    (t.tipo_transacao === 'PAGAMENTO' ||
                      (t.tipo_transacao === 'VENDA' && t.metodo_pagamento === 'Pago')) &&
                    t.forma_pagamento
                  "
                >
                  ({{ t.forma_pagamento }})</em
                >
              </span>
              <span :class="{ 'valor-positivo': t.valor > 0, 'valor-negativo': t.valor < 0 }">
                R$ {{ t.valor > 0 ? '+' : '' }}{{ t.valor.toFixed(2) }}
              </span>
            </div>
            <div class="transacao-acoes">
              <button
                v-if="t.tipo_transacao === 'PAGAMENTO' && !t.estornado"
                @click="estornarPagamento(t)"
                class="btn-estornar"
              >
                🗑️
              </button>
            </div>
            <div v-if="t.observacoes" class="observacoes-transacao">
              <strong>Obs:</strong> {{ t.observacoes }}
            </div>
            <ul v-if="t.tipo_transacao === 'VENDA' && t.itens" class="itens-da-venda">
              <li v-for="item in t.itens" :key="item.id">
                - {{ item.quantidade }}x {{ item.nome_produto_congelado }}
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <PinModal
      :visible="mostrarPinModal"
      @close="mostrarPinModal = false"
      @success="executarAcaoPendente"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue' // Adicionado onMounted
import { useDataStore } from '@/stores/dataStore.js'
import { db } from '@/services/databaseService.js'
import PinModal from '@/components/PinModal.vue'
import { useAuthStore } from '@/stores/authStore'

const dataStore = useDataStore()
const authStore = useAuthStore()

const todosOsClientesComConta = ref([])
const clienteSelecionado = ref(null)
const valorPagamento = ref('')
const formaPagamento = ref('')
const observacoesPagamento = ref('')
const mostrarPinModal = ref(false)
const acaoPendente = ref(null)

// --- CORREÇÃO: A FUNÇÃO carregarContas AGORA ESTÁ ANTES DE SER USADA ---
const carregarContas = async () => {
  try {
    const todasTransacoes = await db.transacoes.toArray()
    const clientesParaCalculo = dataStore.todosOsClientes.filter((c) => c.tipo !== 'AVULSO')

    const contas = await Promise.all(
      clientesParaCalculo.map(async (cliente) => {
        const transacoesDoCliente = todasTransacoes.filter((t) => t.cliente_id === cliente.id)

        const saldo = transacoesDoCliente.reduce((acc, t) => {
          if (!t.estornado) {
            if (t.tipo_transacao === 'VENDA' && t.metodo_pagamento === 'Não Pago') {
              return acc + t.valor
            }
            if (t.tipo_transacao === 'PAGAMENTO') {
              return acc + t.valor
            }
          }
          return acc
        }, 0)

        const transacoesComItens = await Promise.all(
          transacoesDoCliente.map(async (t) => {
            if (t.tipo_transacao === 'VENDA') {
              const itens = await db.itens_transacao.where({ transacao_id: t.id }).toArray()
              return { ...t, itens }
            }
            return t
          }),
        )

        transacoesComItens.sort(
          (a, b) =>
            new Date(b.created_at || b.data_transacao || 0) -
            new Date(a.created_at || a.data_transacao || 0),
        )

        return { ...cliente, saldo, transacoes: transacoesComItens }
      }),
    )

    todosOsClientesComConta.value = contas
      .filter((c) => c.transacoes.length > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome))
  } catch (error) {
    console.error('Erro ao carregar contas:', error)
    todosOsClientesComConta.value = []
  }
}

// --- CORREÇÃO: O watch agora pode chamar carregarContas sem erro ---
watch(
  () => dataStore.todosOsClientes,
  () => {
    carregarContas()
  },
  { immediate: true, deep: true },
)

onMounted(async () => {
  // É uma boa prática garantir que os clientes estão carregados antes de rodar a lógica
  await dataStore.fetchClientes()
})

const selecionarCliente = (cliente) => {
  clienteSelecionado.value = cliente
}

const registrarPagamento = async () => {
  if (!clienteSelecionado.value || !valorPagamento.value) return
  const valor = parseFloat(valorPagamento.value)
  if (valor <= 0) {
    alert('O valor do pagamento deve ser positivo.')
    return
  }
  try {
    const clienteId = clienteSelecionado.value.id
    await db.transacoes.add({
      cliente_id: clienteId,
      tipo_transacao: 'PAGAMENTO',
      valor: -valor,
      data_transacao: new Date().toISOString().slice(0, 10),
      created_at: new Date(),
      estornado: false,
      forma_pagamento: formaPagamento.value || null,
      observacoes: observacoesPagamento.value,
    })

    valorPagamento.value = ''
    formaPagamento.value = ''
    observacoesPagamento.value = ''

    await carregarContas()
    const clienteAtualizado = todosOsClientesComConta.value.find((c) => c.id === clienteId)
    if (clienteAtualizado) {
      selecionarCliente(clienteAtualizado)
    }
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error)
  }
}

const estornarPagamento = (pagamento) => {
  acaoPendente.value = async () => {
    await db.transacoes.update(pagamento.id, { estornado: true })
    await carregarContas()
    const clienteAtualizado = todosOsClientesComConta.value.find(
      (c) => c.id === pagamento.cliente_id,
    )
    if (clienteAtualizado) {
      selecionarCliente(clienteAtualizado)
    } else {
      clienteSelecionado.value = null
    }
  }
  mostrarPinModal.value = true
}

const executarAcaoPendente = () => {
  if (acaoPendente.value) {
    acaoPendente.value()
  }
  mostrarPinModal.value = false
  acaoPendente.value = null
}
</script>

<style scoped>
.contas-container {
  display: flex;
  height: calc(100vh - 58px);
}
.lista-clientes {
  width: 350px;
  border-right: 1px solid #ddd;
  overflow-y: auto;
  flex-shrink: 0;
}
.lista-clientes h2 {
  padding: 20px;
  margin: 0;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-size: 1.2em;
}
.lista-clientes ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.lista-clientes li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}
.lista-clientes li:hover {
  background: #f0f0f0;
}
.lista-clientes li.active {
  background: #ffc107;
  color: black;
  font-weight: bold;
}
.saldo {
  font-weight: bold;
}
.saldo.devedor {
  color: #dc3545;
}
.saldo.credor {
  color: #198754;
}

.extrato-cliente {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
}
.placeholder-extrato {
  text-align: center;
  color: #888;
  margin-top: 50px;
}
.saldo-total {
  font-size: 1.5em;
  font-weight: bold;
  margin: 10px 0 20px;
}
.saldo-total.devedor {
  color: #dc3545;
}
.saldo-total.credor {
  color: #198754;
}
.pagamento-form {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-areas:
    'valor select'
    'obs obs'
    'botao botao';
  gap: 10px;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ddd;
}
.pagamento-form input[type='number'] {
  grid-area: valor;
  padding: 10px;
}
.pagamento-form select {
  grid-area: select;
  padding: 10px;
}
.pagamento-form textarea {
  grid-area: obs;
  padding: 10px;
}
.pagamento-form button {
  grid-area: botao;
  padding: 10px;
}

.lista-transacoes {
  list-style: none;
  padding: 0;
  margin: 0;
}
.transacao-item {
  display: grid;
  grid-template-columns: 1fr auto; /* Coluna de info e coluna de ações */
  gap: 10px;
  padding: 15px 10px;
  border-bottom: 1px solid #eee;
}
.transacao-info {
  display: grid;
  grid-template-columns: 160px 100px 1fr;
  gap: 10px;
  align-items: center;
}
.transacao-acoes {
  justify-self: end;
}
.btn-estornar {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2em;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.btn-estornar:hover {
  opacity: 1;
}
.transacao-item.estornado {
  background-color: #f8f9fa;
  color: #adb5bd;
  text-decoration: line-through;
}
.transacao-item.estornado .valor-positivo,
.transacao-item.estornado .valor-negativo {
  color: #adb5bd;
}
.fundo-pagamento {
  background-color: #e8f5e9;
}
.transacao-item:last-child {
  border-bottom: none;
}
.tipo-transacao em {
  font-style: italic;
  color: #666;
}
.valor-positivo {
  color: #dc3545;
  font-weight: bold;
  text-align: right;
}
.valor-negativo {
  color: #198754;
  font-weight: bold;
  text-align: right;
}
.itens-da-venda,
.observacoes-transacao {
  grid-column: 1 / -1;
  padding-left: 20px;
  margin-top: 8px;
}
.itens-da-venda {
  list-style: none;
  font-size: 0.9em;
  color: #333;
}
.observacoes-transacao {
  font-size: 0.9em;
  color: #555;
  white-space: pre-wrap;
  background-color: #f8f9fa;
  padding: 5px 10px;
  border-radius: 4px;
}
</style>
