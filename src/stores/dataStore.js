// src/stores/dataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { liveQuery } from 'dexie'
import { db } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js'
import { v4 as uuidv4 } from 'uuid'
import { setupRealtimeProducts } from '@/composables/useRealtimeProducts'

// Util: aceita vírgula em preço
function toNumber(val) {
  if (typeof val === 'string') return Number(val.replace(',', '.'))
  return Number(val)
}

// Guardas para evitar múltiplas assinaturas
let produtosRealtimeChannel = null
let produtosSubscription = null

export const useDataStore = defineStore('data', () => {
  // Estado
  const todosOsClientes = ref([])
  const produtos = ref([])
  const transacoes = ref([])

  const loading = ref(false)
  const erroCarregamento = ref(null)
  const online = ref(navigator.onLine)

  // Getters
  const clientesAtivos = computed(() => todosOsClientes.value.filter((c) => c.ativo !== false))
  const produtosAtivos = computed(() => produtos.value.filter((p) => p.ativo !== false))

  // Carregamentos locais
  async function fetchClientes() {
    try {
      todosOsClientes.value = await db.clientes.toArray()
    } catch (error) {
      console.error('Erro ao buscar clientes no IndexedDB:', error)
      todosOsClientes.value = []
    }
  }

  async function fetchProdutos() {
    try {
      produtos.value = await db.produtos.toArray()
    } catch (error) {
      console.error('Erro ao buscar produtos no IndexedDB:', error)
      produtos.value = []
    }
  }

  // Assinatura live do IndexedDB para Produtos (resolve “sumir no F5”)
  function startProdutosSubscription() {
    if (produtosSubscription) return

    // Pré-carrega imediatamente o que já existe local
    db.produtos
      .toArray()
      .then((rows) => {
        console.log('[LIVE] Pré-carregado do IndexedDB:', rows.length)
        produtos.value = rows
      })
      .catch((err) => console.error('Falha no pré-carregamento de produtos:', err))

    // Qualquer mudança no IndexedDB reflete na UI
    produtosSubscription = liveQuery(() => db.produtos.toArray()).subscribe({
      next: (rows) => {
        produtos.value = rows
      },
      error: (err) => {
        console.error('LiveQuery produtos erro:', err)
      },
    })
  }

  // CRUD Produtos (offline-first + envio em background)
  async function adicionarProduto(payload) {
    const nome = (payload?.nome || '').trim()
    const preco = toNumber(payload?.preco)
    if (!nome) throw new Error('Nome do produto é obrigatório.')
    if (!Number.isFinite(preco) || preco <= 0) throw new Error('Preço inválido.')

    // Evita duplicado ativo
    const existente = await db.produtos.where('nome').equalsIgnoreCase(nome).first()
    if (existente && existente.ativo !== false) {
      throw new Error('Já existe um produto ativo com esse nome.')
    }

    const novo = { id: uuidv4(), nome, preco, ativo: true, ultima_sincronizacao: null }
    await db.produtos.add(novo)

    // NOVO: atualiza a lista já na hora
    await fetchProdutos()

    // Envio best-effort (não bloqueia UI). Não mandar ultima_sincronizacao.
    supabase
      .from('produtos')
      .upsert([{ id: novo.id, nome: novo.nome, preco: novo.preco, ativo: true }])
      .then(({ error }) => {
        if (!error) db.produtos.update(novo.id, { ultima_sincronizacao: new Date() })
      })
      .catch((e) => console.warn('Upsert em background falhou (adicionarProduto):', e))

    return novo
  }

  async function atualizarProduto(payload) {
    const id = payload?.id
    if (!id) throw new Error('ID do produto é obrigatório.')

    const update = { ultima_sincronizacao: null }
    if (payload.nome !== undefined) {
      const nome = String(payload.nome).trim()
      if (!nome) throw new Error('Nome do produto é obrigatório.')
      const existente = await db.produtos.where('nome').equalsIgnoreCase(nome).first()
      if (existente && existente.id !== id && existente.ativo !== false) {
        throw new Error('Já existe um produto ativo com esse nome.')
      }
      update.nome = nome
    }
    if (payload.preco !== undefined) {
      const preco = toNumber(payload.preco)
      if (!Number.isFinite(preco) || preco <= 0) throw new Error('Preço inválido.')
      update.preco = preco
    }

    // Atualiza LOCAL primeiro
    await db.produtos.update(id, update)

    // NOVO: atualiza a lista já na hora
    await fetchProdutos()

    // Envia para a nuvem SEM ultima_sincronizacao
    const { ultima_sincronizacao: _omit, ...payloadForSupabase } = update
    supabase
      .from('produtos')
      .upsert([{ id, ...payloadForSupabase }])
      .then(({ error }) => {
        if (error) {
          console.error('Falha no upsert Supabase (atualizarProduto):', error)
          return
        }
        db.produtos.update(id, { ultima_sincronizacao: new Date() })
      })
      .catch((e) => console.error('Exceção no upsert Supabase (atualizarProduto):', e))
  }

  async function excluirProduto(produtoOuId) {
    const id = typeof produtoOuId === 'object' ? produtoOuId?.id : produtoOuId
    if (!id) throw new Error('ID do produto é obrigatório.')

    await db.produtos.update(id, { ativo: false, ultima_sincronizacao: null })

    // NOVO: atualiza a lista já na hora
    await fetchProdutos()

    supabase
      .from('produtos')
      .upsert([{ id, ativo: false }])
      .then(({ error }) => {
        if (!error) db.produtos.update(id, { ultima_sincronizacao: new Date() })
      })
      .catch((e) => console.warn('Upsert em background falhou (excluirProduto):', e))
  }

  async function reativarProduto(id) {
    if (!id) throw new Error('ID do produto é obrigatório.')
    await db.produtos.update(id, { ativo: true, ultima_sincronizacao: null })

    // NOVO: atualiza a lista já na hora
    await fetchProdutos()

    supabase
      .from('produtos')
      .upsert([{ id, ativo: true }])
      .then(({ error }) => {
        if (!error) db.produtos.update(id, { ultima_sincronizacao: new Date() })
      })
      .catch((e) => console.warn('Upsert em background falhou (reativarProduto):', e))
  }

  // Sincronização manual
  async function enviarProdutosPendentes() {
    const pendentes = await db.produtos.filter((p) => !p.ultima_sincronizacao).toArray()
    console.log('[SYNC] Pendentes:', pendentes.length)
    if (pendentes.length === 0) return 0

    const payload = pendentes.map(({ ultima_sincronizacao, ...rest }) => rest)
    const { error } = await supabase.from('produtos').upsert(payload)
    if (error) {
      console.error('[SYNC] Erro ao enviar pendentes:', error)
      throw error
    }

    await db.produtos.bulkUpdate(
      pendentes.map((p) => ({ key: p.id, changes: { ultima_sincronizacao: new Date() } })),
    )
    console.log('[SYNC] Envio concluído:', pendentes.length)
    return pendentes.length
  }

  async function recarregarProdutosDaNuvem() {
    try {
      console.log('[SYNC] Baixando produtos da nuvem...')
      const { data, error } = await supabase.from('produtos').select('*')
      if (error) throw error

      const qtNuvem = data?.length ?? 0
      console.log(`[SYNC] Recebidos da nuvem: ${qtNuvem}`)

      if (qtNuvem) {
        for (const row of data) {
          await db.produtos.put({ ...row, ultima_sincronizacao: new Date() })
        }
      }

      const locais = await db.produtos.count()
      console.log(`[SYNC] Total local após mesclagem: ${locais}`)
      await fetchProdutos() // garante atualização da UI
    } catch (e) {
      console.error('Erro ao recarregar produtos da nuvem:', e)
      throw new Error('Falha ao recarregar produtos da nuvem.')
    }
  }

  async function sincronizarProdutosAgora() {
    const qtd = await enviarProdutosPendentes().catch((e) => {
      console.error('Falha ao enviar pendentes:', e)
      return 0
    })
    await recarregarProdutosDaNuvem()
    return qtd
  }

  // Transações (mantidas)
  async function fetchTransacoesDoDia(dataISO) {
    try {
      const transacoesDoDB = await db.transacoes
        .where({ data_transacao: dataISO, tipo_transacao: 'VENDA' })
        .toArray()

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
    const transacaoId = uuidv4()
    await db.transacoes.add({ ...transacao, id: transacaoId })
    const itensParaSalvar = itens.map((item) => {
      const { id, ...itemSemId } = item
      return { ...itemSemId, id: uuidv4(), transacao_id: transacaoId }
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

  // Sync em lote (mantido como stub)
  async function syncData() {
    return // PAUSADO
  }

  // Backup/Restauração
  async function criarClienteAvulsoPadrao() {
    const clienteAvulsoExiste = await db.clientes.where('nome').equalsIgnoreCase('Cliente Avulso').first()
    if (!clienteAvulsoExiste) {
      try {
        await db.clientes.add({ id: uuidv4(), nome: 'Cliente Avulso', tipo: 'AVULSO', ativo: true })
      } catch (error) {
        if (error.name !== 'ConstraintError') console.error('Erro ao criar cliente avulso:', error)
      }
    }
  }

  async function restaurarBackupDaNuvem() {
    console.log('Banco local vazio. Tentando restaurar da nuvem...')
    let sucessoGeral = true

    const restaurarTabela = async (nomeTabela, dbTable) => {
      try {
        const { data, error } = await supabase.from(nomeTabela).select('*')
        if (error) throw error
        if (data.length > 0) {
          await dbTable.bulkPut(data.map((d) => ({ ...d, ultima_sincronizacao: new Date() })))
          console.log(`${data.length} registros restaurados para '${nomeTabela}'.`)
        }
      } catch (error) {
        console.error(`Falha ao restaurar tabela '${nomeTabela}':`, error)
        sucessoGeral = false
      }
    }

    await restaurarTabela('clientes', db.clientes)
    await restaurarTabela('produtos', db.produtos)
    await restaurarTabela('transacoes', db.transacoes)
    await restaurarTabela('itens_transacao', db.itens_transacao)
    await restaurarTabela('funcionarios', db.funcionarios)

    console.log(`Restauração concluída. Sucesso: ${sucessoGeral}`)
    return sucessoGeral
  }

  async function restaurarProdutosSeVazio() {
    const count = await db.produtos.count()
    if (count > 0) return true
    try {
      const { data, error } = await supabase.from('produtos').select('*')
      if (error) throw error
      if (data && data.length > 0) {
        await db.produtos.bulkPut(data.map((d) => ({ ...d, ultima_sincronizacao: new Date() })))
        console.log(`${data.length ?? 0} produtos restaurados da nuvem.`)
      }
      return true
    } catch (e) {
      console.error('Falha ao restaurar produtos da nuvem:', e)
      return false
    }
  }

  // Network: ao ficar online, sincroniza automaticamente
  function setupNetworkWatch() {
    online.value = navigator.onLine
    window.addEventListener('online', async () => {
      online.value = true
      try {
        await enviarProdutosPendentes()
        await recarregarProdutosDaNuvem()
      } catch (e) {
        console.error('Falha na sincronização ao voltar online:', e)
      }
    })
    window.addEventListener('offline', () => (online.value = false))
  }

  // Initialize (ordem importante)
  async function initialize() {
    loading.value = true
    try {
      setupNetworkWatch()

      const contagemClientes = await db.clientes.count()
      if (contagemClientes === 0) {
        const restauradoComSucesso = await restaurarBackupDaNuvem()
        if (!restauradoComSucesso) await criarClienteAvulsoPadrao()
      }

      // 1) Assina IndexedDB e carrega local
      startProdutosSubscription()
      await fetchClientes()
      await fetchProdutos()

      // 2) Se produtos estiver vazio, tenta restaurar
      await restaurarProdutosSeVazio()

      // 3) Mescla novidades da nuvem (não apaga local)
      await recarregarProdutosDaNuvem()

      // 4) Liga Realtime para receber alterações de outros dispositivos
      if (!produtosRealtimeChannel) {
        try {
          produtosRealtimeChannel = setupRealtimeProducts()
        } catch (e) {
          console.error('Falha ao iniciar Realtime de produtos:', e)
        }
      }
    } finally {
      loading.value = false
    }
  }

  // Retorno do store
  return {
    // Listas
    todosOsClientes,
    produtos,
    transacoes,
    // Computeds
    clientesAtivos,
    produtosAtivos,
    // Estados
    loading,
    erroCarregamento,
    online,

    // Ações públicas
    initialize,
    fetchClientes,
    fetchProdutos,
    fetchTransacoesDoDia,

    // Produtos
    adicionarProduto,
    atualizarProduto,
    excluirProduto,
    reativarProduto,

    // Sync
    enviarProdutosPendentes,
    recarregarProdutosDaNuvem,
    sincronizarProdutosAgora,

    // Outros
    lancarPedido,
    estornarLancamento,
    atualizarStatus,
    syncData,
    restaurarBackupDaNuvem,
    restaurarProdutosSeVazio,
  }
})
