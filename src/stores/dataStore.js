import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js'
import { v4 as uuidv4 } from 'uuid'

// Um único canal global
let produtosChannel = null

// Debug opcional
if (typeof window !== 'undefined') {
  window.__sb = supabase
  const host =
    (supabase?.restUrl && new URL(supabase.restUrl).host) ||
    (supabase?.supabaseUrl && new URL(supabase.supabaseUrl).host) ||
    ''
  console.log('[RT] Supabase URL:', host)
}

export const useDataStore = defineStore('data', () => {
  // STATE
  const todosOsClientes = ref([])
  const produtos = ref([])
  const transacoes = ref([])

  const loading = ref(false)
  const erroCarregamento = ref(null)
  const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // GETTERS
  const clientesAtivos = computed(() => todosOsClientes.value.filter((c) => c.ativo !== false))
  const produtosAtivos = computed(() => produtos.value.filter((p) => p.ativo !== false))

  // UTILS
  function normalizeNome(s) {
    return String(s || '').trim().replace(/\s+/g, ' ')
  }
  function keyFromNome(s) {
    return normalizeNome(s).toLowerCase()
  }
  function toNumber(val) {
    if (typeof val === 'string') return Number(val.replace(',', '.'))
    return Number(val)
  }

  // Reconcilia id local <-> id oficial da nuvem após upsert/select
  async function reconciliarLocalComServidor(localId, serverRow) {
    const serverId = serverRow?.id
    if (!serverId) return
    if (localId && localId !== serverId) {
      const local = await db.produtos.get(localId)
      if (local) {
        const { id, ...rest } = local
        await db.produtos.delete(localId)
        await db.produtos.put({ ...rest, id: serverId, ultima_sincronizacao: new Date() })
      }
    } else {
      await db.produtos.update(serverId, { ultima_sincronizacao: new Date() })
    }
  }

  function dedupPorNome(lista) {
    const map = new Map()
    for (const p of lista) {
      const k = keyFromNome(p.nome)
      if (!k) continue
      map.set(k, p) // mantém o último
    }
    return Array.from(map.values())
  }

  // LOAD LOCAL
  async function fetchClientes() {
    try {
      todosOsClientes.value = await db.clientes.toArray()
    } catch (error) {
      console.error('Erro ao buscar clientes no store:', error)
      todosOsClientes.value = []
    }
  }
  async function fetchProdutos() {
    try {
      produtos.value = await db.produtos.toArray()
    } catch (error) {
      console.error('Erro ao buscar produtos no store:', error)
      produtos.value = []
    }
  }

  // TRANSACOES (mantidas)
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

  // REALTIME PRODUTOS (dedupe por nome)
  function startRealtimeProdutos() {
    try {
      if (produtosChannel) return
      console.log('[RT] Iniciando canal realtime de produtos...')
      produtosChannel = supabase
        .channel('public:produtos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'produtos' },
          async (payload) => {
            try {
              if (payload.eventType === 'DELETE') {
                const id = payload.old?.id
                if (id) await db.produtos.delete(id)
              } else {
                const row = payload.new
                if (row?.id) {
                  // Remove locais com mesmo nome e id diferente
                  const existentesMesmoNome = await db.produtos
                    .where('nome')
                    .equalsIgnoreCase(row.nome)
                    .toArray()
                  for (const e of existentesMesmoNome) {
                    if (e.id !== row.id) await db.produtos.delete(e.id)
                  }
                  await db.produtos.put({ ...row, ultima_sincronizacao: new Date() })
                }
              }
              await fetchProdutos()
            } catch (e) {
              console.error('Erro aplicando evento de produtos:', e)
            }
          },
        )
        .subscribe((status) => {
          console.log('[RT] Canal produtos status:', status)
        })
    } catch (e) {
      console.error('Erro ao iniciar realtime de produtos:', e)
    }
  }

  // PRODUTOS: CRUD com reconciliação de ID
  async function adicionarProduto({ nome, preco, funcionario }) {
    const nomeTrim = normalizeNome(nome)
    const precoNum = toNumber(preco)
    if (!nomeTrim) throw new Error('Nome e preço são obrigatórios.')
    if (!Number.isFinite(precoNum) || precoNum <= 0) throw new Error('Preço inválido.')

    const idLocal = uuidv4()
    const agora = new Date()

    // Local primeiro
    await db.produtos.add({
      id: idLocal,
      nome: nomeTrim,
      preco: precoNum,
      ativo: true,
      funcionario_cadastro: funcionario || null, // só Dexie
      created_at: agora,
      updated_at: agora,
      ultima_sincronizacao: null,
    })
    await fetchProdutos()

    // Nuvem com onConflict + select para pegar ID oficial
    const { data, error } = await supabase
      .from('produtos')
      .upsert(
        [
          {
            id: idLocal,
            nome: nomeTrim,
            preco: precoNum,
            ativo: true,
            created_at: agora.toISOString(),
            updated_at: agora.toISOString(),
          },
        ],
        { onConflict: 'nome' },
      )
      .select()

    if (error) {
      console.error('[UPSERT produtos] erro:', error)
      return
    }

    const serverRow = Array.isArray(data) ? data[0] : null
    if (serverRow) {
      await reconciliarLocalComServidor(idLocal, serverRow)
      const existentesMesmoNome = await db.produtos.where('nome').equalsIgnoreCase(serverRow.nome).toArray()
      for (const e of existentesMesmoNome) {
        if (e.id !== serverRow.id) await db.produtos.delete(e.id)
      }
      await db.produtos.put({ ...serverRow, ultima_sincronizacao: new Date() })
      await fetchProdutos()
    }
  }

  async function atualizarProduto({ id, nome, preco, ativo = true }) {
    if (!id) throw new Error('ID inválido.')
    const agora = new Date()

    const changes = { updated_at: agora, ultima_sincronizacao: null }
    if (nome !== undefined) {
      const nomeTrim = normalizeNome(nome)
      if (!nomeTrim) throw new Error('Nome do produto é obrigatório.')
      changes.nome = nomeTrim
    }
    if (preco !== undefined) {
      const precoNum = toNumber(preco)
      if (!Number.isFinite(precoNum) || precoNum <= 0) throw new Error('Preço inválido.')
      changes.preco = precoNum
    }
    if (ativo !== undefined) changes.ativo = !!ativo

    await db.produtos.update(id, changes)
    await fetchProdutos()

    const payload = { id, updated_at: agora.toISOString() }
    if ('nome' in changes) payload.nome = changes.nome
    if ('preco' in changes) payload.preco = changes.preco
    if ('ativo' in changes) payload.ativo = changes.ativo

    const { data, error } = await supabase.from('produtos').upsert([payload], { onConflict: 'nome' }).select()
    if (error) {
      console.error('[UPSERT produtos] erro:', error)
      return
    }
    const serverRow = Array.isArray(data) ? data[0] : null
    if (serverRow) {
      await reconciliarLocalComServidor(id, serverRow)
      const existentesMesmoNome = await db.produtos.where('nome').equalsIgnoreCase(serverRow.nome).toArray()
      for (const e of existentesMesmoNome) {
        if (e.id !== serverRow.id) await db.produtos.delete(e.id)
      }
      await db.produtos.put({ ...serverRow, ultima_sincronizacao: new Date() })
      await fetchProdutos()
    }
  }

  async function excluirProduto(produtoOuId) {
    const id = typeof produtoOuId === 'object' ? produtoOuId?.id : produtoOuId
    if (!id) throw new Error('Produto inválido.')
    const agora = new Date()

    await db.produtos.update(id, { ativo: false, updated_at: agora, ultima_sincronizacao: null })
    await fetchProdutos()

    const { data, error } = await supabase
      .from('produtos')
      .upsert([{ id, ativo: false, updated_at: agora.toISOString() }], { onConflict: 'nome' })
      .select()
    if (error) {
      console.error('[UPSERT produtos] erro:', error)
      return
    }
    const serverRow = Array.isArray(data) ? data[0] : null
    if (serverRow) {
      await reconciliarLocalComServidor(id, serverRow)
      await db.produtos.put({ ...serverRow, ultima_sincronizacao: new Date() })
      await fetchProdutos()
    }
  }

  async function reativarProduto(id) {
    if (!id) throw new Error('ID inválido.')
    await db.produtos.update(id, { ativo: true, ultima_sincronizacao: null })
    await fetchProdutos()
    const { data, error } = await supabase
      .from('produtos')
      .upsert([{ id, ativo: true, updated_at: new Date().toISOString() }], { onConflict: 'nome' })
      .select()
    if (error) {
      console.error('[UPSERT produtos] erro:', error)
      return
    }
    const serverRow = Array.isArray(data) ? data[0] : null
    if (serverRow) {
      await reconciliarLocalComServidor(id, serverRow)
      await db.produtos.put({ ...serverRow, ultima_sincronizacao: new Date() })
      await fetchProdutos()
    }
  }

  // SYNC
  async function enviarProdutosPendentes() {
    const pendentes = await db.produtos.filter((p) => !p.ultima_sincronizacao).toArray()
    if (pendentes.length === 0) return 0

    const dedup = dedupPorNome(pendentes)
    const payload = dedup.map(({ ultima_sincronizacao, funcionario_cadastro, ...rest }) => rest)

    const { data, error } = await supabase.from('produtos').upsert(payload, { onConflict: 'nome' }).select()
    if (error) throw error

    const mapaServer = new Map((data || []).map((r) => [keyFromNome(r.nome), r]))
    for (const local of dedup) {
      const server = mapaServer.get(keyFromNome(local.nome))
      if (server) {
        await reconciliarLocalComServidor(local.id, server)
        const existentesMesmoNome = await db.produtos.where('nome').equalsIgnoreCase(server.nome).toArray()
        for (const e of existentesMesmoNome) {
          if (e.id !== server.id) await db.produtos.delete(e.id)
        }
        await db.produtos.put({ ...server, ultima_sincronizacao: new Date() })
      }
    }
    await fetchProdutos()
    return dedup.length
  }

  async function recarregarProdutosDaNuvem() {
    const { data, error } = await supabase.from('produtos').select('*')
    if (error) throw error
    if (Array.isArray(data) && data.length) {
      const vistos = new Set()
      for (const row of data) {
        const k = keyFromNome(row.nome)
        if (vistos.has(k)) continue
        vistos.add(k)
        // remove duplicados locais por nome
        const existentes = await db.produtos.where('nome').equalsIgnoreCase(row.nome).toArray()
        for (const e of existentes) {
          if (e.id !== row.id) await db.produtos.delete(e.id)
        }
        await db.produtos.put({ ...row, ultima_sincronizacao: new Date() })
      }
    }
    await fetchProdutos()
  }

  async function sincronizarProdutosAgora() {
    try {
      await enviarProdutosPendentes().catch((e) => {
        console.error('Falha ao enviar pendentes:', e)
        return 0 // baixa mesmo assim
      })
      await recarregarProdutosDaNuvem()
      return true
    } catch (e) {
      console.error('Falha ao sincronizar produtos agora:', e)
      try {
        await recarregarProdutosDaNuvem()
      } catch {}
      return false
    }
  }

  async function syncData() {
    try {
      // Clientes
      const clientesPend = await db.clientes.filter((c) => !c.ultima_sincronizacao).toArray()
      if (clientesPend.length) {
        const payload = clientesPend.map(({ ultima_sincronizacao, ...rest }) => rest)
        const { error } = await supabase.from('clientes').upsert(payload)
        if (error) throw error
        await db.clientes.bulkUpdate(
          clientesPend.map((c) => ({ key: c.id, changes: { ultima_sincronizacao: new Date() } })),
        )
        console.log(`[SYNC] Clientes sincronizados: ${clientesPend.length}`)
      }

      // Produtos
      await enviarProdutosPendentes()

      // Transações
      const transPend = await db.transacoes.filter((t) => !t.ultima_sincronizacao).toArray()
      if (transPend.length) {
        const payload = transPend.map(({ ultima_sincronizacao, ...rest }) => rest)
        const { error } = await supabase.from('transacoes').upsert(payload)
        if (error) throw error
        await db.transacoes.bulkUpdate(
          transPend.map((t) => ({ key: t.id, changes: { ultima_sincronizacao: new Date() } })),
        )
        console.log(`[SYNC] Transações sincronizadas: ${transPend.length}`)
      }

      // Itens de transação
      const itensPend = await db.itens_transacao.filter((i) => !i.ultima_sincronizacao).toArray()
      if (itensPend.length) {
        const payload = itensPend.map(({ ultima_sincronizacao, ...rest }) => rest)
        const { error } = await supabase.from('itens_transacao').upsert(payload)
        if (error) throw error
        await db.itens_transacao.bulkUpdate(
          itensPend.map((i) => ({ key: i.id, changes: { ultima_sincronizacao: new Date() } })),
        )
        console.log(`[SYNC] Itens sincronizados: ${itensPend.length}`)
      }

      console.log('[SYNC] Concluída.')
    } catch (error) {
      console.error('[SYNC] ERRO:', error)
    }
  }

  // BACKUP/RESTORE
  async function criarClienteAvulsoPadrao() {
    const clienteAvulsoExiste = await db.clientes.where('nome').equalsIgnoreCase('Cliente Avulso').first()
    if (!clienteAvulsoExiste) {
      try {
        await db.clientes.add({
          id: uuidv4(),
          nome: 'Cliente Avulso',
          tipo: 'AVULSO',
          ativo: true,
        })
      } catch (error) {
        if (error.name !== 'ConstraintError') console.error('Erro ao criar cliente avulso:', error)
      }
    }
  }
  async function restaurarBackupDaNuvem() {
    console.log('Banco local vazio. Tentando restaurar da nuvem...')
    let sucessoGeral = true
    const restaurar = async (nomeTabela, dbTable) => {
      try {
        const { data, error } = await supabase.from(nomeTabela).select('*')
        if (error) throw error
        if (Array.isArray(data) && data.length) {
          await dbTable.bulkPut(data.map((d) => ({ ...d, ultima_sincronizacao: new Date() })))
          console.log(`${data.length} registros restaurados: ${nomeTabela}`)
        }
      } catch (e) {
        console.error(`Falha ao restaurar '${nomeTabela}':`, e)
        sucessoGeral = false
      }
    }
    await restaurar('clientes', db.clientes)
    await restaurar('produtos', db.produtos)
    await restaurar('transacoes', db.transacoes)
    await restaurar('itens_transacao', db.itens_transacao)
    await restaurar('funcionarios', db.funcionarios)
    console.log(`Restauração concluída. Sucesso: ${sucessoGeral}`)
    return sucessoGeral
  }

  // INITIALIZE
  async function initialize() {
    loading.value = true
    erroCarregamento.value = null
    try {
      const contagemClientes = await db.clientes.count()
      if (contagemClientes === 0) {
        const restaurado = await restaurarBackupDaNuvem()
        if (!restaurado) await criarClienteAvulsoPadrao()
      }

      await fetchClientes()
      await fetchProdutos()

      // Realtime
      startRealtimeProdutos()

      // Sincroniza e agenda
      await syncData()
      setInterval(syncData, 120000)
    } catch (e) {
      erroCarregamento.value = e
      console.error('Falha ao inicializar data store:', e)
    } finally {
      loading.value = false
    }
  }

  // Opcional: expõe util de fix forte
  async function reconciliarProdutosForte() {
    const { data, error } = await supabase.from('produtos').select('*')
    if (error) { console.error(error); return false }
    await db.produtos.clear()
    const agora = new Date()
    for (const row of data || []) {
      await db.produtos.put({ ...row, ultima_sincronizacao: agora })
    }
    await fetchProdutos()
    console.log('[FIX] Reconciliação forte concluída:', (data || []).length)
    return true
  }
  if (typeof window !== 'undefined') {
    window.__startRT = startRealtimeProdutos
    window.__fixProdutos = reconciliarProdutosForte
  }

  // RETURN
  return {
    // state
    todosOsClientes,
    produtos,
    transacoes,
    loading,
    erroCarregamento,
    online,

    // getters
    clientesAtivos,
    produtosAtivos,

    // ações base
    fetchClientes,
    fetchProdutos,

    // produtos
    adicionarProduto,
    atualizarProduto,
    excluirProduto,
    reativarProduto,
    enviarProdutosPendentes,
    recarregarProdutosDaNuvem,
    sincronizarProdutosAgora,

    // transações
    fetchTransacoesDoDia,
    lancarPedido,
    estornarLancamento,
    atualizarStatus,

    // sync/restore/boot
    syncData,
    restaurarBackupDaNuvem,
    initialize,
  }
})
