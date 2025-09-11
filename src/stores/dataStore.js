// src/stores/dataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue' // Adiciona 'computed'
import { db } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js'
import { v4 as uuidv4 } from 'uuid'
import { getCurrentTimestamp } from '@/utils/day.js'
import { setupRealtimeSync, updateSelectedDay, setRealtimeEventHandlers } from '@/services/realtime.js'
import { startIncrementalPull } from '@/services/pullIncremental.js'

export const useDataStore = defineStore('data', () => {
  // --- ESTADO (STATE) ---
  const todosOsClientes = ref([]) // Armazena TODOS os clientes (ativos e inativos)
  const produtos = ref([])
  const transacoes = ref([])
  const currentSelectedDay = ref(null) // Track selected day for realtime filtering
  const syncStatus = ref({ uploading: false, lastUpload: null, lastPull: null })

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
          const itens = await db['itens_transacao'].where('transacao_id').equals(t.id).toArray()
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
    const now = getCurrentTimestamp()
    const transacaoId = uuidv4()
    
    // Add timestamps to the transaction
    const transacaoCompleta = {
      ...transacao,
      id: transacaoId,
      created_at: now,
      updated_at: now
    }
    
    // Save locally first for offline-first behavior
    await db.transacoes.add(transacaoCompleta)
    
    const itensParaSalvar = itens.map((item) => {
      return {
        ...item,
        id: uuidv4(),
        transacao_id: transacaoId,
        created_at: now,
        updated_at: now
      }
    })
    
    await db['itens_transacao'].bulkAdd(itensParaSalvar)
    
    // Immediate upload (offline-first with immediate sync)
    uploadTransactionImmediately(transacaoCompleta, itensParaSalvar)
    
    // Refresh UI data
    await fetchTransacoesDoDia(transacao.data_transacao)
  }

  async function estornarLancamento(lancamento) {
    const now = getCurrentTimestamp()
    const updates = { 
      estornado: true,
      updated_at: now
    }
    
    // Update locally first
    await db.transacoes.update(lancamento.id, updates)
    
    // Immediate upload
    uploadRecordUpdate('transacoes', lancamento.id, updates)
    
    await fetchTransacoesDoDia(lancamento.data_transacao)
  }

  async function atualizarStatus(lancamento, updates) {
    const now = getCurrentTimestamp()
    const updatesWithTimestamp = {
      ...updates,
      updated_at: now
    }
    
    // Update locally first
    await db.transacoes.update(lancamento.id, updatesWithTimestamp)
    
    // Immediate upload
    uploadRecordUpdate('transacoes', lancamento.id, updatesWithTimestamp)
    
    await fetchTransacoesDoDia(lancamento.data_transacao)
  }

  /**
   * Upload a specific transaction immediately (offline-first behavior)
   */
  async function uploadTransactionImmediately(transacao, itens) {
    try {
      // Sanitize payload - remove UI-specific fields
      const cleanTransacao = sanitizeRecord(transacao)
      const cleanItens = itens.map(sanitizeRecord)
      
      // Upload transaction
      const { error: transacaoError } = await supabase
        .from('transacoes')
        .upsert(cleanTransacao)
      
      if (transacaoError) throw transacaoError
      
      // Upload items
      if (cleanItens.length > 0) {
        const { error: itensError } = await supabase
          .from('itens_transacao')
          .upsert(cleanItens)
        
        if (itensError) throw itensError
      }
      
      // Mark as synchronized
      const now = getCurrentTimestamp()
      await db.transacoes.update(transacao.id, { ultima_sincronizacao: now })
      
      for (const item of itens) {
        await db['itens_transacao'].update(item.id, { ultima_sincronizacao: now })
      }
      
      console.log(`✅ Transaction ${transacao.id} uploaded immediately`)
      syncStatus.value.lastUpload = now
      
    } catch (error) {
      console.warn('Immediate upload failed (will retry on next sync):', error.message)
    }
  }

  /**
   * Upload a record update immediately
   */
  async function uploadRecordUpdate(tableName, recordId, updates) {
    try {
      const cleanUpdates = sanitizeRecord(updates)
      
      const { error } = await supabase
        .from(tableName)
        .update(cleanUpdates)
        .eq('id', recordId)
      
      if (error) throw error
      
      // Mark as synchronized
      const dbTable = getDbTable(tableName)
      const now = getCurrentTimestamp()
      await dbTable.update(recordId, { ultima_sincronizacao: now })
      
      console.log(`✅ ${tableName}/${recordId} updated immediately`)
      syncStatus.value.lastUpload = now
      
    } catch (error) {
      console.warn('Immediate update failed (will retry on next sync):', error.message)
    }
  }

  /**
   * Sanitize record by removing UI-specific fields
   */
  function sanitizeRecord(record) {
    // eslint-disable-next-line no-unused-vars
    const { 
      ultima_sincronizacao, 
      mostrarSeletorFP, 
      cliente_nome,
      itens,
       
      ...cleanRecord 
    } = record
    return cleanRecord
  }

  /**
   * Get database table by name
   */
  function getDbTable(tableName) {
    const tableMap = {
      clientes: db.clientes,
      produtos: db.produtos,
      transacoes: db.transacoes,
      itens_transacao: db['itens_transacao'],
      funcionarios: db.funcionarios
    }
    return tableMap[tableName]
  }

  /**
   * Background sync - safety net for missed uploads (every 2 minutes)
   */
  async function backgroundSync() {
    if (syncStatus.value.uploading) return
    
    syncStatus.value.uploading = true
    
    try {
      const tables = [
        { name: 'clientes', db: db.clientes },
        { name: 'produtos', db: db.produtos },
        { name: 'funcionarios', db: db.funcionarios },
        { name: 'transacoes', db: db.transacoes },
        { name: 'itens_transacao', db: db['itens_transacao'] }
      ]
      
      let totalUploaded = 0
      
      for (const { name, db: dbTable } of tables) {
        const recordsToSync = await dbTable.filter(r => !r.ultima_sincronizacao).toArray()
        
        if (recordsToSync.length > 0) {
          const cleanPayload = recordsToSync.map(sanitizeRecord)
          
          const { error } = await supabase.from(name).upsert(cleanPayload)
          
          if (error) {
            console.warn(`Background sync failed for ${name}:`, error.message)
            continue
          }
          
          // Mark as synchronized
          const now = getCurrentTimestamp()
          await dbTable.bulkUpdate(
            recordsToSync.map(r => ({ 
              key: r.id, 
              changes: { ultima_sincronizacao: now } 
            }))
          )
          
          totalUploaded += recordsToSync.length
          console.log(`📤 Background sync: ${recordsToSync.length} ${name} uploaded`)
        }
      }
      
      if (totalUploaded > 0) {
        console.log(`📤 Background sync completed: ${totalUploaded} total records`)
        syncStatus.value.lastUpload = getCurrentTimestamp()
      }
      
    } catch (error) {
      console.error('Background sync failed:', error)
    } finally {
      syncStatus.value.uploading = false
    }
  }

  /**
   * Set the selected day and update realtime filtering
   */
  function setSelectedDay(dayISO) {
    currentSelectedDay.value = dayISO
    updateSelectedDay(dayISO)
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
    console.log("Banco de dados local vazio. Tentando restaurar da nuvem...")
    let sucessoGeral = true

    const restaurarTabela = async (nomeTabela, dbTable) => {
      try {
        const { data, error } = await supabase.from(nomeTabela).select('*')
        if (error) throw error
        if (data.length > 0) {
          // Mark restored data as synchronized
          const dataWithSync = data.map(d => ({ 
            ...d, 
            ultima_sincronizacao: getCurrentTimestamp() 
          }))
          await dbTable.bulkPut(dataWithSync)
          console.log(`${data.length} registros restaurados para '${nomeTabela}'.`)
        }
      } catch (error) {
        console.warn(`Falha ao restaurar tabela '${nomeTabela}':`, error.message)
        sucessoGeral = false
      }
    }

    await restaurarTabela('clientes', db.clientes)
    await restaurarTabela('produtos', db.produtos)
    await restaurarTabela('transacoes', db.transacoes)
    await restaurarTabela('itens_transacao', db.itens_transacao)
    await restaurarTabela('funcionarios', db.funcionarios)
    
    console.log(`Restauração da nuvem concluída. Sucesso: ${sucessoGeral}`)
    return sucessoGeral
  }

  async function initialize() {
    console.log("Inicializando o Data Store...")
    
    const contagemClientes = await db.clientes.count()
    
    // 1. Verifica se o banco local está vazio.
    if (contagemClientes === 0) {
      console.log("Banco local vazio detectado.")
      
      // 2. Tenta restaurar da nuvem.
      const restauradoComSucesso = await restaurarBackupDaNuvem()
      
      // 3. SOMENTE se a restauração falhar (ex: primeiro uso, sem internet),
      //    cria os dados padrão.
      if (!restauradoComSucesso) {
        console.log("Restauração falhou ou não havia dados. Criando padrões.")
        await criarClienteAvulsoPadrao()
      }
    }

    // 4. Após garantir que os dados locais existem, carrega-os para a memória da aplicação.
    await fetchClientes()
    await fetchProdutos()

    // 5. Setup realtime subscriptions
    setupRealtimeSync()
    
    // Set realtime event handlers to refresh UI data when needed
    setRealtimeEventHandlers({
      onInsert: (tableName) => {
        if (tableName === 'transacoes' && currentSelectedDay.value) {
          fetchTransacoesDoDia(currentSelectedDay.value)
        } else if (['clientes', 'produtos', 'funcionarios'].includes(tableName)) {
          if (tableName === 'clientes') fetchClientes()
          if (tableName === 'produtos') fetchProdutos()
        }
      },
      onUpdate: (tableName) => {
        if (tableName === 'transacoes' && currentSelectedDay.value) {
          fetchTransacoesDoDia(currentSelectedDay.value)
        } else if (['clientes', 'produtos', 'funcionarios'].includes(tableName)) {
          if (tableName === 'clientes') fetchClientes()
          if (tableName === 'produtos') fetchProdutos()
        }
      },
      onDelete: (tableName) => {
        if (tableName === 'transacoes' && currentSelectedDay.value) {
          fetchTransacoesDoDia(currentSelectedDay.value)
        } else if (['clientes', 'produtos', 'funcionarios'].includes(tableName)) {
          if (tableName === 'clientes') fetchClientes()
          if (tableName === 'produtos') fetchProdutos()
        }
      }
    })

    // 6. Start incremental pull service (every 30 seconds)
    startIncrementalPull(30)

    // 7. Start background sync as safety net (every 2 minutes)
    console.log("Iniciando sincronização de segurança a cada 2 minutos...")
    setInterval(backgroundSync, 120000)

    console.log("🚀 Offline-first realtime system initialized!")
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
    syncStatus,
    // Ações
    fetchClientes,
    fetchProdutos,
    initialize,
    fetchTransacoesDoDia,
    lancarPedido,
    estornarLancamento,
    atualizarStatus,
    backgroundSync,
    restaurarBackupDaNuvem,
    setSelectedDay,
    uploadTransactionImmediately,
    uploadRecordUpdate
  }
})