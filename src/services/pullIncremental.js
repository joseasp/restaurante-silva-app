
import { supabase } from '@/services/supabaseClient'
import { db } from '@/services/databaseService'
import { useDataStore } from '@/stores/dataStore'
import { isSameDay } from '@/utils/day'

// Marca como sincronizado agora (veio do servidor)
async function putSynced(table, row) {
  await db[table].put({ ...row, ultima_sincronizacao: new Date() })
}

const TABLES = ['clientes', 'produtos', 'funcionarios', 'transacoes', 'itens_transacao']

function getKey(table) {
  return `lastSeen:${table}`
}

function getLastSeen(table) {
  return localStorage.getItem(getKey(table)) || '1970-01-01T00:00:00Z'
}

function setLastSeen(table, iso) {
  localStorage.setItem(getKey(table), iso)
}

async function pullTable(table) {
  const lastSeen = getLastSeen(table)

  // Paginação simples para evitar baixar de uma vez, caso tenha muito dado
  let page = 0
  const pageSize = 500
  let maxSeen = lastSeen
  let affectedDates = new Set()

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('updated_at', lastSeen)
      .order('updated_at', { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    // Aplica no Dexie
    for (const row of data) {
      if (table === 'clientes') await putSynced('clientes', row)
      if (table === 'produtos') await putSynced('produtos', row)
      if (table === 'funcionarios' && db.funcionarios) await putSynced('funcionarios', row)
      if (table === 'transacoes') {
        await putSynced('transacoes', row)
        if (row.data_transacao) affectedDates.add(row.data_transacao)
      }
      if (table === 'itens_transacao') {
        await putSynced('itens_transacao', row)
        if (row.transacao_id) {
          const t = await db.transacoes.get(row.transacao_id)
          if (t?.data_transacao) affectedDates.add(t.data_transacao)
        }
      }
      if (row.updated_at && row.updated_at > maxSeen) maxSeen = row.updated_at
    }

    if (data.length < pageSize) break
    page++
  }

  if (maxSeen !== lastSeen) setLastSeen(table, maxSeen)

  return affectedDates
}

export async function pullIncrementalAll() {
  if (!navigator.onLine) return
  const store = useDataStore()
  const datesNeedingRefresh = new Set()

  for (const table of TABLES) {
    try {
      const affected = await pullTable(table)
      if (affected && affected.size) {
        for (const d of affected) datesNeedingRefresh.add(d)
      }
      // Se clientes/produtos mudaram, recarrega listas do store
      if (table === 'clientes') await store.fetchClientes()
      if (table === 'produtos') await store.fetchProdutos()
    } catch (e) {
      console.error('Erro no incremental de', table, e)
    }
  }

  // Recarrega apenas o dia selecionado
  for (const dateISO of datesNeedingRefresh) {
    if (isSameDay(store.currentDateISO, dateISO)) {
      await store.fetchTransacoesDoDia(store.currentDateISO)
    }
  }
}

let timer = null
export function startIncrementalPull(intervalMs = 30000) {
  if (timer) return
  pullIncrementalAll()
  timer = setInterval(pullIncrementalAll, intervalMs)
  window.addEventListener('online', () => setTimeout(pullIncrementalAll, 1000))
}

export function stopIncrementalPull() {
  if (timer) clearInterval(timer)
  timer = null
}
