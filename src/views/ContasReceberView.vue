<template>
  <div class="contas-container">
    <div class="lista-clientes">
      <h2>Clientes com Histórico</h2>
      <!-- PASSO 3: CAMPO DE BUSCA ADICIONADO -->
      <div class="busca-container">
        <input type="text" v-model="buscaCliente" placeholder="Buscar cliente..." />
      </div>
      <!-- PASSO 4: V-FOR MODIFICADO -->
      <ul>
        <li
          v-for="cliente in clientesFiltrados"
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

        <!-- No topo da seção do extrato -->
        <div class="extrato-actions">
          <div class="filtro-periodo">
            <label>De:</label>
            <input type="date" v-model="filtroInicio" />
            <label>Até:</label>
            <input type="date" v-model="filtroFim" />
          </div>
          <button @click="imprimirExtrato" class="btn-imprimir">🖨️ Imprimir Extrato</button>
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
            v-for="t in transacoesFiltradas"
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
import { ref, computed, watch, onMounted } from 'vue'
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

const buscaCliente = ref('')

const filtroInicio = ref('')
const filtroFim = ref('')

const clientesFiltrados = computed(() => {
  if (!buscaCliente.value) {
    return todosOsClientesComConta.value
  }
  return todosOsClientesComConta.value.filter((c) =>
    c.nome.toLowerCase().includes(buscaCliente.value.toLowerCase()),
  )
})

const transacoesFiltradas = computed(() => {
  if (!clienteSelecionado.value) return []
  if (!filtroInicio.value || !filtroFim.value) {
    return clienteSelecionado.value.transacoes // Retorna todas se não houver filtro
  }
  return clienteSelecionado.value.transacoes.filter((t) => {
    const dataTransacao = t.data_transacao
    return dataTransacao >= filtroInicio.value && dataTransacao <= filtroFim.value
  })
})

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

watch(
  () => dataStore.todosOsClientes,
  () => {
    carregarContas()
  },
  { immediate: true, deep: true },
)

onMounted(async () => {
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

const imprimirExtrato = () => {
  if (!clienteSelecionado.value) return

  const cliente = clienteSelecionado.value
  const transacoesParaImprimir = transacoesFiltradas.value.filter((t) => !t.estornado)

  const corpoTabela = transacoesParaImprimir
    .map((t) => {
      const valor = t.valor.toFixed(2)
      const tipo = t.tipo_transacao
      const detalhes =
        t.tipo_transacao === 'VENDA' && t.itens
          ? t.itens
              .map((item) => `<li>${item.quantidade}x ${item.nome_produto_congelado}</li>`)
              .join('')
          : t.observacoes || ''

      return `
          <tr>
              <td>${new Date(t.created_at || t.data_transacao).toLocaleDateString('pt-BR')}</td>
              <td>${tipo}</td>
              <td><ul>${detalhes}</ul></td>
              <td class="${t.valor > 0 ? 'debito' : 'credito'}">R$ ${valor}</td>
          </tr>
      `
    })
    .join('')

  const extratoHTML = `
    <html>
      <head>
        <title>Extrato de ${cliente.nome}</title>
        <style>
          body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }
          ul { margin: 0; padding-left: 15px; list-style-position: inside; } .debito { color: red; } .credito { color: green; }
        </style>
      </head>
      <body>
        <h1>Extrato do Cliente: ${cliente.nome}</h1>
        <h3>Saldo Devedor Atual: R$ ${cliente.saldo.toFixed(2)}</h3>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Operação</th>
              <th>Detalhes</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>${corpoTabela}</tbody>
        </table>
      </body>
    </html>`

  // --- LÓGICA DE IMPRESSÃO APRIMORADA ---
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(extratoHTML)
  doc.close()

  iframe.contentWindow.focus() // Foca no iframe para a impressão
  iframe.contentWindow.print()

  // Remove o iframe do DOM após a impressão para limpar a memória
  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
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
  display: flex;
  flex-direction: column;
}
.lista-clientes h2 {
  padding: 20px;
  margin: 0;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-size: 1.2em;
}
/* ESTILO PARA O CONTAINER DA BUSCA */
.busca-container {
  padding: 10px 15px;
  border-bottom: 1px solid #ddd;
  background-color: #f8f9fa;
}
.busca-container input {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}
.lista-clientes ul {
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  overflow-y: auto;
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

.extrato-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ddd;
  gap: 15px;
}
.filtro-periodo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filtro-periodo input {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}
.btn-imprimir {
  padding: 10px 15px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s;
}
.btn-imprimir:hover {
  background-color: #45a049;
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
  grid-template-columns: 1fr auto;
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
