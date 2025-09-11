<template>
  <q-page padding>
    <div class="flex justify-between items-center q-mb-md">
      <div class="text-h4">{{ dataExibicao }}</div>
      <div class="flex items-center q-gutter-md">
        <q-input outlined dense v-model="dataSelecionada" type="date" style="width: 150px" />
        <q-btn
          @click="imprimirCadernoDoDia"
          color="primary"
          icon="print"
          label="Imprimir Dia"
          outline
        />
      </div>
    </div>

    <q-splitter v-model="splitterModel" style="height: calc(100vh - 150px)">
      <template v-slot:before>
        <div class="q-pa-md">
          <div class="text-h5 q-mb-md">
            {{ lancamentoEmEdicao ? 'Editando Lançamento' : 'Novo Lançamento' }}
          </div>
          <q-form @submit.prevent="lancarPedido" class="q-gutter-md">
            <!-- SELEÇÃO DE CLIENTE -->
            <div v-if="!pedidoAtual.cliente">
              <q-input
                outlined
                v-model="buscaCliente"
                label="Buscar Cliente..."
                dense
                class="q-mb-xs"
              >
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>
              <q-list bordered separator v-if="clientesFiltrados.length">
                <q-item
                  clickable
                  v-ripple
                  v-for="cliente in clientesFiltrados"
                  :key="cliente.id"
                  @click="selecionarCliente(cliente)"
                >
                  <q-item-section>{{ cliente.nome }}</q-item-section>
                </q-item>
              </q-list>
              <q-btn
                outline
                color="primary"
                @click="selecionarClienteAvulso"
                label="Venda Avulsa"
                class="full-width q-mt-sm"
              />
            </div>
            <div v-else>
              <q-chip
                removable
                @remove="removerCliente"
                color="primary"
                text-color="white"
                icon="person"
                :label="pedidoAtual.cliente.nome"
              />
            </div>

            <!-- NOME DO FUNCIONÁRIO (EMPRESA) -->
            <q-select
              v-if="pedidoAtual.cliente && pedidoAtual.cliente.tipo === 'EMPRESA'"
              v-model="pedidoAtual.nome_funcionario"
              label="Nome do Funcionário"
              outlined
              dense
              use-input
              hide-selected
              fill-input
              input-debounce="0"
              :options="funcionariosFiltrados"
              @filter="filterFn"
              :rules="[(val) => !!val || 'Campo obrigatório']"
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    Nenhum funcionário encontrado. Digite para adicionar.
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- SELEÇÃO DE PRODUTO -->
            <div class="row q-col-gutter-sm items-center">
              <div class="col">
                <q-input
                  outlined
                  v-model="buscaProduto"
                  label="Buscar Produto..."
                  dense
                  class="q-mb-xs"
                >
                  <template v-slot:append> <q-icon name="search" /> </template>
                </q-input>
                <q-list bordered separator v-if="produtosFiltrados.length">
                  <q-item
                    clickable
                    v-ripple
                    v-for="produto in produtosFiltrados"
                    :key="produto.id"
                    @click="adicionarItem(produto)"
                  >
                    <q-item-section>{{ produto.nome }}</q-item-section>
                    <q-item-section side>R$ {{ produto.preco.toFixed(2) }}</q-item-section>
                  </q-item>
                </q-list>
              </div>
              <div class="col-auto">
                <q-btn round dense color="primary" icon="add" @click="abrirModalItemAvulso">
                  <q-tooltip>Adicionar Item Avulso</q-tooltip>
                </q-btn>
              </div>
            </div>

            <!-- ITENS DO PEDIDO -->
            <q-card flat bordered>
              <q-card-section class="flex justify-between items-center q-py-sm">
                <div class="text-subtitle1">Itens do Pedido</div>
                <div class="text-weight-bold">Total: R$ {{ totalPedido.toFixed(2) }}</div>
              </q-card-section>
              <q-separator />
              <q-list separator>
                <q-item v-if="pedidoAtual.itens.length === 0">
                  <q-item-section class="text-grey text-center">
                    Nenhum item adicionado
                  </q-item-section>
                </q-item>
                <q-item v-for="(item, index) in pedidoAtual.itens" :key="index">
                  <q-item-section>
                    <q-item-label>{{ item.nome_produto_congelado }}</q-item-label>
                    <q-item-label caption>
                      R$ {{ (item.preco_unitario_congelado * item.quantidade).toFixed(2) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div class="flex items-center q-gutter-xs">
                      <q-btn round dense flat icon="remove" @click="decrementarItem(item, index)" />
                      <span class="text-body1 text-weight-bold">{{ item.quantidade }}</span>
                      <q-btn round dense flat icon="add" @click="incrementarItem(item)" />
                    </div>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      round
                      dense
                      flat
                      color="negative"
                      icon="close"
                      @click="removerItem(index)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>

            <q-input
              v-model="pedidoAtual.observacoes"
              outlined
              type="textarea"
              label="Observações"
              dense
            />

            <q-btn-toggle
              v-model="pedidoAtual.metodo_pagamento"
              spread
              no-caps
              :toggle-color="pedidoAtual.metodo_pagamento === 'Pago' ? 'positive' : 'warning'"
              color="white"
              text-color="black"
              :options="[
                {
                  label: 'Não Pago',
                  value: 'Não Pago',
                  disable: pedidoAtual.cliente && pedidoAtual.cliente.tipo === 'AVULSO',
                },
                { label: 'Pago', value: 'Pago' },
              ]"
            />

            <q-select
              v-if="pedidoAtual.metodo_pagamento === 'Pago'"
              outlined
              v-model="pedidoAtual.forma_pagamento_venda"
              :options="['Dinheiro', 'PIX', 'Cartão']"
              label="Forma de Pagamento (Opcional)"
              dense
              emit-value
              map-options
              clearable
            />

            <q-btn
              type="submit"
              color="positive"
              size="lg"
              class="full-width"
              :label="lancamentoEmEdicao ? 'Salvar Alterações' : 'Lançar no Caderno'"
              icon="check_circle"
            />
          </q-form>
        </div>
      </template>

      <template v-slot:after>
        <div class="q-pa-md">
          <div
            v-if="!lancamentosDoDia || lancamentosDoDia.length === 0"
            class="text-center text-grey q-mt-xl"
          >
            <q-icon name="inbox" size="xl" />
            <p>Nenhum lançamento para esta data.</p>
          </div>
          <div v-else>
            <q-card
              v-for="lancamento in pedidosOrdenados"
              :key="lancamento.id"
              flat
              bordered
              class="q-mb-sm"
              :class="{
                'bg-amber-1': lancamento.status_preparo === 'PENDENTE' && !lancamento.estornado,
                'bg-grey-3 text-grey-7 estornado-style': lancamento.estornado,
              }"
            >
              <q-card-section>
                <div class="flex items-start justify-between">
                  <div class="col">
                    <div class="text-weight-bold">
                      {{ lancamento.cliente_nome }}
                      <span
                        v-if="lancamento.nome_funcionario_empresa"
                        class="text-caption text-weight-regular"
                      >
                        ({{ lancamento.nome_funcionario_empresa }})
                      </span>
                    </div>
                    <div class="text-h6 text-primary text-weight-bolder">
                      R$ {{ lancamento.valor.toFixed(2) }}
                    </div>
                  </div>
                  <div class="col-auto flex items-center q-gutter-sm">
                    <q-badge
                      :color="lancamento.status_preparo === 'PENDENTE' ? 'orange' : 'positive'"
                      class="q-pa-sm cursor-pointer"
                      @click="!lancamento.estornado && alternarStatusPreparo(lancamento)"
                    >
                      {{ lancamento.status_preparo }}
                    </q-badge>

                    <q-badge
                      :color="lancamento.metodo_pagamento === 'Não Pago' ? 'negative' : 'positive'"
                      class="q-pa-sm cursor-pointer"
                      @click="!lancamento.estornado && alternarStatusPagamento(lancamento)"
                    >
                      {{ lancamento.metodo_pagamento }}
                      <span
                        v-if="lancamento.metodo_pagamento === 'Pago' && lancamento.forma_pagamento"
                        class="q-ml-xs text-caption opacity-80"
                      >
                        ({{ lancamento.forma_pagamento }})
                      </span>
                    </q-badge>

                    <q-btn
                      v-if="lancamento.metodo_pagamento === 'Pago' && !lancamento.estornado"
                      flat
                      round
                      dense
                      icon="payment"
                    >
                      <q-tooltip>Alterar Forma de Pagamento</q-tooltip>
                      <q-menu auto-close anchor="bottom middle" self="top middle">
                        <q-btn-group flat>
                          <q-btn
                            flat
                            label="Dinheiro"
                            dense
                            @click="atualizarFormaPagamento(lancamento, 'Dinheiro')"
                            :class="{
                              'bg-primary text-white': lancamento.forma_pagamento === 'Dinheiro',
                            }"
                          />
                          <q-btn
                            flat
                            label="PIX"
                            dense
                            @click="atualizarFormaPagamento(lancamento, 'PIX')"
                            :class="{
                              'bg-primary text-white': lancamento.forma_pagamento === 'PIX',
                            }"
                          />
                          <q-btn
                            flat
                            label="Cartão"
                            dense
                            @click="atualizarFormaPagamento(lancamento, 'Cartão')"
                            :class="{
                              'bg-primary text-white': lancamento.forma_pagamento === 'Cartão',
                            }"
                          />
                          <q-btn
                            flat
                            dense
                            icon="backspace"
                            @click="atualizarFormaPagamento(lancamento, null)"
                          >
                            <q-tooltip>Limpar</q-tooltip>
                          </q-btn>
                        </q-btn-group>
                      </q-menu>
                    </q-btn>

                    <q-btn flat round dense icon="more_vert" :disable="lancamento.estornado">
                      <q-menu auto-close>
                        <q-list style="min-width: 100px">
                          <q-item clickable @click="iniciarEdicaoLancamento(lancamento)">
                            <q-item-section avatar><q-icon name="edit" /></q-item-section>
                            <q-item-section>Editar</q-item-section>
                          </q-item>
                          <q-item clickable @click="imprimirComprovante(lancamento)">
                            <q-item-section avatar><q-icon name="print" /></q-item-section>
                            <q-item-section>Imprimir</q-item-section>
                          </q-item>
                          <q-separator />
                          <q-item
                            clickable
                            class="text-negative"
                            @click="estornarLancamento(lancamento)"
                          >
                            <q-item-section avatar><q-icon name="delete" /></q-item-section>
                            <q-item-section>Estornar</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </div>
                </div>
                <q-list dense padding class="q-ml-md" v-if="lancamento.itens.length > 0">
                  <q-item v-for="item in lancamento.itens" :key="item.id" class="q-pa-none">
                    <q-item-section class="text-grey-8"
                      >- {{ item.quantidade }}x {{ item.nome_produto_congelado }}</q-item-section
                    >
                  </q-item>
                </q-list>

                <q-banner dense class="bg-amber-2 text-dark q-mt-sm" v-if="lancamento.observacoes">
                  <template v-slot:avatar> <q-icon name="info" /> </template>
                  {{ lancamento.observacoes }}
                </q-banner>
              </q-card-section>
            </q-card>

            <!-- RESUMO DIÁRIO -->
            <q-card flat bordered class="q-mt-lg">
              <q-card-section horizontal>
                <q-card-section class="col">
                  <div>Total de Vendas</div>
                  <div class="text-h6 text-weight-bold">
                    <span v-if="resumoVisivel">{{ resumoDiario.totalVendas }}</span>
                    <span v-else>••••</span>
                  </div>
                </q-card-section>
                <q-separator vertical />
                <q-card-section class="col">
                  <div>Faturamento do Dia</div>
                  <div class="text-h6 text-weight-bold text-positive">
                    <span v-if="resumoVisivel">R$ {{ resumoDiario.faturamento.toFixed(2) }}</span>
                    <span v-else>R$ ••••</span>
                  </div>
                </q-card-section>
                <q-card-actions>
                  <q-btn
                    flat
                    round
                    :icon="resumoVisivel ? 'visibility_off' : 'visibility'"
                    @click="revelarResumo"
                  />
                </q-card-actions>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </template>
    </q-splitter>

    <!-- MODAL ITEM AVULSO -->
    <q-dialog v-model="mostrarModalItemAvulso">
      <q-card style="width: 350px">
        <q-card-section>
          <div class="text-h6">Adicionar Item Avulso</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-form @submit.prevent="confirmarItemAvulso" class="q-gutter-md">
            <q-input
              v-model="itemAvulso.nome"
              label="Descrição do Item"
              outlined
              dense
              autofocus
              :rules="[(val) => !!val || 'Campo obrigatório']"
            />
            <q-input
              v-model.number="itemAvulso.preco"
              label="Preço (R$)"
              type="number"
              step="0.01"
              outlined
              dense
              :rules="[(val) => val > 0 || 'Preço deve ser maior que zero']"
            />
            <q-card-actions align="right">
              <q-btn flat label="Cancelar" color="primary" v-close-popup />
              <q-btn label="Confirmar" color="primary" type="submit" />
            </q-card-actions>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <PinModal
      :visible="mostrarPinModal"
      @close="mostrarPinModal = false"
      @success="executarAcaoPendente"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDataStore } from '@/stores/dataStore.js'
import { db } from '@/services/databaseService.js';
import { DADOS_RESTAURANTE } from '@/config.js'
import PinModal from '@/components/PinModal.vue'

const $q = useQuasar()
const dataStore = useDataStore()

const splitterModel = ref(35)

const clientesParaSelecao = computed(() => dataStore.clientesAtivos || [])
const produtosParaSelecao = computed(() => dataStore.produtosAtivos || [])

const lancamentosDoDia = computed(() => dataStore.transacoes || [])

// Computed para ordenar os pedidos/lancamentos conforme solicitado
const pedidosOrdenados = computed(() => {
  return [...lancamentosDoDia.value]
    .sort((a, b) => {
      // 1. PENDENTE antes de PRONTO (ou outro status)
      const aPend = a.status_preparo === 'PENDENTE' ? 0 : 1
      const bPend = b.status_preparo === 'PENDENTE' ? 0 : 1
      if (aPend !== bPend) return aPend - bPend

      // 2. Dentro dos PENDENTES: mais ANTIGO primeiro (created_at menor)
      const dateA = new Date(a.created_at)
      const dateB = new Date(b.created_at)
      return dateA - dateB
    })
})

const hoje = new Date()
hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset())
const dataSelecionada = ref(hoje.toISOString().slice(0, 10))
const buscaCliente = ref('')
const buscaProduto = ref('')
const lancamentoEmEdicao = ref(null)
const funcionariosDaEmpresaSelecionada = ref([])
const funcionariosFiltrados = ref([])

const mostrarModalItemAvulso = ref(false)
const itemAvulso = ref({ nome: '', preco: null })
const mostrarPinModal = ref(false)
const acaoPendente = ref(null)
const resumoVisivel = ref(false)

const getInitialPedido = () => ({
  cliente: null,
  itens: [],
  metodo_pagamento: 'Não Pago',
  observacoes: '',
  nome_funcionario: '',
  forma_pagamento_venda: '',
})

const pedidoAtual = ref(getInitialPedido())

const resumoDiario = computed(() => {
  const lancamentosValidos = (lancamentosDoDia.value || []).filter((l) => !l.estornado)
  const totalVendas = lancamentosValidos.length
  const faturamento = lancamentosValidos.reduce((acc, l) => acc + l.valor, 0)
  return { totalVendas, faturamento }
})

const dataExibicao = computed(() => {
  if (!dataSelecionada.value) return ''
  const data = new Date(dataSelecionada.value)
  data.setMinutes(data.getMinutes() + data.getTimezoneOffset())
  const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  return new Intl.DateTimeFormat('pt-BR', opcoes).format(data)
})

const clientesFiltrados = computed(() => {
  if (!buscaCliente.value) return []
  return clientesParaSelecao.value.filter((c) =>
    c.nome.toLowerCase().includes(buscaCliente.value.toLowerCase()),
  )
})

const produtosFiltrados = computed(() => {
  if (!buscaProduto.value) return []
  return produtosParaSelecao.value.filter(
    (p) => p && p.nome && p.nome.toLowerCase().includes(buscaProduto.value.toLowerCase()),
  )
})

const selecionarCliente = async (cliente) => {
  pedidoAtual.value.cliente = cliente
  buscaCliente.value = ''
  funcionariosDaEmpresaSelecionada.value = []
  pedidoAtual.value.nome_funcionario = ''

  if (cliente.tipo === 'EMPRESA') {
    try {
      const funcionarios = await db.funcionarios.where('cliente_id').equals(cliente.id).toArray();
      funcionariosDaEmpresaSelecionada.value = funcionarios.map(f => f.nome);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      $q.notify({ type: 'negative', message: 'Falha ao carregar funcionários da empresa.' });
    }
  }
}

const removerCliente = () => {
  pedidoAtual.value.cliente = null
  pedidoAtual.value.metodo_pagamento = 'Não Pago'
  funcionariosDaEmpresaSelecionada.value = []
  pedidoAtual.value.nome_funcionario = ''
}

const selecionarClienteAvulso = () => {
  const clienteAvulso = clientesParaSelecao.value.find((c) => c.nome === 'Cliente Avulso')
  if (clienteAvulso) {
    pedidoAtual.value.cliente = clienteAvulso
    pedidoAtual.value.metodo_pagamento = 'Pago'
  } else {
    $q.notify({ type: 'negative', message: 'Cliente Avulso não encontrado.' })
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

const totalPedido = computed(() => {
  return pedidoAtual.value.itens.reduce(
    (acc, item) => acc + item.preco_unitario_congelado * item.quantidade,
    0,
  )
})

const carregarDadosIniciais = async () => {
  await dataStore.fetchClientes()
  await dataStore.fetchProdutos()
  await dataStore.fetchTransacoesDoDia(dataSelecionada.value)
}

const lancarPedido = async () => {
  if (!pedidoAtual.value.cliente || pedidoAtual.value.itens.length === 0) {
    $q.notify({ type: 'warning', message: 'Selecione um cliente e adicione pelo menos um item.' })
    return
  }

  const novaTransacao = {
    cliente_id: pedidoAtual.value.cliente.id,
    tipo_transacao: 'VENDA',
    valor: totalPedido.value,
    data_transacao: dataSelecionada.value,
    metodo_pagamento: pedidoAtual.value.metodo_pagamento,
    forma_pagamento:
      pedidoAtual.value.metodo_pagamento === 'Pago'
        ? pedidoAtual.value.forma_pagamento_venda
        : null,
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
  funcionariosDaEmpresaSelecionada.value = []
  $q.notify({ type: 'positive', message: 'Lançamento realizado com sucesso!' })
}

const iniciarEdicaoLancamento = async (lancamento) => {
  await dataStore.estornarLancamento(lancamento)
  const clienteParaEditar = dataStore.todosOsClientes.find((c) => c.id === lancamento.cliente_id)

  if (clienteParaEditar && clienteParaEditar.tipo === 'EMPRESA') {
    try {
        const funcionarios = await db.funcionarios.where('cliente_id').equals(clienteParaEditar.id).toArray();
        funcionariosDaEmpresaSelecionada.value = funcionarios.map(f => f.nome);
    } catch (error) {
        console.error("Erro ao buscar funcionários na edição:", error);
    }
  } else {
      funcionariosDaEmpresaSelecionada.value = [];
  }

  pedidoAtual.value.cliente = clienteParaEditar
  pedidoAtual.value.itens = JSON.parse(JSON.stringify(lancamento.itens))
  pedidoAtual.value.metodo_pagamento = lancamento.metodo_pagamento
  pedidoAtual.value.observacoes = lancamento.observacoes || ''
  pedidoAtual.value.nome_funcionario = lancamento.nome_funcionario_empresa || ''
  pedidoAtual.value.forma_pagamento_venda = lancamento.forma_pagamento || ''

  lancamentoEmEdicao.value = lancamento
  $q.notify({ type: 'info', message: 'Lançamento movido para o formulário de edição.' })
}

const estornarLancamento = (lancamento) => {
  acaoPendente.value = async () => {
    await dataStore.estornarLancamento(lancamento)
    $q.notify({ type: 'positive', message: 'Lançamento estornado.' })
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

const revelarResumo = () => {
  if (resumoVisivel.value) {
    resumoVisivel.value = false
    return
  }
  acaoPendente.value = () => {
    resumoVisivel.value = true
  }
  mostrarPinModal.value = true
}

const alternarStatusPagamento = async (lancamento) => {
  if (lancamento.cliente_nome === 'Cliente Avulso') {
    $q.notify({
      type: 'warning',
      message: 'Não é possível alterar o status de pagamento para uma Venda Avulsa.',
    })
    return
  }
  const novoStatus = lancamento.metodo_pagamento === 'Não Pago' ? 'Pago' : 'Não Pago'
  await dataStore.atualizarStatus(lancamento, { metodo_pagamento: novoStatus })
}

const alternarStatusPreparo = async (lancamento) => {
  const novoStatus = lancamento.status_preparo === 'PENDENTE' ? 'PRONTO' : 'PENDENTE'
  await dataStore.atualizarStatus(lancamento, { status_preparo: novoStatus })
}

const atualizarFormaPagamento = async (lancamento, novaForma) => {
  await dataStore.atualizarStatus(lancamento, { forma_pagamento: novaForma })
}

const abrirModalItemAvulso = () => {
  itemAvulso.value = { nome: '', preco: null }
  mostrarModalItemAvulso.value = true
}

const confirmarItemAvulso = () => {
  adicionarItem({
    id: `avulso-${Date.now()}`,
    nome: itemAvulso.value.nome,
    preco: parseFloat(itemAvulso.value.preco),
    produto_id: null,
  })
  mostrarModalItemAvulso.value = false
}

const filterFn = (val, update) => {
  if (val === '') {
    update(() => {
      funcionariosFiltrados.value = funcionariosDaEmpresaSelecionada.value
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    funcionariosFiltrados.value = funcionariosDaEmpresaSelecionada.value.filter(
      v => v.toLowerCase().indexOf(needle) > -1
    )
  })
}

const imprimirComprovante = (lancamento) => {
  const dataImpressao = new Date().toLocaleString('pt-BR')
  const itensHTML = lancamento.itens
    .map(
      (item) => `
      <div class="item-line">
        <span>${item.quantidade}x ${item.nome_produto_congelado} (${item.preco_unitario_congelado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
        <span>${(item.quantidade * item.preco_unitario_congelado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
      </div>
    `,
    )
    .join('')

  const observacoesHTML = lancamento.observacoes
    ? `<div class="section"><strong>Observações:</strong><p>${lancamento.observacoes}</p></div>`
    : ''

  const funcionarioHTML = lancamento.nome_funcionario_empresa
    ? `(${lancamento.nome_funcionario_empresa})`
    : ''

  const comprovanteHTML = `
    <html>
      <head>
        <title>Comprovante</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 300px; font-size: 12px; }
          .header, .footer { text-align: center; }
          .header h3 { margin: 0; }
          .header p { margin: 2px 0; }
          hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
          .section { margin: 10px 0; }
          .item-line { display: flex; justify-content: space-between; }
          .total { font-weight: bold; font-size: 14px; text-align: right; }
          .signature { margin-top: 25px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>${DADOS_RESTAURANTE.nome_fantasia}</h3>
          <p>${DADOS_RESTAURANTE.endereco}</p>
          <p>Telefone: ${DADOS_RESTAURANTE.telefone}</p>
        </div>
        <hr>
        <div class="section">
          <p><strong>COMPROVANTE NÃO FISCAL</strong></p>
          <p>Data: ${dataImpressao}</p>
        </div>
        <hr>
        <div class="section">
          <p><strong>Cliente:</strong> ${lancamento.cliente_nome} ${funcionarioHTML}</p>
        </div>
        <div class="section">
          <strong>Itens:</strong>
          ${itensHTML}
        </div>
        ${observacoesHTML}
        <hr>
        <div class="total">
          <p>TOTAL: ${lancamento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <hr>
        <div class="signature">
            <p>_____________________________</p>
            <p>Assinatura</p>
        </div>
      </body>
    </html>
  `

  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(comprovanteHTML)
  doc.close()
  iframe.contentWindow.focus()
  iframe.contentWindow.print()
  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
}

const imprimirCadernoDoDia = () => {
  if (lancamentosDoDia.value.length === 0) {
    $q.notify({ type: 'warning', message: 'Não há lançamentos para imprimir nesta data.' })
    return
  }
  const dataFormatadaParaPrint = new Date(dataSelecionada.value).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
  })
  const corpoTabela = lancamentosDoDia.value
    .filter((l) => !l.estornado)
    .map((lancamento) => {
      const itensHTML = lancamento.itens
        .map((item) => `<li>${item.quantidade}x ${item.nome_produto_congelado}</li>`)
        .join('')
      return `
        <tr>
          <td>${lancamento.cliente_nome} ${lancamento.nome_funcionario_empresa ? '(' + lancamento.nome_funcionario_empresa + ')' : ''}</td>
          <td><ul>${itensHTML}</ul></td>
          <td>${lancamento.observacoes || ''}</td>
          <td>${lancamento.status_preparo}</td>
          <td>${lancamento.metodo_pagamento} ${lancamento.forma_pagamento ? '(' + lancamento.forma_pagamento + ')' : ''}</td>
          <td>R$ ${lancamento.valor.toFixed(2)}</td>
        </tr>
      `
    })
    .join('')
  const resumoHTML = `
    <div class="resumo-print">
      <p><strong>Total de Vendas:</strong> ${resumoDiario.value.totalVendas}</p>
      <p><strong>Faturamento do Dia:</strong> R$ ${resumoDiario.value.faturamento.toFixed(2)}</p>
    </div>
  `
  const relatorioHTML = `
    <html>
      <head>
        <title>Caderno do Dia - ${dataFormatadaParaPrint}</title>
        <style>
          body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; margin-top: 20px;}
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; } th { background-color: #f2f2f2; }
          ul { margin: 0; padding-left: 15px; } .resumo-print { margin-top: 20px; text-align: right; font-size: 1.2em; }
        </style>
      </head>
      <body>
        <h1>Lançamentos do Dia: ${dataFormatadaParaPrint}</h1>
        <table>
          <thead> <tr> <th>Cliente (Funcionário)</th> <th>Itens</th> <th>Observações</th> <th>Preparo</th> <th>Pagamento</th> <th>Total</th> </tr> </thead>
          <tbody> ${corpoTabela} </tbody>
        </table>
        ${resumoHTML}
      </body>
    </html>
  `
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(relatorioHTML)
  doc.close()
  iframe.contentWindow.focus()
  iframe.contentWindow.print()
  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
}

watch(dataSelecionada, (novaData) => {
  dataStore.fetchTransacoesDoDia(novaData)
  resumoVisivel.value = false
})

onMounted(() => {
  carregarDadosIniciais()
})
</script>

<style scoped>
.estornado-style {
  text-decoration: line-through;
  opacity: 0.7;
}
.opacity-80 {
  opacity: 0.8;
}
</style>