
import { supabase } from '@/services/supabaseClient'
import { db } from '@/services/databaseService'
import { useDataStore } from '@/stores/dataStore'
import { isSameDay, dayKey } from '@/utils/day'

// Marca como sincronizado agora (veio do servidor)
async function putWithSyncedFlag(table, row) {
  await db[table].put({ ...row, ultima_sincronizacao: new Date() })
}

function subscribeTable(table, onChange) {
  const channel = supabase
    .channel(`public:${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      async (payload) => {
        try {
          // Diminui barulho: mude para console.debug se preferir
          console.debug('RT', table, payload.eventType, payload.new?.id || payload.old?.id)
          if (payload.eventType === 'DELETE') {
            await db[table].delete(payload.old.id)
          } else {
            await putWithSyncedFlag(table, payload.new)
          }
          await onChange?.(table, payload)
        } catch (err) {
          console.warn(`Erro ao processar Realtime de ${table}`, err?.message || err)
        }
      },
    )
    .subscribe((status) => {
      console.debug(`Realtime ${table}:`, status)
    })

  return channel
}

export function startRealtime() {
  const store = useDataStore()

  const onChange = async (table, payload) => {
    // Atualiza listas em memória quando necessário
    if (table === 'clientes') await store.fetchClientes()
    if (table === 'produtos') await store.fetchProdutos()

    // Proteção: só recarrega se for o dia selecionado
    if (table === 'transacoes') {
      const dateISO = payload.new?.data_transacao || payload.old?.data_transacao
      if (dateISO && isSameDay(store.currentDateISO, dateISO)) {
        await store.fetchTransacoesDoDia(store.currentDateISO)
      }
    }
    if (table === 'itens_transacao') {
      const transacaoId = payload.new?.transacao_id || payload.old?.transacao_id
      if (transacaoId) {
        const t = await db.transacoes.get(transacaoId)
        if (t?.data_transacao && isSameDay(store.currentDateISO, t.data_transacao)) {
          await store.fetchTransacoesDoDia(store.currentDateISO)
        }
      }
    }
  }

  const tables = ['clientes', 'produtos', 'funcionarios', 'transacoes', 'itens_transacao']
  const channels = tables.map((t) => subscribeTable(t, onChange))

  function stopRealtime() {
    for (const ch of channels) supabase.removeChannel(ch)
  }

  return { stopRealtime }
}
