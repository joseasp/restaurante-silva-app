<template>
  <div class="caderno-diario-container">
    <header class="view-header">
      <h1>Caderno Digital Diário</h1>
      <input type="date" v-model="dataSelecionada" />
    </header>

    <main class="main-content">
      <section class="lancamento-form-section">
        <h2>{{ lancamentoEmEdicao ? 'Editando Lançamento' : 'Novo Lançamento' }}</h2>

        <form @submit.prevent="lancarPedido" class="lancamento-form">
          <label>Cliente:</label>
          <div v-if="!pedidoAtual.cliente">
            <div class="cliente-actions">
              <div class="autocomplete">
                <input type="text" placeholder="Buscar cliente..." v-model="buscaCliente" />
                <ul v-if="clientesFiltrados.length">
                  <li
                    v-for="cliente in clientesFiltrados"
                    :key="cliente.id"
                    @click="selecionarCliente(cliente)"
                  >
                    {{ cliente.nome }}
                  </li>
                </ul>
              </div>
              <button type="button" @click="selecionarClienteAvulso" class="btn-avulso">
                Venda Avulsa
              </button>
            </div>
          </div>
          <div v-else class="cliente-selecionado">
            <span>{{ pedidoAtual.cliente.nome }}</span>
            <button type="button" @click="removerCliente" class="remove-btn">X</button>
          </div>

          <div
            v-if="pedidoAtual.cliente && pedidoAtual.cliente.tipo === 'EMPRESA'"
            class="campo-funcionario"
          >
            <label>Nome do Funcionário:</label>
            <input
              type="text"
              placeholder="Quem está retirando?"
              v-model="pedidoAtual.nome_funcionario"
              required
            />
          </div>

          <label>Adicionar Produto:</label>
          <div class="cliente-actions">
            <div class="autocomplete">
              <input type="text" placeholder="Buscar produto..." v-model="buscaProduto" />
              <ul v-if="produtosFiltrados.length">
                <li
                  v-for="produto in produtosFiltrados"
                  :key="produto.id"
                  @click="adicionarItem(produto)"
                >
                  {{ produto.nome }} - R$ {{ produto.preco.toFixed(2) }}
                </li>
              </ul>
            </div>
            <button type="button" @click="abrirModalItemAvulso" class="btn-avulso">
              + Item Avulso
            </button>
          </div>

          <div class="itens-pedido">
            <h4>Itens do Pedido (Total: R$ {{ totalPedido.toFixed(2) }})</h4>
            <ul>
              <li v-if="pedidoAtual.itens.length === 0" class="placeholder-item">
                Nenhum item adicionado
              </li>
              <li v-for="(item, index) in pedidoAtual.itens" :key="index" class="item-no-pedido">
                <span class="item-nome">{{ item.nome_produto_congelado }}</span>
                <div class="item-controles">
                  <button type="button" @click="decrementarItem(item, index)" class="btn-qty">
                    -
                  </button>
                  <span class="item-qtd">{{ item.quantidade }}</span>
                  <button type="button" @click="incrementarItem(item)" class="btn-qty">+</button>
                </div>
                <span class="item-preco"
                  >R$ {{ (item.preco_unitario_congelado * item.quantidade).toFixed(2) }}</span
                >
                <button type="button" @click="removerItem(index)" class="remove-btn">X</button>
              </li>
            </ul>
          </div>

          <label>Observações:</label>
          <textarea
            placeholder="Ex: Sem cebola, troco para R$ 50..."
            v-model="pedidoAtual.observacoes"
          ></textarea>

          <div class="opcoes-pagamento">
            <button
              type="button"
              :class="{ active: pedidoAtual.metodo_pagamento === 'Não Pago' }"
              @click="setPagamento('Não Pago')"
              :disabled="pedidoAtual.cliente && pedidoAtual.cliente.tipo === 'AVULSO'"
            >
              Não Pago
            </button>
            <button
              type="button"
              :class="{ active: pedidoAtual.metodo_pagamento === 'Pago' }"
              @click="setPagamento('Pago')"
            >
              Pago
            </button>
          </div>

          <button class="lancar-btn" type="submit">
            {{ lancamentoEmEdicao ? 'Salvar Alterações' : 'Lançar no Caderno' }}
          </button>
        </form>
      </section>

      <section class="lancamentos-lista-section">
        <h2>Lançamentos de {{ dataFormatada }}</h2>
        <div v-if="!lancamentosDoDia || lancamentosDoDia.length === 0" class="placeholder-item">
          Nenhum lançamento para esta data.
        </div>
        <div v-else class="lista-lancamentos">
          <div
            v-for="lancamento in lancamentosDoDia"
            :key="lancamento.id"
            class="lancamento-item"
            :class="{
              'pendente-bg': lancamento.status_preparo === 'PENDENTE' && !lancamento.estornado,
              estornado: lancamento.estornado,
            }"
          >
            <div class="lancamento-header">
              <h3>
                {{ lancamento.cliente_nome }}
                <span v-if="lancamento.nome_funcionario_empresa" class="nome-funcionario">
                  ({{ lancamento.nome_funcionario_empresa }})
                </span>
              </h3>
              <div class="status-container">
                <button
                  @click="alternarStatusPreparo(lancamento)"
                  :class="[
                    'status-preparo-btn',
                    lancamento.status_preparo ? lancamento.status_preparo.toLowerCase() : '',
                  ]"
                >
                  {{ lancamento.status_preparo }}
                </button>
                <span
                  @click="alternarStatusPagamento(lancamento)"
                  :class="[
                    'status-tag',
                    lancamento.metodo_pagamento === 'Não Pago' ? 'nao-pago' : 'pago',
                  ]"
                >
                  {{ lancamento.metodo_pagamento }}
                  <em v-if="lancamento.metodo_pagamento === 'Pago' && lancamento.forma_pagamento">
                    ({{ lancamento.forma_pagamento }})</em
                  >
                </span>
                <!-- NOVO: Link "Detalhes" -->
                <span
                  v-if="lancamento.metodo_pagamento === 'Pago'"
                  @click.stop="toggleSeletorFP(lancamento)"
                  class="detalhes-pagamento-btn"
                >
                  Detalhes
                </span>
              </div>
              <span class="valor-total">Total: R$ {{ lancamento.valor.toFixed(2) }}</span>
              <div class="menu-acoes-container" ref="menuRefs">
                <button @click="abrirMenu(lancamento, $event)" class="btn-menu-acoes">⋮</button>
                <div v-if="menuAbertoId === lancamento.id" class="dropdown-menu">
                  <button @click="iniciarEdicaoLancamento(lancamento)">✏️ Editar</button>
                  <button @click="imprimirComprovante(lancamento)">🖨️ Imprimir</button>
                  <button @click="estornarLancamento(lancamento)" class="acao-perigosa">
                    🗑️ Estornar
                  </button>
                </div>
              </div>
            </div>

            <ul class="itens-lancamento">
              <li v-for="item in lancamento.itens" :key="item.id">
                - {{ item.quantidade }}x {{ item.nome_produto_congelado }}
              </li>
            </ul>

            <!-- NOVO: Pop-up de seleção -->
            <div v-if="lancamento.mostrarSeletorFP" class="fp-popup">
              <button
                @click="atualizarFormaPagamento(lancamento, 'Dinheiro')"
                :class="{ active: lancamento.forma_pagamento === 'Dinheiro' }"
              >
                Dinheiro
              </button>
              <button
                @click="atualizarFormaPagamento(lancamento, 'PIX')"
                :class="{ active: lancamento.forma_pagamento === 'PIX' }"
              >
                PIX
              </button>
              <button
                @click="atualizarFormaPagamento(lancamento, 'Cartão')"
                :class="{ active: lancamento.forma_pagamento === 'Cartão' }"
              >
                Cartão
              </button>
            </div>

            <p v-if="lancamento.observacoes" class="observacao-item">
              <strong>Obs:</strong> {{ lancamento.observacoes }}
            </p>
          </div>
        </div>
        <footer v-if="lancamentosDoDia && lancamentosDoDia.length > 0" class="resumo-diario-footer">
          <div class="resumo-item">
            <span>Total de Vendas:</span>
            <strong>{{ resumoDiario.totalVendas }}</strong>
          </div>
          <div class="resumo-item">
            <span>Faturamento do Dia:</span>
            <strong>R$ {{ resumoDiario.faturamento.toFixed(2) }}</strong>
          </div>
        </footer>
      </section>
    </main>

    <!-- Modal para Item Avulso -->
    <div v-if="mostrarModalItemAvulso" class="modal-overlay" @click.self="fecharModalItemAvulso">
      <div class="modal-content" @click.stop>
        <h3>Adicionar Item Avulso</h3>
        <form @submit.prevent="confirmarItemAvulso">
          <label>Descrição do Item:</label>
          <input type="text" v-model="itemAvulso.nome" required />
          <label>Preço (R$):</label>
          <input type="number" step="0.01" v-model="itemAvulso.preco" required />
          <div class="modal-actions">
            <button type="button" @click="fecharModalItemAvulso">Cancelar</button>
            <button type="submit">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useDataStore } from '@/stores/dataStore.js'
import { DADOS_RESTAURANTE, MENSAGEM_RODAPE } from '@/config.js'

const dataStore = useDataStore()

const clientes = computed(() => dataStore.clientes || [])
const produtos = computed(() => dataStore.produtos || [])
const lancamentosDoDia = computed(() => dataStore.transacoes || [])

const hoje = new Date()
hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset())
const dataSelecionada = ref(hoje.toISOString().slice(0, 10))
const buscaCliente = ref('')
const buscaProduto = ref('')
const lancamentoEmEdicao = ref(null)
const menuAbertoId = ref(null)
const mostrarModalItemAvulso = ref(false)
const itemAvulso = ref({ nome: '', preco: '' })

const getInitialPedido = () => ({
  cliente: null,
  itens: [],
  metodo_pagamento: 'Não Pago',
  observacoes: '',
  nome_funcionario: '',
  // O campo forma_pagamento_venda não é mais necessário no formulário
})

const pedidoAtual = ref(getInitialPedido())

const resumoDiario = computed(() => {
  const lancamentosValidos = (lancamentosDoDia.value || []).filter((l) => !l.estornado)
  const totalVendas = lancamentosValidos.length
  const faturamento = lancamentosValidos.reduce((acc, l) => acc + l.valor, 0)
  return { totalVendas, faturamento }
})

const clientesFiltrados = computed(() => {
  if (!buscaCliente.value) return []
  return (clientes.value || []).filter(
    (c) => c && c.nome && c.nome.toLowerCase().includes(buscaCliente.value.toLowerCase()),
  )
})

const produtosFiltrados = computed(() => {
  if (!buscaProduto.value) return []
  return (produtos.value || []).filter(
    (p) => p && p.nome && p.nome.toLowerCase().includes(buscaProduto.value.toLowerCase()),
  )
})

const selecionarCliente = (cliente) => {
  pedidoAtual.value.cliente = cliente
  buscaCliente.value = ''
}
const removerCliente = () => {
  pedidoAtual.value.cliente = null
}
const selecionarClienteAvulso = () => {
  const clienteAvulso = clientes.value.find((c) => c.nome === 'Cliente Avulso')
  if (clienteAvulso) {
    pedidoAtual.value.cliente = clienteAvulso
    pedidoAtual.value.metodo_pagamento = 'Pago'
  } else {
    alert('Cliente Avulso não encontrado. Tente recarregar a página.')
  }
}
const adicionarItem = (produto) => {
  if (produto.id && typeof produto.id === 'number') {
    const itemExistente = pedidoAtual.value.itens.find((i) => i.produto_id === produto.id)
    if (itemExistente) {
      itemExistente.quantidade++
      buscaProduto.value = ''
      return
    }
  }
  pedidoAtual.value.itens.push({
    produto_id: typeof produto.id === 'number' ? produto.id : null,
    nome_produto_congelado: produto.nome,
    preco_unitario_congelado: parseFloat(produto.preco),
    quantidade: 1,
  })
  buscaProduto.value = ''
}
const incrementarItem = (item) => {
  item.quantidade++
}
const decrementarItem = (item, index) => {
  if (item.quantidade > 1) {
    item.quantidade--
  } else {
    removerItem(index)
  }
}
const removerItem = (index) => {
  pedidoAtual.value.itens.splice(index, 1)
}
const setPagamento = (metodo) => {
  pedidoAtual.value.metodo_pagamento = metodo
}
const totalPedido = computed(() => {
  return pedidoAtual.value.itens.reduce(
    (acc, item) => acc + item.preco_unitario_congelado * item.quantidade,
    0,
  )
})
const dataFormatada = computed(() => {
  if (!dataSelecionada.value) return ''
  const [ano, mes, dia] = dataSelecionada.value.split('-')
  return `${dia}/${mes}/${ano}`
})

const carregarDadosIniciais = async () => {
  await dataStore.fetchClientes()
  await dataStore.fetchTransacoesDoDia(dataSelecionada.value)
}

const lancarPedido = async () => {
  if (!pedidoAtual.value.cliente || pedidoAtual.value.itens.length === 0) {
    alert('Selecione um cliente e adicione pelo menos um item.')
    return
  }

  const novaTransacao = {
    cliente_id: pedidoAtual.value.cliente.id,
    tipo_transacao: 'VENDA',
    valor: totalPedido.value,
    data_transacao: dataSelecionada.value,
    metodo_pagamento: pedidoAtual.value.metodo_pagamento,
    forma_pagamento: null, // A forma de pagamento será definida depois
    estornado: false,
    status_preparo: 'PENDENTE',
    observacoes: pedidoAtual.value.observacoes,
    nome_funcionario_empresa: pedidoAtual.value.nome_funcionario,
    created_at: new Date(),
  }

  await dataStore.lancarPedido(novaTransacao, pedidoAtual.value.itens)

  lancamentoEmEdicao.value = null
  pedidoAtual.value = getInitialPedido()
  buscaCliente.value = ''
}

const iniciarEdicaoLancamento = async (lancamento) => {
  menuAbertoId.value = null
  await dataStore.estornarLancamento(lancamento)
  const clienteParaEditar = dataStore.clientes.find((c) => c.id === lancamento.cliente_id)

  pedidoAtual.value.cliente = clienteParaEditar
  pedidoAtual.value.itens = JSON.parse(JSON.stringify(lancamento.itens))
  pedidoAtual.value.metodo_pagamento = lancamento.metodo_pagamento
  pedidoAtual.value.observacoes = lancamento.observacoes || ''
  pedidoAtual.value.nome_funcionario = lancamento.nome_funcionario_empresa || ''
  // Não precisamos mais do forma_pagamento_venda aqui
  lancamentoEmEdicao.value = lancamento
}

const estornarLancamento = async (lancamento) => {
  if (confirm('Tem certeza que deseja estornar este lançamento? A ação não pode ser desfeita.')) {
    await dataStore.estornarLancamento(lancamento)
  }
}

const alternarStatusPagamento = async (lancamento) => {
  if (lancamento.cliente_nome === 'Cliente Avulso') {
    alert('Não é possível alterar o status de pagamento para uma Venda Avulsa.')
    return
  }
  const novoStatus = lancamento.metodo_pagamento === 'Não Pago' ? 'Pago' : 'Não Pago'
  await dataStore.atualizarStatus(lancamento, { metodo_pagamento: novoStatus })
}

const alternarStatusPreparo = async (lancamento) => {
  const novoStatus = lancamento.status_preparo === 'PENDENTE' ? 'PRONTO' : 'PENDENTE'
  await dataStore.atualizarStatus(lancamento, { status_preparo: novoStatus })
}

// --- NOVA FUNÇÃO ---
const atualizarFormaPagamento = async (lancamento, novaForma) => {
  await dataStore.atualizarStatus(lancamento, { forma_pagamento: novaForma })
}

// --- NOVA FUNÇÃO ---
const toggleSeletorFP = (lancamento) => {
  // Encontra o lançamento na lista e inverte o estado de `mostrarSeletorFP`
  const l = lancamentosDoDia.value.find((item) => item.id === lancamento.id)
  if (l) {
    l.mostrarSeletorFP = !l.mostrarSeletorFP
  }
}

const abrirModalItemAvulso = () => {
  itemAvulso.value = { nome: '', preco: '' }
  mostrarModalItemAvulso.value = true
}
const fecharModalItemAvulso = () => {
  mostrarModalItemAvulso.value = false
}
const confirmarItemAvulso = () => {
  if (!itemAvulso.value.nome || !itemAvulso.value.preco) {
    alert('Preencha o nome e o preço do item.')
    return
  }
  adicionarItem({
    id: `avulso-${Date.now()}`,
    nome: itemAvulso.value.nome,
    preco: parseFloat(itemAvulso.value.preco),
    produto_id: null,
  })
  fecharModalItemAvulso()
}
const imprimirComprovante = (lancamento) => {
  const printWindow = window.open('', '_blank', 'width=300,height=500')
  const reciboHTML = `
      <html>
        <head><title>Comprovante</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 280px; font-size: 12px; line-height: 1.4; }
          .center { text-align: center; } .bold { font-weight: bold; } p { margin: 2px 0; }
          .divider { border-top: 1px dashed black; margin: 5px 0; } .info { margin-bottom: 10px; }
          .itens-table { width: 100%; border-collapse: collapse; } .itens-table th, .itens-table td { padding: 2px 0; vertical-align: top; }
          .itens-table .valor { text-align: right; } .total-line { display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; }
          .assinatura { margin-top: 30px; text-align: center; }
        </style>
        </head>
        <body>
          <div class="center bold"><p>${DADOS_RESTAURANTE.nome_fantasia.toUpperCase()}</p><p>${DADOS_RESTAURANTE.endereco}</p><p>CNPJ: ${DADOS_RESTAURANTE.cnpj}</p><p>TEL: ${DADOS_RESTAURANTE.telefone}</p></div>
          <div class="divider"></div>
          <div class="info"><p>Impresso em: ${new Date().toLocaleString('pt-BR')}</p><p>Cliente: ${lancamento.cliente_nome}</p>${lancamento.nome_funcionario_empresa ? `<p>Funcionário: ${lancamento.nome_funcionario_empresa}</p>` : ''}</div>
          <div class="center bold"><p>${MENSAGEM_RODAPE}</p></div>
          <div class="divider"></div>
          <table class="itens-table"><thead><tr><th>Qtd</th><th>Descrição</th><th class="valor">Total</th></tr></thead>
            <tbody>${lancamento.itens.map((item) => `<tr><td>${item.quantidade}</td><td>${item.nome_produto_congelado}</td><td class="valor">${(item.quantidade * item.preco_unitario_congelado).toFixed(2)}</td></tr>`).join('')}</tbody>
          </table>
          <div class="divider"></div>
          <div class="total-line"><span>TOTAL A PAGAR:</span><span>R$ ${lancamento.valor.toFixed(2)}</span></div>
          ${lancamento.metodo_pagamento === 'Não Pago' ? `<div class="assinatura"><p>_________________________</p><p>Assinatura</p></div>` : ''}
        </body>
      </html>`
  printWindow.document.write(reciboHTML)
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}
const fecharMenuSeClicarFora = (event) => {
  if (!event.target.closest('.menu-acoes-container')) {
    menuAbertoId.value = null
  }
}
const abrirMenu = (lancamento, event) => {
  event.stopPropagation()
  menuAbertoId.value = menuAbertoId.value === lancamento.id ? null : lancamento.id
}

watch(dataSelecionada, (novaData) => {
  dataStore.fetchTransacoesDoDia(novaData)
})

onMounted(() => {
  carregarDadosIniciais()
  document.addEventListener('click', fecharMenuSeClicarFora)
})

onUnmounted(() => {
  document.removeEventListener('click', fecharMenuSeClicarFora)
})
</script>

<style scoped>
.caderno-diario-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 58px);
}
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}
.main-content {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}
.lancamento-form-section {
  width: 400px;
  padding: 20px;
  border-right: 1px solid #dee2e6;
  background-color: #fff;
  overflow-y: auto;
  flex-shrink: 0;
}
.lancamentos-lista-section {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f8f9fa;
}
.lancamento-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.lancamento-form label {
  font-weight: bold;
  margin-bottom: -10px;
}
.lancamento-form input,
.lancamento-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.cliente-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.autocomplete {
  position: relative;
  flex-grow: 1;
}
.btn-avulso {
  padding: 10px;
  border: 1px solid #ccc;
  background: #f8f9fa;
  cursor: pointer;
  border-radius: 4px;
  white-space: nowrap;
}
.btn-avulso:hover {
  background-color: #e2e6ea;
}
.autocomplete ul {
  position: absolute;
  width: 100%;
  background: white;
  border: 1px solid #ccc;
  list-style: none;
  padding: 0;
  margin-top: 2px;
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.autocomplete li {
  padding: 10px;
  cursor: pointer;
}
.autocomplete li:hover {
  background-color: #f0f0f0;
}
.cliente-selecionado {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
}
.itens-pedido {
  border: 1px solid #eee;
  padding: 10px;
  border-radius: 4px;
  min-height: 100px;
}
.itens-pedido ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.itens-pedido li {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 10px;
  align-items: center;
  padding: 5px 0;
}
.item-nome {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-controles {
  display: flex;
  align-items: center;
  gap: 5px;
}
.item-qtd {
  font-weight: bold;
  min-width: 20px;
  text-align: center;
}
.btn-qty {
  font-weight: bold;
  border: 1px solid #ccc;
  background: #f0f0f0;
  border-radius: 4px;
  width: 25px;
  height: 25px;
  cursor: pointer;
}
.placeholder-item {
  color: #888;
  text-align: center;
  padding: 20px 0;
}
.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  cursor: pointer;
  line-height: 22px;
  text-align: center;
  font-weight: bold;
}
.opcoes-pagamento {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.opcoes-pagamento button {
  padding: 10px;
  border: 1px solid #ccc;
  background: #f8f9fa;
  cursor: pointer;
  border-radius: 4px;
}
.opcoes-pagamento button.active {
  background: #ffc107;
  border-color: #ffc107;
  font-weight: bold;
}
.lancar-btn {
  padding: 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color 0.2s;
}
.lancar-btn:hover {
  background-color: #218838;
}
.lista-lancamentos {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lancamento-item {
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-left: 4px solid transparent;
  position: relative;
}
.lancamento-header {
  display: grid;
  grid-template-columns: 1fr auto auto auto; /* Nome | Status | Total | Menu */
  gap: 15px;
  align-items: center;
  margin-bottom: 10px;
}
.lancamento-header h3 {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.itens-lancamento {
  list-style: none;
  padding-left: 20px;
  margin: 0 0 10px 0;
}
.status-tag {
  padding: 4px 10px;
  border-radius: 12px;
  color: white;
  font-size: 0.9em;
  font-weight: bold;
  cursor: pointer;
}
.status-tag.nao-pago {
  background-color: #dc3545;
}
.status-tag.pago {
  background-color: #198754;
}
.status-tag em {
  font-style: italic;
  font-weight: normal;
  opacity: 0.9;
}
.observacao-item {
  margin-top: 10px;
  padding: 8px;
  background-color: #fffbe6;
  border-left: 3px solid #ffc107;
  font-size: 0.9em;
  color: #664d03;
}
.status-preparo-btn {
  padding: 4px 10px;
  border-radius: 12px;
  color: white;
  border: none;
  cursor: pointer;
  font-weight: bold;
}
.status-preparo-btn.pendente {
  background-color: #ffc107;
  color: black;
}
.status-preparo-btn.pronto {
  background-color: #198754;
}
.lancamento-item.pendente-bg {
  background-color: #fff9e6;
  border-left-color: #ffc107;
}
.lancamento-item.estornado {
  background-color: #e9ecef;
  opacity: 0.6;
  text-decoration: line-through;
}
.lancamento-item.estornado .status-preparo-btn,
.lancamento-item.estornado .status-tag,
.lancamento-item.estornado .btn-menu-acoes {
  pointer-events: none;
  opacity: 0.5;
}
.status-container {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-self: end;
}
.valor-total {
  font-weight: bold;
  font-size: 1.1em;
  justify-self: end;
}

.menu-acoes-container {
  justify-self: end;
}
.btn-menu-acoes {
  font-size: 1.5em;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 5px;
  border-radius: 4px;
}
.btn-menu-acoes:hover {
  background-color: #f0f0f0;
}
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 120px;
}
.dropdown-menu button {
  text-align: left;
  padding: 8px 12px;
  background: none;
  border: none;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  width: 100%;
}
.dropdown-menu button:last-child {
  border-bottom: none;
}
.dropdown-menu button:hover {
  background-color: #f8f9fa;
}
.dropdown-menu .acao-perigosa {
  color: #dc3545;
}

/* ESTILOS PARA NOVA FUNCIONALIDADE */
.detalhes-pagamento-btn {
  font-size: 0.8em;
  color: #0d6efd;
  cursor: pointer;
  text-decoration: underline;
  margin-left: -5px; /* aproxima do status */
}
.fp-popup {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #ccc;
}
.fp-popup button {
  font-size: 0.9em;
  padding: 5px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f8f9fa;
  cursor: pointer;
}
.fp-popup button:hover {
  background-color: #e2e6ea;
}
.fp-popup button.active {
  background-color: #0d6efd;
  color: white;
  border-color: #0d6efd;
}

/* ESTILOS DO MODAL */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 300px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}
.modal-content h3 {
  margin-top: 0;
}
.modal-content form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
.modal-actions button {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* ESTILOS DO RESUMO */
.resumo-diario-footer {
  border-top: 2px solid #ddd;
  margin-top: 20px;
  padding-top: 15px;
  display: flex;
  justify-content: space-between;
  font-size: 1.2em;
}
.resumo-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.resumo-item strong {
  color: #0d6efd;
}
</style>
