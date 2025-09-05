// src/stores/dataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue' // Adiciona 'computed'
import { db } from '@/services/databaseService.js'

export const useDataStore = defineStore('data', () => {
  // --- ESTADO (STATE) ---
  const todosOsClientes = ref([]) // Armazena TODOS os clientes (ativos e inativos)
  const produtos = ref([])
  const transacoes = ref([])

  // --- GETTERS (COMPUTED) ---
  // Propriedade computada que deriva a lista de ativos da lista principal
  const clientesAtivos = computed(() => todosOsClientes.value.filter((c) => c.ativo !== false))
  // Os produtos também podem ter um computed para consistência
  const produtosAtivos = computed(() => produtos.value.filter((p) => p.ativo !== false))

  // --- AÇÕES (ACTIONS) ---

  async function fetchClientes() {
    try {
      // Agora, esta função busca TODOS os clientes, sem filtrar.
      todosOsClientes.value = await db.clientes.toArray()
    } catch (error) {
      console.error('Erro CRÍTICO ao buscar clientes no store:', error)
      todosOsClientes.value = []
    }
  }

  async function fetchProdutos() {
    try {
      // Esta função também deve buscar TODOS os produtos.
      produtos.value = await db.produtos.toArray()
    } catch (error) {
      console.error('Erro CRÍTICO ao buscar produtos no store:', error)
      produtos.value = []
    }
  }

  async function fetchTransacoesDoDia(dataISO) {
    try {
      const transacoesDoDB = await db.transacoes
        .where({ data_transacao: dataISO, tipo_transacao: 'VENDA' })
        .toArray()

      // Usa a lista completa de clientes para encontrar o nome, mesmo que inativo
      const clientesCarregados = todosOsClientes.value

      const lancamentosCompletos = await Promise.all(
        transacoesDoDB.map(async (t) => {
          const itens = await db.itens_transacao.where('transacao_id').equals(t.id).toArray()
          const cliente = clientesCarregados.find((c) => c.id === t.cliente_id)
          return {
            ...t,
            itens,
            cliente_nome: cliente ? cliente.nome : 'Cliente Avulso',
            mostrarSeletorFP: false,
          }
        }),
      )

      lancamentosCompletos.sort((a, b) => {
        if (a.estornado && !b.estornado) return 1
        if (!a.estornado && b.estornado) return -1
        if (!a.estornado) {
          if (a.status_preparo === 'PENDENTE' && b.status_preparo === 'PRONTO') return -1
          if (a.status_preparo === 'PRONTO' && b.status_preparo === 'PENDENTE') return 1
        }
        return (a.id || 0) - (b.id || 0)
      })

      transacoes.value = lancamentosCompletos
    } catch (error) {
      console.error('Erro ao buscar transações do dia:', error)
      transacoes.value = []
    }
  }

  async function lancarPedido(transacao, itens) {
    const transacaoId = await db.transacoes.add(transacao)
    const itensParaSalvar = itens.map((item) => {
      const { id, ...itemSemId } = item
      return { ...itemSemId, transacao_id: transacaoId }
    })
    await db.itens_transacao.bulkAdd(itensParaSalvar)
    await fetchTransacoesDoDia(transacao.data_transacao)
  }

  async function estornarLancamento(lancamento) {
    await db.transacoes.update(lancamento.id, { estornado: true })
    await fetchTransacoesDoDia(lancamento.data_transacao)
  }

  async function atualizarStatus(lancamento, updates) {
    await db.transacoes.update(lancamento.id, updates)
    await fetchTransacoesDoDia(lancamento.data_transacao)
  }

  async function initialize() {
    await fetchClientes()
    await fetchProdutos()
    const clienteAvulsoExiste = todosOsClientes.value.some((c) => c.nome === 'Cliente Avulso')

    if (!clienteAvulsoExiste) {
      console.log("Criando 'Cliente Avulso' padrão...")
      try {
        await db.clientes.add({
          nome: 'Cliente Avulso',
          tipo: 'AVULSO',
          ativo: true,
        })
        await fetchClientes()
      } catch (error) {
        if (error.name !== 'ConstraintError') {
          console.error('Erro ao criar cliente avulso:', error)
        }
      }
    }
  }

  // --- RETORNO ---
  return {
    // Listas completas
    todosOsClientes,
    produtos,
    // Listas computadas (filtradas)
    clientesAtivos,
    produtosAtivos,
    // Outros estados
    transacoes,
    // Ações
    fetchClientes,
    fetchProdutos,
    initialize,
    fetchTransacoesDoDia,
    lancarPedido,
    estornarLancamento,
    atualizarStatus,
  }
})
