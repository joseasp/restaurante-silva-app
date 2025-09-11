  // Remove campos locais/UI antes de enviar para o Supabase
  function sanitizeForRemote(obj) {
    const {
      ultima_sincronizacao,
      mostrarSeletorFP,
      cliente_nome,
      // adicione aqui quaisquer campos só de UI se existirem
      ...rest
    } = obj || {}
    return rest
  }
// src/stores/dataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue' // Adiciona 'computed'
import { db } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';
import { startRealtime } from '@/services/realtime'
import { startIncrementalPull } from '@/services/pullIncremental'
import { dayKey, isSameDay } from '@/utils/day'

export const useDataStore = defineStore('data', () => {
  // --- ESTADO (STATE) ---
  const todosOsClientes = ref([]) // Armazena TODOS os clientes (ativos e inativos)
  const produtos = ref([])
  const transacoes = ref([])
  const currentDateISO = ref(null)

  function setCurrentDateISO(dateISO) {
    currentDateISO.value = dateISO
  }

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
      const reqDate = dataISO || currentDateISO.value
      if (!currentDateISO.value) currentDateISO.value = reqDate
      const requestKey = dayKey(reqDate)

      const transacoesDoDB = await db.transacoes
        .where({ data_transacao: requestKey, tipo_transacao: 'VENDA' })
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

      // Proteção: só aplica se for o dia selecionado
      if (!isSameDay(currentDateISO.value, requestKey)) return
      transacoes.value = lancamentosCompletos
    } catch (error) {
      console.error('Erro ao buscar transações do dia:', error)
      transacoes.value = []
    }
  }

  function ensureTimestamps(row, { setCreated = false } = {}) {
    const now = new Date().toISOString()
    const out = { ...row }
    if (setCreated && !out.created_at) out.created_at = now
    out.updated_at = now
    return out
  }

  async function lancarPedido(transacao, itens) {
    const transacaoId = uuidv4();
    const now = new Date().toISOString();
    const payloadTransacao = { ...transacao, id: transacaoId, created_at: now, updated_at: now }

    // Salva local
    await db.transacoes.add({ ...payloadTransacao, ultima_sincronizacao: null });
    const itensParaSalvar = itens.map((item) => {
      const { id, ...itemSemId } = item
      return { ...itemSemId, id: uuidv4(), transacao_id: transacaoId, created_at: now, updated_at: now, ultima_sincronizacao: null }
    })
    await db.itens_transacao.bulkAdd(itensParaSalvar)
    await fetchTransacoesDoDia(transacao.data_transacao)

    // Tenta subir na hora (se online). Se falhar, o sync periódico resolve.
    if (navigator.onLine) {
      try {
        const payloadTransacaoRemote = sanitizeForRemote(payloadTransacao)
        const payloadItensRemote = itensParaSalvar.map(sanitizeForRemote)
        await supabase.from('transacoes').upsert([payloadTransacaoRemote])
        if (payloadItensRemote.length) {
          await supabase.from('itens_transacao').upsert(payloadItensRemote)
        }
        // Marca como sincronizado após sucesso
        await db.transacoes.update(transacaoId, { ultima_sincronizacao: new Date() })
        if (itensParaSalvar.length) {
          await db.itens_transacao.bulkUpdate(itensParaSalvar.map((i) => ({ key: i.id, changes: { ultima_sincronizacao: new Date() } })))
        }
      } catch (error) {
        console.warn('Upload imediato falhou', { code: error?.code, message: error?.message, details: error?.details })
      }
    }
  }

  async function estornarLancamento(lancamento) {
    const now = new Date().toISOString();
    await db.transacoes.update(lancamento.id, { estornado: true, updated_at: now, ultima_sincronizacao: null })
    await fetchTransacoesDoDia(lancamento.data_transacao)
    if (navigator.onLine) {
      try {
        await supabase.from('transacoes').update({ estornado: true, updated_at: now }).eq('id', lancamento.id)
        await db.transacoes.update(lancamento.id, { ultima_sincronizacao: new Date() })
      } catch (e) {
        console.debug('Falha no upload imediato do estorno', e?.message || e)
      }
    }
  }

  async function atualizarStatus(lancamento, updates) {
    const now = new Date().toISOString();
    await db.transacoes.update(lancamento.id, { ...updates, updated_at: now, ultima_sincronizacao: null })
    await fetchTransacoesDoDia(lancamento.data_transacao)
    if (navigator.onLine) {
      try {
        await supabase.from('transacoes').update({ ...updates, updated_at: now }).eq('id', lancamento.id)
        await db.transacoes.update(lancamento.id, { ultima_sincronizacao: new Date() })
      } catch (e) {
        console.debug('Falha no upload imediato do status', e?.message || e)
      }
    }
  }

  let isSyncRunning = false
  async function syncData() {
    if (!navigator.onLine || isSyncRunning) return
    isSyncRunning = true
    try {
      const needsSend = (row) => {
        const u = row.updated_at ? new Date(row.updated_at).getTime() : 0
        const s = row.ultima_sincronizacao ? new Date(row.ultima_sincronizacao).getTime() : 0
        return s === 0 || u > s
      }

      const clientesParaSync = await db.clientes.filter(needsSend).toArray()
      if (clientesParaSync.length) {
        const payload = clientesParaSync.map(({ ultima_sincronizacao, ...rest }) => ensureTimestamps(rest, { setCreated: true }))
        const { error } = await supabase.from('clientes').upsert(payload)
        if (!error) await db.clientes.bulkUpdate(clientesParaSync.map((c) => ({ key: c.id, changes: { ultima_sincronizacao: new Date() } })))
      }

      const produtosParaSync = await db.produtos.filter(needsSend).toArray()
      if (produtosParaSync.length) {
        const payload = produtosParaSync.map(({ ultima_sincronizacao, ...rest }) => ensureTimestamps(rest, { setCreated: true }))
        const { error } = await supabase.from('produtos').upsert(payload)
        if (!error) await db.produtos.bulkUpdate(produtosParaSync.map((p) => ({ key: p.id, changes: { ultima_sincronizacao: new Date() } })))
      }

      if (db.funcionarios) {
        const funcionariosParaSync = await db.funcionarios.filter(needsSend).toArray()
        if (funcionariosParaSync.length) {
          const payload = funcionariosParaSync.map(({ ultima_sincronizacao, ...rest }) => ensureTimestamps(rest, { setCreated: true }))
          const { error } = await supabase.from('funcionarios').upsert(payload)
          if (!error) await db.funcionarios.bulkUpdate(funcionariosParaSync.map((f) => ({ key: f.id, changes: { ultima_sincronizacao: new Date() } })))
        }
      }

      const transacoesParaSync = await db.transacoes.filter(needsSend).toArray()
      if (transacoesParaSync.length) {
        const payload = transacoesParaSync.map(({ ultima_sincronizacao, ...rest }) => ensureTimestamps(rest, { setCreated: true }))
        const { error } = await supabase.from('transacoes').upsert(payload)
        if (!error) await db.transacoes.bulkUpdate(transacoesParaSync.map((t) => ({ key: t.id, changes: { ultima_sincronizacao: new Date() } })))
      }

      const itensParaSync = await db.itens_transacao.filter(needsSend).toArray()
      if (itensParaSync.length) {
        const payload = itensParaSync.map(({ ultima_sincronizacao, ...rest }) => ensureTimestamps(rest, { setCreated: true }))
        const { error } = await supabase.from('itens_transacao').upsert(payload)
        if (!error) await db.itens_transacao.bulkUpdate(itensParaSync.map((i) => ({ key: i.id, changes: { ultima_sincronizacao: new Date() } })))
      }
    } catch (e) {
      console.debug('Sync falhou temporariamente, tentará depois...', e?.message || e)
    } finally {
      isSyncRunning = false
    }
  }

  async function criarClienteAvulsoPadrao() {
    const clienteAvulsoExiste = await db.clientes.where('nome').equalsIgnoreCase('Cliente Avulso').first();
    if (!clienteAvulsoExiste) {
      console.log("Criando 'Cliente Avulso' padrão...");
      try {
        await db.clientes.add({
          id: uuidv4(),
          nome: 'Cliente Avulso',
          tipo: 'AVULSO',
          ativo: true,
        });
      } catch (error) {
        if (error.name !== 'ConstraintError') {
          console.error('Erro ao criar cliente avulso:', error);
        }
      }
    }
  }

  async function restaurarBackupDaNuvem() {
  console.log("Banco de dados local vazio. Tentando restaurar da nuvem...");
  let sucessoGeral = true;

  const restaurarTabela = async (nomeTabela, dbTable) => {
    try {
      const { data, error } = await supabase.from(nomeTabela).select('*');
      if (error) throw error;
      if (data.length > 0) {
        await dbTable.bulkPut(data.map(d => ({ ...d, ultima_sincronizacao: new Date() })));
        console.log(`${data.length} registros restaurados para '${nomeTabela}'.`);
      }
    } catch (error) {
      console.error(`Falha ao restaurar tabela '${nomeTabela}':`, error);
      sucessoGeral = false;
    }
  };

  await restaurarTabela('clientes', db.clientes);
  await restaurarTabela('produtos', db.produtos);
  await restaurarTabela('transacoes', db.transacoes);
  await restaurarTabela('itens_transacao', db.itens_transacao);
  await restaurarTabela('funcionarios', db.funcionarios);
  
  console.log(`Restauração da nuvem concluída. Sucesso: ${sucessoGeral}`);
  return sucessoGeral;
}

  async function initialize() {
    console.log("Inicializando o Data Store...");
    
    const contagemClientes = await db.clientes.count();
    
    // Lógica crucial:
    // 1. Verifica se o banco local está vazio.
    if (contagemClientes === 0) {
      console.log("Banco local vazio detectado.");
      
      // 2. Tenta restaurar da nuvem.
      const restauradoComSucesso = await restaurarBackupDaNuvem();
      
      // 3. SOMENTE se a restauração falhar (ex: primeiro uso, sem internet),
      //    cria os dados padrão.
      if (!restauradoComSucesso) {
        console.log("Restauração falhou ou não havia dados. Criando padrões.");
        await criarClienteAvulsoPadrao();
      }
    }

    // 4. Após garantir que os dados locais existem (seja por restauração ou criação),
    //    carrega-os para a memória da aplicação.

    await fetchClientes();
    await fetchProdutos();

    // LIGA O REALTIME
    startRealtime();

    // 5. Inicia a rotina de sincronização de UPLOAD.
    console.log("Iniciando a primeira sincronização de upload.");
    await syncData();
    setInterval(syncData, 120000); // E a cada 2 minutos

    // Listener para reconexão
    window.addEventListener('online', () => { setTimeout(syncData, 1000); });

    // Refresh incremental inteligente
    startIncrementalPull(30000);
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
    currentDateISO,
    // Ações
    fetchClientes,
    fetchProdutos,
    initialize,
    fetchTransacoesDoDia,
    lancarPedido,
    estornarLancamento,
    atualizarStatus,
    syncData,
    restaurarBackupDaNuvem,
    setCurrentDateISO,
  }
})