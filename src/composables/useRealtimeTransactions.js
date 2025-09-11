// src/composables/useRealtimeTransactions.js

import { ref, toValue } from 'vue'
import { liveQuery } from 'dexie'
import { db } from '@/services/databaseService.js'
import { useObservable } from '@vueuse/rxjs'

export function useRealtimeTransactions(dataSelecionadaRef) {
  const loading = ref(true)
  const error = ref(null)

  const observable = liveQuery(async () => {
    loading.value = true
    const dataFiltro = toValue(dataSelecionadaRef)
    if (!dataFiltro) {
      loading.value = false
      return []
    }

    const [transacoesDoDia, clientes, todosOsItens] = await Promise.all([
      // A busca inicial não precisa de ordenação, pois faremos isso no código.
      db.transacoes.where('data_transacao').equals(dataFiltro).toArray(),
      db.clientes.toArray(),
      db.itens_transacao.toArray(),
    ])

    const mapaClientes = new Map(clientes.map((c) => [c.id, c.nome]))
    const mapaItens = new Map()
    for (const item of todosOsItens) {
      if (!mapaItens.has(item.transacao_id)) {
        mapaItens.set(item.transacao_id, [])
      }
      mapaItens.get(item.transacao_id).push(item)
    }

    const transacoesCompletas = transacoesDoDia.map((transacao) => {
      const cliente_nome = mapaClientes.get(transacao.cliente_id) || 'Cliente Desconhecido'
      const itens = mapaItens.get(transacao.id) || []
      return { ...transacao, itens, cliente_nome }
    })

    // <<< AQUI ESTÁ A NOVA LÓGICA DE ORDENAÇÃO >>>
    transacoesCompletas.sort((a, b) => {
      // Regra 1: Prioridade do Status de Preparo (PENDENTE vem antes de PRONTO)
      if (a.status_preparo === 'PENDENTE' && b.status_preparo !== 'PENDENTE') return -1
      if (a.status_preparo !== 'PENDENTE' && b.status_preparo === 'PENDENTE') return 1

      // Regra 2: Prioridade de Data (O mais antigo primeiro)
      // Se ambos tiverem o mesmo status, o mais antigo (menor data/hora) vem primeiro.
      const dataA = new Date(a.created_at)
      const dataB = new Date(b.created_at)
      return dataA - dataB // Compara as datas. Se A for mais antigo, o resultado é negativo.
    })

    loading.value = false
    return transacoesCompletas
  })

  const transactions = useObservable(observable, { initialValue: [] })

  return { transactions, loading, error }
}
