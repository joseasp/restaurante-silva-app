<template>
  <q-page padding class="row">
    <q-splitter v-model="splitterModel" style="height: calc(100vh - 50px); width: 100%">
      <template v-slot:before>
        <q-list bordered separator>
          <q-item-label header>Clientes com Histórico</q-item-label>

          <q-input dense outlined v-model="buscaCliente" label="Buscar..." class="q-ma-sm">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>

          <q-item
            v-for="cliente in clientesFiltrados"
            :key="cliente.id"
            clickable
            v-ripple
            @click="selecionarCliente(cliente)"
            :active="clienteSelecionado && clienteSelecionado.id === cliente.id"
            active-class="bg-amber-2"
          >
            <q-item-section>
              <q-item-label class="text-subtitle1">{{ cliente.nome }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label
                :class="{
                  'text-red': cliente.saldo > 0.01,
                  'text-green-8': cliente.saldo < -0.01,
                  'text-grey': cliente.saldo >= -0.01 && cliente.saldo <= 0.01,
                }"
                class="text-body1 text-weight-bold"
              >
                R$ {{ Math.abs(cliente.saldo).toFixed(2) }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </template>

      <template v-slot:after>
        <div v-if="!clienteSelecionado" class="flex flex-center text-grey" style="height: 100%">
          <h5>Selecione um cliente para ver o extrato</h5>
        </div>

        <q-card
          v-else
          flat
          bordered
          class="q-ma-sm"
          style="height: 100%; display: flex; flex-direction: column"
        >
          <q-card-section>
            <div class="text-h5">Extrato de: {{ clienteSelecionado.nome }}</div>
            <div
              class="text-h5"
              :class="{
                'text-red': clienteSelecionado.saldo > 0.01,
                'text-green-8': clienteSelecionado.saldo < -0.01,
              }"
            >
              <span v-if="clienteSelecionado.saldo > 0.01">
                Saldo Devedor: R$ {{ clienteSelecionado.saldo.toFixed(2) }}
              </span>
              <span v-else-if="clienteSelecionado.saldo < -0.01">
                Crédito Disponível: R$ {{ Math.abs(clienteSelecionado.saldo).toFixed(2) }}
              </span>
              <span v-else>Saldo Zerado</span>
            </div>
          </q-card-section>

          <q-card-section class="row items-center q-gutter-md">
            <q-input
              dense
              outlined
              v-model="filtroInicio"
              type="date"
              label="De:"
              stack-label
              class="col"
            />
            <q-input
              dense
              outlined
              v-model="filtroFim"
              type="date"
              label="Até:"
              stack-label
              class="col"
            />
            <q-btn
              icon="print"
              color="amber"
              text-color="black"
              @click="imprimirExtrato"
              label="Imprimir Extrato"
              class="col-auto"
            />
          </q-card-section>

          <q-expansion-item
            icon="payment"
            label="Registrar Novo Pagamento"
            header-class="bg-grey-2"
            class="q-mx-md q-mb-md"
            bordered
          >
            <q-card>
              <q-card-section>
                <div class="row q-col-gutter-sm">
                  <div class="col-12 col-md-6">
                    <q-input
                      outlined
                      v-model.number="valorPagamento"
                      label="Valor do Pagamento"
                      type="number"
                      step="0.01"
                      prefix="R$"
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <q-select
                      outlined
                      v-model="formaPagamento"
                      :options="['Dinheiro', 'PIX', 'Cartão']"
                      label="Forma (opcional)"
                      clearable
                    />
                  </div>
                  <div class="col-12">
                    <q-input
                      outlined
                      v-model="observacoesPagamento"
                      label="Observações (opcional)"
                      type="textarea"
                      autogrow
                    />
                  </div>
                </div>
                <q-btn
                  color="positive"
                  label="Registrar Pagamento"
                  @click="registrarPagamento"
                  class="full-width q-mt-md"
                />
              </q-card-section>
            </q-card>
          </q-expansion-item>

          <q-separator />

          <q-scroll-area class="col">
            <q-list separator>
              <q-item
                v-for="t in transacoesFiltradas"
                :key="t.id"
                :class="{
                  'bg-grey-2 text-grey-6 text-strike': t.estornado,
                  'bg-green-1': t.tipo_transacao === 'PAGAMENTO' && !t.estornado,
                }"
              >
                <q-item-section>
                  <q-item-label caption>
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
                  </q-item-label>
                  <q-item-label class="text-body1">{{
                    new Date(t.created_at || t.data_transacao).toLocaleString('pt-BR')
                  }}</q-item-label>

                  <q-item-label
                    v-if="t.observacoes"
                    class="q-mt-sm bg-grey-3 q-pa-sm rounded-borders text-body2"
                    style="white-space: pre-wrap"
                  >
                    <strong>Obs:</strong> {{ t.observacoes }}
                  </q-item-label>
                  <q-item-label
                    v-if="t.tipo_transacao === 'VENDA' && t.itens"
                    class="q-mt-sm text-body2"
                  >
                    <ul class="q-pl-md q-ma-none">
                      <li v-for="item in t.itens" :key="item.id">
                        {{ item.quantidade }}x {{ item.nome_produto_congelado }}
                      </li>
                    </ul>
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <q-item-label
                    :class="{ 'text-red': t.valor > 0, 'text-green-8': t.valor < 0 }"
                    class="text-weight-bold text-h6"
                  >
                    R$ {{ t.valor > 0 ? '+' : '' }}{{ t.valor.toFixed(2) }}
                  </q-item-label>
                  <div class="row items-center q-gutter-xs q-mt-xs">
                    <q-btn
                      v-if="t.tipo_transacao === 'PAGAMENTO' && !t.estornado"
                      flat
                      dense
                      round
                      color="negative"
                      icon="delete"
                      @click="estornarPagamento(t)"
                    >
                      <q-tooltip>Estornar Pagamento</q-tooltip>
                    </q-btn>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </q-card>
      </template>
    </q-splitter>

    <PinModal
      :visible="mostrarPinModal"
      @close="mostrarPinModal = false"
      @success="executarAcaoPendente"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useDataStore } from '@/stores/dataStore.js'
import { db } from '@/services/databaseService.js'
import PinModal from '@/components/PinModal.vue'
import { useAuthStore } from '@/stores/authStore'
import { v4 as uuidv4 } from 'uuid';

const dataStore = useDataStore()
const authStore = useAuthStore()

const splitterModel = ref(30)

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
    return clienteSelecionado.value.transacoes
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
  if (!clienteSelecionado.value || !valorPagamento.value) {
    console.warn('Por favor, insira um valor para o pagamento.')
    return
  }
  const valor = parseFloat(valorPagamento.value)
  if (valor <= 0) {
    console.warn('O valor do pagamento deve ser positivo.')
    return
  }
  try {
    const clienteId = clienteSelecionado.value.id
    await db.transacoes.add({
      id: uuidv4(),
      cliente_id: clienteId,
      tipo_transacao: 'PAGAMENTO',
      valor: -valor,
      data_transacao: new Date().toISOString().slice(0, 10),
      created_at: new Date(),
      estornado: false,
      forma_pagamento: formaPagamento.value || null,
      observacoes: observacoesPagamento.value,
    })

    console.log('Pagamento registrado com sucesso!')

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

  const transacoesHTML = transacoesParaImprimir
    .map((t) => {
      let detalhes = ''
      if (t.tipo_transacao === 'VENDA' && t.itens) {
        const itensHTML = t.itens
          .map(
            (item) => `
            <div class="item">
              <span>- ${item.quantidade}x ${item.nome_produto_congelado}</span>
            </div>
          `,
          )
          .join('')

        let statusPagamentoHTML = ''
        if (t.metodo_pagamento === 'Pago') {
          statusPagamentoHTML = t.forma_pagamento ? `(Pagamento: ${t.forma_pagamento})` : '(PAGO)'
        } else {
          statusPagamentoHTML = '(A PRAZO)'
        }
        statusPagamentoHTML = `<div class="item"><span>${statusPagamentoHTML}</span></div>`

        detalhes = `${itensHTML}${statusPagamentoHTML}<div class="item total-venda"><span>TOTAL VENDA</span><span>R$ ${t.valor.toFixed(2)}</span></div>`
      } else if (t.tipo_transacao === 'PAGAMENTO') {
        detalhes = `
          <div class="item">
            <span>PAGAMENTO RECEBIDO ${t.forma_pagamento ? `(${t.forma_pagamento})` : ''}</span>
            <span class="credito">R$ ${t.valor.toFixed(2)}</span>
          </div>
        `
      }

      return `
        <div class="transaction-block">
          <div>Data: ${new Date(t.created_at || t.data_transacao).toLocaleString('pt-BR')}</div>
          ${detalhes}
        </div>
      `
    })
    .join('<div class="separator">----------------------------------------</div>')

  const extratoHTML = `
    <html>
      <head>
        <title>Extrato de ${cliente.nome}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
          }
          .receipt {
            width: 302px; /* Largura comum de impressora térmica de 80mm */
            margin: 0 auto;
            padding: 10px;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { margin: 0; font-size: 16px; }
          .header p { margin: 2px 0; font-size: 12px; }
          .separator {
            margin: 10px 0;
            text-align: center;
            overflow: hidden;
            white-space: nowrap;
          }
          .item {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin: 3px 0;
          }
          .total-venda {
            font-weight: bold;
          }
          .total-final {
            font-weight: bold;
            font-size: 14px;
            margin-top: 10px;
            border-top: 1px dashed #000;
            padding-top: 5px;
          }
          .signature {
            margin-top: 40px;
            border-top: 1px solid #000;
            text-align: center;
            font-size: 12px;
            padding-top: 5px;
          }
          .transaction-block { font-size: 12px; }
          .credito { color: green; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>Restaurante Silva</h1>
            <p>Rua Primeiro de Março, n 7</p>
            <p>Telefone: (33) 98720-8003</p>
          </div>
          <div class="separator">----------------------------------------</div>
          <div><strong>Cliente:</strong> ${cliente.nome}</div>
          <div><strong>Data Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div>
          <div class="separator">----------------------------------------</div>

          ${transacoesHTML}

          <div class="separator">----------------------------------------</div>
          <div class="item total-final">
            <span>SALDO FINAL:</span>
            <span>R$ ${cliente.saldo.toFixed(2)}</span>
          </div>


        </div>
      </body>
    </html>`

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

  iframe.contentWindow.focus()
  iframe.contentWindow.print()

  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
}
</script>
