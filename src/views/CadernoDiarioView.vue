<template>
  <div class="caderno-diario-container">
    <header class="view-header">
      <h1>Caderno Digital Diário</h1>
      <input type="date" v-model="dataSelecionada" />
    </header>

    <main class="main-content">
      <section class="lancamento-form-section">
        <h2>Novo Lançamento</h2>

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

          <div class="itens-pedido">
            <h4>Itens do Pedido (Total: R$ {{ totalPedido.toFixed(2) }})</h4>
            <ul>
              <li v-if="pedidoAtual.itens.length === 0" class="placeholder-item">
                Nenhum item adicionado
              </li>
              <li v-for="(item, index) in pedidoAtual.itens" :key="index">
                <span>{{ item.nome_produto_congelado }}</span>
                <span>R$ {{ item.preco_unitario_congelado.toFixed(2) }}</span>
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

          <button class="lancar-btn" type="submit">Lançar no Caderno</button>
        </form>
      </section>

      <section class="lancamentos-lista-section">
        <h2>Lançamentos de {{ dataFormatada }}</h2>
        <div v-if="lancamentosDoDia.length === 0" class="placeholder-item">
          Nenhum lançamento para esta data.
        </div>
        <div v-else class="lista-lancamentos">
          <div
            v-for="lancamento in lancamentosDoDia"
            :key="lancamento.id"
            class="lancamento-item"
            :class="{ 'pendente-bg': lancamento.status_preparo === 'PENDENTE' }"
          >
            <div class="lancamento-header">
              <h3>
                {{ lancamento.cliente_nome }}
                <span v-if="lancamento.nome_funcionario_empresa" class="nome-funcionario">
                  ({{ lancamento.nome_funcionario_empresa }})
                </span>
              </h3>
              <div class="acoes-lancamento">
                <button @click="imprimirComprovante(lancamento)" class="btn-acao">🖨️</button>
                <button
                  @click="alternarStatusPreparo(lancamento)"
                  :class="[
                    'status-preparo-btn',
                    lancamento.status_preparo ? lancamento.status_preparo.toLowerCase() : '',
                  ]"
                >
                  {{ lancamento.status_preparo }}
                </button>
              </div>
              <span
                :class="[
                  'status-tag',
                  lancamento.metodo_pagamento === 'Não Pago' ? 'nao-pago' : 'pago',
                ]"
                @click="alternarStatusPagamento(lancamento)"
              >
                {{ lancamento.metodo_pagamento }}
              </span>
            </div>
            <ul class="itens-lancamento">
              <li v-for="item in lancamento.itens" :key="item.id">
                - {{ item.nome_produto_congelado }} (R$
                {{ item.preco_unitario_congelado.toFixed(2) }})
              </li>
            </ul>
            <p v-if="lancamento.observacoes" class="observacao-item">
              <strong>Obs:</strong> {{ lancamento.observacoes }}
            </p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore.js'
import { db } from '@/services/databaseService.js'
import { DADOS_RESTAURANTE, MENSAGEM_RODAPE } from '@/config.js'

const dataStore = useDataStore()
const clientes = computed(() => dataStore.clientes || [])
const produtos = computed(() => dataStore.produtos || [])
const hoje = new Date();
// Ajusta o fuso horário para garantir que a data seja a local
hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
// Converte para o formato YYYY-MM-DD
const dataSelecionada = ref(hoje.toISOString().slice(0, 10));
const lancamentosDoDia = ref([])
const buscaCliente = ref('')
const buscaProduto = ref('')

const getInitialPedido = () => ({
  cliente: null,
  itens: [],
  metodo_pagamento: 'Não Pago',
  observacoes: '',
  nome_funcionario: '',
})

const pedidoAtual = ref(getInitialPedido())

const clientesFiltrados = computed(() => {
  if (!buscaCliente.value) return []
  return clientes.value.filter(
    (c) => c && c.nome && c.nome.toLowerCase().includes(buscaCliente.value.toLowerCase()),
  )
})

const produtosFiltrados = computed(() => {
  if (!buscaProduto.value) return []
  return produtos.value.filter(
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
  pedidoAtual.value.itens.push({
    produto_id: produto.id,
    nome_produto_congelado: produto.nome,
    preco_unitario_congelado: produto.preco,
    quantidade: 1,
  })
  buscaProduto.value = ''
}
const removerItem = (index) => {
  pedidoAtual.value.itens.splice(index, 1)
}
const setPagamento = (metodo) => {
  pedidoAtual.value.metodo_pagamento = metodo
}
const totalPedido = computed(() => {
  return pedidoAtual.value.itens.reduce((acc, item) => acc + item.preco_unitario_congelado, 0)
})
const dataFormatada = computed(() => {
  if (!dataSelecionada.value) return ''
  const [ano, mes, dia] = dataSelecionada.value.split('-')
  return `${dia}/${mes}/${ano}`
})

const carregarLancamentos = async () => {
  try {
    const dataISO = dataSelecionada.value
    const transacoes = await db.transacoes.where('data_transacao').equals(dataISO).toArray()
    const lancamentosCompletos = await Promise.all(
      transacoes.map(async (t) => {
        const itens = await db.itens_transacao.where('transacao_id').equals(t.id).toArray()
        const cliente = await db.clientes.get(t.cliente_id)
        return { ...t, itens, cliente_nome: cliente ? cliente.nome : 'Cliente Avulso' }
      }),
    )
    lancamentosCompletos.sort((a, b) => {
      if (a.status_preparo === 'PENDENTE' && b.status_preparo === 'PRONTO') return -1
      if (a.status_preparo === 'PRONTO' && b.status_preparo === 'PENDENTE') return 1
      return (a.id || 0) - (b.id || 0)
    })
    lancamentosDoDia.value = lancamentosCompletos
  } catch (error) {
    console.error('Erro ao carregar lançamentos:', error)
  }
}

const lancarPedido = async () => {
  if (!pedidoAtual.value.cliente || pedidoAtual.value.itens.length === 0) {
    alert('Selecione um cliente e adicione pelo menos um item.')
    return
  }
  try {
    const novaTransacao = {
      cliente_id: pedidoAtual.value.cliente.id,
      tipo_transacao: 'VENDA',
      valor: totalPedido.value,
      data_transacao: dataSelecionada.value,
      metodo_pagamento: pedidoAtual.value.metodo_pagamento,
      status_preparo: 'PENDENTE',
      observacoes: pedidoAtual.value.observacoes,
      nome_funcionario_empresa: pedidoAtual.value.nome_funcionario,
      created_at: new Date(),
    }
    const transacaoId = await db.transacoes.add(novaTransacao)
    const itensParaSalvar = pedidoAtual.value.itens.map((item) => ({
      ...item,
      transacao_id: transacaoId,
    }))
    await db.itens_transacao.bulkAdd(itensParaSalvar)
    pedidoAtual.value = getInitialPedido()
    buscaCliente.value = ''
    await carregarLancamentos()
  } catch (error) {
    console.error('Erro ao lançar pedido:', error)
  }
}

const alternarStatusPagamento = async (lancamento) => {
  // --- CLÁUSULA DE GUARDA ADICIONADA ---
  // Se o cliente for avulso, não permite alterar o status de pagamento.
  if (lancamento.cliente_nome === 'Cliente Avulso') {
    alert("Não é possível alterar o status de pagamento para uma Venda Avulsa.");
    return; 
  }
  // --- FIM DA CLÁUSULA ---

  try {
    const novoStatus = lancamento.metodo_pagamento === 'Não Pago' ? 'Pago' : 'Não Pago';
    await db.transacoes.update(lancamento.id, { metodo_pagamento: novoStatus });
    await carregarLancamentos();
  } catch (error) {
    console.error("Erro ao alterar status de pagamento:", error);
  }
};

const alternarStatusPreparo = async (lancamento) => {
  try {
    const novoStatus = lancamento.status_preparo === 'PENDENTE' ? 'PRONTO' : 'PENDENTE'
    await db.transacoes.update(lancamento.id, { status_preparo: novoStatus })
    await carregarLancamentos()
  } catch (error) {
    console.error('Erro ao alterar status de preparo:', error)
  }
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

watch(dataSelecionada, carregarLancamentos)
onMounted(carregarLancamentos)
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
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
}
.lancamento-header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
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
  margin: 0;
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
  color: white;
}
.status-tag.pago {
  background-color: #198754;
  color: white;
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
  border-left: 4px solid #ffc107;
}
.acoes-lancamento {
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn-acao {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  padding: 5px;
  font-size: 1.2em;
  line-height: 1;
}
</style>
